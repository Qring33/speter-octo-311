// batch_creator.js
// Usage: node batch_creator.js

const { exec } = require('child_process');

const totalRuns = 3;
let currentRun = 0;

console.log(`🚀 Starting batch creator — will run creator.js ${totalRuns} times, then run push.py ONCE.\n`);

function runCreator() {
  if (currentRun >= totalRuns) {
    console.log(`\n✅ All ${totalRuns} creator.js runs completed successfully!`);
    console.log(`🚀 Now running push.py ONCE...\n`);

    // Run push.py only once after everything is done
    const pushProcess = exec('python3 push.py');

    pushProcess.stdout.on('data', (data) => process.stdout.write(data));
    pushProcess.stderr.on('data', (data) => process.stderr.write(data));

    pushProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n🎉 push.py completed successfully!`);
      } else {
        console.error(`\n❌ push.py failed with exit code ${code}`);
      }
      console.log(`\n🏁 Entire batch process finished.`);
      process.exit(code);
    });

    pushProcess.on('error', (err) => {
      console.error(`\n❌ Failed to start push.py: ${err.message}`);
      process.exit(1);
    });

    return;
  }

  currentRun++;
  console.log(`\n⚙️  Run \( {currentRun}/ \){totalRuns} — starting creator.js...`);

  const startTime = Date.now();
  const processInstance = exec('node creator.js', { timeout: 10 * 60 * 1000 }); // 10 min timeout

  processInstance.stdout.on('data', (data) => process.stdout.write(data));
  processInstance.stderr.on('data', (data) => process.stderr.write(data));

  processInstance.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (code === 0) {
      console.log(`✅ Run \( {currentRun} succeeded ( \){duration}s)`);
    } else {
      console.warn(`⚠️ Run \( {currentRun} failed (code \){code}) — continuing anyway...`);
    }

    // Continue to next run
    setTimeout(runCreator, 2000);
  });

  processInstance.on('error', (err) => {
    console.error(`❌ Error starting run \( {currentRun}: \){err.message}`);
    setTimeout(runCreator, 2000);
  });
}

// Start the chain
runCreator();
