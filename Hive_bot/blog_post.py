import os
import re
import datetime
import time
import random
import requests
from beem import Hive
from concurrent.futures import ThreadPoolExecutor, as_completed

# AI text generators
from ai import generate_random_post, generate_random_title, datetime

FOLDER_PATH = "hive_accounts"

# Primary Hive account
PRIMARY_USERNAME = "qring"
PRIMARY_POSTING_KEY = "5KS5X9youPJwQZeLJ5g9fP62DNicrG3bFtSr5Hytv4ewHZjQFpD"

# Hive RPC nodes
NODES = [
    "https://api.hive.blog",
    "https://anyx.io",
    "https://api.openhive.network",
    "https://api.pharesim.me",
    "https://hive.roelandp.nl"
]

# ---------------------------
# Pixabay API helpers
# ---------------------------

def load_pixabay_keys():
    try:
        with open("pixabay_api.txt", "r") as f:
            return [x.strip() for x in f.readlines() if x.strip()]
    except:
        return []

PIXABAY_KEYS = load_pixabay_keys()

def get_pixabay_image(query):
    random.shuffle(PIXABAY_KEYS)
    for key in PIXABAY_KEYS:
        try:
            url = f"https://pixabay.com/api/?key={key}&q={query}&image_type=photo&safesearch=true&per_page=50"
            r = requests.get(url, timeout=10)
            data = r.json()
            if "hits" in data and len(data["hits"]) > 0:
                hit = random.choice(data["hits"])
                return hit["largeImageURL"]
        except:
            continue
    return None

# ---------------------------
# Utility helpers
# ---------------------------

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
    permlink += "-" + datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    return permlink

def clean_title(title):
    return re.sub(r'\d{4}-\d{2}-\d{2}.*$', '', title).strip()

def extract_first_paragraph(text):
    m = re.search(r'\.', text)
    if not m:
        return text.strip()
    return text[:m.start() + 1].strip()

# ---------------------------
# Post handling
# ---------------------------

def safe_post(hive, title, body, permlink, username):
    json_metadata = {
        "tags": ["LeoFinance", "hive", "daily", "discussion", "business", "tech", "finance"],
        "app": "inleo/1.0"
    }

    for attempt in range(5):
        try:
            hive.post(
                title=title,
                body=body,
                author=username,
                permlink=permlink,
                json_metadata=json_metadata
            )
            print(f"[SUCCESS] Posted as {username} | permlink: {permlink}")
            return True

        except Exception as e:
            error_msg = str(e)

            if "HIVE_MIN_ROOT_COMMENT_INTERVAL" in error_msg:
                print(f"[SKIP] {username}: Must wait 5 minutes.")
                return False

            if "payer has not enough RC mana" in error_msg:
                print(f"[SKIP] {username}: Low RC.")
                return False

            print(f"[WARN] Attempt {attempt+1} failed for {username}: {e}")
            time.sleep(2 + attempt)

    return False

def post_test_thread(username, posting_key):
    hive = Hive(keys=[posting_key], nodes=NODES, num_retries=5, retry_wait=2)

    # Generate blog content
    body = generate_random_post().strip()

    # First sentence for header
    intro = extract_first_paragraph(body)

    # Title generation
    raw_title = generate_random_title()
    base_title = clean_title(raw_title)
    final_title = f"{base_title}: {intro}"

    # Image query using first word of base_title
    query = base_title.split(" ")[0]
    image_url = get_pixabay_image(query)

    # Insert image with empty alt text to avoid visible "Image" caption
    if image_url:
        body = f"![]({image_url})\n\n{body}"

        # Safety: remove accidental "Image" or "ImageIn" prefix that may appear immediately after the image block
        body = re.sub(r'(!\[\]\(.*?\)\s*\n+)\s*(?:Image|ImageIn)\b', r'\1', body, flags=re.I)

    permlink = generate_permlink(final_title)

    success = safe_post(hive, final_title, body, permlink, username)

    time.sleep(random.uniform(1, 5))
    return success

# ---------------------------
# Account file processing
# ---------------------------

def process_account_file(file_name):
    file_path = os.path.join(FOLDER_PATH, file_name)
    username = file_name.replace(".txt", "")
    posting_key, active_key = extract_keys(file_path)

    if not posting_key:
        print(f"[WARN] No posting key in {file_name}. Removing.")
        try:
            os.remove(file_path)
        except:
            pass
        return

    post_test_thread(username, posting_key)

    # Remove processed account file
    try:
        os.remove(file_path)
        print(f"[INFO] Removed {file_name}")
    except Exception as e:
        print(f"[WARN] Could not remove {file_name}: {e}")

# ---------------------------
# Main workflow
# ---------------------------

def main():
    print(f"[INFO] Posting first with primary account: {PRIMARY_USERNAME}")
    post_test_thread(PRIMARY_USERNAME, PRIMARY_POSTING_KEY)
    print(f"[INFO] Primary account done.\n")

    while True:
        files = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".txt")]
        if not files:
            print("✅ All accounts processed. Exiting.")
            break

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_account_file, f) for f in files]
            for future in as_completed(futures):
                future.result()

if __name__ == "__main__":
    main()