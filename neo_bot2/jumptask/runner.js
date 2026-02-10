const { execSync } = require("child_process");
const path = require("path");

(async () => {
  try {
    console.log("Starting downloader.js...");

    // Run downloader.js
    execSync(`node ${path.join(__dirname, "downloader.js")}`, { stdio: "inherit" });

    console.log("downloader.js completed. Now running main.js...");

    // Run main.js
    execSync(`node ${path.join(__dirname, "main.js")}`, { stdio: "inherit" });

    console.log("main.js completed. All done!");
  } catch (err) {
    console.error("Runner encountered an error:", err.message);
  }
})();
