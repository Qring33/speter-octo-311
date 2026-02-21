const { chromium } = require("playwright");
const path = require("path");
const { execSync } = require("child_process");
const { getYoutubeLink } = require("./modules/finder");
const { processTaskWithLastLink } = require("./modules/worker");
const accountManager = require("./accountManager");

const jumpTaskUrl =
  "https://app.jumptask.io/earn?tags%5B%5D=Watch+%26+Profit#all_tasks";

// Heartbeat interval in ms
const HEARTBEAT_INTERVAL = 20_000;

(async () => {
  const VM_ID = `vm-${Math.random().toString(36).slice(2, 8)}`;

  // Claim an available account
  const account = await accountManager.claimAccount(VM_ID);
  if (!account) {
    console.log("No free accounts available.");
    return;
  }

  console.log(`Claimed account: ${account.account}`);
  const excludedTasks = account.excluded_tasks || [];

  //  Extract numeric account ID (account_10  10)
  const accountNumber = String(account.account).match(/\d+/)?.[0];

  const USER_DATA_DIR = path.join(__dirname, "chrome-profile");

  let context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: null,
    userAgent: account.user_agent,
  });

  let page = await context.newPage();
  await page.goto(jumpTaskUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(10_000);

  // ================================
  // HEARTBEAT
  // ================================
  const heartbeatInterval = setInterval(async () => {
    try {
      await accountManager.updateAccount(account.id, {
        last_heartbeat: new Date(),
      });
    } catch (err) {
      console.error("Heartbeat error:", err.message);
    }
  }, HEARTBEAT_INTERVAL);

  // ================================
  // CHECK FOR LOGOUT
  // ================================
  const earningsXpath =
    "/html/body/div[1]/div/header/div/div[2]/button/div/div/div/p";
  let earningsElem = await page.$(`xpath=${earningsXpath}`);

  if (!earningsElem) {
    const logoutXpath = "/html/body/div[2]/div[3]/div/div[1]/div";
    const logoutElem = await page.$(`xpath=${logoutXpath}`);

    if (logoutElem) {
      console.log(
        `Detected logout. Running login.js for account ${accountNumber}...`
      );

      await context.close();

      try {
        execSync(`node login.js ${accountNumber}`, { stdio: "inherit" });

        context = await chromium.launchPersistentContext(USER_DATA_DIR, {
          headless: false,
          viewport: null,
          userAgent: account.user_agent,
        });

        page = await context.newPage();
        await page.goto(jumpTaskUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(10_000);
      } catch (err) {
        console.error("Login failed:", err.message);
        await accountManager.releaseAccount(account.id);
        clearInterval(heartbeatInterval);
        return;
      }
    }
  }

  // ================================
  // REMOVE BLOCKING DIALOG (up to 3 attempts)
  // ================================
  for (let attempt = 1; attempt <= 3; attempt++) {
    const dialog = await page.$(
      "div.MuiBackdrop-root.MuiModal-backdrop.css-14dl35y"
    );
    if (!dialog) break;

    console.log(`Blocking dialog found. Removing attempt ${attempt}...`);

    await page.evaluate(() => {
      const el = document.querySelector(
        "div.MuiBackdrop-root.MuiModal-backdrop.css-14dl35y"
      );
      if (el) el.remove();
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  }

  // ================================
  // Update initial balance
  // ================================
  earningsElem = await page.$(`xpath=${earningsXpath}`);
  let balance = 0;

  if (earningsElem) {
    const text = (await earningsElem.innerText()).replace(/\u00a0/g, " ");
    const match = text.match(/[\d,.]+/);
    balance = match ? parseFloat(match[0].replace(/,/g, "")) : 0;
  }

  await accountManager.updateAccount(account.id, { balance });

  // ================================
  // Locate task cards
  // ================================
  const containerSelector =
    "div.MuiGrid2-root.MuiGrid2-container.MuiGrid2-direction-xs-row.MuiGrid2-grid-xs-grow.css-hvx45w";
  const taskCardSelector =
    "div.MuiGrid2-root.MuiGrid2-direction-xs-row.MuiGrid2-grid-xs-12.MuiGrid2-grid-md-6.css-tnatjl";

  const container = await page.$(containerSelector);
  if (!container) {
    console.log("No tasks container found.");
    await context.close();
    await accountManager.releaseAccount(account.id);
    clearInterval(heartbeatInterval);
    return;
  }

  const taskCards = await container.$$(taskCardSelector);
  console.log(`Found ${taskCards.length} task(s)`);

  // ================================
  // Process each task
  // ================================
  for (const card of taskCards) {
    await card.click();

    const modal = await page
      .waitForSelector("div.MuiBox-root.css-jl6j1q", { timeout: 10_000 })
      .catch(() => null);

    if (!modal) continue;

    const taskIdElem = await modal.$(
      "h6.MuiTypography-root.MuiTypography-h6.css-88tfn1"
    );
    if (!taskIdElem) {
      await closeModal(page);
      continue;
    }

    const taskId = (await taskIdElem.innerText()).match(/#(\d+)/)?.[1];
    if (!taskId) {
      await closeModal(page);
      continue;
    }

    if (excludedTasks.some((t) => t.taskId === taskId)) {
      console.log(`Task ${taskId} excluded for this account`);
      await closeModal(page);
      continue;
    }

    const instructionsElem = await modal.$(
      "div.MuiTypography-root.MuiTypography-body1.css-12idmda"
    );
    const instructionsText = await instructionsElem?.innerText();
    if (!instructionsText) {
      await closeModal(page);
      continue;
    }

    if (instructionsText.toLowerCase().includes("last link")) {
      await processTaskWithLastLink(
        context,
        page,
        modal,
        account.id,
        taskId,
        instructionsText
      );
    } else {
      await accountManager.addExcludedTask(
        account.id,
        taskId,
        instructionsText
      );
      excludedTasks.push({ taskId, query: instructionsText });
      console.log(`Task ${taskId} added to excluded_tasks`);
      await closeModal(page);
    }
  }

  // ================================
  // Cleanup
  // ================================
  console.log("All tasks processed. Closing in 10s...");
  await page.waitForTimeout(10_000);

  clearInterval(heartbeatInterval);
  await context.close();
  await accountManager.releaseAccount(account.id);
  console.log("Browser closed and account released.");

  // ================================
  // Helper: close modal
  // ================================
  async function closeModal(page) {
    const closeBtn = await page.$(
      "button.MuiIconButton-root.MuiIconButton-colorSecondary.css-rz9o4b"
    );
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
      console.log("Modal closed");
    }
  }
})();