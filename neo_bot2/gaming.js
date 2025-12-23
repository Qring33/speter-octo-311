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
        console.log(`(${name} not found, retrying (${attempt}/${maxRetries})...)`);
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
  const maxLoops = 3;
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

    try {
      const rewardButton = "#rwtd";
      await page.waitForSelector(rewardButton, { timeout: 10000 });

      const [newPage] = await Promise.all([
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
      const maxGameEntryAttempts = 5;
      let gameEntryAttempt = 0;

      while (!gameEntrySuccess && gameEntryAttempt < maxGameEntryAttempts && loopCounter <= maxLoops) {
        gameEntryAttempt++;
        console.log(`Game entry attempt (${gameEntryAttempt}/${maxGameEntryAttempts})`);

        const refreshAndRestart = async () => {
          console.log("Refreshing Knife Smash page and restarting play sequence...");
          await newPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
          await newPage.waitForTimeout(3000);
        };

        const playNowClicked = await clickWithRetry(
          newPage,
          'ark-div[ark-test-id="ark-play-now"]',
          3,
          "Play Now button",
          refreshAndRestart
        );

        if (!playNowClicked) continue;

        const adPlayClicked = await clickWithRetry(
          newPage,
          'button.ark-ad-button[data-type="play-button"]',
          3,
          "ad/play button",
          refreshAndRestart
        );

        if (!adPlayClicked) continue;

        gameEntrySuccess = true;
      }

      if (!gameEntrySuccess) {
        await newPage.close();
        loopCounter++;
        continue;
      }

      for (let inner = 1; inner <= 5 && loopCounter <= maxLoops; inner++) {
        console.log(`--- Play Cycle ${loopCounter} ---`);
        console.log("Waiting 90s for game iframe...");
        await newPage.waitForTimeout(90000);

        try {
          // CLOSE POPUP IF EXISTS
          const popup = await newPage.$('xpath=/html/body/ark-popup');
          if (popup) {
            const closeBtn = await newPage.$('xpath=/html/body/ark-popup/ark-div[1]/ark-span');
            if (closeBtn) {
              await closeBtn.click();
              console.log("Popup closed.");
              await newPage.waitForTimeout(1000);
            }
          }

          // LOOK FOR GAME IFRAME
          const widgetSelector = 'ark-div.ark-widget-app';
          await newPage.waitForSelector(widgetSelector, { timeout: 60000 });

          const widgetHandle = await newPage.$(widgetSelector);
          if (!widgetHandle) throw new Error("ark-widget-app not found.");

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
          let box = await gameIframe.boundingBox();
          if (!frame || !box) throw new Error("Iframe not ready");

          const position1 = { x: box.width / 2, y: box.height * 0.75 };
          const position2 = { x: box.width / 4, y: box.height * 0.20 };
          const position3 = { x: box.width / 4, y: box.height * 0.5 };

          let clickCount = 0;
          const maxClicks = 30;

          // ---- NEW LOGIC START ----
          // First position1 click
          await frame.locator("body").click({ position: position1, force: true });
          clickCount++;
          console.log("First position1 click done. Waiting 150s...");
          await newPage.waitForTimeout(150000);

          // CLOSE POPUP IF EXISTS (again)
          const popupAgain = await newPage.$('xpath=/html/body/ark-popup');
          if (popupAgain) {
            const closeBtnAgain = await newPage.$('xpath=/html/body/ark-popup/ark-div[1]/ark-span');
            if (closeBtnAgain) {
              await closeBtnAgain.click();
              console.log("Popup closed after delay.");
              await newPage.waitForTimeout(1000);
            }
          }

          // Second position1 click
          await frame.locator("body").click({ position: position1, force: true });
          clickCount++;
          // ---- NEW LOGIC END ----

          // Continue original logic
          while (clickCount < maxClicks) {
            for (const pos of [position2, position3]) {
              await frame.locator("body").click({ position: pos, force: true });
              clickCount++;
            }
          }

          loopCounter++;

        } catch (err) {
          console.log("Game error during play cycle:", err.message);
          break;
        }
      }

      await newPage.close();

    } catch (err) {
      console.log("Failed during NeoBux cycle:", err.message);
      loopCounter++;
    }
  }

  console.log("All loops completed.");
};