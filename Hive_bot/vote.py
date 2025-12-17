import os
import re
import random
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from beem import Hive
from beem.instance import set_shared_hive_instance
from beem.comment import Comment
from beem.account import Account

from comment import generate_comment

FOLDER_PATH = "hive_accounts_1"
WORKING_NODES = [
    "https://api.deathwing.me",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://hived.emre.sh",
]

MAX_ATTEMPTS_PER_AUTHOR = 5
TARGET_AUTHORS_COUNT = 10
MIN_REPUTATION = 25

USED_AUTHORS = set()
CURRENT_TARGETS = []
TARGET_POST_CACHE = {}
ATTEMPTS_MADE = {}

import logging
logging.getLogger("beem").setLevel(logging.CRITICAL)

def fetch_random_authors(limit=10, base_min_reputation=25):
    url = "https://api.deathwing.me"
    payload = {
        "id": 92,
        "jsonrpc": "2.0",
        "method": "bridge.get_ranked_posts",
        "params": {
            "tag": "",
            "sort": "hot",
            "limit": 20,
            "start_author": None,
            "start_permlink": None,
            "observer": "qring"
        }
    }

    try:
        r = requests.post(url, json=payload, timeout=15)
        r.raise_for_status()
        posts = r.json().get("result", [])

        temp_min_rep = base_min_reputation
        while temp_min_rep >= 0:
            candidates = []
            for p in posts:
                author = p.get("author")
                if not author or author in USED_AUTHORS:
                    continue
                try:
                    rep_float = float(p.get("author_reputation", 0))
                except:
                    rep_float = 0
                if rep_float >= temp_min_rep:
                    candidates.append(author)

            candidates = list(dict.fromkeys(candidates))
            if len(candidates) >= limit:
                return random.sample(candidates, limit)
            temp_min_rep -= 10

        fallback = list({p.get("author") for p in posts if p.get("author") and p.get("author") not in USED_AUTHORS})
        return random.sample(fallback, min(limit, len(fallback))) if fallback else []

    except Exception:
        return []

def extract_posting_key(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'"posting"\s*:\s*"(5[1-9A-HJ-NP-Za-km-z]{50,})"', content)
        return match.group(1) if match else None
    except:
        return None

def get_latest_post_cached(author, hive):
    if author in TARGET_POST_CACHE:
        return TARGET_POST_CACHE[author]

    try:
        acc = Account(author, blockchain_instance=hive)
        max_op = acc.virtual_op_count()
        stop = max_op - 500
        for entry in acc.history_reverse(start=max_op, stop=stop, use_block_num=False, only_ops=["comment"]):
            op = entry if isinstance(entry, dict) else entry.get("op", [None, {}])[1]
            if op.get("parent_author") == "" and op.get("author") == author:
                permlink = op["permlink"]
                TARGET_POST_CACHE[author] = (author, permlink)
                return author, permlink
    except Exception:
        pass

    TARGET_POST_CACHE[author] = (None, None)
    return None, None

def try_comment(username, author, permlink, key):
    if not permlink:
        return False

    hive = Hive(
        keys=[key],
        nodes=WORKING_NODES,
        num_retries=3,
        num_retries_call=2,
        timeout=20
    )
    set_shared_hive_instance(hive)

    try:
        parent = Comment(f"@{author}/{permlink}", blockchain_instance=hive)
        body = generate_comment()
        parent.reply(body=body, author=username)
        return True
    except Exception:
        return False

def process_single_account(file_name, target_author, target_permlink):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.rsplit(".", 1)[0]

    key = extract_posting_key(file_path)
    if not key:
        try: os.remove(file_path)
        except: pass
        return None  # Silent on invalid key

    success = try_comment(username, target_author, target_permlink, key)

    try: os.remove(file_path)
    except: pass

    if success:
        return f"{username} commented on @{target_author}"
    else:
        return f"{username} failed to comment, no RC"

def main():
    global CURRENT_TARGETS, TARGET_POST_CACHE, ATTEMPTS_MADE, USED_AUTHORS

    public_hive = Hive(nodes=WORKING_NODES)
    set_shared_hive_instance(public_hive)

    while True:
        new_authors = fetch_random_authors(limit=TARGET_AUTHORS_COUNT, base_min_reputation=MIN_REPUTATION)
        if not new_authors:
            time.sleep(30)
            continue

        CURRENT_TARGETS = new_authors
        USED_AUTHORS.update(CURRENT_TARGETS)
        TARGET_POST_CACHE = {}
        ATTEMPTS_MADE = {a: 0 for a in CURRENT_TARGETS}

        # Silent caching
        for author in CURRENT_TARGETS:
            get_latest_post_cached(author, public_hive)

        for author in CURRENT_TARGETS:
            auth, permlink = TARGET_POST_CACHE.get(author, (None, None))
            if not permlink:
                continue  # Skip silently if no post

            attempts_done = 0
            while attempts_done < MAX_ATTEMPTS_PER_AUTHOR:
                files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
                if not files:
                    break

                batch_size = min(3, len(files), MAX_ATTEMPTS_PER_AUTHOR - attempts_done)
                batch = random.sample(files, batch_size)

                with ThreadPoolExecutor(max_workers=3) as executor:
                    futures = [
                        executor.submit(process_single_account, f, author, permlink)
                        for f in batch
                    ]
                    for future in as_completed(futures):
                        result = future.result()
                        if result:  # Only print real attempts
                            print(result)
                        attempts_done += 1

                time.sleep(1.5)

        time.sleep(5)  # Short pause before next cycle

if __name__ == "__main__":
    main()