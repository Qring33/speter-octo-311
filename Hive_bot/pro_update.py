import os
import random
import subprocess
import json
from concurrent.futures import ThreadPoolExecutor
from beem import Hive
from beembase.operations import Account_update2
from beem.account import Account

# ---------------- Config ----------------
FOLDER_PATH = "hive_accounts_3"
NODES = ["https://api.openhive.network"]
CONCURRENT_THREADS = 3

# ---------------- Helper Function ----------------
def extract_posting_key(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    import re
    match = re.search(r'"posting"\s*:\s*"(5[1-9A-HJ-NP-Za-km-z]{50,})"', content)
    return match.group(1) if match else None

# ---------------- Worker Function ----------------
def process_account(file_name):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.rsplit(".", 1)[0]

    posting_key = extract_posting_key(file_path)
    if not posting_key:
        print(f"{username} → no valid posting key, deleted")
        os.remove(file_path)
        return

    hive = Hive(keys=[posting_key], nodes=NODES)

    try:
        # Check existing profile
        account = Account(username, blockchain_instance=hive)
        posting_metadata = account.get("posting_json_metadata") or "{}"
        try:
            posting_metadata = json.loads(posting_metadata)
        except Exception:
            posting_metadata = {}

        profile_data = posting_metadata.get("profile", {})

        # Skip if both profile and cover images exist
        if profile_data.get("profile_image") and profile_data.get("cover_image"):
            print(f"{username} → profile & cover already exist, skipped")
            os.remove(file_path)
            return

        # Generate images
        profile_url = subprocess.check_output(
            ["python3", "img.py"], text=True
        ).strip()
        cover_url = subprocess.check_output(
            ["python3", "img.py"], text=True
        ).strip()

        # Build posting_json_metadata
        posting_meta = json.dumps({
            "profile": {
                "profile_image": profile_url,
                "cover_image": cover_url,
                "version": 2
            }
        })

        # Broadcast update
        op = Account_update2(
            **{
                "account": username,
                "json_metadata": "",
                "posting_json_metadata": posting_meta,
                "extensions": []
            }
        )

        tx = hive.finalizeOp(op, username, "posting")
        print(f"{username} → profile updated | Tx: {tx['trx_id']}")

    except Exception as e:
        print(f"{username} → FAILED | {str(e)}")

    # Delete the file after processing
    os.remove(file_path)

# ---------------- Main Loop ----------------
while True:
    files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
    if not files:
        print("All accounts processed. Done!")
        break

    # Pick up to CONCURRENT_THREADS random files
    batch = random.sample(files, min(CONCURRENT_THREADS, len(files)))

    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        executor.map(process_account, batch)
