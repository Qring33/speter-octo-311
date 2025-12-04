import os
import re
import datetime
import time
import random
from beem import Hive
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Import our AI-free generator ---
from ai import generate_random_post, generate_random_title, datetime

FOLDER_PATH = "hive_accounts"

# --- Your personal Hive account details ---
PRIMARY_USERNAME = "qring"
PRIMARY_POSTING_KEY = "5KS5X9youPJwQZeLJ5g9fP62DNicrG3bFtSr5Hytv4ewHZjQFpD"

# --- Reliable Hive nodes ---
NODES = [
    "https://api.hive.blog",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://api.pharesim.me",
    "https://hive.roelandp.nl"
]

# ======= FUNCTIONS =======

def extract_keys(file_path):
    with open(file_path, "r") as f:
        content = f.read()
    posting_match = re.search(r'"posting"\s*:\s*"(5[123456789A-HJ-NP-Za-km-z]+)"', content)
    active_match = re.search(r'"active"\s*:\s*"(5[123456789A-HJ-NP-Za-km-z]+)"', content)
    posting_key = posting_match.group(1) if posting_match else None
    active_key = active_match.group(1) if active_match else None
    return posting_key, active_key

def generate_permlink(title):
    permlink = title.lower()
    permlink = re.sub(r'[^a-z0-9]+', '-', permlink).strip('-')
    permlink += f"-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    return permlink

def safe_post(hive, title, body, permlink, username):
    json_metadata = {
        "tags": ["LeoFinance", "hive", "daily", "discussion", "business", "tech", "finance"],
        "app": "inleo/1.0"
    }
    for attempt in range(5):  # Retry for transient errors
        try:
            hive.post(title=title, body=body, author=username, permlink=permlink, json_metadata=json_metadata)
            print(f"[SUCCESS] Posted thread as {username} with permlink: {permlink}")
            return True
        except Exception as e:
            error_msg = str(e)

            # --- Skip account if posting interval not reached ---
            if "HIVE_MIN_ROOT_COMMENT_INTERVAL" in error_msg:
                print(f"[SKIP] Account {username} cannot post yet (5 min interval). Skipping.")
                return False

            # --- Skip account if insufficient RC mana ---
            if "payer has not enough RC mana" in error_msg:
                print(f"[SKIP] Account {username} has insufficient RC mana. Skipping.")
                return False

            # Otherwise, retry with backoff
            print(f"[WARN] Attempt {attempt+1} failed for {username}: {e}")
            time.sleep(2 + attempt)  # incremental backoff
    return False

def post_test_thread(username, posting_key):
    hive = Hive(keys=[posting_key], nodes=NODES, num_retries=5, retry_wait=2)

    # Generate dynamic post
    body = generate_random_post()
    title = generate_random_title()
    permlink = generate_permlink(title)

    success = safe_post(hive, title, body, permlink, username)
    
    # Optional: random short delay between posts to reduce node overload
    time.sleep(random.uniform(1, 5))
    return success

def process_account_file(file_name):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.replace(".txt", "")
    posting_key, active_key = extract_keys(file_path)

    if not posting_key:
        print(f"[WARN] Posting key not found in {file_name}, skipping.")
        # Remove file anyway
        try:
            os.remove(file_path)
            print(f"[INFO] Removed account file {file_name}.")
        except Exception as e:
            print(f"[WARN] Could not remove {file_name}: {str(e)}")
        return

    success = post_test_thread(username, posting_key)

    # --- Delete file regardless of outcome ---
    try:
        os.remove(file_path)
        print(f"[INFO] Removed account file {file_name} after processing (success/skipped/failed).")
    except Exception as e:
        print(f"[WARN] Could not remove {file_name}: {str(e)}")

# ======= MAIN SCRIPT =======

def main():
    # --- Step 1: Post first with the primary account ---
    print(f"[INFO] Posting first blog as primary account: {PRIMARY_USERNAME}")
    post_test_thread(PRIMARY_USERNAME, PRIMARY_POSTING_KEY)
    print(f"[INFO] Primary account post complete. Proceeding to other accounts...\n")

    # --- Step 2: Process all other account files concurrently (3 at a time) ---
    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("✅ All account files have been posted or processed. Exiting.")
            break

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_account_file, file_name) for file_name in files]
            for future in as_completed(futures):
                future.result()

if __name__ == "__main__":
    main()