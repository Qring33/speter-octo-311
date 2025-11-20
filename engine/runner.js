// batch_main.js
// Usage: node batch_main.js

const { exec } = require('child_process');

const scripts = ['main.js', 'main_1.js'];
const totalRunsPerScript = 10;
const timeoutMs = 10 * 60 * 1000; // 10 minutes
const delayBetweenRuns = 2000;    // 2 seconds

let currentScriptIndex = 0;
let currentRun = 0;
let nodeScriptsDone = false;

console.log("🚀 Starting batch sequence 🚀 each script will run " + totalRunsPerScript + " times.\n");

function runScript() {
  if (nodeScriptsDone) {
    runPushOnce();
    return;
  }

  const script = scripts[currentScriptIndex];

  if (!script) {
    console.log("✅ All Node.js scripts completed (" + scripts.length + " × " + totalRunsPerScript + " runs)\n");
    nodeScriptsDone = true;
    setTimeout(runScript, 3000);
    return;
  }

  if (currentRun >= totalRunsPerScript) {
    console.log("✔ Finished all " + totalRunsPerScript + " runs for " + script + ". Moving to next script...\n");
    currentRun = 0;
    currentScriptIndex++;
    setTimeout(runScript, 3000);
    return;
  }

  currentRun++;
  console.log("\n🔥 [" + script + "] Run " + currentRun + " of " + totalRunsPerScript + " starting...");

  const startTime = Date.now();
  const child = exec("node " + script, { timeout: timeoutMs });

  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));

  child.on('close', code => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (code === 0) {
      console.log("✅ [" + script + "] Run " + currentRun + " completed successfully in " + duration + "s.");
    } else {
      console.log("❌ [" + script + "] Run " + currentRun + " failed (exit code " + code + "). Continuing anyway...");
    }
    setTimeout(runScript, delayBetweenRuns);
  });

  child.on('error', err => {
    console.error("⚠️ [" + script + "] Process error on run " + currentRun + ": " + err.message);
    setTimeout(runScript, delayBetweenRuns);
  });
}

function runPushOnce() {
  console.log("🐍 Running final step: python3 push.py (only once)\n");
  const p = exec('python3 push.py');
  p.stdout.on('data', d => process.stdout.write(d));
  p.stderr.on('data', d => process.stderr.write(d));
  p.on('close', code => {
    if (code === 0) {
      console.log("🎉 python3 push.py finished successfully!");
    } else {
      console.log("❌ python3 push.py exited with code " + code);
    }
    console.log("\n🏁 Entire batch process completed! Goodbye! 🏁\n");
    process.exit(code);
  });

  p.on('error', err => {
    console.error("💥 Failed to start python3 push.py: " + err.message);
    process.exit(1);
  });
}

// Start
runScript();