"""
Predict the price class of new NFT records with a saved model.

Usage:
    python src/predict.py --model models/random_forest.joblib --input data/new_assets.csv
"""

import argparse

import joblib
import pandas as pd

from preprocess import engineer_features


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="models/random_forest.joblib")
    ap.add_argument("--input", required=True, help="CSV with the same raw feature columns")
    ap.add_argument("--out", default="reports/predictions.csv")
    args = ap.parse_args()

    pipe = joblib.load(args.model)
    df = pd.read_csv(args.input)
    X = engineer_features(df)
    for col in ("avg_price_usd", "price_class", "asset_id"):
        X = X.drop(columns=[col], errors="ignore")

    df["predicted_price_class"] = pipe.predict(X)
    df.to_csv(args.out, index=False)
    print(df["predicted_price_class"].value_counts())
    print(f"Predictions written to {args.out}")


if __name__ == "__main__":
    main()
