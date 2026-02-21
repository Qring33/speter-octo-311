const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// List of files to download (Metamask removed)
const files = [
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

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  zip.getEntries().forEach((entry) => {
    const parts = entry.entryName.split("/").slice(1); // remove top-level folder
    if (parts.length === 0) return;

    const destPath = path.join(targetFolder, ...parts);

    if (entry.isDirectory) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
    } else {
      fs.writeFileSync(destPath, entry.getData());
    }
  });

  console.log(`Unzipped ${path.basename(zipPath)} into ${targetFolder}`);
}

// Main
(async () => {
  try {
    // 1️⃣ Download and unzip chrome-profile only
    for (const file of files) {
      const zipPath = await downloadFile(file);
      const targetFolder = path.join(__dirname, file.name);
      unzipFile(zipPath, targetFolder);
    }

    // 2️⃣ Unzip existing profiles.zip (no download)
    const profilesZipPath = path.join(__dirname, "profiles.zip");

    if (!fs.existsSync(profilesZipPath)) {
      console.log("profiles.zip not found, skipping...");
    } else {
      const profilesTarget = path.join(__dirname, "profiles");
      unzipFile(profilesZipPath, profilesTarget);
    }

    console.log("All files downloaded and unzipped correctly!");
  } catch (err) {
    console.error("Error:", err.message);
  }
})();