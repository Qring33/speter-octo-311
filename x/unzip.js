const AdmZip = require("adm-zip");
const https = require("https");
const fs = require("fs");
const path = require("path");

/* =======================
   UNZIP x_only_profile.zip
======================= */

try {
  const zipPath = path.resolve(__dirname, "x_only_profile.zip");
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(__dirname, true);
  console.log("x_only_profile.zip extracted successfully");
} catch (err) {
  console.error("Error extracting x_only_profile.zip:", err);
}

/* =======================
   DOWNLOAD gemini_api.txt
======================= */

const fileUrl =
  "https://www.dropbox.com/scl/fi/ymiblunv395rryh0x7fww/gemini_api.txt?rlkey=ntgb7ykme4dzwxjcb6r6euvhn&dl=1";

const outputPath = path.resolve(__dirname, "gemini_api.txt");

function download(url) {
  https.get(url, (res) => {
    // Follow redirects (Dropbox)
    if (res.statusCode === 301 || res.statusCode === 302) {
      res.destroy();
      return download(res.headers.location);
    }

    if (res.statusCode !== 200) {
      console.error("Download failed with status:", res.statusCode);
      res.destroy();
      process.exit(1);
      return;
    }

    const file = fs.createWriteStream(outputPath);

    res.pipe(file);

    file.on("finish", () => {
      file.close(() => {
        res.destroy(); // ensure socket closes
        console.log("gemini_api.txt downloaded successfully");
        process.exit(0); // clean exit
      });
    });

    file.on("error", (err) => {
      console.error("File write error:", err.message);
      res.destroy();
      process.exit(1);
    });
  }).on("error", (err) => {
    console.error("Download error:", err.message);
    process.exit(1);
  });
}

download(fileUrl);