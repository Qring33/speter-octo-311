import os
import re
import datetime
import json
import time
import requests
from beem import Hive
from concurrent.futures import ThreadPoolExecutor, as_completed

FOLDER_PATH = "hive_accounts"

PRIMARY_USERNAME = "zuber0"
PRIMARY_POSTING_KEY = "5JWu6EDJS4HdhnS8v3PCswvHqTktYXizNeQdhizwrmgHAkJf5xV"

POLLINATIONS_TEXT_URL = "https://text.pollinations.ai/text/"

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

def generate_post_content(prompt=None):
    """Generate Hive post content using Pollinations RAW HTTP endpoint."""
    if prompt is None:
        prompt = """
Write a long-form blog post of at least 550 words with a natural human tone. 
The style must be conversational and readable as if a real person is talking to their community. 
Avoid emojis, avoid bullet points, avoid advertising language, avoid self-referential statements about being an AI, 
avoid generic motivational phrases. Do not use the symbols — or • or similar characters. 
Focus on three themes: current football news, the state of global financial markets, and the Hive blockchain. 
The football section should discuss current transfer rumors, club performance, and fan communities. 
The finance section should talk about inflation, crypto market volatility, and how people are reacting to changes in the global economy. 
The Hive blockchain section should explore what makes Hive different, how the community works, and real examples of people using Hive to create content or earn rewards. 
The tone should feel like someone writing to their friends on Hive, sharing their perspective and asking for opinions. 
End with a personal reflection and an open question to readers.
"""
        
    try:
        url = POLLINATIONS_TEXT_URL + requests.utils.quote(prompt)
        response = requests.get(url, timeout=25)

        if response.status_code != 200:
            print("[ERROR] Pollinations returned HTTP", response.status_code)
            return None

        text = response.text.strip()
        if not text:
            return None

        return text

    except Exception as e:
        print("[ERROR] Pollinations API request failed:", str(e))
        return None

def post_test_thread(username, posting_key):
    hive = Hive(keys=[posting_key])
    title = "Daily Hive Update"
    permlink = generate_permlink(title)
    body = generate_post_content()

    if not body:
        print(f"[WARN] Skipping post for {username}: Pollinations returned empty content.")
        return False

    json_metadata = {
        "tags": ["hive"],
        "app": "inleo/1.0"
    }

    try:
        hive.post(
            title=title,
            body=body,
            author=username,
            permlink=permlink,
            json_metadata=json_metadata
        )
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
    print(f"[INFO] Posting first blog as primary account: {PRIMARY_USERNAME}")
    post_test_thread(PRIMARY_USERNAME, PRIMARY_POSTING_KEY)
    print(f"[INFO] Primary account post complete.")

if __name__ == "__main__":
    main()