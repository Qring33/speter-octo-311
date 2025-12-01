import os
import re
import datetime
import json
import time
import requests
from beem import Hive
from concurrent.futures import ThreadPoolExecutor, as_completed

FOLDER_PATH = "hive_accounts"
GEMINI_API_KEY = "AIzaSyCdWw7A7wozpk99OV7ekN9LKsfLbrgjGU8"
MODEL = "gemini-2.0-flash"

# --- Your personal Hive account details ---
PRIMARY_USERNAME = "qring"
PRIMARY_POSTING_KEY = "5KS5X9youPJwQZeLJ5g9fP62DNicrG3bFtSr5Hytv4ewHZjQFpD"

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

def generate_post_content(prompt="Write a short, simple, engaging Hive blog post,mostly focused on (crypto, finance, business, entrepreneurship) blogs, avoid generating any blog post that will asked me to (Insert) anything in the blog."):
    """Use Gemini API with proper endpoint and retry until success"""
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    headers = {"Content-Type": "application/json"}
    data = {"contents": [{"parts": [{"text": prompt}]}]}

    while True:
        try:
            response = requests.post(f"{endpoint}?key={GEMINI_API_KEY}", headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                result = response.json()
                text_output = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text_output:
                    return text_output
                else:
                    print("[INFO] Gemini returned empty text, retrying...")
            else:
                print(f"[WARN] Gemini failed ({response.status_code}): {response.text}")
        except Exception as e:
            print("[ERROR] Gemini API call failed, retrying in 5s:", str(e))
        time.sleep(5)

def post_test_thread(username, posting_key):
    hive = Hive(keys=[posting_key])
    title = "Daily Hive Update"
    permlink = generate_permlink(title)
    body = generate_post_content("Write a short, simple, engaging Hive blog post for maximum upvotes")
    json_metadata = {
        "tags": ["LeoFinance", "hive", "daily", "discussion"],
        "app": "inleo/1.0"
    }

    try:
        hive.post(title=title, body=body, author=username, permlink=permlink, json_metadata=json_metadata)
        print(f"[SUCCESS] Posted thread as {username} with permlink: {permlink}")
        return True
    except Exception as e:
        try:
            op = [
                [
                    "comment",
                    {
                        "parent_author": "",
                        "parent_permlink": "hive-1",
                        "author": username,
                        "permlink": permlink,
                        "title": title,
                        "body": body,
                        "json_metadata": json_metadata,
                    },
                ]
            ]
            tx = hive.rpc.broadcast_transaction_synchronous({"operations": op, "signatures": []})
            print(f"[FALLBACK] Broadcast attempted for {username}. Response: {tx}")
            return True
        except Exception as e2:
            print("[ERROR] Posting failed:", str(e), str(e2))
            return False

def process_account_file(file_name):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.replace(".txt", "")
    posting_key, active_key = extract_keys(file_path)
    if not posting_key:
        print(f"[WARN] Posting key not found in {file_name}, skipping.")
        return

    success = post_test_thread(username, posting_key)
    if success:
        try:
            os.remove(file_path)
            print(f"[INFO] Removed account file {file_name} after successful post.")
        except Exception as e:
            print(f"[WARN] Could not remove {file_name}: {str(e)}")
    else:
        print(f"[WARN] Post failed for {username}, file not removed.")

def main():
    # --- Step 1: Post first with the primary account ONLY ---
    print(f"[INFO] Posting first blog as primary account: {PRIMARY_USERNAME}")
    post_test_thread(PRIMARY_USERNAME, PRIMARY_POSTING_KEY)
    print(f"[INFO] Primary account post complete.")

if __name__ == "__main__":
    main()