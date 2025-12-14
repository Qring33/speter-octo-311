// gaming.js

// -----------------------------
// Helper to retry clicks
// -----------------------------
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

// -----------------------------
// Main gaming function
// -----------------------------
module.exports = async function gaming(page) {
  const context = page.context();
  const maxLoops = 3;          // TOTAL plays 105
  const globalEvery = 2;        // GLOBAL LOOP every 40 plays
  let loopCounter = 1;
  let globalLoop = 1;

  while (loopCounter <= maxLoops) {

    // -----------------------------
    // GLOBAL LOOP LOG (every 40)
    // -----------------------------
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

      await clickWithRetry(
        newPage,
        'ark-div[ark-test-id="ark-play-now"]',
        3,
        "Play Now button"
      );

      for (let inner = 1; inner <= 2 && loopCounter <= maxLoops; inner++) {
        console.log(`--- Play Cycle ${loopCounter} ---`);

        await clickWithRetry(
          newPage,
          'button.ark-ad-button[data-type="play-button"]',
          3,
          "ad/play button"
        );

        console.log("Waiting 150s for game iframe...");
        await newPage.waitForTimeout(150000);

        try {
          // -----------------------------
          // CLOSE POPUP IF EXISTS
          // -----------------------------
          const popup = await newPage.$('xpath=/html/body/ark-popup');
          if (popup) {
            const closeBtn = await newPage.$('xpath=/html/body/ark-popup/ark-div[1]/ark-span');
            if (closeBtn) {
              await closeBtn.click();
              console.log("Popup closed.");
              await newPage.waitForTimeout(1000);
            }
          }

          // -----------------------------
          // DISABLE BLOCKING HTML LAYER (PERMANENT)
          // -----------------------------
          await newPage.evaluate(() => {
            const outerXPath = '/html/body/div[1]/div/div/main/ark-main-block/ark-article/ark-grid/ark-grid[4]/ark-div/ark-div/ark-div[2]/ark-div[3]/ark-div[6]';
            const innerXPath = outerXPath + '/ark-div[2]/ark-div[2]';

            const getByXPath = (xp) =>
              document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                .singleNodeValue;

            const hide = () => {
              const el = getByXPath(innerXPath);
              if (el) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
              }
            };

            hide();

            new MutationObserver(hide).observe(document.body, {
              childList: true,
              subtree: true
            });
          });

          // -----------------------------
          // LOOK FOR GAME IFRAME
          // -----------------------------
          const widgetSelector = 'ark-div.ark-widget-app';
          await newPage.waitForSelector(widgetSelector, { timeout: 60000 });

          const widgetHandle = await newPage.$(widgetSelector);
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
            break;
          }

          console.log("Correct game iframe found.");

          const frame = await gameIframe.contentFrame();
          let box = await gameIframe.boundingBox();
          if (!frame || !box) break;

          const position1 = { x: box.width / 2, y: box.height * 0.75 };
          const position2 = { x: box.width / 4, y: box.height * 0.20 };
          const position3 = { x: box.width / 4, y: box.height * 0.5 };

          let clickCount = 0;
          const maxClicks = 30;

          try {
            box = await gameIframe.boundingBox();
            if (!box) throw new Error();
            await frame.locator("body").click({ position: position1, force: true });
            clickCount++;
            await newPage.waitForTimeout(300);
          } catch {}

          while (clickCount < maxClicks) {
            box = await gameIframe.boundingBox();
            if (!box) break;

            for (const pos of [position2, position3]) {
              box = await gameIframe.boundingBox();
              if (!box) break;

              try {
                await frame.locator("body").click({ position: pos, force: true });
                clickCount++;
              } catch {
                clickCount = maxClicks;
                break;
              }
            }
          }

          while (true) {
            console.log("Waiting 5s and checking for Play Again...");
            await newPage.waitForTimeout(5000);

            const endContainer = await newPage.$('ark-div.ark-game-end-container');
            if (!endContainer) continue;

            const playAgainBtn = await endContainer.$(
              'ark-div[ark-test-id="ark-play-again-button"]'
            );

            if (playAgainBtn) {
              await playAgainBtn.click();
              console.log("Clicked Play Again button.");
              break;
            }
          }

        } catch (err) {
          console.log("Game error:", err.message);
        }

        loopCounter++;
      }

      await newPage.close();

    } catch (err) {
      console.log("Failed during NeoBux cycle:", err.message);
      loopCounter++;
    }
  }

  console.log("All loops completed.");
};