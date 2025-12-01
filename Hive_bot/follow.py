# hive_follow_qring_CONCURRENT.py

import os
import re
import random
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from beem import Hive
from beem.instance import set_shared_hive_instance

FOLDER_PATH = "hive_accounts_2"
TARGET_USER = "qring"

WORKING_NODES = [
    "https://api.deathwing.me",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://hived.emre.sh",
]

# --- Read Gemini API key from file ---
with open("gemini_api.txt", "r") as f:
    GEMINI_API_KEY = f.read().strip()

# --- Suppress low-level beem logs ---
logging.getLogger("beem").setLevel(logging.CRITICAL)

def extract_posting_key(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'"posting"\s*:\s*"(5[1-9A-HJ-NP-Za-km-z]{50,})"', content)
        return match.group(1) if match else None
    except:
        return None

def follow_user_task(file_name):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.rsplit(".", 1)[0]

    key = extract_posting_key(file_path)
    if not key:
        try:
            os.remove(file_path)
        except:
            pass
        return f"{username} → no valid posting key, file removed"

    hive = Hive(
        keys=[key],
        nodes=WORKING_NODES,
        num_retries=5,
        num_retries_call=3,
        timeout=30
    )
    set_shared_hive_instance(hive)  # ensure shared instance uses suppressed logging

    follow_operation = [
        "follow",
        {
            "follower": username,
            "following": TARGET_USER,
            "what": ["blog"]
        }
    ]

    try:
        tx = hive.custom_json(
            id="follow",
            json_data=follow_operation,
            required_posting_auths=[username]
        )
        tx_id = tx.get("id", "N/A") if isinstance(tx, dict) else "N/A"
        success_msg = f"[pro_update] {username} profile updated | Tx: {tx_id}"
    except Exception as e:
        error_msg = str(e).lower()
        if "already following" in error_msg or "duplicate" in error_msg:
            success_msg = f"[pro_update] {username} already follows @{TARGET_USER}"
        else:
            success_msg = f"[pro_update] {username} FAILED: {e}"

    # remove file if success
    if "FAILED" not in success_msg:
        try:
            os.remove(file_path)
        except:
            pass

    return success_msg

def main():
    print(f"Starting mass-follow → @{TARGET_USER}\n")
    count = 0
    max_workers = 6  # concurrent threads

    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("All accounts processed. Done!")
            break

        # pick up to max_workers random files
        selected_files = random.sample(files, min(max_workers, len(files)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(follow_user_task, f) for f in selected_files]
            for future in as_completed(futures):
                print(future.result())
                count += 1

        time.sleep(2)  # small delay between batches

if __name__ == "__main__":
    main()