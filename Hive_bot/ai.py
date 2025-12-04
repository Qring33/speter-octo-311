import random
import datetime

# ======= WORD LISTS =======
topics = [
    # Crypto
    "BTC halving", "ETH staking", "DeFi growth", "NFT adoption", "crypto regulation",
    "layer-1 scaling", "stablecoin trends", "crypto lending", "market liquidity",
    # Finance
    "stock market volatility", "interest rate hikes", "portfolio diversification",
    "emerging markets", "economic indicators", "inflation trends", "retirement planning",
    # Business
    "startup fundraising", "venture capital trends", "remote work adoption",
    "supply chain innovation", "digital marketing", "corporate governance",
    # Tech
    "AI adoption", "blockchain integration", "cloud computing trends",
    "quantum computing", "IoT devices", "cybersecurity threats",
    # Entrepreneurship
    "side hustle growth", "entrepreneurial mindset", "bootstrapping startups",
    "product-market fit", "scaling operations", "team building strategies"
]

actions = [
    "rising", "holding steady", "breaking down", "testing support", "surging", "correcting",
    "consolidating", "rebounding", "momentum shifting", "accumulating", "declining",
    "trending sideways", "spiking", "oversold conditions", "undervalued", "overextended",
    "retesting highs", "gaining traction", "innovating rapidly", "transforming industries"
]

sentiments = [
    "bullish", "bearish", "neutral", "uncertain", "optimistic", "cautious", "skeptical",
    "excited", "fearful", "confident", "mixed", "hopeful", "wary", "dynamic", "evolving"
]

connectors = [
    "however", "moreover", "interestingly", "currently", "overall",
    "on the other hand", "in contrast", "in summary", "meanwhile", "furthermore",
    "as a result", "similarly", "consequently", "in addition", "alternatively"
]

conclusions = [
    "let’s watch the market closely", "I’m waiting for confirmation", "risk management is key",
    "traders should be careful", "this trend could continue", "expect volatility soon",
    "monitor support and resistance", "keep an eye on BTC dominance",
    "plan your entries wisely", "stay informed", "adapt your strategy accordingly",
    "innovation will shape the next wave", "investors should diversify", "growth potential is high",
    "consider long-term impacts"
]

adjectives = ["significant", "rapid", "unexpected", "critical", "strategic", "innovative", "notable"]
adverbs = ["quickly", "carefully", "gradually", "strategically", "remarkably", "effectively", "consistently"]

# ======= POST TEMPLATES =======
templates = [
    "{{topic}} is currently {{action}}, and the overall market sentiment appears {{sentiment}}. {{connector}}, {{conclusion}}. Investors and enthusiasts should monitor trends {{adverb}} and adopt {{adjective}} strategies.",
    
    "Today’s insight: {{topic}} has been {{action}}. The community sentiment is largely {{sentiment}}. {{connector}}, {{conclusion}}. In my view, {{adjective}} opportunities may arise if one acts {{adverb}}.",
    
    "Analysis update: {{topic}} is {{action}}. Market participants are feeling {{sentiment}}. {{connector}}, {{conclusion}}. Observing developments {{adverb}} can provide {{adjective}} advantage to stakeholders.",
    
    "In recent news, {{topic}} shows signs of {{action}}. Overall sentiment is {{sentiment}}. {{connector}}, {{conclusion}}. Businesses and traders should consider {{adjective}} approaches to stay competitive {{adverb}}.",
    
    "Discussion: {{topic}} has been {{action}}. {{connector}}, the prevailing sentiment is {{sentiment}}. {{conclusion}}. Keeping strategies {{adjective}} and reacting {{adverb}} will be beneficial."
]

title_topics = topics + ["Daily Insights", "Market Update", "Tech News", "Business Tips", "Finance Analysis"]
title_adjectives = ["Update", "Insight", "Report", "Forecast", "Review"]

# ======= GENERATOR FUNCTIONS =======

def generate_random_post():
    """Generate a single unique post"""
    template = random.choice(templates)
    post = template.replace("{{topic}}", random.choice(topics)) \
                   .replace("{{action}}", random.choice(actions)) \
                   .replace("{{sentiment}}", random.choice(sentiments)) \
                   .replace("{{connector}}", random.choice(connectors)) \
                   .replace("{{conclusion}}", random.choice(conclusions)) \
                   .replace("{{adjective}}", random.choice(adjectives)) \
                   .replace("{{adverb}}", random.choice(adverbs))
    return post

def generate_random_title():
    """Generate a unique title"""
    return f"{random.choice(title_topics)}: {random.choice(title_adjectives)} {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

# ======= TEST FUNCTION =======
if __name__ == "__main__":
    for _ in range(5):  # Generate 5 sample posts
        print("Title:", generate_random_title())
        print("Body:", generate_random_post())
        print("------------------------------------------------\n")
