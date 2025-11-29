const { exec } = require('child_process');

const scripts = ['main.js'];
const totalRunsPerScript = 2; // how many times to repeat main.js
const timeoutMs = 10 * 60 * 1000;
const delayBetweenRuns = 2000;

let currentScriptIndex = 0;
let currentRun = 0;

console.log("Starting sequence — downloader.js → main.js loops → upload.js\n");

// ---------------------------
// STEP 0 — Run downloader.js ONCE
// ---------------------------
function runDownloader() {
    console.log("Running downloader.js (only once)...\n");

    const dl = exec("node downloader.js", { timeout: 5 * 60 * 1000 });
    dl.stdout.on("data", (d) => process.stdout.write(d));
    dl.stderr.on("data", (d) => process.stderr.write(d));

    dl.on("close", () => {
        console.log("downloader.js completed.\n");
        runMainScripts();
    });

    dl.on("error", (err) => {
        console.error("downloader.js failed:", err);
        runMainScripts(); // continue anyway
    });
}

// ---------------------------
// STEP 1 — Loop main.js N times
// ---------------------------
function runMainScripts() {
    const script = scripts[currentScriptIndex];

    if (!script) {
        return runUploadFinal();
    }

    if (currentRun >= totalRunsPerScript) {
        currentRun = 0;
        currentScriptIndex++;

        if (!scripts[currentScriptIndex]) {
            return runUploadFinal();
        }

        return setTimeout(runMainScripts, 1000);
    }

    currentRun++;
    console.log(`\n[${script}] Run ${currentRun} of ${totalRunsPerScript} starting...`);

    const instance = exec(`node ${script}`, { timeout: timeoutMs });
    instance.stdout.on("data", (d) => process.stdout.write(d));
    instance.stderr.on("data", (d) => process.stderr.write(d));

    instance.on("close", () => {
        setTimeout(runMainScripts, delayBetweenRuns);
    });

    instance.on("error", () => {
        setTimeout(runMainScripts, delayBetweenRuns);
    });
}

// ---------------------------
// STEP 2 — Run upload.js ONCE
// ---------------------------
function runUploadFinal() {
    console.log("\nRunning upload.js (only once)...\n");

    const up = exec("node upload.js", { timeout: 5 * 60 * 1000 });
    up.stdout.on("data", (d) => process.stdout.write(d));
    up.stderr.on("data", (d) => process.stderr.write(d));

    up.on("close", (code) => {
        if (code === 0) {
            console.log("\nAll tasks completed successfully!\n");
        } else {
            console.log(`\nupload.js exited with code ${code}\n`);
        }
    });

    up.on("error", (err) => {
        console.error("\nFailed to start upload.js:", err);
        console.log("\nSequence finished with errors.\n");
    });
}

// Start execution
runDownloader();
