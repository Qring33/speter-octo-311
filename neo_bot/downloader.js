const https = require('https');
const fs = require('fs');

// Correct JSON URLs
const neobuxJsonUrl = "https://www.dropbox.com/scl/fi/rg0xl60r1gtkvqr486out/neobux_accounts.json?rlkey=b6dvz6ecktq6t2g15qkty1u93&st=ggdil92u&dl=1";
const imageSolverUrl = "https://www.dropbox.com/scl/fi/8b2p7oc8fz8sa4rzt9s20/image_solver.json?rlkey=t3sz5hfc5aj17uu58w4ym3c9u&dl=1";

// File destinations
const folderPath = "./neobux_accounts";
const neobuxJsonPath = "./neobux_accounts/neobux_accounts.json";
const imageSolverPath = "image_solver.json";

// Remove old
if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
if (fs.existsSync(imageSolverPath)) fs.unlinkSync(imageSolverPath);

// Create fresh folder
fs.mkdirSync(folderPath, { recursive: true });

console.log("Created folder: ./neobux_accounts");

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

// Download neobux_accounts.json
download(neobuxJsonUrl, neobuxJsonPath, () => {
    console.log("Downloaded neobux_accounts.json → ./neobux_accounts");

    // Download image_solver.json into root
    download(imageSolverUrl, imageSolverPath, () => {
        console.log("Downloaded image_solver.json → ./");
        console.log("All files ready.");
        process.exit(0);
    });
});