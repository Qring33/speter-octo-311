const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { unlockAndSelectAccount } = require("./modules/metamask");
const { connectWallet } = require("./modules/jumptask");

// Get the account index from command line argument (1-based)
const accountIndex = parseInt(process.argv[2], 10);
if (isNaN(accountIndex) || accountIndex < 1) {
  console.error("Please provide a valid account number as argument (e.g., node login.js 1)");
  process.exit(1);
}

(async () => {
  const USER_DATA_DIR = path.join(__dirname, "chrome-profile");
  const METAMASK_EXTENSION_PATH = path.join(__dirname, "metamask");

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: null,
    args: [
      `--disable-extensions-except=${METAMASK_EXTENSION_PATH}`,
      `--load-extension=${METAMASK_EXTENSION_PATH}`,
    ],
  });

  try {
    // ======================
    // Open MetaMask
    // ======================
    const mmPage = await context.newPage();
    await mmPage.goto(
      "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html",
      { waitUntil: "domcontentloaded" }
    );
    console.log("MetaMask opened");

    // ======================
    // Open JumpTask
    // ======================
    const jumpTaskUrl =
      "https://app.jumptask.io/earn?tags%5B%5D=Watch+%26+Profit#all_tasks";
    const jtPage = await context.newPage();
    await jtPage.goto(jumpTaskUrl, { waitUntil: "domcontentloaded" });
    console.log("JumpTask opened");

    // ======================
    // Focus MetaMask
    // ======================
    await mmPage.bringToFront();
    console.log("MetaMask page focused");

    // ======================
    // Unlock MetaMask + select account
    // ======================
    await unlockAndSelectAccount(mmPage, accountIndex);

    // ======================
    // Focus JumpTask
    // ======================
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await jtPage.bringToFront();
    console.log("JumpTask page focused");

    // ======================
    // Connect wallet (MetaMask)
    // ======================
    await connectWallet(context, jtPage);

    // ======================
    // Grace period (MetaMask may auto-close signature)
    // ======================
    console.log("Waiting 15s before closing browser...");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // ======================
    // Safe shutdown
    // ======================
    await context.close();
    console.log("Browser closed");
  } catch (err) {
    console.error("Login flow failed:", err.message);

    // Ensure browser is closed even on error
    try {
      await context.close();
      console.log("Browser closed after error");
    } catch (_) {}
  }
})();