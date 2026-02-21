// jumptask.js

/**
 * JumpTask wallet connection module (assumes MetaMask is already unlocked)
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 */
async function connectWallet(context, page) {
  // ======================
  // Modal → Connect wallet
  // ======================
  const modalSelector =
    'div[role="presentation"][aria-labelledby="modal-modal-title"]';

  await page.waitForSelector(modalSelector, { timeout: 30000 });
  console.log("Modal detected");

  await page.waitForSelector(modalSelector, { timeout: 30000 });
console.log("Modal detected");

// Remove Google One Tap iframe if present
try {
  await page.evaluate(() => {
    const googleIframe = document.getElementById("credential_picker_iframe");
    if (googleIframe) {
      googleIframe.remove();
    }
  });
  console.log("Removed Google One Tap iframe");
} catch (_) {}

// Now click safely
await page
  .locator(`${modalSelector} button:has-text("Connect with wallet")`)
  .click({ timeout: 30000 });

console.log("Connect with wallet clicked");

  await page.waitForTimeout(10000);

  // ======================
  // Click MetaMask (Shadow DOM)
  // ======================
  await page.evaluate(() => {
    document
      .querySelector("body > w3m-modal")
      .shadowRoot.querySelector("wui-flex > wui-card > w3m-router")
      .shadowRoot.querySelector("div > w3m-connect-view")
      .shadowRoot.querySelector("wui-flex > w3m-wallet-login-list")
      .shadowRoot.querySelector("wui-flex > w3m-connector-list")
      .shadowRoot.querySelector("w3m-connect-announced-widget")
      .shadowRoot.querySelector("wui-flex > wui-list-wallet")
      .shadowRoot.querySelector("button")
      .click();
  });

  console.log("MetaMask wallet clicked (Shadow DOM)");

  // ======================
  // Wait for MetaMask popup
  // ======================
  let mmPage = await context.waitForEvent("page", { timeout: 60000 });
  await mmPage.waitForLoadState("domcontentloaded");

  // ======================
  // CONNECT CONFIRM
  // ======================
  const CONNECT_CONFIRM_XPATH =
    '/html/body/div[1]/div/div/div/div[2]/div/div[3]/div/div/button[2]';

  console.log("Waiting 10s before clicking Connect confirm...");
  await mmPage.waitForTimeout(10000);

  await mmPage
    .locator(`xpath=${CONNECT_CONFIRM_XPATH}`)
    .click({ timeout: 20000 });

  console.log("Connection confirmed");

  // ======================
  // HANDLE SIGNATURE (robust)
  // ======================
  const SIGN_CONFIRM_XPATH =
    '/html/body/div[1]/div/div/div/div/div[3]/div/button[2]';

  console.log("Waiting for signature...");

  let signatureConfirmed = false;

  for (let i = 0; i < 30; i++) {
    try {
      // If popup was closed → wait for new popup
      if (mmPage.isClosed()) {
        console.log("Popup closed → waiting for new signature popup...");
        mmPage = await context.waitForEvent("page", { timeout: 30000 });
        await mmPage.waitForLoadState("domcontentloaded");
      }

      // Try clicking signature button
      await mmPage
        .locator(`xpath=${SIGN_CONFIRM_XPATH}`)
        .click({ timeout: 3000 });

      console.log("Signature confirmed");
      signatureConfirmed = true;
      break;

    } catch (err) {
      // Page might reload internally OR button not ready yet
      if (mmPage.isClosed()) {
        continue;
      }

      try {
        await mmPage.waitForLoadState("domcontentloaded", { timeout: 2000 });
      } catch (_) {}

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!signatureConfirmed) {
    throw new Error("Signature confirmation failed");
  }

  console.log("Wallet connection flow completed");
}

module.exports = { connectWallet };