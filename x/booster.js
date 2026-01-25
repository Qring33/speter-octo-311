const { firefox } = require("playwright");
const path = require("path");
const fs = require("fs");

const PROFILE_PATH = path.resolve(__dirname, "../x_only_profile");
const COMMENTS_PATH = path.resolve(__dirname, "comment.txt");

// ===== TARGET URLS (RANDOM SELECTION) =====
const TARGET_URLS = [
  "https://x.com/search?q=let%27s%20connect&src=typeahead_click&f=live",
  "https://x.com/search?q=follow%20&src=typeahead_click&f=live"
];

const TARGET_URL =
  TARGET_URLS[Math.floor(Math.random() * TARGET_URLS.length)];
// ========================================

const LOGIN_URL = "https://x.com/i/flow/login";

// Load comments
const comments = fs
  .readFileSync(COMMENTS_PATH, "utf8")
  .split("\n")
  .map(c => c.trim())
  .filter(Boolean);

function getRandomComment() {
  return comments[Math.floor(Math.random() * comments.length)];
}

(async () => {
  const context = await firefox.launchPersistentContext(PROFILE_PATH, {
    headless: false,
    viewport: null,
    bypassCSP: true
  });

  const page = await context.newPage();
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });

  const currentUrl = page.url();
  if (currentUrl !== TARGET_URL || currentUrl.startsWith(LOGIN_URL)) {
    await context.close();
    process.exit(1);
  }

  console.log(`Login successful. Opened target:\n${TARGET_URL}\n`);

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(20000);

  const containerXPath =
    "/html/body/div[1]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/section/div";

  const container = await page.$(`xpath=${containerXPath}`);
  if (!container) {
    await context.close();
    process.exit(1);
  }

  const cells = await container.$$('div[data-testid="cellInnerDiv"]');
  const validCells = [];

  for (const cell of cells) {
    const style = await cell.getAttribute("style") || "";
    const match = style.match(/translateY\(([-\d.]+)px\)/);
    const y = match ? parseFloat(match[1]) : 0;
    if (y > 0) validCells.push(cell);
  }

  console.log(`Trending post found = ${validCells.length}\n`);

  let processed = 0;

  for (let i = 0; i < validCells.length; i++) {
    if (processed >= 1) break;

    const cell = validCells[i];

    try {
      if (processed > 0) console.log("");

      const moreBtn = await cell.waitForSelector(
        'button[data-testid="caret"]',
        { timeout: 10000 }
      );
      await moreBtn.click();

      const menuSelector = 'div[role="menu"]';

      const followXPath =
        "/html/body/div[1]/div/div/div[1]/div[2]/div/div/div/div[2]/div/div[3]/div/div/div/div[1]/div[2]/div/span";

      const followSpan = await page.waitForSelector(
        `xpath=${followXPath}`,
        { timeout: 15000 }
      );

      const followText = await followSpan.innerText();

      // ===== FIX: CLOSE MENU IF NOT FOLLOW =====
      if (!followText.includes("Follow")) {
        const menuOpen = await page.$(menuSelector);
        if (menuOpen) {
          await page.keyboard.press("Escape");
          await page.waitForSelector(menuSelector, {
            state: "detached",
            timeout: 5000
          });
        }
        continue;
      }
      // =======================================

      await followSpan.click();
      console.log("Followed");

      await page.waitForTimeout(2000);

      const replyBtn = await cell.waitForSelector(
        'button[data-testid="reply"]',
        { timeout: 10000 }
      );
      await replyBtn.click();

      const modalSelector = 'div[role="dialog"][aria-modal="true"]';

      const modal = await page.waitForSelector(modalSelector, {
        timeout: 30000
      });

      const textbox = await modal.waitForSelector(
        'div[data-testid="tweetTextarea_0"]',
        { timeout: 15000 }
      );

      const comment = getRandomComment();
      await textbox.click();

      for (const char of comment) {
        await textbox.type(char, { delay: 80 });
      }

      console.log("Commented");

      const postBtn = await modal.waitForSelector(
        'button[data-testid="tweetButton"]',
        { timeout: 15000 }
      );
      await postBtn.click();

      console.log("Sent");

      await page.waitForTimeout(3000);

      let dialogStillOpen = await page.$(modalSelector);
      if (dialogStillOpen) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(2000);
        dialogStillOpen = await page.$(modalSelector);
        if (dialogStillOpen) {
          const closeBtn = await page.$('button[aria-label="Close"]');
          if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }

      await page.waitForSelector(modalSelector, {
        state: "detached",
        timeout: 10000
      });

      processed++;
      console.log("Done");

      await page.waitForTimeout(20000);

    } catch (err) {
      continue;
    }
  }

  console.log("\nAll trending posts processed. Closing browser.");
  await context.close();
})();