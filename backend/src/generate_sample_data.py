"""
Generate a synthetic NFT dataset that mimics the TweetBoost dataset schema
(Twitter + OpenSea features joined on the NFT asset permalink).

Use this ONLY to develop/test the pipeline. For the real project, replace
data/nft_dataset.csv with the actual TweetBoost / OpenSea-scraped dataset.

Market skew matches the synopsis: ~75% of NFTs under $15, ~1% above $1500.
Social features are generated with genuine correlation to price so the
models have real signal to learn, plus noise so accuracy is not trivial.

Usage:
    python src/generate_sample_data.py --rows 70000 --out data/nft_dataset.csv
"""

import argparse
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

CATEGORIES = ["art", "collectible", "games", "metaverse", "music", "sports", "utility"]


def generate(rows: int) -> pd.DataFrame:
    # Latent "hype" factor drives both price and social engagement.
    hype = RNG.normal(0, 1, rows)

    # Price in USD: log-normal shaped by hype -> heavy right skew.
    log_price = 1.2 + 1.9 * hype + RNG.normal(0, 1.1, rows)
    price_usd = np.exp(log_price * 0.9)
    price_usd = np.clip(price_usd, 0.01, 500_000)

    # --- Twitter features (correlated with hype + noise) ---
    followers = np.exp(6 + 1.4 * hype + RNG.normal(0, 1.5, rows)).astype(int)
    followings = np.exp(5 + 0.3 * hype + RNG.normal(0, 1.2, rows)).astype(int)
    tweet_likes = np.exp(1.5 + 1.1 * hype + RNG.normal(0, 1.3, rows)).astype(int)
    retweets = (tweet_likes * RNG.uniform(0.05, 0.4, rows)).astype(int)
    replies = (tweet_likes * RNG.uniform(0.01, 0.15, rows)).astype(int)
    tweet_count = RNG.poisson(np.clip(2 + 2.5 * np.exp(0.5 * hype), 0, 60))
    account_age_days = RNG.integers(30, 4000, rows)
    verified = (RNG.random(rows) < 1 / (1 + np.exp(-(hype - 2)))).astype(int)
    has_bio = (RNG.random(rows) < 0.8).astype(int)
    hashtags_count = RNG.poisson(3, rows)
    mentions_count = RNG.poisson(1.5, rows)

    # --- OpenSea features ---
    num_sales = RNG.poisson(np.clip(0.3 + 1.5 * np.exp(0.6 * hype), 0, 300))
    listed_count = RNG.poisson(np.clip(1 + 2.0 * np.exp(0.4 * hype), 0, 500))
    collection_size = np.exp(RNG.normal(7, 2, rows)).astype(int)
    collection_sales_total = (collection_size * RNG.uniform(0.0, 0.6, rows)).astype(int)
    creator_royalty_pct = RNG.choice([0, 2.5, 5, 7.5, 10], rows, p=[0.2, 0.2, 0.3, 0.15, 0.15])
    days_since_mint = RNG.integers(1, 365, rows)
    num_owners = np.maximum(1, (num_sales * RNG.uniform(0.3, 1.0, rows)).astype(int))
    has_unlockable = (RNG.random(rows) < 0.1).astype(int)
    is_presale = (RNG.random(rows) < 0.15).astype(int)
    payment_token_eth = (RNG.random(rows) < 0.85).astype(int)
    favorites_on_opensea = np.exp(0.5 + 0.9 * hype + RNG.normal(0, 1.0, rows)).astype(int)

    # --- Image/metadata features (stand-ins for the 130-factor space) ---
    traits_count = RNG.integers(0, 12, rows)
    rarity_score = np.clip(RNG.normal(50 + 8 * hype, 20, rows), 0, 100)
    image_width = RNG.choice([512, 1024, 2048, 4096], rows)
    has_animation = (RNG.random(rows) < 0.12).astype(int)

    df = pd.DataFrame(
        {
            "asset_id": np.arange(rows),
            "category": RNG.choice(CATEGORIES, rows),
            # Twitter
            "followers": followers,
            "followings": followings,
            "tweet_likes": tweet_likes,
            "retweets": retweets,
            "replies": replies,
            "tweet_count": tweet_count,
            "account_age_days": account_age_days,
            "verified": verified,
            "has_bio": has_bio,
            "hashtags_count": hashtags_count,
            "mentions_count": mentions_count,
            # OpenSea
            "num_sales": num_sales,
            "listed_count": listed_count,
            "collection_size": collection_size,
            "collection_sales_total": collection_sales_total,
            "creator_royalty_pct": creator_royalty_pct,
            "days_since_mint": days_since_mint,
            "num_owners": num_owners,
            "has_unlockable": has_unlockable,
            "is_presale": is_presale,
            "payment_token_eth": payment_token_eth,
            "favorites_on_opensea": favorites_on_opensea,
            # Metadata
            "traits_count": traits_count,
            "rarity_score": rarity_score,
            "image_width": image_width,
            "has_animation": has_animation,
            # Target
            "avg_price_usd": np.round(price_usd, 2),
        }
    )

    # Inject realistic messiness: missing values and a few duplicates.
    for col in ["tweet_likes", "retweets", "followers", "rarity_score"]:
        mask = RNG.random(rows) < 0.03
        df.loc[mask, col] = np.nan
    df = pd.concat([df, df.sample(frac=0.005, random_state=1)], ignore_index=True)
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=70_000)
    ap.add_argument("--out", default="data/nft_dataset.csv")
    args = ap.parse_args()

    df = generate(args.rows)
    df.to_csv(args.out, index=False)
    share_under_15 = (df["avg_price_usd"] < 15).mean()
    share_over_1500 = (df["avg_price_usd"] > 1500).mean()
    print(f"Wrote {len(df):,} rows to {args.out}")
    print(f"  under $15: {share_under_15:.1%}   over $1500: {share_over_1500:.1%}")
