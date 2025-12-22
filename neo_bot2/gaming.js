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
      const maxGameEntryAttempts = 5;
      let gameEntryAttempt = 0;

      while (!gameEntrySuccess && gameEntryAttempt < maxGameEntryAttempts && loopCounter <= maxLoops) {
        gameEntryAttempt++;

        const refreshAndRestart = async () => {
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

      // -----------------------------
      // Gameplay cycles
      // -----------------------------
      for (let inner = 1; inner <= 5 && loopCounter <= maxLoops; inner++) {
        console.log(`--- Play Cycle ${loopCounter} ---`);

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

          // DISABLE BLOCKING HTML LAYER
          await newPage.evaluate(() => {
            const outerXPath = '/html/body/div[1]/div/div/main/ark-main-block/ark-article/ark-grid/ark-grid[4]/ark-div/ark-div/ark-div[2]/ark-div[3]/ark-div[6]';
            const innerXPath = outerXPath + '/ark-div[2]/ark-div[2]';

            const getByXPath = (xp) =>
              document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            const hide = () => {
              const el = getByXPath(innerXPath);
              if (el) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
              }
            };

            hide();
            new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
          });

          // -----------------------------
          // WAIT UP TO 120s FOR GAME IFRAME
          // -----------------------------
          console.log("Waiting up to 120s for game iframe...");
          const iframeStart = Date.now();
          let gameIframe = null;

          while (Date.now() - iframeStart < 120000 && !gameIframe) {
            const widgetHandle = await newPage.$('ark-div.ark-widget-app');
            if (widgetHandle) {
              const frames = await widgetHandle.$$('iframe[ark-test-id="ark-game-iframe"]');
              for (const fh of frames) {
                const src = await fh.getAttribute("src");
                if (src && src.includes("knife-smash")) {
                  gameIframe = fh;
                  break;
                }
              }
            }
            if (!gameIframe) await newPage.waitForTimeout(1000);
          }

          if (!gameIframe) throw new Error("Game iframe not found within 120s");

          console.log("Game iframe found.");

          const frame = await gameIframe.contentFrame();
          if (!frame) throw new Error("Iframe frame not ready");

          // -----------------------------
          // REAL RENDERED GAME TIME (190s)
          // -----------------------------
          console.log("Waiting 190s of REAL rendered game time...");
          await frame.evaluate(() => {
            const REQUIRED_MS = 190000;
            const start = performance.now();

            return new Promise(resolve => {
              function tick() {
                if (performance.now() - start >= REQUIRED_MS) {
                  resolve(true);
                } else {
                  requestAnimationFrame(tick);
                }
              }
              requestAnimationFrame(tick);
            });
          });

          // -----------------------------
          // CONTINUE ORIGINAL CLICK LOGIC
          // -----------------------------
          let box = await gameIframe.boundingBox();
          if (!box) throw new Error("Iframe box missing");

          const position1 = { x: box.width / 2, y: box.height * 0.75 };
          const position2 = { x: box.width / 4, y: box.height * 0.20 };
          const position3 = { x: box.width / 4, y: box.height * 0.5 };

          let clickCount = 0;
          const maxClicks = 30;

          for (let i = 0; i < 2; i++) {
            await frame.locator("body").click({ position: position1, force: true });
            clickCount++;
            await newPage.waitForTimeout(300);
          }

          while (clickCount < maxClicks) {
            for (const pos of [position2, position3]) {
              await frame.locator("body").click({ position: pos, force: true });
              clickCount++;
            }
          }

          loopCounter++;

        } catch (err) {
          console.log("Game error:", err.message);
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