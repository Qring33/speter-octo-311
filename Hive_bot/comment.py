import random

# Expanded base positive phrases – natural and commonly used in supportive comments
base_phrases = [
    "Thanks for sharing this",
    "Great post",
    "Really insightful",
    "Appreciate the breakdown",
    "Solid take",
    "Well said",
    "This is spot on",
    "Helpful perspective",
    "Valuable thoughts",
    "Thanks for posting",
    "Good information",
    "Nice post",
    "Excellent points",
    "Love reading this",
    "Always enjoy your takes",
    "Super useful",
    "Clear and concise",
    "Spot-on analysis",
    "This resonates",
    "Important topic",
    "Glad you brought this up",
    "Thought-provoking stuff",
    "Quality content as always",
    "Keep it coming",
    "Exactly what I was thinking",
    "Couldn't agree more",
    "This needs more attention",
    "Well articulated",
    "On point",
    "Great summary",
    "Thanks for the update",
    "Always learn something here",
    "Strong points",
    "This hits the mark",
    "Appreciate the insight",
    "Very well explained",
    "Right on target"
]

# Expanded topic-specific reactions (replaced "angle" with "topic" as requested)
topic_reactions = [
    "this topic is underrated",
    "this topic deserves more attention",
    "this topic is fascinating",
    "the implications of this topic are huge",
    "this topic needs more discussion",
    "this topic is exactly what the space needs",
    "love seeing focus on this topic",
    "the second-order effects of this topic are worth watching",
    "this topic provides a helpful framework",
    "great way to approach this topic",
    "the incentives around this topic are key",
    "this topic is evolving fast",
    "these trade-offs in this topic are critical",
    "perfect timing on this topic",
    "this topic brings much-needed clarity",
    "the broader context of this topic matters",
    "these developments in this topic are moving quickly",
    "the nuance in this topic is important",
    "this topic adds real value",
    "the long-term view on this topic is crucial",
    "the challenges in this topic are real but solvable",
    "the opportunities in this topic are massive",
    "this topic changes everything",
    "the ecosystem impact of this topic could be profound",
    "this topic is under-discussed",
    "this topic is a game-changer",
    "this topic is worth digging deeper into",
    "this topic shifts the conversation",
    "this topic opens new doors",
    "this topic is ahead of its time"
]

# Light additions for emphasis and variety
additions = [
    "as always",
    "once again",
    "right on time",
    "as expected from you",
    "no surprise here",
    "definitely",
    "absolutely",
    "100%",
    "for sure",
    "indeed",
    "totally",
    "completely",
    "exactly",
    "precisely",
    "spot on",
    "no doubt",
    "without question"
]

# Expanded emoji set – positive, relevant, and commonly used
emojis = [
    "🔥", "💯", "🚀", "🤔", "👀", "✅", "🙌", "👍", "❤️", "💭",
    "🧠", "📈", "🌟", "⚡", "🔍", "💡", "👏", "🎯", "🔄", "✅",
    "✨", "🌐", "📊", "🔔", "🔥", "⚡", "🚀", "💡", "🙏", "🫡"
]

# Expanded and varied templates for natural-looking comments
templates = [
    "{{base}}",
    "{{base}} {{emoji}}",
    "{{base}}. {{topic}}",
    "{{base}} — {{topic}}",
    "{{base}}. {{topic}} {{emoji}}",
    "{{base}}, {{topic}}",
    "{{base}} {{addition}}, {{topic}}",
    "{{base}}. {{topic}} {{emoji}}",
    "{{base}} {{emoji}} {{emoji}}",
    "{{base}} {{addition}}",
    "{{base}} {{emoji}}",
    "{{topic}} {{emoji}}",
    "{{topic}} — {{base}}",
    "{{base}}. {{topic}} {{addition}} {{emoji}}",
    "{{base}} {{emoji}} {{topic}}",
    "Agreed. {{topic}}",
    "Exactly. {{topic}} {{emoji}}",
    "This. {{topic}}",
    "Yes, {{topic}}",
    "{{base}}. Keep posting this kind of content {{emoji}}",
    "Appreciate posts like this {{emoji}}",
    "More of this please {{emoji}}",
    "One of the better takes on this {{emoji}}",
    "{{base}} as expected from you {{emoji}}",
    "Always high quality — {{topic}} {{emoji}}",
    "{{topic}}. {{base}}",
    "Great to see {{topic}} {{emoji}}",
    "{{base}}, especially {{topic}}",
    "Solid content. {{topic}} {{emoji}}",
    "Thanks for highlighting {{topic}}",
    "This is why I follow you — {{topic}}"
]

def generate_comment():
    template = random.choice(templates)
    
    selected_base = random.choice(base_phrases)
    selected_topic = random.choice(topic_reactions)
    selected_addition = random.choice(additions)
    selected_emoji = random.choice(emojis)
    
    comment = template.replace("{{base}}", selected_base) \
                      .replace("{{topic}}", selected_topic) \
                      .replace("{{addition}}", selected_addition) \
                      .replace("{{emoji}}", selected_emoji)
    
    # Clean up spacing and punctuation
    comment = " ".join(comment.split())
    comment = comment.replace(" ,", ",").replace(" .", ".").replace(" !", "!").replace(" ?", "?")
    
    # Capitalize the first letter
    if comment:
        comment = comment[0].upper() + comment[1:]
    
    # Avoid double emojis in some cases if needed (optional)
    # Ensure it doesn't end with punctuation right before emoji in awkward way
    if comment.endswith((".", "!", "?")) and " {{emoji}}" in template:
        pass  # already handled by spacing
    
    return comment

if __name__ == "__main__":
    print("Generating 25 varied supportive comments\n" + "="*80)
    random.seed()  # Ensure fresh randomness
    generated = set()  # Optional: avoid exact duplicates in demo
    i = 0
    while i < 25:
        comment = generate_comment()
        if comment not in generated:
            generated.add(comment)
            print(f"{i+1:2}. {comment}")
            print("-" * 80)
            i += 1