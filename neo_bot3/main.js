const { firefox } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const gaming = require("./gaming.js");
const { Client } = require("pg");

const accounts_v2Dir = path.join(__dirname, "neobux_accounts_v2");

/* =======================
   DATABASE CONFIG
======================= */
const DB_CONFIG = {
  host: "35.225.142.237",
  user: "neobot",
  password: "Edmond99",
  database: "neobux",
  port: 5432,
};

const VM_ID = process.env.VM_ID || `vm-${Math.random().toString(36).slice(2, 8)}`;
const HEARTBEAT_INTERVAL = 30000;

/* =======================
   DB HELPERS
======================= */
async function getClient() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  return client;
}

async function claimAccount() {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const res = await client.query(`
      SELECT id, username, email, password, user_agent, session_json
      FROM accounts_v2
      WHERE status = 'free'
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (!res.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }

    const acc = res.rows[0];

    await client.query(
      `
      UPDATE accounts_v2
      SET status = 'claimed',
          claimed_by = $1,
          last_heartbeat = NOW()
      WHERE id = $2
      `,
      [VM_ID, acc.id]
    );

    await client.query("COMMIT");
    return acc;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

async function heartbeat(username) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts_v2
      SET last_heartbeat = NOW()
      WHERE username = $1 AND claimed_by = $2
      `,
      [username, VM_ID]
    );
  } finally {
    await client.end();
  }
}

async function releaseAccount(username) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts_v2
      SET status = 'free',
          claimed_by = NULL,
          last_heartbeat = NULL
      WHERE username = $1 AND claimed_by = $2
      `,
      [username, VM_ID]
    );
  } finally {
    await client.end();
  }
}

async function saveBalance(username, balance) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts_v2
      SET balance = $1,
          balance_updated_at = NOW()
      WHERE username = $2
      `,
      [balance, username]
    );
  } finally {
    await client.end();
  }
}

async function saveSession(username, cookies) {
  const client = await getClient();
  try {
    await client.query(
      `
      UPDATE accounts_v2
      SET session_json = $1
      WHERE username = $2
      `,
      [JSON.stringify(cookies), username]
    );
  } finally {
    await client.end();
  }
}

/* =======================
   SINGLE JOB
======================= */
async function runJob() {
  const acc = await claimAccount();

  if (!acc) {
    console.log("[EXIT] No more accounts_v2 available.");
    process.exit(0);
  }

  console.log(`[ACCOUNT ${acc.username}] Selected & consumed`);
  console.log(`[ACCOUNT ${acc.username}] Job started`);

  const hb = setInterval(() => {
    heartbeat(acc.username).catch(() => {});
  }, HEARTBEAT_INTERVAL);

  process.on("SIGINT", async () => {
    clearInterval(hb);
    await releaseAccount(acc.username);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    clearInterval(hb);
    await releaseAccount(acc.username);
    process.exit(0);
  });

  const sessionFolder = path.join(__dirname, "session");
  const sessionFile = path.join(sessionFolder, `${acc.username}.json`);
  const profilePath = path.join(__dirname, "browser_profile", acc.username);

  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  let browser = null;
  let page = null;

  try {
    if (acc.session_json) {
      console.log(`[ACCOUNT ${acc.username}] Found session file, validating...`);

      browser = await firefox.launchPersistentContext(profilePath, {
        headless: true,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();

      const cookies = JSON.parse(acc.session_json);
      await browser.addCookies(cookies);

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
      require("child_process").execSync(`node login.js ${acc.username}`, { stdio: "inherit" });

      await new Promise(r => setTimeout(r, 2000));

      if (!fs.existsSync(sessionFile)) {
        throw new Error("login.js did not create session file");
      }

      const cookies = JSON.parse(fs.readFileSync(sessionFile, "utf8"));

      browser = await firefox.launchPersistentContext(profilePath, {
        headless: false,
        userAgent: acc.user_agent,
        locale: "en-US",
        timezoneId: "America/New_York",
        viewport: null
      });

      page = browser.pages()[0] || await browser.newPage();
      await browser.addCookies(cookies);

      await page.goto("https://www.neobux.com/c/", { waitUntil: "domcontentloaded" });
      await new Promise(r => setTimeout(r, 3000));

      await saveSession(acc.username, cookies);
    }

  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] Pre-gaming failure ? retry allowed`);
    if (browser) await browser.close().catch(() => {});
    clearInterval(hb);
    await releaseAccount(acc.username);
    return "RETRY";
  }

  console.log(`[ACCOUNT ${acc.username}] Starting gaming (NO RETRIES AFTER THIS)`);

  try {
    await page.waitForSelector("#t_saldo span", { timeout: 20000 });
    const balance = await page.evaluate(() => {
      const el = document.querySelector("#t_saldo span");
      return el ? el.textContent.trim() : null;
    });

    if (balance) {
      await saveBalance(acc.username, balance);
      console.log(`Balance for ${acc.username}: ${balance}`);
    }
  } catch {
    console.log(`Could not retrieve balance for ${acc.username} - may still be loading`);
  }

  try {
    await gaming(page);
    console.log(`[ACCOUNT ${acc.username}] Gaming completed successfully`);
  } catch (err) {
    console.log(`[ACCOUNT ${acc.username}] Gaming crashed: ${err.message}`);
  }

  const finalCookies = await browser.cookies();
  await saveSession(acc.username, finalCookies);

  clearInterval(hb);
  await releaseAccount(acc.username);

  if (browser) await browser.close().catch(() => {});
  console.log(`[ACCOUNT ${acc.username}] Exiting after gaming`);
  process.exit(0);
}

/* =======================
   MAIN
======================= */
(async () => {
  while (true) {
    const result = await runJob();
    if (result !== "RETRY") break;
    console.log("[RETRY] Trying another account...");
    await new Promise(r => setTimeout(r, 3000));
  }
})();