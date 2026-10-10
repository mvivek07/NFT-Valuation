"""
Create the two sample files for the "Upload a CSV" feature.

Both are built from REAL NFTs in the held-out test set (the same 20% split the
models are evaluated on), so the models have never trained on these rows.

  data/sample_upload_full.csv     20 NFTs, every feature column, the seller's
                                  asking price and the true answer (price_label)
                                  so the app can score its own predictions.
  data/sample_upload_minimal.csv  10 NFTs with only 11 easy-to-find columns and
                                  an asking price — shows that a partial file
                                  works (missing columns use typical values).

Usage:
    python backend/src/make_sample_csv.py
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

MINIMAL_COLS = [
    "followers_count_mean", "nlikes_mean", "nretweets_mean", "number_of_tweets", "verified",
    "floor_price", "average_price", "total_sales", "num_owners", "numEvents", "successful",
]
NOT_FEATURES = ["avg_price_usd", "price_label", "sale_label", "permalink", "listing_price_usd"]


def pick(df, test_idx, per_class, rng):
    """Random test rows per price class, preferring rows with an asking price."""
    test = df.iloc[test_idx]
    chosen = []
    for label, k in per_class:
        pool = test[(test["price_label"] == label) & test["listing_price_usd"].gt(0)]
        chosen.extend(rng.choice(pool.index.to_numpy(), size=min(k, len(pool)), replace=False).tolist())
    rng.shuffle(chosen)
    return df.loc[chosen]


def main():
    df = pd.read_csv(DATA / "nft_dataset_real.csv")
    _, test_idx = train_test_split(
        np.arange(len(df)), test_size=0.2, stratify=df["price_label"], random_state=42
    )
    rng = np.random.default_rng(7)
    features = [c for c in df.columns if c not in NOT_FEATURES]

    full = pick(df, test_idx, [(0, 8), (1, 4), (2, 4), (3, 3), (4, 1)], rng)
    out = full[features].copy()
    out.insert(0, "name", [f"NFT #{i}" for i in full.index])
    out["listing_price_usd"] = full["listing_price_usd"].round(2)
    out["price_label"] = full["price_label"].astype(int)
    out.to_csv(DATA / "sample_upload_full.csv", index=False)
    print(f"sample_upload_full.csv     {out.shape[0]} rows x {out.shape[1]} columns")

    mini = pick(df, test_idx, [(0, 4), (1, 2), (2, 3), (3, 1)], rng)
    out = mini[MINIMAL_COLS].copy()
    out.insert(0, "name", [f"NFT #{i}" for i in mini.index])
    out["listing_price_usd"] = mini["listing_price_usd"].round(2)
    out.to_csv(DATA / "sample_upload_minimal.csv", index=False)
    print(f"sample_upload_minimal.csv  {out.shape[0]} rows x {out.shape[1]} columns")


if __name__ == "__main__":
    main()
