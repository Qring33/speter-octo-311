const https = require("https");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

/* =======================
   GITHUB CONFIG
======================= */

// GitHub repo ZIP (main branch)
const githubRepoZipUrl =
    "https://codeload.github.com/Qring33/speter-octo-311/zip/refs/heads/main";

// ZIP destination
const repoZipPath = "repo.zip";

// Target folder inside repo
const TARGET_FOLDER = "neobux_accounts";

/* =======================
   DROPBOX CONFIG
======================= */

// Dropbox file URL (force direct download)
const dropboxFileUrl =
    "https://www.dropbox.com/s/8b2p7oc8fz8sa4rzt9s20/image_solver.json?dl=1";

// Destination for the Dropbox file
const dropboxFileDest = "image_solver.json";

/* =======================
   CLEAN OLD FILES
======================= */

if (fs.existsSync(repoZipPath)) fs.unlinkSync(repoZipPath);
if (fs.existsSync(`./${TARGET_FOLDER}`))
    fs.rmSync(`./${TARGET_FOLDER}`, { recursive: true, force: true });
if (fs.existsSync(dropboxFileDest)) fs.unlinkSync(dropboxFileDest);

console.log("Cleaned old files/folders");

/* =======================
   DOWNLOAD FUNCTION
======================= */

function download(url, dest, done) {
    https.get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0" } },
        (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return download(res.headers.location, dest, done);
            }

            if (res.statusCode !== 200) {
                console.error("Download failed:", res.statusCode);
                process.exit(1);
            }

            const file = fs.createWriteStream(dest);
            res.pipe(file);

            file.on("finish", () => file.close(done));
            file.on("error", (err) => {
                console.error("File write error:", err);
                process.exit(1);
            });
        }
    ).on("error", (err) => {
        console.error("Download error:", err.message);
        process.exit(1);
    });
}

/* =======================
   EXTRACT TARGET FOLDER
======================= */

function extractTargetFolder(zipPath, folderName) {
    console.log(`Extracting ${folderName} from GitHub repo...`);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const tempDir = "./__temp_repo__";
    zip.extractAllTo(tempDir, true);

    // Repo root folder name (randomized by GitHub)
    const repoRoot = fs.readdirSync(tempDir)[0];
    const sourcePath = path.join(tempDir, repoRoot, folderName);
    const destPath = `./${folderName}`;

    if (!fs.existsSync(sourcePath)) {
        console.error("Target folder not found in repo");
        process.exit(1);
    }

    fs.renameSync(sourcePath, destPath);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    console.log(`${folderName} ready → ./${folderName}`);
}

/* =======================
   MAIN
======================= */

download(githubRepoZipUrl, repoZipPath, () => {
    extractTargetFolder(repoZipPath, TARGET_FOLDER);

    // After GitHub extraction, download Dropbox file
    console.log("Downloading Dropbox file...");
    download(dropboxFileUrl, dropboxFileDest, () => {
        console.log(`Dropbox file ready → ./${dropboxFileDest}`);
        console.log("All files and folders ready.");
        process.exit(0);
    });
});