// gaming.js

// -----------------------------
// Helper to retry clicks with optional failure handler
// -----------------------------
async function clickWithRetry(page, selector, maxRetries = 3, name = "button", onFinalFailure = null) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
      }, selector);
      console.log(`Clicked ${name} (attempt ${attempt})`);
      return true;
    } catch (err) {
      if (attempt < maxRetries) {
        console.log(`${name} not found, retrying (${attempt}/${maxRetries})...`);
        await page.waitForTimeout(2000);
      } else {
        console.log(`${name} not found after ${maxRetries} attempts.`);
        if (onFinalFailure) {
          await onFinalFailure();
        }
      }
    }
  }
  return false;
}

// -----------------------------
// Main gaming function
// -----------------------------
module.exports = async function gaming(page) {
  const context = page.context();
  const maxLoops = 10;
  const globalEvery = 5;
  let loopCounter = 1;
  let globalLoop = 1;

  while (loopCounter <= maxLoops) {

    if ((loopCounter - 1) % globalEvery === 0) {
      console.log(`===== GLOBAL LOOP ${globalLoop} =====`);
      globalLoop++;
    }

    console.log("Navigating to game rewards page...");
    await page.goto("https://www.neobux.com/m/ag/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    let newPage;

    try {
      const rewardButton = "#rwtd";
      await page.waitForSelector(rewardButton, { timeout: 10000 });

      [newPage] = await Promise.all([
        context.waitForEvent("page"),
        page.click(rewardButton)
      ]);

      console.log("Clicked reward button, waiting for gameplay tab...");
      await newPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
      await newPage.waitForTimeout(5000);

      console.log("Opening Knife Smash...");
      await newPage.goto("https://gameplayneo.com/games/knife-smash/", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      console.log("Knife Smash game page loaded.");

      let gameEntrySuccess = false;

      for (let attempt = 1; attempt <= 5 && !gameEntrySuccess; attempt++) {
        console.log(`Game entry attempt (${attempt}/5)`);

        const refreshAndRestart = async () => {
          console.log("Refreshing Knife Smash page and restarting play sequence...");
          await newPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
          await newPage.waitForTimeout(3000);
        };

        if (!await clickWithRetry(
          newPage,
          'ark-div[ark-test-id="ark-play-now"]',
          3,
          "Play Now button",
          refreshAndRestart
        )) continue;

        if (!await clickWithRetry(
          newPage,
          'button.ark-ad-button[data-type="play-button"]',
          3,
          "ad/play button",
          refreshAndRestart
        )) continue;

        gameEntrySuccess = true;
      }

      if (!gameEntrySuccess) {
        await newPage.close();
        loopCounter++;
        continue;
      }

      // -----------------------------
      // SINGLE PLAY CYCLE (NO RETRIES)
      // -----------------------------
      console.log(`--- Play Cycle ${loopCounter} ---`);
      loopCounter++; //  ADVANCE IMMEDIATELY — NO RE-RUNS POSSIBLE

      console.log("Waiting 80s for game iframe...");
      await newPage.waitForTimeout(80000);

      try {
        const widgetSelector = 'ark-div.ark-widget-app';
        await newPage.waitForSelector(widgetSelector, { timeout: 60000 });

        const widgetHandle = await newPage.$(widgetSelector);
        const iframeHandles = await widgetHandle.$$('iframe[ark-test-id="ark-game-iframe"]');

        let gameIframe = null;
        for (const frameHandle of iframeHandles) {
          const src = await frameHandle.getAttribute("src");
          if (src && src.includes("knife-smash")) {
            gameIframe = frameHandle;
            break;
          }
        }

        if (!gameIframe) throw new Error("Game iframe missing");

        console.log("Correct game iframe found.");

        const frame = await gameIframe.contentFrame();
        const box = await gameIframe.boundingBox();
        if (!frame || !box) throw new Error("Iframe not ready");

        const position1 = { x: box.width / 2, y: box.height * 0.75 };
        const position2 = { x: box.width / 4, y: box.height * 0.20 };
        const position3 = { x: box.width / 4, y: box.height * 0.5 };

        let clickCount = 0;
        const maxClicks = 30;

        await frame.locator("body").click({ position: position1, force: true });
        clickCount++;
        console.log("Clicked position1 (first click)");

        console.log("Waiting 150s before second position1 click...");
        await newPage.waitForTimeout(150000);

        await frame.locator("body").click({ position: position1, force: true });
        clickCount++;
        console.log("Clicked position1 (second click)");

        while (clickCount < maxClicks) {
          for (const pos of [position2, position3]) {
            await frame.locator("body").click({ position: pos, force: true });
            clickCount++;
          }
        }

      } catch (err) {
        console.log("Game error during play cycle:", err.message);
      }

      await newPage.close();

    } catch (err) {
      console.log("Failed during NeoBux cycle:", err.message);
      if (newPage) await newPage.close();
      loopCounter++;
    }
  }

  console.log("All loops completed.");
};