import random
import random
import datetime

# ======= MASSIVELY EXPANDED WORD LISTS (2025-Ready, Hashtag-Free) =======

topics = [
    # Crypto & Web3
    "Bitcoin halving cycle", "Ethereum restaking narrative", "Layer-2 adoption curve", "DeFi summer 2025", "Real World Assets tokenization",
    "Bitcoin Ordinals resurgence", "Solana mobile ecosystem", "memecoin meta evolution", "institutional ETF flows", "stablecoin treasury adoption",
    "modular vs monolithic debate", "zero-knowledge roadmap", "account abstraction wallets", "intent-centric architecture", "decentralized sequencing",
    "Bitcoin Lightning scalability", "cross-chain liquidity fragmentation", "perpetual DEX volume surge", "on-chain derivatives growth", "prediction markets revival",

    # Macro & Finance
    "Federal Reserve balance sheet runoff", "10-year Treasury yield breakout", "dollar milkshake theory", "global liquidity conditions",
    "emerging market currency crisis", "corporate bond spread compression", "private credit explosion", "carry trade unwind", "gold vs Bitcoin narrative",
    "commodity supercycle signals", "energy transition bottlenecks", "fiscal dominance era", "modern monetary theory limits", "CBDC pilot results",

    # AI & Technology
    "AI agent interoperability", "open-source model frontier", "multimodal reasoning leap", "on-device inference revolution", "synthetic data moat",
    "GPU supply constraints", "data center power wall", "robotics embodiment stage", "autonomous world models", "ASI timeline compression",
    "spatial computing inflection", "brain-computer interface trials", "6G spectrum allocation", "satellite mega-constellations", "quantum error correction",

    # Business & Entrepreneurship
    "AI-native startup wave", "defense tech funding surge", "climate tech deployment gap", "creator economy infrastructure", "vertical SaaS renaissance",
    "founder-led company premium", "remote-first operating systems", "equity crowdfunding maturity", "roll-up strategy comeback", "family office direct deals",
    "talent war 2.0", "quiet hiring trend", "outcome-based compensation", "micro-acquisition platforms", "lifestyle business revival"
]

actions = [
    "building a multi-month base", "coiling under resistance", "rejecting lower levels cleanly", "printing inverse head-and-shoulders",
    "showing aggressive accumulation", "experiencing controlled distribution", "forming higher lows consistently", "breaking out on expanding volume",
    "retesting breakout levels as support", "trapping late bears", "liquidating weak hands", "absorbing all sell pressure", "showing capitulation volume",
    "rotating into quietly", "leading the market recovery", "lagging intentionally", "decoupling from risk assets", "correlating tightly with rates",
    "responding to macro catalysts", "ignoring short-term noise", "establishing new all-time highs", "correcting in three waves", "extending the fifth wave"
]

sentiments = [
    "overwhelmingly bullish", "cautiously constructive", "euphoric but justified", "fearful yet accumulating", "extremely oversold emotionally",
    "greed index spiking", "capitulation finally here", "quiet confidence building", "narrative dominance shifting", "FOMO entering late stage",
    "complacency at peak levels", "uncertainty at maximum", "risk-on environment returning", "risk-off rotation complete", "conviction rising steadily"
]

connectors = [
    "That being said", "However", "More importantly", "Beneath the surface", "Zooming out", "Looking at the bigger picture",
    "Contrary to consensus", "Despite the headline noise", "Underneath the volatility", "When you strip away emotion",
    "From a first-principles view", "Looking at on-chain reality", "Based on historical parallels", "Given current macro setup",
    "Considering network effects", "Factoring in adoption curves", "Accounting for regulatory clarity", "In light of recent developments"
]

conclusions = [
    "patience continues to be the highest-conviction play", "the path of least resistance remains higher", "this is still early innings",
    "capital preservation comes first", "asymmetric upside justifies current positioning", "the setup improves with each retest",
    "volatility is opportunity in disguise", "narratives follow price — not the other way around", "time in market beats timing the market",
    "strong hands are being rewarded", "weak hands are exiting at the worst time", "the next leg up is being prepared",
    "structural trends remain firmly intact", "cyclical noise cannot derail secular growth", "innovation moves faster than regulation"
]

adjectives = [
    "generational", "structural", "inevitable", "underappreciated", "misunderstood", "capital-efficient", "network-dominant",
    "antifragile", "exponential", "compounding", "deflationary", "permissionless", "sovereign-grade", "institutional-quality",
    "battle-tested", "capital-light", "flywheel-powered", "winner-takes-most", "zero-to-one", "paradigm-defining"
]

adverbs = [
    "relentlessly", "methodically", "surgically", "patiently", "aggressively", "selectively", "confidently", "fearlessly",
    "prudently", "deliberately", "strategically", "tactically", "quietly", "boldly", "unapologetically", "consistently"
]

tones = [
    "calm and convicted", "measured but bullish", "cautiously excited", "data-driven", "on-chain confirmed",
    "macro-aware", "cycle-tested", "battle-scarred", "long-term greedy", "short-term respectful"
]

emojis_list = [
    "Rocket", "Chart Increasing", "Diamond Hands", "Crystal Ball", "Hourglass",
    "Eyes", "Brain", "Bull", "Bear", "Fire", "Lightning",
    "Seedling", "Telescope", "Chart Decreasing", "Key", "Shield", "Magnifying Glass Tilting Left"
]

# ======= 20 SOPHISTICATED TEMPLATES (Professional & Addictive to Read) =======
templates = [
    "Observation: {{topic}} continues {{action}} while most remain focused elsewhere.\nSentiment sits at {{sentiment}} levels.\n{{connector}}, {{conclusion}}.\nThis remains a {{adjective}} opportunity for those willing to think {{adverb}} and act {{tone}}.",

    "Current assessment:\n{{topic}} → {{action}}\nMarket sentiment → {{sentiment}}\n{{connector}}, {{conclusion}}\nPositioning {{adverb}} into {{adjective}} conviction themes continues to make sense {{emoji}}",

    "The quiet truth: {{topic}} has been {{action}} for months.\nRetail sentiment remains {{sentiment}}.\nSmart money behavior suggests otherwise.\n{{connector}}, {{conclusion}}\nStaying {{adjective}} and accumulating {{adverb}}.",

    "2025 thesis update:\n{{topic}} is {{action}} exactly as projected in this cycle phase.\nBroader sentiment still pricing in {{sentiment}} outcomes.\n{{connector}}, {{conclusion}}\nThe risk/reward skew remains {{adjective}} when positioned {{adverb}}.",

    "Not financial advice, but worth noting:\n{{topic}} showing textbook {{action}}.\nFear/greed currently reading {{sentiment}}.\n{{connector}}, {{conclusion}}\nPersonally remaining {{tone}} on this name {{emoji}}",

    "Pattern recognition:\nWe've seen {{topic}} {{action}} during similar macro regimes before.\nCurrent sentiment mirrors past {{sentiment}} phases perfectly.\n{{connector}}, {{conclusion}}\nHistory favors the {{adjective}} and {{adverb}}-positioned.",

    "Under-the-radar development:\n{{topic}} quietly {{action}} amid louder narratives.\nOn-chain + sentiment data both confirming {{sentiment}} shift.\n{{connector}}, these setups often precede {{adjective}} moves when executed {{adverb}}.",

    "Long-form thought:\n{{topic}} has spent the last quarter {{action}}.\nYet the narrative remains stuck in {{sentiment}} mode.\n{{connector}}, such disconnects are where {{adjective}} wealth is built — provided one moves {{adverb}} and stays {{tone}}.",

    "Simple framework:\nIf {{topic}} continues {{action}}, and sentiment stays {{sentiment}},\nthen {{conclusion}}.\nThat probability feels {{adjective}} from current levels when deployed {{adverb}}.",

    "Final thought tonight:\n{{topic}} is either {{action}} — or setting up for something much larger.\nEither way, {{conclusion}}.\nI choose to remain {{adjective}}, {{adverb}}, and {{tone}} {{emoji}}"
]

# ======= TITLE TEMPLATES (Clean & Click-Worthy) =======
title_templates = [
    "{{topic}} – {{title_adj}} {{date}}",
    "Weekend Reflection: {{title_adj}}",
    "Sunday Alpha Drop {{date}}",
    "Market Note: {{topic}}",
    "Quiet Observation No. {{random_num}}",
    "Conviction Update – {{date}}",
    "Thread: {{title_adj}} on {{topic}}",
    "GM. One Thought for {{date}}",
    "Closing Thought: {{title_adj}}",
    "Cycle Context {{date}}: {{topic}}"
]

title_adjectives = ["Update", "Assessment", "Observation", "Framework", "Conviction Check", "Pattern", "Signal", "Reflection", "Thread", "Note"]

# ======= GENERATOR FUNCTIONS =======
def random_emoji():
    return random.choice(emojis_list)

def generate_random_title():
    template = random.choice(title_templates)
    date_str = datetime.datetime.now().strftime('%b %d, %Y')
    return template.replace("{{topic}}", random.choice(topics)) \
                   .replace("{{title_adj}}", random.choice(title_adjectives)) \
                   .replace("{{date}}", date_str) \
                   .replace("{{random_num}}", str(random.randint(41, 99)))

def generate_random_post():
    template = random.choice(templates)
    return template.replace("{{topic}}", random.choice(topics)) \
                   .replace("{{action}}", random.choice(actions)) \
                   .replace("{{sentiment}}", random.choice(sentiments)) \
                   .replace("{{connector}}", random.choice(connectors)) \
                   .replace("{{conclusion}}", random.choice(conclusions)) \
                   .replace("{{adjective}}", random.choice(adjectives)) \
                   .replace("{{adverb}}", random.choice(adverbs)) \
                   .replace("{{tone}}", random.choice(tones)) \
                   .replace("{{emoji}}", random_emoji())

# ======= TEST RUN =======
if __name__ == "__main__":
    print("Generating 10 ultra-clean, professional-grade posts (zero hashtags)\n" + "="*70)
    for i in range(10):
        print(f"{i+1}. {generate_random_title()}\n")
        print(generate_random_post())
        print("\n" + "—" * 70 + "\n")