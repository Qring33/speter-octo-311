import os
import re
import random
import time
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from beem import Hive
from beem.instance import set_shared_hive_instance
from beem.comment import Comment
from beem.account import Account

FOLDER_PATH = "hive_accounts_1"
WORKING_NODES = [
    "https://api.deathwing.me",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://hived.emre.sh",
]

VOTE_WEIGHT = 20
SLEEP_BETWEEN_ACCOUNTS = 0.9

# --- Suppress low-level beem logs ---
import logging
logging.getLogger("beem").setLevel(logging.CRITICAL)


def fetch_random_authors(limit=3):
    """Fetch first 20 trending posts and pick 3 random authors"""
    url = "https://api.deathwing.me"
    payload = {
        "id": 92,
        "jsonrpc": "2.0",
        "method": "bridge.get_ranked_posts",
        "params": {
            "tag": "",
            "sort": "created",
            "limit": 20,
            "start_author": None,
            "start_permlink": None,
            "observer": "qring"
        }
    }

    try:
        r = requests.post(url, json=payload, timeout=15)
        posts = r.json().get("result", [])
        authors = [p["author"] for p in posts if "author" in p]
        authors = list(dict.fromkeys(authors))  # remove duplicates
        selected = random.sample(authors, min(limit, len(authors)))
        return selected
    except Exception as e:
        print(f"[ERROR] Could not fetch authors: {e}")
        return []


def extract_posting_key(file_path):
    """Extract posting key from account file"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'"posting"\s*:\s*"(5[1-9A-HJ-NP-Za-km-z]{50,})"', content)
        return match.group(1) if match else None
    except:
        return None


def get_latest_post(author, hive):
    """Get latest top-level post from author"""
    try:
        acc = Account(author, blockchain_instance=hive)
        max_op = acc.virtual_op_count()
        stop = max_op - 500
        for entry in acc.history_reverse(start=max_op, stop=stop, use_block_num=False, only_ops=["comment"]):
            op = entry if isinstance(entry, dict) else entry.get("op", [None, {}])[1]
            if op.get("parent_author") == "" and op.get("author") == author:
                return op["author"], op["permlink"]
    except:
        pass
    return None, None


def already_voted(voter, author, permlink, hive):
    try:
        c = Comment(f"@{author}/{permlink}", blockchain_instance=hive)
        for vote in c.get_votes():
            if vote["voter"] == voter:
                return vote["percent"]
    except:
        pass
    return None


def vote_account(file_name, target_authors):
    """Vote for posts from multiple target authors using one account"""
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.rsplit(".", 1)[0]

    key = extract_posting_key(file_path)
    if not key:
        try: os.remove(file_path)
        except: pass
        return f"[pro_update] {username} → no valid posting key, file removed"

    hive = Hive(
        keys=[key],
        nodes=WORKING_NODES,
        num_retries=5,
        num_retries_call=3,
        timeout=30
    )
    set_shared_hive_instance(hive)

    votes_done = 0

    for author in target_authors:
        author_name, permlink = get_latest_post(author, hive)
        if not author_name:
            continue

        if already_voted(username, author_name, permlink, hive):
            continue

        try:
            c = Comment(f"@{author_name}/{permlink}", blockchain_instance=hive)
            c.upvote(weight=VOTE_WEIGHT, voter=username)
            votes_done += 1
        except:
            continue

        time.sleep(SLEEP_BETWEEN_ACCOUNTS)

    try: os.remove(file_path)
    except: pass

    return f"[pro_update] {username} voted {votes_done}/{len(target_authors)} posts | Tx: N/A"


def main():
    print("\nFetching random authors...\n")
    TARGET_AUTHORS = fetch_random_authors(limit=3)

    if not TARGET_AUTHORS:
        print("No authors found → stopping!")
        return

    print("Selected authors to vote on:")
    for u in TARGET_AUTHORS:
        print(" - @" + u)
    print("\nStarting mass-vote...\n")

    max_workers = 2
    processed_count = 0

    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("\nAll accounts processed. Done!")
            break

        selected_files = random.sample(files, min(max_workers, len(files)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(vote_account, f, TARGET_AUTHORS) for f in selected_files]
            for future in as_completed(futures):
                print(future.result())
                processed_count += 1

                # Every 10 accounts processed → fetch new trending authors
                if processed_count % 10 == 0:
                    print("\n[INFO] 10 accounts processed → fetching new trending authors...\n")
                    TARGET_AUTHORS = fetch_random_authors(limit=3)
                    if TARGET_AUTHORS:
                        print("New authors:")
                        for a in TARGET_AUTHORS:
                            print(" - @" + a)
                        print("\n")


        time.sleep(2)


if __name__ == "__main__":
    main()