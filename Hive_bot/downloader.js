const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

const zipUrl = "https://www.dropbox.com/scl/fo/fmfmi8ponzrdbnui7n5df/AGFalLfx-cTjkRBtEjvr0Hc?rlkey=039hpjf7ipizdza7edqv082tr&st=fpwjatp6&dl=1";
const jsonUrl = "https://www.dropbox.com/scl/fi/2ei8dwa694bnuu67uhns8/key.json?rlkey=k34mho22158reckeemcg08csr&st=9mgwg3c2&dl=1";

const zipFile = "hive_accounts.zip";
const jsonFile = "key.json";

const folder1 = "hive_accounts";
const copies = [
    "hive_accounts_1",
    "hive_accounts_2",
    "hive_accounts_3",
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {

            // Handle HTTP redirect
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(downloadFile(res.headers.location, dest));
            }

            if (res.statusCode !== 200) {
                return reject(`Download failed: ${res.statusCode}`);
            }

            const file = fs.createWriteStream(dest);
            res.pipe(file);

            file.on("finish", () => file.close(() => resolve(dest)));
            file.on("error", reject);

        }).on("error", reject);
    });
}

function copyFolders() {
    return new Promise((resolve, reject) => {
        const cmd = copies.map(c => `cp -r ${folder1} ${c}`).join(" && ");
        exec(cmd, (err) => err ? reject(err) : resolve());
    });
}

(async () => {
    try {
        console.log("⏬ Downloading ZIP...");
        await downloadFile(zipUrl, zipFile);
        console.log("✔ ZIP downloaded");

        console.log("📦 Extracting ZIP...");
        const zip = new AdmZip(zipFile);
        zip.extractAllTo(folder1, true);
        console.log("✔ Extracted to", folder1);

        console.log("📁 Creating copies...");
        await copyFolders();
        console.log("✔ Copies created:", copies.join(", "));

        console.log("🗑 Deleting ZIP...");
        fs.unlinkSync(zipFile);
        console.log("✔ ZIP deleted");

        console.log("🔑 Downloading key.json...");
        await downloadFile(jsonUrl, jsonFile);
        console.log("✔ key.json downloaded");

        console.log("🎉 ALL DONE");

        process.exit(0);

    } catch (err) {
        console.error("❗ ERROR:", err);
        process.exit(1);
    }
})();