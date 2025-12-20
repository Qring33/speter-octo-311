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
        console.log(`\( {name} not found, retrying ( \){attempt}/${maxRetries})...`);
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
  const maxLoops = 3;          // TOTAL plays 105
  const globalEvery = 2;       // GLOBAL LOOP every 40 plays
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

    // -----------------------------
    // Robust reward page load with retry + refresh (up to 3 attempts)
    // -----------------------------
    let rewardPageSuccess = false;
    const maxRewardAttempts = 3;

    for (let rewardAttempt = 1; rewardAttempt <= maxRewardAttempts; rewardAttempt++) {
      console.log(`Navigating to game rewards page... (Attempt \( {rewardAttempt}/ \){maxRewardAttempts})`);
      
      try {
        await page.goto("https://www.neobux.com/m/ag/", {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        // Primary selector: the container td that holds "Play now"
        let rewardButtonClicked = false;

        // First try: click the <td id="pntd"> (the actual clickable "Play now" cell)
        try {
          await page.waitForSelector('#pntd', { state: "visible", timeout: 10000 });
          const [newPage] = await Promise.all([
            context.waitForEvent("page"),
            page.click('#pntd')
          ]);
          console.log("Successfully clicked #pntd (Play now cell)");
          rewardButtonClicked = true;

          await newPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
          await newPage.waitForTimeout(5000);
        } catch (err) {
          console.log("#pntd not found after 10s, trying fallback XPath...");

          // Fallback: use provided XPath pointing to the parent <a> that wraps the table
          const fallbackXPath = '/html/body/div[2]/div/div[2]/div[2]/div[2]/a/table';

          await page.waitForSelector(`xpath=${fallbackXPath}`, { state: "visible", timeout: 10000 });

          const [newPage] = await Promise.all([
            context.waitForEvent("page"),
            page.evaluate((xp) => {
              const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              if (el) el.click();
            }, fallbackXPath)
          ]);

          console.log("Successfully clicked fallback XPath reward button");
          rewardButtonClicked = true;

          await newPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
          await newPage.waitForTimeout(5000);
        }

        if (!rewardButtonClicked) {
          throw new Error("Neither #pntd nor fallback XPath worked");
        }

        // Success → proceed
        rewardPageSuccess = true;

        console.log("Opening Knife Smash...");
        await newPage.goto("https://gameplayneo.com/games/knife-smash/", {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        console.log("Knife Smash game page loaded.");

        // -----------------------------
        // Robust game entry with refresh on failure
        // -----------------------------
        let gameEntrySuccess = false;
        const maxGameEntryAttempts = 5;
        let gameEntryAttempt = 0;

        while (!gameEntrySuccess && gameEntryAttempt < maxGameEntryAttempts && loopCounter <= maxLoops) {
          gameEntryAttempt++;
          console.log(`Game entry attempt \( {gameEntryAttempt}/ \){maxGameEntryAttempts}`);

          const refreshAndRestart = async () => {
            console.log("Refreshing Knife Smash page and restarting play sequence...");
            await newPage.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
            await newPage.waitForTimeout(3000);
          };

          // Click "Play Now"
          const playNowClicked = await clickWithRetry(
            newPage,
            'ark-div[ark-test-id="ark-play-now"]',
            3,
            "Play Now button",
            refreshAndRestart
          );

          if (!playNowClicked) {
            console.log("Failed to click Play Now even after retries. Retrying full entry...");
            continue;
          }

          // Click "ad/play button"
          const adPlayClicked = await clickWithRetry(
            newPage,
            'button.ark-ad-button[data-type="play-button"]',
            3,
            "ad/play button",
            refreshAndRestart
          );

          if (!adPlayClicked) {
            console.log("Failed to click ad/play button. Retrying full entry...");
            continue;
          }

          gameEntrySuccess = true;
        }

        if (!gameEntrySuccess) {
          console.log("Failed to enter game after multiple attempts. Skipping this cycle.");
          await newPage.close();
          loopCounter++;
          break; // Exit reward retry loop
        }

        // -----------------------------
        // Actual gameplay loops (2 plays per reward tab)
        // -----------------------------
        for (let inner = 1; inner <= 2 && loopCounter <= maxLoops; inner++) {
          console.log(`--- Play Cycle ${loopCounter} ---`);

          console.log("Waiting 150s for game iframe...");
          await newPage.waitForTimeout(150000);

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

            // DISABLE BLOCKING HTML LAYER (PERMANENT)
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

            // LOOK FOR GAME IFRAME
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
              throw new Error("Game iframe missing");
            }

            console.log("Correct game iframe found.");

            const frame = await gameIframe.contentFrame();
            let box = await gameIframe.boundingBox();
            if (!frame || !box) throw new Error("Iframe not ready");

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

            loopCounter++; // Increment only after successful play

          } catch (err) {
            console.log("Game error during play cycle:", err.message);
            // Do not increment loopCounter on gameplay error
          }
        }

        await newPage.close();
        break; // Success → exit reward retry loop

      } catch (err) {
        console.log(`Failed to click reward button on attempt ${rewardAttempt}:`, err.message);
        
        if (rewardAttempt < maxRewardAttempts) {
          console.log("Refreshing rewards page and retrying...");
          await page.waitForTimeout(3000);
        } else {
          console.log("Failed to access reward button after 3 attempts. Moving to next global cycle.");
          loopCounter++;
        }
      }
    }

    if (!rewardPageSuccess && loopCounter > maxLoops) {
      break;
    }
  }

  console.log("All loops completed.");
};