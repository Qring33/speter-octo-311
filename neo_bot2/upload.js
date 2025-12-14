const fs = require("fs");
const path = require("path");
const { Dropbox } = require("dropbox");

const DROPBOX_REFRESH_TOKEN = "aKyyc46BzjsAAAAAAAAAAflNqCXbvJtQ75QkrOK3GGJKTEHbE6bq__b-tPQ7tpVH";
const DROPBOX_APP_KEY = "89qh2irwhtm9nh3";
const DROPBOX_APP_SECRET = "n3al44m84jg1i3q";

const LOCAL_FOLDERS = ["neobux_accounts", "session"];
const DROPBOX_ROOT = "/";

function getDropboxClient() {
    return new Dropbox({
        clientId: DROPBOX_APP_KEY,
        clientSecret: DROPBOX_APP_SECRET,
        refreshToken: DROPBOX_REFRESH_TOKEN,
    });
}

// Helper to read existing JSON from Dropbox
async function readDropboxJson(dbx, dropboxPath) {
    try {
        const response = await dbx.filesDownload({ path: dropboxPath });
        const data = response.result.fileBinary.toString();
        return JSON.parse(data);
    } catch (err) {
        if (err.status === 409) {
            // File does not exist
            return null;
        }
        throw err;
    }
}

// Helper to upload file (with optional merge)
async function uploadFile(dbx, localPath, dropboxPath, merge = false) {
    let contents = fs.readFileSync(localPath, "utf8");

    if (merge) {
        let localData = JSON.parse(contents);
        let dropboxData = await readDropboxJson(dbx, dropboxPath) || [];

        // Merge arrays if both are arrays
        if (Array.isArray(localData) && Array.isArray(dropboxData)) {
            localData = [...dropboxData, ...localData];
        }
        // Merge objects if both are objects
        else if (typeof localData === "object" && typeof dropboxData === "object") {
            localData = { ...dropboxData, ...localData };
        }

        contents = JSON.stringify(localData, null, 2);
    }

    await dbx.filesUpload({
        path: dropboxPath,
        contents,
        mode: { ".tag": "overwrite" },
    });
}

// Upload files in a folder
async function uploadFiles(dbx, localFolder, dropboxFolder) {
    if (!fs.existsSync(localFolder)) {
        console.log(`Folder not found: ${localFolder}`);
        return;
    }

    const files = fs.readdirSync(localFolder).filter(file => file.endsWith(".json") || file.endsWith(".txt"));

    if (files.length === 0) {
        console.log(`No .txt or .json files to upload in: ${localFolder}`);
        return;
    }

    const isSessionFolder = localFolder === "session";

    for (const filename of files) {
        const localPath = path.join(localFolder, filename);
        const dropboxPath = `${dropboxFolder}/${filename}`;

        if (filename === "neobux_accounts.json") {
            await uploadFile(dbx, localPath, dropboxPath, true); // merge
            if (!isSessionFolder) console.log(`Uploaded: ${dropboxPath}`);
        } else {
            await uploadFile(dbx, localPath, dropboxPath, false); // overwrite
            if (!isSessionFolder) console.log(`Uploaded: ${dropboxPath}`);
        }
    }

    if (isSessionFolder) {
        console.log(`All session JSON files uploaded successfully.`);
    }
}

async function main() {
    const dbx = getDropboxClient();

    for (const folder of LOCAL_FOLDERS) {
        await uploadFiles(dbx, folder, `/${folder}`);
    }

    console.log("Script finished processing all folders.");
}

main().catch(err => console.error(err));