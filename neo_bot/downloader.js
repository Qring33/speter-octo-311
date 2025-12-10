const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');

const folderUrl = "https://www.dropbox.com/scl/fo/5gh8ddvhx4zou49om4n12/AJAQtOXYAS2OCeQVjQOezw0?rlkey=6bva6uycb9fjcr7x9yybxk0kv&dl=1";
const jsonUrl   = "https://www.dropbox.com/scl/fi/8b2p7oc8fz8sa4rzt9s20/image_solver.json?rlkey=t3sz5hfc5aj17uu58w4ym3c9u&st=1t7n0wo0&dl=1"; // dl=1 for direct download
const tempZip   = "temp_download.zip";
const jsonFile  = "image_solver.json";

// Clean old data
if (fs.existsSync("neobux_accounts")) fs.rmSync("neobux_accounts", { recursive: true, force: true });
if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile);

console.log("Downloading neobux_accounts folder...");

function downloadWithRedirect(url, destination, onFinish) {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return downloadWithRedirect(res.headers.location, destination, onFinish);
        }

        if (res.statusCode !== 200) {
            console.error("Failed with status:", res.statusCode);
            process.exit(1);
        }

        const file = fs.createWriteStream(destination);
        res.pipe(file);

        file.on("finish", () => {
            file.close(onFinish);
        });

    }).on("error", (err) => {
        console.error("Download error:", err.message);
        process.exit(1);
    });
}

// 1. Download and extract the folder
downloadWithRedirect(folderUrl, tempZip, () => {
    console.log("Download finished. Extracting...");

    try {
        const zip = new AdmZip(tempZip);
        zip.extractAllTo(".", true);
        fs.unlinkSync(tempZip);

        if (fs.existsSync("__MACOSX")) {
            fs.rmSync("__MACOSX", { recursive: true, force: true });
        }

        // 2. Now download the json file
        downloadWithRedirect(jsonUrl, jsonFile, () => {
            console.log("Success! Your folder is ready: ./neobux_accounts");
            process.exit(0);
        });

    } catch (err) {
        console.error("Extraction failed:", err.message);
        process.exit(1);
    }
});