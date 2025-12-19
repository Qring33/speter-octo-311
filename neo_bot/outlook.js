const { firefox } = require("playwright-extra");
const fs = require("fs");
const path = require("path");

// Define a realistic Firefox user agent
const selectedUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

const password = "Edmond99@"; // Master password for all accounts

// Get email from command line argument, or fall back to random from email.txt
let targetEmail;

if (process.argv.length >= 3) {
  targetEmail = process.argv[2].trim();
} else {
  const emailsPath = path.join(__dirname, "email.txt");
  if (!fs.existsSync(emailsPath)) {
    console.error("Error: email.txt not found and no email provided via argument.");
    process.exit(1);
  }
  const emails = fs.readFileSync(emailsPath, "utf-8")
    .trim()
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (emails.length === 0) {
    console.error("Error: email.txt is empty.");
    process.exit(1);
  }
  targetEmail = emails[Math.floor(Math.random() * emails.length)];
}

(async () => {
  console.log(`1/5 - Starting login for ${targetEmail}`);

  const browserContext = await firefox.launchPersistentContext("./browser_profile", {
    headless: false,
    locale: "en-US",
    userAgent: selectedUA,
    timezoneId: "America/New_York",
    viewport: { width: 1280, height: 900 },
  });

  const page = browserContext.pages()[0] || await browserContext.newPage();

  await page.goto("https://outlook.live.com/mail/0/", { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#c-shellmenu_custom_outline_signin_bhvr100_right", { timeout: 30000 });
  await page.click("#c-shellmenu_custom_outline_signin_bhvr100_right");

  await page.waitForSelector("#i0116", { timeout: 30000 });
  await page.fill("#i0116", targetEmail);
  await page.click("#idSIButton9");

  const passwordLocator = page.locator('input[type="password"][name="passwd"][id="passwordEntry"]');
  const foundPasswordDirectly = await passwordLocator.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);

  if (!foundPasswordDirectly) {
    const usePasswordLink = page.locator('span[role="button"]:has-text("Use your password")');
    await usePasswordLink.waitFor({ state: "visible", timeout: 30000 });
    await usePasswordLink.click();
    await passwordLocator.waitFor({ state: "visible", timeout: 30000 });
  }

  await page.fill('input[type="password"][name="passwd"][id="passwordEntry"]', password);
  await page.click('button[data-testid="primaryButton"]');

  await page.waitForTimeout(5000);

  const passwordFieldStillVisible = await passwordLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (!passwordFieldStillVisible) {
    await page.goto("https://outlook.live.com/mail/0/", { waitUntil: "domcontentloaded" });
  }

  console.log("2/5 - Login successful, waiting for NeoBux email");

  let otpCode = null;
  const maxRetries = 3;
  let emailClicked = false; // Track if we already clicked the email

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const messageList = page.locator('div[tabindex="-1"][role="listbox"]');
      await messageList.waitFor({ state: "visible", timeout: 30000 });

      let neoBuxEmailRow = null;
      let rowFound = false;

      // Try different selectors to find the email row
      neoBuxEmailRow = page.locator('div[role="option"]:has(div span.OZZZK:has-text("NeoBux<noreply@mail.neobux.com>"))').first();
      rowFound = await neoBuxEmailRow.isVisible({ timeout: 10000 }).catch(() => false);

      if (!rowFound) {
        neoBuxEmailRow = page.locator('div[role="option"][aria-label*="New registration: Email verification"]').first();
        rowFound = await neoBuxEmailRow.isVisible({ timeout: 10000 }).catch(() => false);
      }

      if (!rowFound) {
        neoBuxEmailRow = page.locator('xpath=/html/body/div[1]/div/div[2]/div/div[2]/div/div[1]/div[1]/div/div/div[3]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div/div').first();
        rowFound = await neoBuxEmailRow.isVisible({ timeout: 10000 }).catch(() => false);
      }

      // If email row is found and we haven't clicked it yet
      if (rowFound && !emailClicked) {
        await neoBuxEmailRow.scrollIntoViewIfNeeded();
        await neoBuxEmailRow.click({ force: true });
        emailClicked = true;
        await page.waitForTimeout(8000); // Initial wait after clicking
      }

      // Only try to extract OTP if we have clicked the email
      if (emailClicked) {
        const otpDiv = page.locator('div[style*="Lucida Console"][style*="width: 300px"][style*="white-space: nowrap"]');
        const otpVisible = await otpDiv.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);

        if (otpVisible) {
          otpCode = await otpDiv.innerText();
          console.log(`3/5 - OTP:: ${otpCode.trim()}`);
          break; // Success → exit loop
        }
      }

      // If we reach here, either email not found or OTP not loaded yet
      if (attempt === maxRetries) {
        console.error("Error: NeoBux verification email not found after 3 attempts.");
        await browserContext.close();
        process.exit(1);
      }

      console.log("   Email not found yet, retrying in 15 seconds...");
      await page.waitForTimeout(15000);

    } catch (err) {
      if (attempt === maxRetries) {
        console.error("Error: Failed to extract OTP after 3 attempts.");
        await browserContext.close();
        process.exit(1);
      }
      console.log(`   Attempt failed, retrying in 15 seconds...`);
      await page.waitForTimeout(15000);
    }
  }

  console.log("4/5 - Task completed successfully");
  console.log("5/5 - Closing browser");

  await browserContext.close();
})();