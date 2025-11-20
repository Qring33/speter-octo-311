// runner.js
// Usage: node runner.js

const { exec } = require('child_process');

// Configuration
const scripts = [
  'main.js',
  'main_1.js',
];
const totalRunsPerScript = 10;
const timeoutMs = 10 * 60 * 1000; // 10 minutes
const delayBetweenRuns = 2000;    // 2 seconds
const delayBetweenScripts = 3000; // 3 seconds

let currentScriptIndex = 0;
let currentRun = 0;

console.log(`Starting batch sequence — each script will run ${totalRunsPerScript} times.\n`);

function runScript() {
  if (currentScriptIndex >= scripts.length) {
    console.log(`\nAll Node.js scripts completed! Running push.py once...`);
    exec('python3 push.py', (err, stdout, stderr) => {
      if (err) {
        console.error(`push.py failed: ${err.message}`);
        process.exit(1);
      }
      if (stderr) process.stderr.write(stderr);
      if (stdout) process.stdout.write(stdout);
      console.log(`push.py executed successfully. Entire batch finished.`);
      process.exit(0);
    });
    return;
  }

  const script = scripts[currentScriptIndex];

  if (currentRun >= totalRunsPerScript) {
    console.log(`Finished all \( {totalRunsPerScript} runs for \){script}. Moving to next script...\n`);
    currentRun = 0;
    currentScriptIndex++;
    setTimeout(runScript, delayBetweenScripts);
    return;
  }

  currentRun++;
  console.log(`\n [\( {script}] Run \){currentRun}/${totalRunsPerScript} starting...`);

  const startTime = Date.now();
  const child = exec(`node ${script}`, { timeout: timeoutMs });

  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (code === 0) {
      console.log(` [\( {script}] Run \){currentRun} succeeded (${duration}s)`);
    } else {
      console.warn(` [\( {script}] Run \){currentRun} failed (code ${code}) – continuing`);
    }
    setTimeout(runScript, delayBetweenRuns);
  });

  child.on('error', (err) => {
    console.error(` [\( {script}] Spawn error on run \){currentRun}: ${err.message}`);
    setTimeout(runScript, delayBetweenRuns);
  });
}

runScript();