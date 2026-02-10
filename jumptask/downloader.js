const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// List of files to download
const files = [
  {
    url: "https://www.dropbox.com/scl/fi/1k8uej7jto9ukxkk1cmmu/metamask.zip?rlkey=0d0lkbpskkdepn5n5b09i0d3q&st=5dmbn4pq&dl=1",
    name: "metamask.zip",
  },
  {
    url: "https://www.dropbox.com/scl/fi/se20ffq0tj6coalqj01m8/chrome-profile.zip?rlkey=90iafi6x5a5ikfxb1k239xhb1&st=pqz9cu4z&dl=1",
    name: "chrome-profile.zip",
  },
];

// Download a file
async function downloadFile(file) {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`Failed to download ${file.name}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(path.join(__dirname, file.name), Buffer.from(buffer));
  console.log(`Downloaded ${file.name}`);
}

// Unzip a file
function unzipFile(file) {
  const zipPath = path.join(__dirname, file.name);
  const extractPath = path.join(__dirname, file.name.replace(".zip", ""));
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractPath, true);
  console.log(`Unzipped ${file.name} to ${extractPath}`);
}

// Main
(async () => {
  for (const file of files) {
    await downloadFile(file);
    unzipFile(file);
  }
  console.log("All files downloaded and unzipped!");
})();