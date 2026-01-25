const AdmZip = require("adm-zip");
const path = require("path");

// Files to unzip
const files = ["gemini_api.txt.zip", "x_only_profile.zip"];

files.forEach((file) => {
  try {
    const zipPath = path.resolve(__dirname, file);
    const zip = new AdmZip(zipPath);

    // Extract to same folder as the zip file
    const extractPath = path.resolve(__dirname);
    zip.extractAllTo(extractPath, true);

    console.log(`${file} extracted successfully to ${extractPath}`);
  } catch (err) {
    console.error(`Error extracting ${file}:`, err);
  }
});
