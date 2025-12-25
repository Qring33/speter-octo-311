const { exec, spawn } = require('child_process');

// List of scripts; disabled: true will skip running it
const scripts = [
    { name: "blog_post", cmd: "python3", args: ["-u", "blog_post.py"], disabled: false },
    { name: "vote", cmd: "python3", args: ["-u", "vote.py"], disabled: true },
    { name: "follow", cmd: "python3", args: ["-u", "follow.py"], disabled: true },
    { name: "pro_update", cmd: "python3", args: ["-u", "pro_update.py"], disabled: true }, // currently skipped
];

let index = 0;

function log(name, data) {
    process.stdout.write(`[${name}] ${data}`);
}

// Run downloader.js first
function runDownloader() {
    console.log("\n=== DOWNLOADER START ===\n");

    const p = exec("node downloader.js");

    p.stdout.on("data", (d) => log("downloader", d));
    p.stderr.on("data", (d) => log("downloader ERR", d));

    p.on("close", () => {
        console.log("\n=== DOWNLOADER DONE ===\n");
        runNextScript();
    });

    p.on("error", () => {
        console.log("\n=== DOWNLOADER FAILED ===\n");
        runNextScript();
    });
}

// Run scripts sequentially
function runNextScript() {
    if (index >= scripts.length) {
        console.log("\n=== ALL SCRIPTS FINISHED ===\n");
        return;
    }

    const { name, cmd, args, disabled } = scripts[index];
    index++;

    if (disabled) {
        console.log(`\n=== SKIPPING ${name} ===\n`);
        runNextScript();
        return;
    }

    console.log(`\n=== START ${name} ===\n`);

    const p = spawn(cmd, args, { cwd: process.cwd(), env: process.env });

    p.stdout.on("data", (d) => log(name, d));
    p.stderr.on("data", (d) => log(`${name} ERR`, d));

    p.on("close", (code) => {
        console.log(`\n=== ${name} EXIT ${code} ===\n`);
        setTimeout(runNextScript, 2000); // optional delay
    });

    p.on("error", (err) => {
        console.log(`\n=== FAILED ${name} ===`);
        console.error(err);
        setTimeout(runNextScript, 2000);
    });
}

// Start the workflow
runDownloader();
