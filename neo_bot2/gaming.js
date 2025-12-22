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
    } catch {
      if (attempt < maxRetries) {
        console.log(`${name} not found, retrying (${attempt}/${maxRetries})...`);
        await page.waitForTimeout(2000);
      } else {
        console.log(`${name} not found after ${maxRetries} attempts.`);
        if (onFinalFailure) await onFinalFailure();
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
  let loopCounter = 1;

  while (loopCounter <= maxLoops) {
    console.log(`===== PLAY LOOP ${loopCounter} =====`);

    await page.goto("https://www.neobux.com/m/ag/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    try {
      await page.waitForSelector("#rwtd", { timeout: 10000 });

      const [newPage] = await Promise.all([
        context.waitForEvent("page"),
        page.click("#rwtd")
      ]);

      await newPage.waitForLoadState("domcontentloaded", { timeout: 30000 });
      await newPage.waitForTimeout(5000);

      await newPage.goto("https://gameplayneo.com/games/knife-smash/", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      const refresh = async () => {
        await newPage.reload({ waitUntil: "domcontentloaded" });
        await newPage.waitForTimeout(3000);
      };

      if (!await clickWithRetry(newPage, 'ark-div[ark-test-id="ark-play-now"]', 3, "Play Now", refresh)) {
        throw new Error("Play Now failed");
      }

      if (!await clickWithRetry(newPage, 'button.ark-ad-button[data-type="play-button"]', 3, "Ad Play", refresh)) {
        throw new Error("Ad Play failed");
      }

      // -----------------------------
      // WAIT FOR GAME IFRAME (REAL WAIT)
      // -----------------------------
      console.log("Waiting for game iframe (up to 60s)...");

      await newPage.waitForSelector("ark-div.ark-widget-app", { timeout: 120000 });

      let gameIframe = null;
      let frame = null;
      const startWait = Date.now();

      while (Date.now() - startWait < 120000) {
        const widget = await newPage.$("ark-div.ark-widget-app");
        if (widget) {
          const frames = await widget.$$('iframe[ark-test-id="ark-game-iframe"]');

          for (const f of frames) {
            const src = await f.getAttribute("src");
            if (src && src.includes("knife-smash")) {
              gameIframe = f;
              frame = await f.contentFrame();
              break;
            }
          }
        }

        if (frame) break;
        await newPage.waitForTimeout(1000);
      }

      if (!frame) {
        throw new Error("Game iframe not found after 60s");
      }

      console.log("Game iframe detected and active.");

      // -----------------------------
      // REAL GAME TIME WAIT
      // -----------------------------
      console.log("Waiting 230s of REAL rendered game time...");
      await frame.evaluate(() => {
        const REQUIRED_MS = 230000;
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

      console.log("Required game time completed.");

      await newPage.close();
      loopCounter++;

    } catch (err) {
      console.log("Gaming error:", err.message);
      break;
    }
  }

  console.log("All loops completed.");
};