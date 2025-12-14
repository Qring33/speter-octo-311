const { firefox } = require("playwright-extra");
const path = require("path");

const profilePath = path.resolve(__dirname, "firefox-profile");

const acc = {
  user_agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/119.0",
};

// Helper to retry clicks
async function clickWithRetry(page, selector, maxRetries = 3, name = "button") {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
      }, selector);
      console.log(`Clicked ${name} (attempt ${attempt})`);
      return true;
    } catch {
      if (attempt < maxRetries) {
        console.log(`${name} not found, retrying (${attempt}/${maxRetries})...`);
        await page.waitForTimeout(2000);
      } else {
        console.log(`${name} not found after ${maxRetries} attempts.`);
      }
    }
  }
  return false;
}

(async () => {
  const browser = await firefox.launchPersistentContext(profilePath, {
    headless: false,
    userAgent: acc.user_agent,
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: null,
  });

  const page = await browser.newPage();

  try {
    await page.goto("https://gameplayneo.com/games/knife-smash/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("Knife Smash page loaded.");

    // Play Now button retry
    await clickWithRetry(page, 'ark-div[ark-test-id="ark-play-now"]', 3, "Play Now button");

    // -----------------------------
    // LOOP: up to 5 Play Again cycles
    // -----------------------------
    const maxLoops = 5;
    for (let loop = 1; loop <= maxLoops; loop++) {
      console.log(`--- Loop ${loop} ---`);

      // Click ad/play button
      await clickWithRetry(page, 'button.ark-ad-button[data-type="play-button"]', 3, "ad/play button");

      console.log("Waiting 150s before searching for the game iframe...");
      await page.waitForTimeout(150000);

      try {
        const widgetSelector = 'ark-div.ark-widget-app';
        await page.waitForSelector(widgetSelector, { timeout: 60000 });

        const widgetHandle = await page.$(widgetSelector);
        if (!widgetHandle) throw new Error("ark-widget-app not found.");

        const iframeHandles = await widgetHandle.$$('iframe[ark-test-id="ark-game-iframe"]');
        let gameIframe = null;

        for (const frameHandle of iframeHandles) {
          const src = await frameHandle.getAttribute("src");
          if (
            src &&
            src.includes(
              "//arenaservices.cdn.arkadiumhosted.com/playgame/api/playgame/play/gameplayneo.com/knife-smash/"
            )
          ) {
            gameIframe = frameHandle;
            break;
          }
        }

        if (!gameIframe) {
          console.log("Correct game iframe not found.");
          return;
        }

        console.log("Correct game iframe found.");

        const frame = await gameIframe.contentFrame();
        if (!frame) {
          console.log("Could not access iframe content frame.");
          return;
        }

        const box = await gameIframe.boundingBox();
        if (!box) {
          console.log("Could not get iframe bounding box.");
          return;
        }

        // Click positions
        const position1 = { x: box.width / 2, y: box.height * 0.75 }; // clicked once
        const position2 = { x: box.width / 4, y: box.height * 0.20 }; // top-left
        const position3 = { x: box.width / 4, y: box.height * 0.5 };  // left-middle

        const clickedPositions = [];
        let clickCount = 0;
        const maxClicks = 30;

        // First click: position1
        try {
          await frame.locator("body").click({ position: position1, force: true });
          clickedPositions.push(1);
          clickCount++;
          process.stdout.write(`clicked position: ${clickedPositions.join(",")}`);
        } catch {
          console.log("Failed to click position 1");
        }

        // Then repeatedly click position2 and position3
        while (clickCount < maxClicks) {
          for (let i = 0; i < 2 && clickCount < maxClicks; i++) {
            const pos = i === 0 ? position2 : position3;
            try {
              await frame.locator("body").click({ position: pos, force: true });
              clickedPositions.push(i + 2);
              clickCount++;
              process.stdout.write(`,${i + 2}`);
            } catch {
              clickCount = maxClicks;
              break;
            }
          }
        }
        console.log(""); // newline after all clicks

        // -------------------------
        // Wait for Play Again button
        // -------------------------
        while (true) {
          console.log("Waiting 5s and checking for Play Again...");
          await page.waitForTimeout(5000);

          const endContainer = await page.$('ark-div.ark-game-end-container');
          if (!endContainer) continue;

          const playAgainBtn = await endContainer.$('ark-div[ark-test-id="ark-play-again-button"]');
          if (playAgainBtn) {
            await playAgainBtn.click();
            console.log("Clicked Play Again button.");
            break;
          }
        }

      } catch (err) {
        console.log("Error finding or interacting with the game iframe:", err.message);
      }
    }

    console.log("Reached maximum loops. Browser will remain open.");
    await page.waitForTimeout(3600000);

  } catch (err) {
    console.log("Error loading page or clicking elements:", err.message);
  }
})();