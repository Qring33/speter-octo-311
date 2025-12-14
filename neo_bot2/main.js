const { firefox } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const gaming = require("./gaming.js");

const PARALLEL_JOBS = 2; // <==== CHANGE THIS TO 5, 10, ETC
const LAUNCH_DELAY_MS = 1000;

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
  if (!fs.existsSync(runningAccountsFile)) {
    resetRunningAccounts();
  }

  let accounts;
  try {
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  } catch {
    resetRunningAccounts();
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    resetRunningAccounts();
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  }

  const index = Math.floor(Math.random() * accounts.length);
  const acc = accounts[index];

  accounts.splice(index, 1);
  fs.writeFileSync(runningAccountsFile, JSON.stringify(accounts, null, 2));

  return acc;
}

// =========================
// SINGLE JOB
// =========================
async function runJob(jobId) {
  let acc;

  try {
    acc = getAndConsumeAccount();
  } catch {
    console.log(`[JOB ${jobId}] Failed to obtain account.`);
    return;
  }

  console.log(`[JOB ${jobId}] Using account: ${acc.username}`);

  try {
    const sessionFolder = path.join(__dirname, "session");
    const sessionFile = path.join(sessionFolder, `${acc.username}.json`);

    if (!fs.existsSync(sessionFile)) {
      console.log(`[JOB ${jobId}] No session, running login.js`);
      execSync(`node login.js ${acc.username}`, { stdio: "inherit" });

      if (!fs.existsSync(sessionFile)) {
        console.log(`[JOB ${jobId}] Login failed, aborting job`);
        return;
      }
    }

    const profilePath = path.join(__dirname, "browser_profile", acc.username);
    if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

    const browser = await firefox.launchPersistentContext(profilePath, {
      headless: false,
      userAgent: acc.user_agent,
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: null
    });

    let page = browser.pages()[0];
    if (!page) page = await browser.newPage();

    try {
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
    } catch {}

    const targetURL = "https://www.neobux.com/c/";
    await page.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (!page.url().startsWith(targetURL)) {
      console.log(`[JOB ${jobId}] Session invalid, relogging`);
      execSync(`node login.js ${acc.username}`, { stdio: "inherit" });

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

      await page.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 30000 });
    }

    // =========================
    // BALANCE
    // =========================
    try {
      await page.waitForSelector("#t_saldo span", { timeout: 15000 });

      const balance = await page.evaluate(() => {
        const el = document.querySelector("#t_saldo span");
        return el ? el.textContent.trim() : null;
      });

      if (balance) {
        const balanceFile = path.join(accountsDir, "balance.json");
        let data = {};

        if (fs.existsSync(balanceFile)) {
          try {
            data = JSON.parse(fs.readFileSync(balanceFile, "utf8"));
          } catch {}
        }

        data[acc.username] = balance;
        fs.writeFileSync(balanceFile, JSON.stringify(data, null, 2));
      }
    } catch {}

    // =========================
    // RUN GAME
    // =========================
    await gaming(page);

    // =========================
    // SAVE COOKIES
    // =========================
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
    } catch {}

    await new Promise(r => setTimeout(r, 2000));
    await browser.close();

    console.log(`[JOB ${jobId}] Completed successfully`);
  } catch (err) {
    console.log(`[JOB ${jobId}] Failed: ${err.message}`);
  }
}

// =========================
// PARALLEL LAUNCHER
// =========================
(async () => {
  resetRunningAccounts();

  const jobs = [];

  for (let i = 0; i < PARALLEL_JOBS; i++) {
    jobs.push(runJob(i + 1));
    await new Promise(r => setTimeout(r, LAUNCH_DELAY_MS));
  }

  await Promise.allSettled(jobs);
  console.log("All jobs finished.");
})();