// metamask.js
const path = require("path");

/**
 * Unlock MetaMask and select an account
 * @param {import('playwright').Page} mmPage - Playwright page for MetaMask
 * @param {number} accountIndex - 1-based account index to select
 */
async function unlockAndSelectAccount(mmPage, accountIndex) {
  // Wait for password input on MetaMask (up to 60s)
  const passwordSelector = 'input#password';
  await mmPage.waitForSelector(passwordSelector, { timeout: 60000 });

  // Enter password
  await mmPage.fill(passwordSelector, "Edmond99@");
  console.log("Password entered");

  // Click Unlock button
  const unlockButtonSelector = 'button[data-testid="unlock-submit"]';
  await mmPage.click(unlockButtonSelector);
  console.log("MetaMask unlocked");

  // Wait for the account menu button to appear
  const accountMenuSelector = 'button[data-testid="account-menu-icon"]';
  await mmPage.waitForSelector(accountMenuSelector, { timeout: 60000 });

  // Click the account menu button
  await mmPage.click(accountMenuSelector);
  console.log("Account menu opened");

  // Account list selector
  const accountItemSelector =
    'div.mm-box.multichain-account-menu-popover__list--menu-item';

  let accountItems = [];
  const maxWait = 60000;        // total max wait: 60s
  const pollInterval = 1000;   // check every 1s
  const refreshAfter = 20000;  // refresh after 20s

  let elapsed = 0;
  let lastRefreshAt = 0;

  while (elapsed < maxWait) {
    accountItems = await mmPage.$$(accountItemSelector);

    if (accountItems.length >= accountIndex) {
      break; // requested account is available
    }

    // Refresh page after 20s without success
    if (elapsed - lastRefreshAt >= refreshAfter) {
      console.log("Refreshing MetaMask page after 20s wait...");
      await mmPage.reload({ waitUntil: "domcontentloaded" });

      // Re-open account menu after reload
      await mmPage.waitForSelector(accountMenuSelector, { timeout: 60000 });
      await mmPage.click(accountMenuSelector);

      lastRefreshAt = elapsed;
    }

    await mmPage.waitForTimeout(pollInterval);
    elapsed += pollInterval;
  }

  const accountCount = accountItems.length;
  console.log(`Found ${accountCount} account(s) in MetaMask`);

  if (accountIndex > accountCount) {
    throw new Error(
      `Account ${accountIndex} does not exist after waiting ${
        maxWait / 1000
      }s. Total accounts: ${accountCount}`
    );
  }

  // Click the requested account (1-based index)
  await accountItems[accountIndex - 1].click();
  console.log(`Clicked account number ${accountIndex}`);
}

module.exports = { unlockAndSelectAccount };