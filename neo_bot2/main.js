const { chromium } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const gaming = require("./gaming.js");

const accountsDir = path.join(__dirname, "neobux_accounts");
const sourceAccountsFile = path.join(accountsDir, "neobux_accounts.json");
const runningAccountsFile = path.join(accountsDir, "running_accounts.json");

const chromiumArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--use-gl=swiftshader",
  "--disable-gpu-sandbox",
  "--disable-software-rasterizer=false",
  "--enable-features=CanvasOopRasterization",
  "--enable-zero-copy",
  "--enable-unsafe-webgpu"
];

// =========================
// INIT / RESET RUNNING POOL
// =========================
function resetRunningAccounts() {
  if (!fs.existsSync(sourceAccountsFile)) {
    console.log("[FATAL] Source accounts file missing. Exiting.");
    process.exit(0);
  }

  fs.copyFileSync(sourceAccountsFile, runningAccountsFile);
  console.log("[INIT] Running accounts reset from source.");
}

// =========================
// GET & CONSUME ACCOUNT
// =========================
function getAndConsumeAccount() {
  let accounts = [];

  if (fs.existsSync(runningAccountsFile)) {
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  } else {
    resetRunningAccounts();
    accounts = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.log("[EXIT] No more accounts available.");
    process.exit(0);
  }

  const index = Math.floor(Math.random() * accounts.length);
  const acc = accounts[index];

  accounts.splice(index, 1);
  fs.writeFileSync(runningAccountsFile, JSON.stringify(accounts, null, 2));

  console.log(`[ACCOUNT ${acc.username}] Selected & consumed`);

  try {
    console.log(`[ACCOUNT ${acc.username}] Running upload.js`);
    execSync(`node upload.js ${acc.username}`, { stdio: "inherit" });
  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] upload.js failed (ignored): ${err.message}`);
  }

  return acc;
}

// =========================
// SINGLE JOB
// =========================
async function runJob() {
  const acc = getAndConsumeAccount();
  console.log(`[ACCOUNT ${acc.username}] Job started`);

  const sessionFolder = path.join(__dirname, "session");
  const sessionFile = path.join(sessionFolder, `${acc.username}.json`);
  const profilePath = path.join(__dirname, "browser_profile", acc.username);

  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  let browser = null;
  let page = null;

  try {
    if (fs.existsSync(sessionFile)) {
      console.log(`[ACCOUNT ${acc.username}] Found session file, validating...`);

      browser = await chromium.launchPersistentContext(profilePath, {
        headless: false,
        args: chromiumArgs,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();

      const cookies = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      await browser.addCookies(cookies.map(c => {
        delete c.sameParty;
        delete c.priority;
        delete c.sourceScheme;
        delete c.sourcePort;
        delete c.partitionKey;
        return c;
      }));

      await page.goto("https://www.neobux.com/c/", { waitUntil: "domcontentloaded" });
      await new Promise(r => setTimeout(r, 3000));

      const valid = await page.evaluate(() => {
        return !!document.querySelector("#t_saldo span");
      });

      if (!valid) {
        console.log(`[ACCOUNT ${acc.username}] Session invalid`);
        await browser.close();
        browser = null;
      } else {
        console.log(`[ACCOUNT ${acc.username}] Session valid`);
      }
    }

    if (!browser) {
      console.log(`[ACCOUNT ${acc.username}] Running login.js`);
      execSync(`node login.js ${acc.username}`, { stdio: "inherit" });

      await new Promise(r => setTimeout(r, 4000));

      browser = await chromium.launchPersistentContext(profilePath, {
        headless: false,
        args: chromiumArgs,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();

      const cookies = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      await browser.addCookies(cookies.map(c => {
        delete c.sameParty;
        delete c.priority;
        delete c.sourceScheme;
        delete c.sourcePort;
        delete c.partitionKey;
        return c;
      }));

      await page.goto("https://www.neobux.com/c/", { waitUntil: "domcontentloaded" });
      await new Promise(r => setTimeout(r, 3000));
    }

  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] Pre-gaming failure → retry allowed`);
    if (browser) await browser.close().catch(() => {});
    return "RETRY";
  }

  console.log(`[ACCOUNT ${acc.username}] Starting gaming (NO RETRIES AFTER THIS)`);

  // =========================
  // BALANCE CHECK (BEFORE GAMING)
  // =========================
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

  // =========================
  // GAMING (POINT OF NO RETURN)
  // =========================
  try {
    await gaming(page);
    console.log(`[ACCOUNT ${acc.username}] Gaming completed successfully`);
  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] Gaming crashed: ${err.message}`);
  }

  if (browser) await browser.close().catch(() => {});
  console.log(`[ACCOUNT ${acc.username}] Exiting after gaming`);
  process.exit(0);
}

// =========================
// MAIN
// =========================
(async () => {
  if (!fs.existsSync(runningAccountsFile)) {
    resetRunningAccounts();
  }

  while (true) {
    let remaining = [];

    try {
      remaining = JSON.parse(fs.readFileSync(runningAccountsFile, "utf8"));
    } catch {
      resetRunningAccounts();
      continue;
    }

    if (!remaining.length) {
      console.log("[EXIT] No accounts left to try.");
      resetRunningAccounts();
      continue;
    }

    const result = await runJob();

    if (result !== "RETRY") {
      break;
    }

    console.log("[RETRY] Trying another account...");
    await new Promise(r => setTimeout(r, 3000));
  }

  process.exit(0);
})();