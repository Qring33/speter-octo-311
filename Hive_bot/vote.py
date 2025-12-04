import os
import re
import time
from beem import Hive
from beem.comment import Comment
from beem.account import Account
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================== CONFIG ==================
FOLDER_PATH = "hive_accounts_1"  # folder containing .txt files with keys
TARGET_AUTHOR = "qring"  # author whose latest post will be voted
CONCURRENT_WORKERS = 2  # reduce concurrency to ~2 accounts/sec
VOTE_WEIGHT = 20  # 20% vote
SLEEP_BETWEEN_ACCOUNTS = 0.5  # 0.5 sec between accounts → 2 accounts/sec
# ============================================


def extract_posting_key(file_path):
    """Extract posting key from a Hive account file"""
    with open(file_path, "r") as f:
        content = f.read()
    match = re.search(r'"posting"\s*:\s*"(5[123456789A-HJ-NP-Za-km-z]+)"', content)
    return match.group(1) if match else None


def get_latest_post(author, hive_instance):
    """Return the latest blog post's author and permlink"""
    try:
        account = Account(author, blockchain_instance=hive_instance)
        max_op = account.virtual_op_count()
        stop_op = max_op - 500

        for post in account.history_reverse(start=max_op, stop=stop_op, use_block_num=False, only_ops=["comment"]):
            op = post if isinstance(post, dict) else post.get("op", [None, {}])[1]

            if op.get("parent_author") == "" and op.get("author") == author:
                return op["author"], op["permlink"]
    except Exception:
        pass

    return None, None


def already_voted(voter, author, permlink, hive_instance):
    """Check if voter already voted on a post"""
    try:
        c = Comment(f"@{author}/{permlink}", blockchain_instance=hive_instance)
        for vote in c.get_votes():
            if vote["voter"] == voter:
                return vote["percent"]
    except:
        pass
    return None


def vote_only(username, posting_key, author, permlink):
    """Vote 20% on the latest post"""
    hive_instance = Hive(keys=[posting_key])
    vote_status = already_voted(username, author, permlink, hive_instance)

    if vote_status is None:
        try:
            c = Comment(f"@{author}/{permlink}", blockchain_instance=hive_instance)
            c.upvote(weight=VOTE_WEIGHT, voter=username)
            print(f"[INFO] Voted {VOTE_WEIGHT}% successfully as {username}")
            time.sleep(SLEEP_BETWEEN_ACCOUNTS)
            return True
        except Exception as e:
            print(f"[ERROR] Voting failed for {username}: {e}")
            return False
    else:
        print(f"[INFO] {username} already voted with {vote_status / 100}%")
        time.sleep(SLEEP_BETWEEN_ACCOUNTS)
        return True


def process_account(file_name, author, permlink):
    """Process a single account: vote only, then remove file immediately"""
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.replace(".txt", "")

    posting_key = extract_posting_key(file_path)
    if not posting_key:
        print(f"[WARN] Posting key not found in {file_name}, skipping.")
        try:
            os.remove(file_path)
        except:
            pass
        return

    # Vote
    vote_only(username, posting_key, author, permlink)

    # Delete account immediately after vote
    try:
        os.remove(file_path)
        print(f"[INFO] Removed account file {file_name} after processing.")
    except Exception as e:
        print(f"[WARN] Could not remove {file_name}: {e}")


def main():
    hive_instance = Hive()
    author, permlink = get_latest_post(TARGET_AUTHOR, hive_instance)

    if not author:
        print(f"[WARN] No blog post found for {TARGET_AUTHOR}. Exiting.")
        return

    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("✅ All account files have been processed. Exiting.")
            break

        with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
            futures = [executor.submit(process_account, f, author, permlink) for f in files]
            for future in as_completed(futures):
                future.result()

        # Add a small pause before next batch
        time.sleep(1)


if __name__ == "__main__":
    main()