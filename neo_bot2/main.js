const { firefox } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const gaming = require("./gaming.js");

const accountsDir = path.join(__dirname, "neobux_accounts");
const sourceAccountsFile = path.join(accountsDir, "neobux_accounts.json");
const runningAccountsFile = path.join(accountsDir, "running_accounts.json");

// =========================
// INIT / RESET RUNNING POOL
// =========================
function resetRunningAccounts() {
  if (!fs.existsSync(sourceAccountsFile)) {
    console.log("Source accounts file missing. Exiting.");
    process.exit(0);
  }

  fs.copyFileSync(sourceAccountsFile, runningAccountsFile);
  console.log("Running accounts reset from source.");
}

// =========================
// GET & CONSUME ACCOUNT
// =========================
function getAndConsumeAccount() {
  let accounts = [];

  if (fs.existsSync(runningAccountsFile)) {
    try {
      accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
    } catch {
      console.log("Failed to parse running accounts. Resetting...");
      resetRunningAccounts();
      accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
    }
  } else {
    resetRunningAccounts();
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.log("No more accounts available.");
    process.exit(0);
  }

  const index = Math.floor(Math.random() * accounts.length);
  const acc = accounts[index];

  accounts.splice(index, 1);
  fs.writeFileSync(runningAccountsFile, JSON.stringify(accounts, null, 2));

  // Run upload.js immediately after consuming an account
  try {
    console.log(`[ACCOUNT ${acc.username}] Running upload.js`);
    execSync(`node upload.js ${acc.username}`, { stdio: "inherit" });
  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] upload.js failed: ${err.message}`);
  }

  return acc;
}

// =========================
// SINGLE JOB (SEQUENTIAL ONLY)
// =========================
async function runJob() {
  const acc = getAndConsumeAccount();
  console.log(`Using account: ${acc.username}`);

  const sessionFolder = path.join(__dirname, "session");
  const sessionFile = path.join(sessionFolder, `${acc.username}.json`);
  const profilePath = path.join(__dirname, "browser_profile", acc.username);

  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  let browser = null;
  let page = null;
  let usedExistingSession = false;

  try {
    // === STEP 1: Try to use existing session first ===
    if (fs.existsSync(sessionFile)) {
      console.log(`Session file found for ${acc.username}. Loading session...`);

      browser = await firefox.launchPersistentContext(profilePath, {
        headless: false,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();

      // Load saved cookies
      const cookies = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      await browser.addCookies(
        cookies.map(c => {
          delete c.sameParty;
          delete c.priority;
          delete c.sourceScheme;
          delete c.sourcePort;
          delete c.partitionKey;
          return c;
        })
      );

      // Go directly to dashboard (do NOT reload or refresh aggressively)
      await page.goto("https://www.neobux.com/c/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      // Small delay to let page settle
      await new Promise(r => setTimeout(r, 3000));

      // Check if we are logged in
      const isLoggedIn = await page.evaluate(() => {
        const balanceEl = document.querySelector("#t_saldo span");
        const usernameEl = document.querySelector("a[href*='/m/u/']");
        const loginForm = document.querySelector("form[action='/l/']");
        return (balanceEl || usernameEl) && !loginForm;
      });

      if (isLoggedIn) {
        console.log(`Session is valid! Skipping login.js for ${acc.username}`);
        usedExistingSession = true;
      } else {
        console.log(`Session expired or invalid. Closing and falling back to login.js`);
        await browser.close();
        browser = null;
        page = null;
      }
    } else {
      console.log(`No session file found for ${acc.username}`);
    }

    // === STEP 2: If no valid session, run login.js ===
    if (!usedExistingSession) {
      console.log(`Running login.js for ${acc.username} to create fresh session...`);
      try {
        execSync(`node login.js ${acc.username}`, { stdio: "inherit" });
      } catch (err) {
        console.log(`login.js failed for ${acc.username}. Skipping this account.`);
        return;
      }

      // Small delay after login.js closes its browser
      await new Promise(r => setTimeout(r, 4000));

      // Now re-launch our own browser and load the freshly saved cookies
      browser = await firefox.launchPersistentContext(profilePath, {
        headless: false,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();

      const cookies = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      await browser.addCookies(
        cookies.map(c => {
          delete c.sameParty;
          delete c.priority;
          delete c.sourceScheme;
          delete c.sourcePort;
          delete c.partitionKey;
          return c;
        })
      );

      await page.goto("https://www.neobux.com/c/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await new Promise(r => setTimeout(r, 4000));
    }

    // === BALANCE CHECK ===
    try {
      await page.waitForSelector("#t_saldo span", { timeout: 20000 });
      const balance = await page.evaluate(() => {
        const el = document.querySelector("#t_saldo span");
        return el ? el.textContent.trim() : null;
      });
      if (balance) {
        const balanceFile = path.join(accountsDir, "balance.json");
        let data = {};
        if (fs.existsSync(balanceFile)) {
          try { data = JSON.parse(fs.readFileSync(balanceFile, "utf8")); } catch {}
        }
        data[acc.username] = balance;
        fs.writeFileSync(balanceFile, JSON.stringify(data, null, 2));
        console.log(`Balance for ${acc.username}: ${balance}`);
      }
    } catch (e) {
      console.log(`Could not retrieve balance for ${acc.username} - may still be loading`);
    }

    // === RUN GAME ===
    try {
      console.log(`Starting gaming module for ${acc.username}...`);
      await gaming(page);
    } catch (err) {
      console.log(`Gaming failed for ${acc.username}: ${err.message}`);
    }

    // === SAVE COOKIES (refresh session at the end) ===
    try {
      const cookies = await browser.cookies();
      fs.writeFileSync(
        sessionFile,
        JSON.stringify(
          cookies.map(c => {
            delete c.sameParty;
            delete c.priority;
            delete c.sourceScheme;
            delete c.sourcePort;
            delete c.partitionKey;
            return c;
          }),
          null,
          2
        )
      );
      console.log(`Session refreshed and saved for ${acc.username}`);
    } catch (e) {
      console.log(`Failed to save session for ${acc.username}: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 3000));
    await browser.close();

    console.log(`Completed successfully for ${acc.username}`);
  } catch (err) {
    console.log(`Unexpected error for ${acc.username}: ${err.message}`);
    if (browser) await browser.close().catch(() => {});
  }
}

// =========================
// MAIN (SEQUENTIAL - ONE ACCOUNT AT A TIME)
// =========================
(async () => {
  if (!fs.existsSync(runningAccountsFile) || JSON.parse(fs.readFileSync(runningAccountsFile, "utf8")).length === 0) {
    resetRunningAccounts();
  }

  while (true) {
    let remaining = [];
    try {
      remaining = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
    } catch {
      console.log("Error reading running accounts. Resetting...");
      resetRunningAccounts();
      remaining = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
    }

    if (!Array.isArray(remaining) || remaining.length === 0) {
      console.log("No more accounts to process.");
      break;
    }

    await runJob();

    // Delay between accounts to be safe
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log("All accounts processed.");
})();