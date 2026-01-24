import random
import time
from google import genai

# ------------------------------
# Load multiple API keys from gemini_api.txt
# Each key should be on a separate line
# ------------------------------
with open("gemini_api.txt", "r") as f:
    api_keys = [line.strip() for line in f if line.strip()]

if not api_keys:
    raise ValueError("No API keys found in gemini_api.txt")

# ------------------------------
# Load prompts from prompt.txt
# ------------------------------
with open("prompt.txt", "r", encoding="utf-8") as f:
    content = f.read().strip()
    # Assuming prompts are separated by blank lines
    prompts = [p.strip() for p in content.split("\n\n") if p.strip()]

if not prompts:
    raise ValueError("No prompts found in prompt.txt")

# ------------------------------
# Randomly select a prompt
# ------------------------------
selected_prompt = random.choice(prompts)
print(f"Selected prompt:\n{selected_prompt}\n")

# ------------------------------
# Retry logic parameters
# ------------------------------
MAX_RETRIES = 15      # Maximum retry attempts
RETRY_DELAY = 15      # Seconds to wait before retry

# ------------------------------
# Retry loop with multiple API keys
# ------------------------------
for attempt in range(1, MAX_RETRIES + 1):
    # Randomly pick an API key for this attempt
    api_key = random.choice(api_keys)
    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=selected_prompt
        )

        # Extract generated text
        post_text = response.text.strip()
        # Truncate to 280 characters for X
        post_text = post_text[:280]

        # Save to post.txt
        with open("post.txt", "w", encoding="utf-8") as f:
            f.write(post_text)

        print(f"Generated post saved to post.txt using API key ending with ...{api_key[-4:]}")
        print(post_text)
        break  # Exit the retry loop if successful

    except Exception as e:
        print(f"Attempt {attempt} failed with API key ending ...{api_key[-4:]}: {e}")
        if attempt < MAX_RETRIES:
            print(f"Retrying in {RETRY_DELAY} seconds...")
            time.sleep(RETRY_DELAY)
        else:
            print("Maximum retries reached. Could not generate post.")