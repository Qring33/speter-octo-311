const { firefox } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const execPromise = util.promisify(exec);

(async () => {
  const sourcePath = path.join(__dirname, '../Creator', 'tempmail_accounts.json');
  const destPath = path.join(__dirname, 'tempmail_accounts.json');
  const renamedPath = path.join(__dirname, 'tempmail_1.json');
  const githubUrl = 'https://raw.githubusercontent.com/henrygreen311/speter-octo/main/Creator/tempmail_accounts.json';
  let accounts;
  let browser;
  let context;

  // === Helper to download from GitHub ===
  async function downloadFromGitHub(url, destination) {
    console.log(`Downloading tempmail_accounts.json from GitHub...`);
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(destination);
      https.get(url, response => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download file: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Downloaded tempmail_accounts.json successfully.');
          resolve();
        });
      }).on('error', err => {
        fs.unlink(destination);
        reject(err);
      });
    });
  }

  try {
    // === Load or Copy Accounts ===
    try {
      let data;
      try {
        data = await fs.readFile(renamedPath, 'utf8');
        console.log('Loaded existing tempmail_1.json');
      } catch {
        data = await fs.readFile(destPath, 'utf8');
        console.log('Loaded existing tempmail_accounts.json');
      }
      accounts = JSON.parse(data);
    } catch (error) {
      console.log('No local tempmail file found. Attempting GitHub download...');
      try {
        await downloadFromGitHub(githubUrl, sourcePath);
        console.log('Downloaded and saved to Creator/tempmail_accounts.json');
      } catch (err) {
        console.error('GitHub download failed:', err.message);
        throw new Error('Unable to fetch tempmail_accounts.json from GitHub.');
      }

      await fs.copyFile(sourcePath, renamedPath);
      const data = await fs.readFile(renamedPath, 'utf8');
      accounts = JSON.parse(data);
      console.log('Copied and renamed Creator/tempmail_accounts.json ➜ tempmail_1.json');
    }

    // === Filter valid accounts ===
    let validAccounts = Object.values(accounts).filter(a => a.register === 'yes');

    if (validAccounts.length === 0) {
      console.log('No accounts with register: yes found. Re-downloading tempmail_accounts.json...');
      await downloadFromGitHub(githubUrl, sourcePath);
      await fs.copyFile(sourcePath, renamedPath);
      const data = await fs.readFile(renamedPath, 'utf8');
      accounts = JSON.parse(data);
      console.log('Successfully re-downloaded and copied tempmail_accounts.json ➜ tempmail_1.json');

      validAccounts = Object.values(accounts).filter(a => a.register === 'yes');
      if (validAccounts.length === 0) throw new Error('Still no valid accounts after downloading.');
    }

    const randomIndex = Math.floor(Math.random() * validAccounts.length);
    const selectedAccount = validAccounts[randomIndex];
    console.log(`Randomly selected account #${randomIndex + 1} of ${validAccounts.length}`);
    console.log('Selected email:', selectedAccount.address);
    console.log('Selected password:', selectedAccount.password);

    delete accounts[selectedAccount.address];
    await fs.writeFile(renamedPath, JSON.stringify(accounts, null, 2));

    // === Load random user-agent ===
    let userAgent;
    try {
      const userAgents = await fs.readFile(path.join(__dirname, '../Creator', 'user_agents.txt'), 'utf8');
      const list = userAgents.split('\n').filter(u => u.trim());
      userAgent = list[Math.floor(Math.random() * list.length)];
      console.log('Selected user agent:', userAgent);
    } catch (error) {
      throw new Error('Error reading user_agents.txt: ' + error.message);
    }

    // === Browser setup ===
    browser = await firefox.launch({ headless: false });
    context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: true,
      bypassCSP: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    const page = await context.newPage();

    await page.route('**/*', async route => {
      await new Promise(res => setTimeout(res, Math.random() * 100));
      route.continue();
    });

    // === Authentication process ===
    console.log('Navigating to Audius sign-in...');
    await page.goto('https://audius.co/signin', { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[aria-label="Email"]', selectedAccount.address);
    await page.fill('input[aria-label="Password"]', selectedAccount.password);

    console.log('Waiting 1s before clicking Sign In...');
    await page.waitForTimeout(1000);
    await page.click('//*[@id="root"]/div[1]/div/div[1]/div/form/div[4]/button');

    try {
      await page.waitForURL('https://audius.co/signin/confirm-email', { waitUntil: 'load', timeout: 60000 });
      console.log('Reached confirm-email page. Waiting 2s before retrieving OTP...');
      await page.waitForTimeout(2000);
    } catch {
      console.warn('Warning: Timeout waiting for confirm-email page, continuing anyway.');
    }

    console.log('Running tempmail.py to retrieve OTP...');
    const { stdout } = await execPromise(`python3 ../Creator/tempmail.py inbox ${selectedAccount.address}`);
    const otpMatch = stdout.match(/\d{3}\s\d{3}/);
    if (!otpMatch) throw new Error('OTP not found in tempmail.py output');
    const otp = otpMatch[0];
    console.log('Retrieved OTP:', otp);

    await page.fill('input[aria-label="Code"]', otp);
    console.log('Waiting 1s before confirming OTP...');
    await page.waitForTimeout(1000);
    await page.click('//*[@id="root"]/div[1]/div/div[1]/form/div[3]/button');

    try {
      await page.waitForURL('https://audius.co/feed', { waitUntil: 'load', timeout: 60000 });
      console.log('Successfully reached feed page.');
    } catch (error) {
      const currentUrl = page.url();
      if (!currentUrl.includes('https://audius.co/feed')) throw new Error('Failed to reach feed page.');
    }

    // === Navigate to target URL ===
    const targetUrl = (await fs.readFile(path.join(__dirname, 'url_1.txt'), 'utf8')).trim();
    if (!targetUrl.startsWith('http')) throw new Error('Invalid URL in url_1.txt');
    console.log('Navigating to target URL:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });

    console.log(' Script completed successfully.');

  } catch (error) {
    console.error(' Script encountered an error:', error);
  } finally {
    // === Graceful shutdown ===
    if (context) {
      try {
        await context.close();
        console.log('Context closed.');
      } catch (err) {
        console.warn('Error closing context:', err.message);
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed.');
      } catch (err) {
        console.warn('Error closing browser:', err.message);
      }
    }
    console.log(' Cleanup complete. Exiting process.');
    process.exit(0);
  }
})();