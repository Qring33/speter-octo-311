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
      checkAccountsAndDecide();
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

// Step 2: Read neobux_accounts.json and count entries
function checkAccountsAndDecide() {
  const filePath = path.join(__dirname, 'neobux_accounts.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error("Could not read neobux_accounts.json:", err.message);
      console.log("Proceeding with normal flow anyway...\n");
      return startMainSequence();
    }

    try {
      const accounts = JSON.parse(data);

      if (!Array.isArray(accounts)) {
        console.warn("neobux_accounts.json does not contain an array. Proceeding normally...\n");
        return startMainSequence();
      }

      const count = accounts.length;
      console.log(`Found ${count} account(s) in neobux_accounts.json`);

      if (count === 96) {
        console.log("\n96 accounts detected! Skipping main.js and upload.js.");
        console.log("Running tel_sender.py now...\n");
        runTelSender();
      } else {
        console.log(`Only ${count}/96 accounts → Running normal flow: main.js → upload.js\n`);
        startMainSequence();
      }

    } catch (parseErr) {
      console.error("Invalid JSON in neobux_accounts.json:", parseErr.message);
      console.log("Proceeding with normal flow...\n");
      startMainSequence();
    }
  });
}

// Step 3: Normal flow — main.js (N times) → upload.js (once)
let currentRun = 0;

function startMainSequence() {
  if (currentRun >= RUNS_OF_MAIN) {
    return runUpload();
  }

  currentRun++;
  console.log(`Running main.js [\( {currentRun}/ \){RUNS_OF_MAIN}]...`);

  const main = exec("node main.js", { timeout: TIMEOUT_PER_SCRIPT });

  main.stdout.on("data", (d) => process.stdout.write(d));
  main.stderr.on("data", (d) => process.stderr.write(d));

  main.on("close", (code) => {
    console.log(`main.js run \( {currentRun} finished (code: \){code})\n`);
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

// Special path: 96 accounts → run tel_sender.py
function runTelSender() {
  console.log("Executing tel_sender.py...\n");

  const tel = exec("python3 tel_sender.py", { timeout: 15 * 60 * 1000 });

  tel.stdout.on("data", (d) => process.stdout.write(d));
  tel.stderr.on("data", (d) => process.stderr.write(d));

  tel.on("close", (code) => {
    console.log(`\ntel_sender.py finished with exit code ${code}`);
    console.log("\nSpecial 96-account sequence completed!\n");
  });

  tel.on("error", (err) => {
    console.error("tel_sender.py error:", err);
    console.log("\nSpecial sequence finished with errors.\n");
  });
}

// ========================= START =========================
runDownloader();