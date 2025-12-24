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

      await new Promise(r => setTimeout(r, 3000));

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

    if (!usedExistingSession) {
      console.log(`Running login.js for ${acc.username} to create fresh session...`);
      try {
        execSync(`node login.js ${acc.username}`, { stdio: "inherit" });
      } catch {
        console.log(`login.js failed for ${acc.username}. Skipping this account.`);
        return;
      }

      await new Promise(r => setTimeout(r, 4000));

      browser = await firefox.launchPersistentContext(profilePath, {
        headless: true,
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

    // === RUN GAME WITH FORCE STOP DETECTION ===
    try {
      console.log(`Starting gaming module for ${acc.username}...`);

      const originalLog = console.log;
      let forceExit = false;

      console.log = (...args) => {
        originalLog(...args);
        if (args[0] === "All loops completed.") {
          forceExit = true;
          throw new Error("__FORCE_STOP_GAMING__");
        }
      };

      try {
        await gaming(page);
      } catch (err) {
        if (err.message === "__FORCE_STOP_GAMING__") {
          originalLog("Gaming signaled completion. Stopping script.");
        } else {
          throw err;
        }
      } finally {
        console.log = originalLog;
      }

      if (forceExit) {
        if (browser) await browser.close().catch(() => {});
        process.exit(0);
      }

    } catch (err) {
      console.log(`Gaming failed for ${acc.username}: ${err.message}`);
    }

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
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log("All accounts processed.");
})();