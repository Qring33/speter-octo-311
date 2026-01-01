const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ========================= CONFIGURATION =========================
const RUNS_OF_MAIN = 1;                    // How many times to run main.js
const DELAY_BETWEEN_RUNS = 2000;           // ms
const GLOBAL_TIMEOUT_MS = 60 * 60 * 1000;  // 1 hour
// =================================================================

console.log("Starting automation sequence...\n");

let currentRun = 0;
let activeProcess = null;
let timedOut = false;

// ========================= GLOBAL TIMEOUT =========================
const globalTimer = setTimeout(() => {
  timedOut = true;
  console.error("\n⏰ Global timeout reached (1 hour). Stopping execution...");

  if (activeProcess) {
    console.error("Terminating active process...");
    activeProcess.kill('SIGTERM');
  }

  console.log("Exiting gracefully.");
  process.exit(0);
}, GLOBAL_TIMEOUT_MS);

// ========================= STEP 1 =========================
function runDownloader() {
  if (timedOut) return;

  console.log("Running downloader.js...\n");

  activeProcess = exec("node downloader.js");

  activeProcess.stdout.on("data", (d) => process.stdout.write(d));
  activeProcess.stderr.on("data", (d) => process.stderr.write(d));

  activeProcess.on("close", (code) => {
    activeProcess = null;

    console.log(`downloader.js finished with code ${code}\n`);
    if ((code === 0 || code === null) && !timedOut) {
      startMainSequence();
    } else {
      console.error("downloader.js failed. Aborting sequence.");
      clearTimeout(globalTimer);
      process.exit(1);
    }
  });

  activeProcess.on("error", (err) => {
    activeProcess = null;
    console.error("Error running downloader.js:", err);
    clearTimeout(globalTimer);
    process.exit(1);
  });
}

// ========================= STEP 2 =========================
function startMainSequence() {
  if (timedOut) return;

  if (currentRun >= RUNS_OF_MAIN) {
    return runUpload();
  }

  currentRun++;
  console.log(`Running main.js [${currentRun}/${RUNS_OF_MAIN}]...`);

  activeProcess = exec("node main.js");

  activeProcess.stdout.on("data", (d) => process.stdout.write(d));
  activeProcess.stderr.on("data", (d) => process.stderr.write(d));

  activeProcess.on("close", (code) => {
    activeProcess = null;

    console.log(`main.js run ${currentRun} finished (code: ${code})\n`);
    if (!timedOut) {
      setTimeout(startMainSequence, DELAY_BETWEEN_RUNS);
    }
  });

  activeProcess.on("error", (err) => {
    activeProcess = null;
    console.error("Error in main.js:", err);
    if (!timedOut) {
      setTimeout(startMainSequence, DELAY_BETWEEN_RUNS);
    }
  });
}

// ========================= STEP 3 =========================
function runUpload() {
  if (timedOut) return;

  console.log("All main.js runs completed.");
  console.log("Running upload.js once...\n");

  activeProcess = exec("node upload.js");

  activeProcess.stdout.on("data", (d) => process.stdout.write(d));
  activeProcess.stderr.on("data", (d) => process.stderr.write(d));

  activeProcess.on("close", (code) => {
    activeProcess = null;

    console.log(`\nupload.js finished with exit code ${code}`);
    console.log("\nFull sequence completed successfully!\n");
    clearTimeout(globalTimer);
    process.exit(0);
  });

  activeProcess.on("error", (err) => {
    activeProcess = null;
    console.error("upload.js failed:", err);
    clearTimeout(globalTimer);
    process.exit(1);
  });
}

// ========================= START =========================
runDownloader();