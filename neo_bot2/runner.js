const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ========================= CONFIGURATION =========================
const RUNS_OF_MAIN = 1;                    // How many times to run main.js
const DELAY_BETWEEN_RUNS = 2000;           // ms
const TIMEOUT_PER_SCRIPT = 10 * 60 * 1000; // 10 minutes
// =================================================================

console.log("Starting automation sequence...\n");

// Step 1: Run downloader.js first
function runDownloader() {
  console.log("Running downloader.js...\n");

  const downloader = exec("node downloader.js", { timeout: TIMEOUT_PER_SCRIPT });

  downloader.stdout.on("data", (d) => process.stdout.write(d));
  downloader.stderr.on("data", (d) => process.stderr.write(d));

  downloader.on("close", (code) => {
    console.log(`downloader.js finished with code ${code}\n`);
    if (code === 0 || code === null) {
      startMainSequence();
    } else {
      console.error("downloader.js failed. Aborting sequence.");
      process.exit(1);
    }
  });

  downloader.on("error", (err) => {
    console.error("Error running downloader.js:", err);
    process.exit(1);
  });
}

// Step 2: Normal flow — main.js (N times) → upload.js (once)
let currentRun = 0;

function startMainSequence() {
  if (currentRun >= RUNS_OF_MAIN) {
    return runUpload();
  }

  currentRun++;
  console.log(`Running main.js [${currentRun}/${RUNS_OF_MAIN}]...`);

  const main = exec("node main.js", { timeout: TIMEOUT_PER_SCRIPT });

  main.stdout.on("data", (d) => process.stdout.write(d));
  main.stderr.on("data", (d) => process.stderr.write(d));

  main.on("close", (code) => {
    console.log(`main.js run ${currentRun} finished (code: ${code})\n`);
    setTimeout(startMainSequence, DELAY_BETWEEN_RUNS);
  });

  main.on("error", (err) => {
    console.error("Error in main.js:", err);
    setTimeout(startMainSequence, DELAY_BETWEEN_RUNS);
  });
}

function runUpload() {
  console.log("All main.js runs completed.");
  console.log("Running upload.js once...\n");

  const upload = exec("node upload.js", { timeout: TIMEOUT_PER_SCRIPT });

  upload.stdout.on("data", (d) => process.stdout.write(d));
  upload.stderr.on("data", (d) => process.stderr.write(d));

  upload.on("close", (code) => {
    console.log(`\nupload.js finished with exit code ${code}`);
    console.log("\nFull sequence completed successfully!\n");
  });

  upload.on("error", (err) => {
    console.error("upload.js failed:", err);
    console.log("\nSequence finished with errors.\n");
  });
}

// ========================= START =========================
runDownloader();
