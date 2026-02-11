const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// List of files to download
const files = [
  {
    url: "https://www.dropbox.com/scl/fi/1k8uej7jto9ukxkk1cmmu/metamask.zip?rlkey=0d0lkbpskkdepn5n5b09i0d3q&st=5dmbn4pq&dl=1",
    name: "metamask",
  },
  {
    url: "https://www.dropbox.com/scl/fi/se20ffq0tj6coalqj01m8/chrome-profile.zip?rlkey=90iafi6x5a5ikfxb1k239xhb1&st=pqz9cu4z&dl=1",
    name: "chrome-profile",
  },
];

// Download a file
async function downloadFile(file) {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`Failed to download ${file.name}`);
  const buffer = await res.arrayBuffer();
  const zipPath = path.join(__dirname, `${file.name}.zip`);
  fs.writeFileSync(zipPath, Buffer.from(buffer));
  console.log(`Downloaded ${file.name}.zip`);
  return zipPath;
}

// Unzip a file into target folder without nesting
function unzipFile(zipPath, targetFolder) {
  const zip = new AdmZip(zipPath);

  // Ensure target folder exists
  if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

  zip.getEntries().forEach((entry) => {
    const parts = entry.entryName.split("/").slice(1); // remove top-level folder
    if (parts.length === 0) return; // skip root folder entry
    const destPath = path.join(targetFolder, ...parts);

    if (entry.isDirectory) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
    } else {
      fs.writeFileSync(destPath, entry.getData());
    }
  });

  console.log(`Unzipped ${path.basename(zipPath)} into ${targetFolder}`);
}

// Main
(async () => {
  for (const file of files) {
    const zipPath = await downloadFile(file);
    const targetFolder = path.join(__dirname, file.name);
    unzipFile(zipPath, targetFolder);
  }
  console.log("All files downloaded and unzipped correctly!");
})();