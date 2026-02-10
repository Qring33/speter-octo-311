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

  await page.click(`${modalSelector} button:has-text("Connect with wallet")`);
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
  // Get MetaMask popup page
  // ======================
  const mmPage = await context.waitForEvent("page", { timeout: 60000 });
  await mmPage.waitForLoadState("domcontentloaded");

  // ======================
  // CONNECT CONFIRM
  // ======================
  const CONNECT_CONFIRM_XPATH =
    '/html/body/div[1]/div/div/div/div[2]/div/div[3]/div/div/button[2]';

  console.log("Waiting 10s before clicking Connect confirm...");
  await mmPage.waitForTimeout(10000);

  if (mmPage.isClosed()) {
    console.log("MetaMask page closed early → assume connected");
    return;
  }

  const connectBtn = await mmPage.$(`xpath=${CONNECT_CONFIRM_XPATH}`);
  if (connectBtn) {
    await connectBtn.click();
    console.log("Connection confirmed");
  }

  // ======================
  // SIGNATURE (same page, auto-close safe)
  // ======================
  const SIGN_CONFIRM_XPATH =
    '/html/body/div[1]/div/div/div/div/div[3]/div/button[2]';

  console.log("Waiting for signature...");

  for (let i = 0; i < 15; i++) {
    // If MetaMask closes → signature approved
    if (mmPage.isClosed()) {
      console.log("MetaMask popup closed → signature approved");
      return;
    }

    const signBtn = await mmPage.$(`xpath=${SIGN_CONFIRM_XPATH}`);
    if (signBtn) {
      await signBtn.click();
      console.log("Signature confirmed");
      return;
    }

    await mmPage.waitForTimeout(1000);
  }

  // If we reach here, MetaMask likely auto-signed
  console.log("No signature button detected → assume auto-approved");
}

module.exports = { connectWallet };