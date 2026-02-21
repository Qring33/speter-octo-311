const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

async function restoreProfile(accountId, userDataDir) {
  try {
    const PROFILES_DIR = path.join(__dirname, "..", "profiles");

    // Use the SAME userDataDir passed from main.js
    const DEFAULT_DIR = path.join(userDataDir, "Default");

    if (!accountId) {
      throw new Error("Invalid accountId provided.");
    }

    if (!userDataDir) {
      throw new Error("userDataDir not provided.");
    }

    // Ensure profiles folder exists
    if (!fs.existsSync(PROFILES_DIR)) {
      throw new Error("Profiles folder does not exist!");
    }

    // Ensure Default directory exists
    if (!fs.existsSync(DEFAULT_DIR)) {
      fs.mkdirSync(DEFAULT_DIR, { recursive: true });
      console.log("Created Default profile directory.");
    }

    // Find matching zip
    const files = fs.readdirSync(PROFILES_DIR);

    const targetZip = files.find(
      (f) => f === `Local Storage_${accountId}.zip`
    );

    if (!targetZip) {
      throw new Error(`No Local Storage zip found for account ${accountId}`);
    }

    const zipPath = path.join(PROFILES_DIR, targetZip);

    console.log("Restoring from:", zipPath);
    console.log("Target directory:", DEFAULT_DIR);

    // Delete existing Local Storage
    const localStoragePath = path.join(DEFAULT_DIR, "Local Storage");

    if (fs.existsSync(localStoragePath)) {
      fs.rmSync(localStoragePath, { recursive: true, force: true });
      console.log("Existing Local Storage folder deleted.");
    }

    // Extract zip
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(DEFAULT_DIR, true);

    console.log(`Restored profile from ${targetZip}`);
  } catch (err) {
    console.error("Unzipper error:", err.message);
    throw err;
  }
}

module.exports = { restoreProfile };