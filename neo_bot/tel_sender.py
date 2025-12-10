import requests
import time

# Your details (already inserted)
TOKEN = "8560965744:AAGpT4-EtbY1_0zG6pFzHjd7DKhv6Z3qsn4"
CHAT_ID = 6807387667

message = "Qring, i have successfully created 96 accounts in neobux, go check them out!"

url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

# Send the message once
response = requests.post(url, data={"chat_id": CHAT_ID, "text": message})
print("Sent once →", response.json())

# Uncomment the lines below if you want to send it 96 times (with 1-second delay to avoid flood ban)
"""
for i in range(96):
    response = requests.post(url, data={"chat_id": CHAT_ID, "text": message})
    print(f"Sent {i+1}/96 →", response.json())
    time.sleep(1)  # important: don't spam too fast
"""
