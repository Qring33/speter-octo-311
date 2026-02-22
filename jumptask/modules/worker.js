const { getYoutubeLink } = require("./finder");
const accountManager = require("../accountManager");
const fs = require("fs");
const path = require("path");

/**
 * Process task that contains "last link" in instructions
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 * @param {import('playwright').ElementHandle} modal
 * @param {number} accountId
 * @param {string} taskId
 * @param {string} instructionsText
 */
async function processTaskWithLastLink(
  context,
  page,
  modal,
  accountId,
  taskId,
  instructionsText
) {
  // =============================
  // Extract quoted text(s)
  // =============================
  const quoted = [...instructionsText.matchAll(/"([^"]+)"/g)].map(
    (m) => m[1]
  );

  if (!quoted.length) {
    await closeModal(page);
    return;
  }

  console.log("Quoted text(s) found:", quoted);

  // =============================
  // Click checkbox if present
  // =============================
  const checkbox = await modal.$(
    'input.PrivateSwitchBase-input.css-j8yymo[type="checkbox"]'
  );
  if (checkbox) await checkbox.click();

  // =============================
  // Click Start Task
  // =============================
  const startBtn = await modal.$(
    'button.MuiButtonBase-root.MuiButton-containedPrimary.css-10mwxyi'
  );

  if (!startBtn) {
    await closeModal(page);
    return;
  }

  await startBtn.click();
  console.log("Start Task button clicked");

  // =============================
  // CHECK jmpt.json FILE
  // =============================
  const JMPT_JSON_PATH = path.join(__dirname, "../jmpt.json");
  let jmptUrls = [];
  let foundInJson = false;

  if (fs.existsSync(JMPT_JSON_PATH)) {
    try {
      const jmptData = JSON.parse(fs.readFileSync(JMPT_JSON_PATH, "utf-8"));
      const matchedEntries = jmptData.filter(
        (entry) => String(entry.id) === String(taskId) && entry.query === quoted[0]
      );

      if (matchedEntries.length) {
        foundInJson = true;
        jmptUrls = matchedEntries.map((entry) => entry.url);
        console.log("Found task in jmpt.json, using URLs:", jmptUrls);
      }
    } catch (err) {
      console.error("Error reading jmpt.json:", err.message);
    }
  }

  // =============================
  // If not in JSON, fallback to YouTube scanning
  // =============================
  let videosChecked = 0;
  let matched = false;

  if (!foundInJson) {
    const result = await getYoutubeLink(quoted[0], taskId);
    jmptUrls = result.urls;
    videosChecked = result.videosChecked;
    matched = result.matched;
  }

  // =============================
  // Dynamic wait based on scan depth
  // =============================
  let waitTime;
  if (videosChecked >= 10) {
    waitTime = 160_000;
  } else if (videosChecked >= 5) {
    waitTime = 60_000;
  } else {
    waitTime = 150_000;
  }

  await page.waitForTimeout(waitTime);

  // =============================
  // OPEN URLS AND CLOSE AFTER 15s
  // =============================
  for (const url of jmptUrls) {
    console.log("Final JMPT URL:", url);
    const jmptPage = await context.newPage();
    await jmptPage.goto(url).catch(() => {});
    await jmptPage.waitForTimeout(15_000);
    await jmptPage.close();
  }

  // =============================
  // Close any YouTube tabs
  // =============================
  for (const p of context.pages()) {
    if (p.url().includes("youtube.com")) {
      await p.close();
    }
  }

  // =============================
  // SAVE EXCLUSION TO DATABASE
  // Only if task came from jmpt.json
  // =============================
  if (foundInJson) {
    await accountManager.addExcludedTask(accountId, taskId, quoted[0]);
    console.log("Task excluded because it was completed via jmpt.json");
  }

  // =============================
  // Close modal
  // =============================
  await closeModal(page);
}

// =============================
// Helper: close modal safely
// =============================
async function closeModal(page) {
  const closeBtn = await page.$(
    'button.MuiIconButton-root.MuiIconButton-colorSecondary.css-rz9o4b'
  );
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(1000);
    console.log("Modal closed");
  }
}

module.exports = {
  processTaskWithLastLink,
};