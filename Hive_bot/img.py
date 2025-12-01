import random

# Picsum allows URLs like https://picsum.photos/id/{id}/{width}/{height}
# We'll generate a random image id between 1 and 1000
img_id = random.randint(1, 1000)

# Construct a public URL (800x600)
url = f"https://picsum.photos/id/{img_id}/800/600"

# Output the URL (Hive profile script will read this)
print(url)