const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// List of files to download (Metamask removed)
const files = [
  {
    url: "https://www.dropbox.com/scl/fi/se20ffq0tj6coalqj01m8/chrome-profile.zip?rlkey=90iafi6x5a5ikfxb1k239xhb1&st=pqz9cu4z&dl=1",
    name: "chrome-profile",
  },
  {
    url: "https://www.dropbox.com/scl/fi/vnwbs8c1qn01bywov4xux/yt_api_txt?rlkey=oyy19g623t6ndbdmipg8kl7uc&st=kntynsa1&dl=1",
    name: "yt_api_txt",
  },
];

// Download a file
async function downloadFile(file) {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`Failed to download ${file.name}`);

  const buffer = await res.arrayBuffer();

  // If file is zip, save as .zip
  const extension = file.name === "chrome-profile" ? ".zip" : "";
  const filePath = path.join(__dirname, `${file.name}${extension}`);

  fs.writeFileSync(filePath, Buffer.from(buffer));
  console.log(`Downloaded ${file.name}${extension}`);

  return filePath;
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
    // 1️⃣ Download files
    for (const file of files) {
      const filePath = await downloadFile(file);

      // Only unzip chrome-profile
      if (file.name === "chrome-profile") {
        const targetFolder = path.join(__dirname, file.name);
        unzipFile(filePath, targetFolder);
      }
    }

    // 2️⃣ Unzip existing profiles.zip (no download)
    const profilesZipPath = path.join(__dirname, "profiles.zip");

    if (!fs.existsSync(profilesZipPath)) {
      console.log("profiles.zip not found, skipping...");
    } else {
      const profilesTarget = path.join(__dirname, "profiles");
      unzipFile(profilesZipPath, profilesTarget);
    }

    console.log("All files downloaded and processed correctly!");
  } catch (err) {
    console.error("Error:", err.message);
  }
})();