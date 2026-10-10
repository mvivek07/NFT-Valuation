"""
Evaluation & visualisation: confusion matrices, PCA variance curve,
feature importances (Random Forest), and price distribution plots.

Usage:
    python src/evaluate.py --data data/nft_dataset.csv
"""

import argparse
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import ConfusionMatrixDisplay
from sklearn.model_selection import train_test_split

from preprocess import load_and_prepare

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
FIG_DIR = Path(__file__).resolve().parents[2] / "reports" / "figures"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/nft_dataset.csv")
    args = ap.parse_args()
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    X, y, df = load_and_prepare(args.data)
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    # Price distribution (log scale) — sold assets only, shows the market skew.
    sold = df.loc[df["avg_price_usd"] > 0, "avg_price_usd"]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.hist(np.log10(sold), bins=80, color="#4c72b0")
    ax.set_xlabel("log10(average price USD)")
    ax.set_ylabel("count")
    ax.set_title(f"NFT price distribution, sold assets (n={len(sold):,})")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "price_distribution.png", dpi=150)

    # Class balance.
    fig, ax = plt.subplots(figsize=(7, 4))
    y.value_counts().sort_index().plot.bar(ax=ax, color="#55a868")
    ax.set_title("Price class balance")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "class_balance.png", dpi=150)

    for model_file in sorted(MODELS_DIR.glob("*.joblib")):
        name = model_file.stem
        try:
            pipe = joblib.load(model_file)
            pipe.predict(X_test.iloc[:1])  # fails fast on sklearn version mismatch
        except Exception as e:
            print(f"Skipping {name}: not loadable in this environment "
                  f"({type(e).__name__}) — likely trained with another sklearn version")
            continue

        fig, ax = plt.subplots(figsize=(7, 6))
        ConfusionMatrixDisplay.from_estimator(
            pipe, X_test, y_test, ax=ax, cmap="Blues", colorbar=False,
            xticks_rotation=30, normalize="true",
        )
        ax.set_title(f"Confusion matrix (row-normalised) — {name}")
        fig.tight_layout()
        fig.savefig(FIG_DIR / f"confusion_{name}.png", dpi=150)

        # PCA explained variance (same fitted PCA inside the pipeline).
        pca = pipe.named_steps["prep"].named_steps["pca"]
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(np.cumsum(pca.explained_variance_ratio_), marker="o", ms=3)
        ax.axhline(0.95, ls="--", c="red", label="95% variance")
        ax.set_xlabel("number of principal components")
        ax.set_ylabel("cumulative explained variance")
        ax.set_title(f"PCA variance curve — {name}")
        ax.legend()
        fig.tight_layout()
        fig.savefig(FIG_DIR / f"pca_variance_{name}.png", dpi=150)

    # Correlation heatmap of the strongest raw features vs price.
    num_df = df.select_dtypes(include=[np.number]).copy()
    corr = num_df.corr(numeric_only=True)["avg_price_usd"].drop("avg_price_usd")
    top = corr.abs().sort_values(ascending=False).head(15).index
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(num_df[list(top) + ["avg_price_usd"]].corr(), annot=True, fmt=".2f",
                cmap="coolwarm", center=0, ax=ax, annot_kws={"size": 7})
    ax.set_title("Correlation of top features with price")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "correlation_heatmap.png", dpi=150)

    print(f"Figures written to {FIG_DIR}/")


if __name__ == "__main__":
    main()
