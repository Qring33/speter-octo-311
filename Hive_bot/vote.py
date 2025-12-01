import os
import re
import datetime
import json
import time
import random
import requests
from beem import Hive
from beem.comment import Comment
from beem.account import Account
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================== CONFIG ==================
FOLDER_PATH = "hive_accounts_1"  # folder containing .txt files with keys
TARGET_AUTHOR = "arlynn"  # author whose latest post will be voted/commented

# --- Read Gemini API key from file ---
with open("gemini_api.txt", "r") as f:
    GEMINI_API_KEY = f.read().strip()

MODEL = "gemini-2.0-flash"
MIN_COMMENT_LENGTH = 20
MAX_COMMENT_LENGTH = 100
CONCURRENT_WORKERS = 3
# ============================================

def extract_posting_key(file_path):
    """Extract posting key from a Hive account file"""
    with open(file_path, "r") as f:
        content = f.read()
    match = re.search(r'"posting"\s*:\s*"(5[123456789A-HJ-NP-Za-km-z]+)"', content)
    return match.group(1) if match else None

def get_latest_post(author, hive_instance):
    """Return the latest blog post's author, permlink, and content"""
    try:
        account = Account(author, blockchain_instance=hive_instance)
        max_op = account.virtual_op_count()
        stop_op = max_op - 500
        for post in account.history_reverse(start=max_op, stop=stop_op, use_block_num=False, only_ops=["comment"]):
            op = post if isinstance(post, dict) else post.get("op", [None, {}])[1]
            if op.get("parent_author") == "" and op.get("author") == author:
                content = op.get("body", "")
                return op["author"], op["permlink"], content
    except Exception as e:
        print(f"[ERROR] Getting latest post failed: {e}")
    return None, None, None

def already_voted(voter, author, permlink, hive_instance):
    """Check if voter already voted on a post"""
    try:
        c = Comment(f"@{author}/{permlink}", blockchain_instance=hive_instance)
        for vote in c.get_votes():
            if vote["voter"] == voter:
                return vote["percent"]
    except Exception:
        pass
    return None

def generate_comment(post_content, post_url):
    """Use Gemini API to generate a comment relevant to the post content"""
    prompt = (
        f"Read the following Hive blog post and write an engaging comment between {MIN_COMMENT_LENGTH}-{MAX_COMMENT_LENGTH} characters "
        f"that is relevant to the post:\n\nPost URL: {post_url}\nPost Content: {post_content}"
    )

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    headers = {"Content-Type": "application/json"}
    data = {"contents": [{"parts": [{"text": prompt}]}]}

    while True:
        try:
            response = requests.post(f"{endpoint}?key={GEMINI_API_KEY}", headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                result = response.json()
                text_output = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                if len(text_output) >= MIN_COMMENT_LENGTH:
                    return text_output[:MAX_COMMENT_LENGTH]
                else:
                    print("[INFO] Generated comment too short, retrying...")
            else:
                print(f"[WARN] Gemini API failed ({response.status_code}): {response.text}")
        except Exception as e:
            print("[ERROR] Gemini API call failed, retrying in 5s:", str(e))
        time.sleep(5)

def vote_and_comment(username, posting_key):
    """Vote 20% and comment on the latest post"""
    hive_instance = Hive(keys=[posting_key])
    author, permlink, post_content = get_latest_post(TARGET_AUTHOR, hive_instance)
    if not author:
        print(f"[WARN] No blog post found for {TARGET_AUTHOR}")
        return False

    post_url = f"https://hive.blog/@{author}/{permlink}"
    print(f"[INFO] Latest post: {post_url}")

    vote_status = already_voted(username, author, permlink, hive_instance)
    if vote_status is None:
        try:
            c = Comment(f"@{author}/{permlink}", blockchain_instance=hive_instance)
            c.upvote(weight=20, voter=username)
            print(f"[INFO] Voted 20% successfully as {username}")
            time.sleep(2)
        except Exception as e:
            print(f"[ERROR] Voting failed for {username}: {e}")
            return False
    else:
        print(f"[INFO] {username} already voted with {vote_status/20}%")

    # Generate and post a relevant comment
    comment_text = generate_comment(post_content, post_url)
    try:
        c = Comment(f"@{author}/{permlink}", blockchain_instance=hive_instance)
        c.reply(comment_text, author=username)
        print(f"[INFO] Comment posted successfully by {username}")
    except Exception as e:
        print(f"[ERROR] Failed to post comment for {username}: {e}")
        return False

    return True

def process_account(file_name):
    """Process a single account: vote and comment, then remove file if successful"""
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.replace(".txt", "")
    posting_key = extract_posting_key(file_path)
    if not posting_key:
        print(f"[WARN] Posting key not found in {file_name}, skipping.")
        return

    success = vote_and_comment(username, posting_key)

    if success:
        try:
            os.remove(file_path)
            print(f"[INFO] Removed account file {file_name}")
        except Exception as e:
            print(f"[WARN] Could not remove {file_name}: {e}")
    else:
        print(f"[WARN] Action failed for {username}, file not removed.")

def main():
    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("✅ All account files have been processed. Exiting.")
            break

        with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
            futures = [executor.submit(process_account, f) for f in files]
            for future in as_completed(futures):
                # re-raise exceptions if any occurred in threads
                future.result()

        time.sleep(5)  # avoid hitting rate limits

if __name__ == "__main__":
    main()