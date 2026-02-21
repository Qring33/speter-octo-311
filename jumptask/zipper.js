const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const AdmZip = require("adm-zip");

const BASE_DIR = __dirname;
const DEFAULT_DIR = path.join(BASE_DIR, "chrome-profile", "Default");
const SOURCE_FOLDER = path.join(DEFAULT_DIR, "Local Storage");
const DEST_DIR = "/home/kali/botnet/jumptask/profiles";
const CHROME_PROFILE_DIR = path.join(BASE_DIR, "chrome-profile");
const CHROME_PROFILE_ZIP = path.join(BASE_DIR, "chrome-profile.zip");

(async () => {
  try {
    // ================================
    // 1️⃣ Check Local Storage exists
    // ================================
    if (!fs.existsSync(SOURCE_FOLDER)) {
      console.error("Local Storage folder not found!");
      process.exit(1);
    }

    // Ensure destination directory exists
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    // ================================
    // 2️⃣ Find next available number
    // ================================
    let number = 1;
    let zipName, destPath;

    do {
      zipName = `Local Storage_${number}.zip`;
      destPath = path.join(DEST_DIR, zipName);
      number++;
    } while (fs.existsSync(destPath));

    number--;
    zipName = `Local Storage_${number}.zip`;
    destPath = path.join(DEST_DIR, zipName);

    console.log(`Creating zip: ${zipName}`);

    // ================================
    // 3️⃣ Create zip
    // ================================
    const output = fs.createWriteStream(destPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(SOURCE_FOLDER, "Local Storage");

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
    });

    console.log(`Zip created: ${destPath}`);

    // ================================
    // 4️⃣ Delete chrome-profile folder
    // ================================
    if (fs.existsSync(CHROME_PROFILE_DIR)) {
      fs.rmSync(CHROME_PROFILE_DIR, { recursive: true, force: true });
      console.log("Deleted chrome-profile folder.");
    }

    // ================================
    // 5️⃣ Restore chrome-profile from zip
    // ================================
    if (!fs.existsSync(CHROME_PROFILE_ZIP)) {
      throw new Error("chrome-profile.zip not found!");
    }

    const zip = new AdmZip(CHROME_PROFILE_ZIP);
    zip.extractAllTo(BASE_DIR, true);

    console.log("chrome-profile restored from chrome-profile.zip");

  } catch (err) {
    console.error("Error:", err.message);
  }
})();