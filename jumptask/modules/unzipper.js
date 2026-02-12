const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

async function restoreProfile(accountId) {
  try {
    const PROFILES_DIR = "/home/kali/botnet/jumptask/profiles";
    const DEFAULT_DIR = path.join(__dirname, "chrome-profile", "Default");

    // Ensure profiles folder exists
    if (!fs.existsSync(PROFILES_DIR)) {
      throw new Error("Profiles folder does not exist!");
    }

    // Find the zip that matches the accountId
    const files = fs.readdirSync(PROFILES_DIR);
    const targetZip = files
      .filter((f) => /^Local Storage_\d+\.zip$/.test(f))
      .find((f) => f.match(new RegExp(`Local Storage_${accountId}\\.zip`)));

    if (!targetZip) {
      throw new Error(`No Local Storage zip found for account ${accountId}`);
    }

    const zipPath = path.join(PROFILES_DIR, targetZip);

    // Delete existing Local Storage folder if exists
    const localStoragePath = path.join(DEFAULT_DIR, "Local Storage");
    if (fs.existsSync(localStoragePath)) {
      fs.rmSync(localStoragePath, { recursive: true, force: true });
      console.log("Existing Local Storage folder deleted.");
    }

    // Extract zip using adm-zip
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(DEFAULT_DIR, true);

    console.log(`Restored profile from ${targetZip} to chrome-profile/Default`);
  } catch (err) {
    console.error("Unzipper error:", err.message);
    throw err;
  }
}

module.exports = { restoreProfile };
