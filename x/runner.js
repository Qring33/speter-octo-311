const { exec } = require("child_process");
const path = require("path");

/* =======================
   SCRIPTS TO RUN
======================= */

const scripts = [
  { command: "node unzip.js", name: "unzip.js" },
  { command: "python3 gem.py", name: "gem.py" },
  { command: "node main.js", name: "main.js" },
  { command: "node booster.js", name: "booster.js" },
];

/* =======================
   RUN FUNCTION
======================= */

function runScript(index = 0) {
  if (index >= scripts.length) {
    console.log("\nAll scripts executed successfully.");
    return;
  }

  const { command, name } = scripts[index];
  console.log(`\n[RUNNING] ${name} ...`);

  const child = exec(command, { cwd: __dirname });

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(`[DONE] ${name} finished successfully.`);
      runScript(index + 1);
    } else {
      console.error(`[ERROR] ${name} exited with code ${code}. Stopping.`);
      process.exit(code);
    }
  });
}

/* =======================
   START
======================= */

runScript();
