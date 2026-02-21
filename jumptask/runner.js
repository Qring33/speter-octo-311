const { spawn } = require("child_process");
const path = require("path");

// Time limit in milliseconds (2 hours)
const TIME_LIMIT = 2 * 60 * 60 * 1000;

(async () => {
  try {
    console.log("Starting main.js...");

    const mainProcess = spawn("node", [path.join(__dirname, "main.js")], {
      stdio: "inherit",
    });

    // Kill the process after 2 hours
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

  } catch (err) {
    console.error("Runner encountered an error:", err.message);
  }
})();