const { spawn } = require("child_process");
const path = require("path");

// Time limit in milliseconds (2 hours)
const TIME_LIMIT = 2 * 60 * 60 * 1000;

(async () => {
  try {
    console.log("Starting downloader.js...");

    // Spawn downloader.js
    const downloaderProcess = spawn("node", [path.join(__dirname, "downloader.js")], {
      stdio: "inherit",
    });

    // Wait for downloader.js to finish
    downloaderProcess.on("exit", (code, signal) => {
      if (signal) {
        console.log(`downloader.js was terminated with signal ${signal}`);
        return;
      }
      if (code !== 0) {
        console.error(`downloader.js exited with code ${code}. Aborting.`);
        return;
      }

      console.log("downloader.js finished successfully. Starting main.js...");

      // Now spawn main.js
      const mainProcess = spawn("node", [path.join(__dirname, "main.js")], {
        stdio: "inherit",
      });

      // Kill main.js after time limit
      const timer = setTimeout(() => {
        console.log("Time limit reached. Terminating main.js...");
        mainProcess.kill("SIGTERM"); // or "SIGKILL" for forceful kill
      }, TIME_LIMIT);

      mainProcess.on("exit", (code, signal) => {
        clearTimeout(timer);
        if (signal) {
          console.log(`main.js was terminated with signal ${signal}`);
        } else {
          console.log(`main.js exited with code ${code}`);
        }
        console.log("All done!");
      });
    });

  } catch (err) {
    console.error("Runner encountered an error:", err.message);
  }
})();