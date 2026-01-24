const { firefox } = require("playwright");
const fs = require("fs");
const path = require("path");

const PROFILE_PATH = path.resolve(__dirname, "x_only_profile");
const HOME_URL = "https://x.com/home";
const LOGIN_FLOW_URL = "https://x.com/i/flow/login";

// Compose textbox
const TEXTBOX_SELECTOR = 'div[role="textbox"]';

// Post button XPath
const POST_BUTTON_XPATH =
  '/html/body/div[1]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div[2]/div[1]/div/div/div/div[2]/div[2]/div[2]/div/div/div/button/div/div/span/span';

(async () => {
  const context = await firefox.launchPersistentContext(PROFILE_PATH, {
    headless: false,
    viewport: null,
    bypassCSP: true
  });

  const page = await context.newPage();

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

  const currentUrl = page.url();

  if (currentUrl !== HOME_URL) {
    console.error("Login unsuccessful. Redirect detected:", currentUrl);
    await context.close();
    process.exit(1);
  }

  console.log("Login successful.");

  // Wait a bit for DOM + animations
  await page.waitForTimeout(10000);

  // Read post text
  const postText = fs.readFileSync("post.txt", "utf-8").trim();
  if (!postText) {
    console.error("post.txt is empty.");
    await context.close();
    process.exit(1);
  }

  // Focus the textbox
  const textbox = await page.waitForSelector(TEXTBOX_SELECTOR, {
    timeout: 30000
  });

  await textbox.click();

  // Use keyboard.type instead of fill
  await page.keyboard.type(postText, { delay: 50 }); // 50ms per character simulates human typing

  // Wait a short moment for Post button to become active
  await page.waitForTimeout(1000);

  // Find and click Post button
  const postButton = await page.waitForSelector(`xpath=${POST_BUTTON_XPATH}`, {
    timeout: 30000
  });

  // Sometimes the button is still disabled visually, we can force click safely
  await postButton.scrollIntoViewIfNeeded();
  await postButton.click({ force: true });

  console.log("Post submitted successfully.");

  await page.waitForTimeout(5000);
  await context.close();
})();