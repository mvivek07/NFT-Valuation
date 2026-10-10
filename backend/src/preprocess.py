"""
Pre-processing pipeline:
 1. Clean (drop duplicates, impute missing values)
 2. Feature engineering (log transforms, engagement ratios — only where the
    source columns exist, so both the synthetic and the real FinWeb/TweetBoost
    schemas work)
 3. Target:
      * real dataset  -> use its `price_label` (0 = never sold, 1..5 = log bins)
      * synthetic     -> bin `avg_price_usd` into log-spaced classes
 4. Scaling + one-hot + PCA to reduce the feature space to key components

The paper's rationale: NFT prices span $0 to $500k+ and ~76% of assets never
sell, so regression on raw price is unstable. Instead we classify assets into
log-spaced price bands ("asset valuation" approach).
"""

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Synthetic-data price classes (USD, log-spaced).
PRICE_BINS = [0, 15, 100, 1500, np.inf]
PRICE_LABELS = ["low(<$15)", "mid($15-100)", "high($100-1500)", "premium(>$1500)"]

LOG_COLS = [
    # synthetic schema
    "followers", "followings", "tweet_likes", "retweets", "replies",
    "collection_size", "collection_sales_total", "favorites_on_opensea",
    # real FinWeb schema
    "followers_count_mean", "friends_count_mean", "nlikes_mean", "nretweets_mean",
    "nreplies_mean", "favourites_count_mean", "statuses_count_mean",
    "total_volume", "total_sales", "total_supply", "market_cap", "num_owners",
]
# Never used as model input: identifiers, raw price, and every target column.
DROP_COLS = ["asset_id", "permalink", "avg_price_usd", "price_class", "listing_price_usd",
             "price_label", "sale_label"]


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.drop_duplicates().copy()
    if "price_label" not in df.columns:
        # Synthetic path bins price directly, so non-positive prices must go.
        df = df[df["avg_price_usd"] > 0]
    return df


def _has(df, *cols):
    return all(c in df.columns for c in cols)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in LOG_COLS:
        if col in df.columns:
            df[f"log_{col}"] = np.log1p(df[col].clip(lower=0))

    # Engagement ratios — social-traction signals the synopsis emphasises.
    if _has(df, "tweet_likes", "retweets", "followers"):
        df["engagement_rate"] = (df["tweet_likes"] + df["retweets"]) / (df["followers"] + 1)
    if _has(df, "nlikes_mean", "nretweets_mean", "followers_count_mean"):
        df["engagement_rate"] = (df["nlikes_mean"] + df["nretweets_mean"]) / (
            df["followers_count_mean"] + 1
        )
    if _has(df, "num_sales", "days_since_mint"):
        df["sales_velocity"] = df["num_sales"] / (df["days_since_mint"] + 1)
    if _has(df, "num_owners", "num_sales"):
        df["owner_concentration"] = df["num_owners"] / (df["num_sales"] + 1)
    if _has(df, "followers", "followings"):
        df["follower_following_ratio"] = df["followers"] / (df["followings"] + 1)
    if _has(df, "followers_count_mean", "friends_count_mean"):
        df["follower_following_ratio"] = df["followers_count_mean"] / (
            df["friends_count_mean"] + 1
        )
    return df


def add_target(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "price_label" in df.columns:
        names = {0: "unsold", 1: "bin1", 2: "bin2", 3: "bin3", 4: "bin4", 5: "bin5"}
        df["price_class"] = df["price_label"].astype(int).map(names)
    else:
        df["price_class"] = pd.cut(
            df["avg_price_usd"], bins=PRICE_BINS, labels=PRICE_LABELS, include_lowest=True
        )
    return df


def build_preprocessor(df: pd.DataFrame, n_components: float | int = 0.95) -> Pipeline:
    """Imputation + scaling + one-hot encoding, followed by PCA.

    n_components=0.95 keeps enough components to explain 95% of variance.
    """
    categorical = [c for c in df.columns if df[c].dtype == object and c not in DROP_COLS]
    numeric = [c for c in df.columns if c not in DROP_COLS + categorical]

    numeric_pipe = Pipeline(
        [("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    )
    transformers = [("num", numeric_pipe, numeric)]
    if categorical:
        categorical_pipe = Pipeline(
            [
                ("impute", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]
        )
        transformers.append(("cat", categorical_pipe, categorical))

    ct = ColumnTransformer(transformers)
    return Pipeline([("columns", ct), ("pca", PCA(n_components=n_components, random_state=42))])


def load_and_prepare(path: str):
    """Returns X (DataFrame of raw features), y (labels), and the full frame."""
    df = pd.read_csv(path)
    df = clean(df)
    df = engineer_features(df)
    df = add_target(df)
    y = df["price_class"]
    drop = set(DROP_COLS) | {"price_class"}
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y, df
