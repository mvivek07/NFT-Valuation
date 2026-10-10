"""
Merge the real FinWeb/TweetBoost feature files into one training CSV.

Input (from the downloaded dataset):
  FinWebWWW/WWW - FinWeb/Data/Twitter_Features_Filtered.csv   (79 cols, per-asset Twitter aggregates)
  FinWebWWW/WWW - FinWeb/Data/Opensea_Features_Filtered.csv   (48 cols, per-asset OpenSea features)

Output:
  data/nft_dataset_real.csv  — 62,997 assets, joined on `permalink`, with:
    * target `price_label`: 0 = never sold, 1..5 = logarithmic price bins
    * target `sale_label` : 0 = never sold, 1 = sold  (binary task)
    * `avg_price_usd`     : kept only for analysis plots, dropped before training

Usage:
    python src/prepare_real_data.py
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "FinWebWWW" / "WWW - FinWeb" / "Data"
OUT = ROOT / "data" / "nft_dataset_real.csv"


def main():
    tw = pd.read_csv(DATA_DIR / "Twitter_Features_Filtered.csv")
    osf = pd.read_csv(DATA_DIR / "Opensea_Features_Filtered.csv")

    osf = osf.drop(columns=["Unnamed: 0"], errors="ignore")
    # avg_selling_price lives in the Twitter file; keep one copy for plots.
    df = tw.merge(osf, on="permalink", how="inner", validate="1:1")
    df = df.rename(columns={"avg_selling_price": "avg_price_usd"})

    # Seller listing price (USD) from the raw tweet-level file: one row per
    # permalink is enough. Used ONLY to compare predicted value vs asking
    # price (never as a model feature). A handful of rows carry corrupted
    # 1e13+ values, which are dropped.
    raw = pd.read_csv(
        DATA_DIR / "Final_Dataset_Filtered.csv",
        usecols=["permalink", "avg_listing_price"], low_memory=False,
    ).drop_duplicates("permalink")
    raw.loc[raw["avg_listing_price"] > 1e7, "avg_listing_price"] = float("nan")
    df = df.merge(raw.rename(columns={"avg_listing_price": "listing_price_usd"}),
                  on="permalink", how="left")

    # Booleans -> ints so everything numeric is uniform.
    for col in df.columns:
        if df[col].dtype == bool:
            df[col] = df[col].astype(int)

    df.to_csv(OUT, index=False)
    print(f"Wrote {len(df):,} rows x {df.shape[1]} cols to {OUT}")
    print("\nprice_label distribution:")
    print(df["price_label"].value_counts(normalize=True).sort_index().round(4))


if __name__ == "__main__":
    main()
