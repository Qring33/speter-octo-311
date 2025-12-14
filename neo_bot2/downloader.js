const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');

// Dropbox folder URLs (downloaded as ZIP)
const sessionFolderZipUrl = "https://www.dropbox.com/scl/fo/6a9gdztfcwt88crixsd6h/AJ_V2Ok4Yv5PC94W9KHnTRk?rlkey=wn5exayw7d77c6w5cm49r96sp&dl=1";
const neobuxAccountsZipUrl = "https://www.dropbox.com/scl/fo/5gh8ddvhx4zou49om4n12/AJAQtOXYAS2OCeQVjQOezw0?rlkey=6bva6uycb9fjcr7x9yybxk0kv&dl=1";

// Other JSON file
const imageSolverUrl = "https://www.dropbox.com/scl/fi/8b2p7oc8fz8sa4rzt9s20/image_solver.json?rlkey=t3sz5hfc5aj17uu58w4ym3c9u&dl=1";
const imageSolverPath = "image_solver.json";

// ZIP destinations
const sessionZipPath = "session.zip";
const neobuxAccountsZipPath = "neobux_accounts.zip";

// Remove old files/folders
if (fs.existsSync(imageSolverPath)) fs.unlinkSync(imageSolverPath);
if (fs.existsSync(sessionZipPath)) fs.unlinkSync(sessionZipPath);
if (fs.existsSync(neobuxAccountsZipPath)) fs.unlinkSync(neobuxAccountsZipPath);
if (fs.existsSync("./session")) fs.rmSync("./session", { recursive: true, force: true });
if (fs.existsSync("./neobux_accounts")) fs.rmSync("./neobux_accounts", { recursive: true, force: true });

console.log("Cleaned old files/folders");

function download(url, dest, done) {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return download(res.headers.location, dest, done);
        }
        if (res.statusCode !== 200) {
            console.error("Failed with status:", res.statusCode);
            process.exit(1);
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);

        file.on("finish", () => file.close(done));
        file.on("error", err => {
            console.error("File write error:", err);
            process.exit(1);
        });

    }).on("error", (err) => {
        console.error("Download error:", err.message);
        process.exit(1);
    });
}

function unzipAndRemove(zipPath, extractTo) {
    console.log(`Unzipping ${zipPath} → ${extractTo}`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractTo, true);
    fs.unlinkSync(zipPath);
    console.log(`Deleted zip: ${zipPath}`);
}

// Download image_solver.json
download(imageSolverUrl, imageSolverPath, () => {
    console.log("Downloaded image_solver.json → ./");

    // Download session folder
    download(sessionFolderZipUrl, sessionZipPath, () => {
        unzipAndRemove(sessionZipPath, "./session");

        // Download neobux_accounts folder
        download(neobuxAccountsZipUrl, neobuxAccountsZipPath, () => {
            unzipAndRemove(neobuxAccountsZipPath, "./neobux_accounts");

            console.log("All files and folders ready.");
            process.exit(0);
        });
    });
});