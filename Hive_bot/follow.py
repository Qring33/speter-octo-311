import os
import re
import random
import time
import logging
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from beem import Hive
from beem.instance import set_shared_hive_instance


FOLDER_PATH = "hive_accounts_2"  
WORKING_NODES = [
    "https://api.deathwing.me",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://hived.emre.sh",
]

# --- Suppress low-level beem logs ---
logging.getLogger("beem").setLevel(logging.CRITICAL)

#  FETCH TRENDING AUTHORS FROM PEAKD API — NOW FETCH 20 AND RANDOMLY PICK 5
def fetch_trending_authors(limit=5):
    url = "https://api.deathwing.me"
    payload = {
        "id": 10,
        "jsonrpc": "2.0",
        "method": "bridge.get_ranked_posts",
        "params": {
            "tag": "",
            "sort": "trending",
            "limit": 20,
            "start_author": None,
            "start_permlink": None,
            "observer": "qring"
        }
    }

    try:
        r = requests.post(url, json=payload, timeout=15)
        data = r.json()

        if "result" not in data:
            print("Failed to fetch trending authors (empty result).")
            return []

        posts = data["result"]
        authors = []

        # extract ALL 50 authors
        for p in posts:
            if "author" in p:
                authors.append(p["author"])

        # remove duplicates while preserving order
        authors = list(dict.fromkeys(authors))

        if len(authors) == 0:
            return []

        # RANDOMLY pick 5 authors
        selected = random.sample(authors, min(limit, len(authors)))
        return selected

    except Exception as e:
        print(f"Error fetching trending authors: {e}")
        return []

#  EXTRACT POSTING KEY
def extract_posting_key(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'"posting"\s*:\s*"(5[1-9A-HJ-NP-Za-km-z]{50,})"', content)
        return match.group(1) if match else None
    except:
        return None

#  FOLLOW USER TASK FOR ONE ACCOUNT
def follow_user_task(file_name, TARGET_USERS):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.rsplit(".", 1)[0]

    key = extract_posting_key(file_path)
    if not key:
        try: os.remove(file_path)
        except: pass
        return f"{username} → no valid posting key, file removed"

    hive = Hive(
        keys=[key],
        nodes=WORKING_NODES,
        num_retries=5,
        num_retries_call=3,
        timeout=30
    )
    set_shared_hive_instance(hive)

    followed_count = 0

    for target in TARGET_USERS:

        follow_op = [
            "follow",
            {
                "follower": username,
                "following": target,
                "what": ["blog"]
            }
        ]

        try:
            hive.custom_json(
                id="follow",
                json_data=follow_op,
                required_posting_auths=[username]
            )
            followed_count += 1

        except Exception as e:
            msg = str(e).lower()

            # Already following → silent skip
            if "already following" in msg or "duplicate" in msg:
                continue

            # RC too low → silent skip
            if "rc" in msg or "mana" in msg or "not enough" in msg:
                continue

            # any other error → completely silent
            continue

    # remove file after processing
    try: os.remove(file_path)
    except: pass

    return f"[pro_update] {username} followed {followed_count}/{len(TARGET_USERS)} | Tx: N/A"

#  MAIN LOOP
def main():
    print("\nFetching trending authors...\n")
    TARGET_USERS = fetch_trending_authors(limit=5)

    if not TARGET_USERS:
        print("No trending authors found → stopping!\n")
        return

    print("Randomly selected trending users to follow:")
    for u in TARGET_USERS:
        print(" - @" + u)
    print("\nStarting mass-follow...\n")

    max_workers = 2
    count = 0

    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("\nAll accounts processed. Done!")
            break

        selected_files = random.sample(files, min(max_workers, len(files)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(follow_user_task, f, TARGET_USERS) for f in selected_files]

            for future in as_completed(futures):
                print(future.result())
                count += 1

        time.sleep(2)


if __name__ == "__main__":
    main()