// batch_main.js
// Usage: node batch_main.js

const { exec } = require('child_process');

// 🧩 Configuration
const scripts = [
  'main.js',
  'main_1.js',
];
const totalRunsPerScript = 10;
const timeoutMs = 10 * 60 * 1000; // 10 minutes
const delayBetweenRuns = 2000;   // 2 seconds between individual runs
const delayBetweenScripts = 3000; // pause before switching to next script

let currentScriptIndex = 0;
let currentRun = 0;

console.log(`🚀 Starting batch sequence — each script will run ${totalRunsPerScript} times.\n`);

function runScript() {
  // All scripts and all runs are done → execute push.py ONCE and exit
  if (currentScriptIndex >= scripts.length) {
    console.log(`\n🎉 All Node.js scripts completed! Running push.py once...`);
    exec('python3 push.py', (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ push.py failed: ${err.message}`);
        process.exit(1);
      }
      if (stderr) process.stderr.write(stderr);
      if (stdout) process.stdout.write(stdout);

      console.log(`✅ push.py executed successfully. Entire batch finished.`);
      process.exit(0);
    });
    return;
  }

  const script = scripts[currentScriptIndex];

  // Finished all runs for current script → move to next script
  if (currentRun >= totalRunsPerScript) {
    console.log(`🏁 Finished all \( {totalRunsPerScript} runs for \){script}. Moving to next script...\n`);
    currentRun = 0;
    currentScriptIndex++;
    setTimeout(runScript, delayBetweenScripts);
    return;
  }

  currentRun++;
  console.log(`\n⚙️  [\( {script}] Run \){currentRun}/${totalRunsPerScript} starting...`);

  const startTime = Date.now();
  const processInstance = exec(`node ${script}`, { timeout: timeoutMs });

  processInstance.stdout.on('data', (data) => process.stdout.write(data));
  processInstance.stderr.on('data', (data) => process.stderr.write(data));

  processInstance.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (code === 0) {
      console.log(`✅ [\( {script}] Run \){currentRun} succeeded (${duration}s)`);
    } else {
      console.warn(`⚠️ [\( {script}] Run \){currentRun} failed (code ${code}) – continuing anyway`);
    }
    setTimeout(runScript, delayBetweenRuns);
  });

  processInstance.on('error', (err) => {
    console.error(`❌ [\( {script}] Spawn error on run \){currentRun}: ${err.message}`);
    setTimeout(runScript, delayBetweenRuns);
  });
}

// Start the chain
runScript();