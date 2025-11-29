const fs = require("fs");
const path = require("path");
const { Dropbox } = require("dropbox");

const DROPBOX_REFRESH_TOKEN = "aKyyc46BzjsAAAAAAAAAAflNqCXbvJtQ75QkrOK3GGJKTEHbE6bq__b-tPQ7tpVH";
const DROPBOX_APP_KEY = "89qh2irwhtm9nh3";
const DROPBOX_APP_SECRET = "n3al44m84jg1i3q";

const LOCAL_FOLDERS = ["account", "keystone_phase", "hive_accounts"];
const DROPBOX_ROOT = "/";

function getDropboxClient() {
    return new Dropbox({
        clientId: DROPBOX_APP_KEY,
        clientSecret: DROPBOX_APP_SECRET,
        refreshToken: DROPBOX_REFRESH_TOKEN,
    });
}

async function uploadFiles(dbx, localFolder, dropboxFolder) {
    if (!fs.existsSync(localFolder)) return;

    const files = fs.readdirSync(localFolder);
    for (const filename of files) {
        if (filename.endsWith(".json") || filename.endsWith(".txt")) {
            const localPath = path.join(localFolder, filename);
            const dropboxPath = `${dropboxFolder}/${filename}`;
            const contents = fs.readFileSync(localPath);
            await dbx.filesUpload({ path: dropboxPath, contents, mode: { ".tag": "overwrite" } });
        }
    }
}

async function main() {
    const dbx = getDropboxClient();
    for (const folder of LOCAL_FOLDERS) {
        await uploadFiles(dbx, folder, `/${folder}`);
    }
    console.log("Upload completed.");
}

main();