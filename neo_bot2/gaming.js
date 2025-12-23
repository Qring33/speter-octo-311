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

      await newPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
      await newPage.waitForTimeout(5000);

      await newPage.goto("https://gameplayneo.com/games/knife-smash/", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      let gameEntrySuccess = false;

      while (!gameEntrySuccess) {

        const playNowClicked = await clickWithRetry(
          newPage,
          'ark-div[ark-test-id="ark-play-now"]',
          3,
          "Play Now button"
        );
        if (!playNowClicked) continue;

        const adPlayClicked = await clickWithRetry(
          newPage,
          'button.ark-ad-button[data-type="play-button"]',
          3,
          "ad/play button"
        );
        if (!adPlayClicked) continue;

        gameEntrySuccess = true;
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
              await newPage.waitForTimeout(1000);
            }
          }

          // LOOK FOR GAME IFRAME
          const widgetSelector = 'ark-div.ark-widget-app';
          await newPage.waitForSelector(widgetSelector, { timeout: 60000 });

          const widgetHandle = await newPage.$(widgetSelector);
          const iframeHandles = await widgetHandle.$$('iframe[ark-test-id="ark-game-iframe"]');

          let gameIframe = null;
          for (const fh of iframeHandles) {
            const src = await fh.getAttribute("src");
            if (src && src.includes("knife-smash")) {
              gameIframe = fh;
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

          // NEW REQUESTED LOGIC
          await frame.locator("body").click({ position: position1, force: true });
          clickCount++;

          console.log("First position1 click done. Waiting 150s...");
          await newPage.waitForTimeout(150000);

          // CLOSE POPUP IF EXISTS AGAIN
          const popupAgain = await newPage.$('xpath=/html/body/ark-popup');
          if (popupAgain) {
            const closeBtnAgain = await newPage.$('xpath=/html/body/ark-popup/ark-div[1]/ark-span');
            if (closeBtnAgain) {
              await closeBtnAgain.click();
              await newPage.waitForTimeout(1000);
            }
          }

          await frame.locator("body").click({ position: position1, force: true });
          clickCount++;

          // ORIGINAL CLICK LOGIC CONTINUES
          while (clickCount < maxClicks) {
            for (const pos of [position2, position3]) {
              await frame.locator("body").click({ position: pos, force: true });
              clickCount++;
            }
          }

          // PLAY AGAIN LOGIC (RESTORED)
          let playAgainSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            await newPage.waitForTimeout(5000);
            const endContainer = await newPage.$('ark-div.ark-game-end-container');
            if (!endContainer) continue;

            const playAgainBtn = await endContainer.$(
              'ark-div[ark-test-id="ark-play-again-button"]'
            );
            if (playAgainBtn) {
              await playAgainBtn.click();
              playAgainSuccess = true;
              break;
            }
          }

          if (!playAgainSuccess) break;

          // RE-CLICK AD/PLAY BUTTON
          const adPlayClickedAgain = await clickWithRetry(
            newPage,
            'button.ark-ad-button[data-type="play-button"]',
            3,
            "ad/play button (post-restart)"
          );
          if (!adPlayClickedAgain) break;

          loopCounter++;

        } catch (err) {
          console.log("Game error:", err.message);
          break;
        }
      }

      await newPage.close();

    } catch (err) {
      loopCounter++;
    }
  }

  console.log("All loops completed.");
};