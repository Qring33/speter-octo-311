const https = require('https');
const fs = require('fs');
const url = "https://www.dropbox.com/scl/fi/2ei8dwa694bnuu67uhns8/key.json?rlkey=k34mho22158reckeemcg08csr&st=9mgwg3c2&dl=1";
const outputFile = "key.json";

function downloadFile(fileUrl, destination) {
    https.get(fileUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            downloadFile(res.headers.location, destination);
            return;
        }

        if (res.statusCode !== 200) {
            console.error(`Download failed. Status code: ${res.statusCode}`);
            process.exit(1);
        }

        const file = fs.createWriteStream(destination);
        res.pipe(file);

        file.on("finish", () => {
            file.close(() => {
                console.log(`Downloaded and saved as ${destination}`);
                process.exit(0); // ensure Node exits
            });
        });

    }).on("error", (err) => {
        console.error("Error downloading file:", err.message);
        process.exit(1);
    });
}

downloadFile(url, outputFile);