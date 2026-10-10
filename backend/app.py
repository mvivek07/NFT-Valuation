"""
NFT Valuator — web frontend for the trained price-class models.

Serves a dashboard that predicts an NFT's price class from Twitter + OpenSea
features, using the locally trained Random Forest and SVM pipelines.

Run:
    .venv/bin/python webapp/app.py          # http://localhost:5000
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent.parent          # project root
sys.path.insert(0, str(ROOT / "backend" / "src"))
from preprocess import engineer_features  # noqa: E402
from hybrid import (GRUClassifier, build_sequence, gru_proba, log_price_to_class,  # noqa: E402
                    meta_features)
from opensea_client import OpenSeaError, fetch_live_asset, parse_asset_url  # noqa: E402
import torch  # noqa: E402

# Serve the built React app (frontend/dist, produced by `npm run build`).
DIST = ROOT / "frontend" / "dist"
app = Flask(
    __name__,
    static_folder=str(DIST / "assets"),
    static_url_path="/assets",
)

CLASS_NAMES = {0: "unsold", 1: "bin1", 2: "bin2", 3: "bin3", 4: "bin4", 5: "bin5"}
CLASS_RANGES = {
    "unsold": "never sold",
    "bin1": "$10 – $100",
    "bin2": "$100 – $1K",
    "bin3": "$1K – $10K",
    "bin4": "$10K – $100K",
    "bin5": "$100K+",
}
CLASS_ORDER = ["unsold", "bin1", "bin2", "bin3", "bin4", "bin5"]

# The subset of raw features exposed as form inputs; everything else is
# median-imputed by the pipeline.
FORM_FIELDS = [
    "followers_count_mean", "nlikes_mean", "nretweets_mean", "nreplies_mean",
    "number_of_tweets", "verified",
    "floor_price", "average_price", "total_sales", "num_owners",
    "numEvents", "successful",
]

print("Loading models and dataset ...")
RF = joblib.load(ROOT / "models" / "random_forest.joblib")
SVM = joblib.load(ROOT / "models" / "svm_rbf.joblib")
DF = pd.read_csv(ROOT / "data" / "nft_dataset_real.csv")
METRICS = json.loads((ROOT / "reports" / "metrics.json").read_text())

# Hybrid architecture (Fig 4.1): PCA -> GRU-RNN + Linear Regression -> KNN combiner
HYBRID_PREP = joblib.load(ROOT / "models" / "hybrid_prep.joblib")
LINREG = joblib.load(ROOT / "models" / "linear_regression.joblib")
KNN = joblib.load(ROOT / "models" / "knn_combiner.joblib")
_ck = torch.load(ROOT / "models" / "gru.pt", map_location="cpu")
GRU = GRUClassifier(n_static=_ck["n_static"])
GRU.load_state_dict(_ck["state_dict"])
GRU.eval()
METRICS_HYBRID = json.loads((ROOT / "reports" / "metrics_hybrid.json").read_text())

# USD bounds of each price class, for the listed-vs-predicted valuation.
CLASS_BOUNDS = {
    "unsold": (0, 10), "bin1": (10, 100), "bin2": (100, 1_000),
    "bin3": (1_000, 10_000), "bin4": (10_000, 100_000), "bin5": (100_000, float("inf")),
}


def valuation(pred_class: str, listing_usd):
    """Compare the seller's asking price with the predicted value band."""
    if listing_usd is None or not np.isfinite(listing_usd) or listing_usd <= 0:
        return None
    lo, hi = CLASS_BOUNDS[pred_class]
    if pred_class == "unsold":
        verdict, note = "overvalued", "The model expects this asset not to find a buyer at all — any asking price is above its predicted market value."
    elif listing_usd < lo:
        verdict, note = "undervalued", f"Asking price is below the predicted ${lo:,.0f}–{'' if hi == float('inf') else f'${hi:,.0f}'} band — potentially a bargain."
    elif listing_usd > hi:
        verdict, note = "overvalued", f"Asking price is above the predicted ${lo:,.0f}–${hi:,.0f} band — the market is unlikely to pay this."
    else:
        verdict, note = "fair", "Asking price sits inside the predicted value band."
    ratio = None if hi == float("inf") else round(listing_usd / max(hi, 1), 3)
    return {"verdict": verdict, "note": note, "listing_usd": round(float(listing_usd), 2),
            "band_low": lo, "band_high": None if hi == float("inf") else hi, "ratio_to_band_top": ratio}

# Recreate the exact test split used in training, so sample demos are honest
# (the model never saw these rows during fit).
from sklearn.model_selection import train_test_split  # noqa: E402

_idx = np.arange(len(DF))
_, TEST_IDX = train_test_split(
    _idx, test_size=0.2, stratify=DF["price_label"], random_state=42
)

TARGET_COLS = ["avg_price_usd", "price_label", "sale_label", "permalink"]
TEST_SET = set(int(i) for i in TEST_IDX)
RAW_COLS = [c for c in DF.columns if c != "permalink"]

FRIENDLY = {
    "followers_count_mean": "Creator followers",
    "friends_count_mean": "Creator followings",
    "nlikes_mean": "Likes / tweet",
    "nretweets_mean": "Retweets / tweet",
    "nreplies_mean": "Replies / tweet",
    "favourites_count_mean": "Creator favourites",
    "statuses_count_mean": "Creator tweet count",
    "number_of_tweets": "Tweets about asset",
    "floor_price": "Collection floor price",
    "average_price": "Collection avg price",
    "total_sales": "Collection total sales",
    "total_volume": "Collection volume",
    "market_cap": "Collection market cap",
    "num_owners": "Collection owners",
    "total_supply": "Collection supply",
    "numEvents": "Asset events",
    "successful": "Successful sales",
    "transfer": "Transfers",
    "bid_entered": "Bids entered",
    "created": "Listings created",
    "offer_entered": "Offers entered",
    "one_day_volume": "1-day volume",
    "seven_day_volume": "7-day volume",
    "thirty_day_volume": "30-day volume",
    "one_day_sales": "1-day sales",
    "seven_day_sales": "7-day sales",
    "thirty_day_sales": "30-day sales",
    "seven_day_average_price": "7-day avg price",
    "thirty_day_average_price": "30-day avg price",
    "one_day_average_price": "1-day avg price",
    "listed_count_mean": "Twitter list count",
    "personal_score_mean": "Personal account score",
    "bid_withdrawn": "Bids withdrawn",
    "cancelled": "Listings cancelled",
    "approve": "Approvals",
    "is_presale": "Presale item",
    "is_collection_verified": "Collection verified",
    "verified": "Creator verified",
    "count": "Collection item count",
    "num_reports": "Collection reports",
}

_STAT_WORDS = {"mean": "average", "median": "median", "min": "lowest", "max": "highest"}
_BASE_WORDS = {
    "nlikes": "likes on a tweet", "nretweets": "retweets on a tweet", "nreplies": "replies on a tweet",
    "followers_count": "creator followers", "friends_count": "creator followings",
    "favourites_count": "creator favourites", "statuses_count": "creator tweet count",
    "listed_count": "Twitter list count", "number_of_hashtags": "hashtags per tweet",
    "number_of_photos": "photos per tweet", "number_of_urls": "links per tweet",
    "number_of_cashtags": "cashtags per tweet", "personal_score": "personal account score",
}


def friendly(col: str) -> str:
    """Readable label for a dataset column."""
    if col in FRIENDLY:
        return FRIENDLY[col]
    base, _, stat = col.rpartition("_")
    if stat in _STAT_WORDS and base in _BASE_WORDS:
        return f"{_STAT_WORDS[stat].capitalize()} {_BASE_WORDS[base]}"
    return col.replace("_", " ").capitalize()


def _build_charts():
    """Precompute all chart data served to the frontend."""
    charts = {}

    # Class distribution (counts + share)
    counts = DF["price_label"].map(CLASS_NAMES).value_counts()
    charts["class_counts"] = [
        {"cls": c, "range": CLASS_RANGES[c], "count": int(counts.get(c, 0)),
         "share": round(float(counts.get(c, 0)) / len(DF), 4)}
        for c in CLASS_ORDER
    ]

    # Price histogram (log10, sold assets only)
    sold = DF.loc[DF["avg_price_usd"] > 0, "avg_price_usd"]
    logp = np.log10(sold)
    edges = np.linspace(logp.min(), logp.max(), 25)
    hist, _ = np.histogram(logp, bins=edges)
    def money(v):
        return f"${v:,.0f}" if v >= 1 else f"${v:.2f}"
    charts["price_hist"] = [
        {"label": money(10 ** edges[i]), "count": int(hist[i])}
        for i in range(len(hist))
    ]
    charts["n_sold"] = int(len(sold))

    # Top feature correlations with price
    num = DF.drop(columns=["price_label", "sale_label"]).select_dtypes("number")
    corr = num.corrwith(DF["avg_price_usd"]).drop("avg_price_usd").dropna()
    top = corr.abs().sort_values(ascending=False).head(12)
    charts["correlations"] = [
        {"feature": friendly(f), "r": round(float(corr[f]), 3)}
        for f in top.index
    ]

    # PCA cumulative explained variance (from the fitted RF pipeline)
    pca = RF.named_steps["prep"].named_steps["pca"]
    cum = np.cumsum(pca.explained_variance_ratio_)
    charts["pca"] = [{"n": i + 1, "v": round(float(v), 4)} for i, v in enumerate(cum)]

    # Per-class metrics + confusion matrices (sklearn sorts labels alphabetically)
    sk_order = sorted(CLASS_ORDER)
    charts["confusion_labels"] = sk_order
    charts["per_class"] = []
    charts["confusion"] = {}
    for key, name in [("random_forest", "Random Forest"), ("svm_rbf", "SVM (RBF)")]:
        rep = METRICS[key]["report"]
        for cls in CLASS_ORDER:
            if cls in rep:
                charts["per_class"].append({
                    "cls": cls, "model": name,
                    "precision": round(rep[cls]["precision"], 3),
                    "recall": round(rep[cls]["recall"], 3),
                    "f1": round(rep[cls]["f1-score"], 3),
                    "support": int(rep[cls]["support"]),
                })
        cm = np.array(METRICS[key]["confusion_matrix"], dtype=float)
        rows = cm.sum(axis=1, keepdims=True)
        rows[rows == 0] = 1
        charts["confusion"][key] = {
            "counts": METRICS[key]["confusion_matrix"],
            "norm": np.round(cm / rows, 3).tolist(),
            "accuracy": round(METRICS[key]["accuracy"], 4),
            "macro_f1": round(rep["macro avg"]["f1-score"], 3),
        }
    # every branch of the hybrid architecture + the combiners
    charts["model_summary"] = METRICS_HYBRID
    return charts


CHARTS = _build_charts()
print(f"Ready: {len(DF):,} assets, {len(TEST_IDX):,} held-out test rows")


def predict_row(raw: pd.DataFrame):
    """raw: single-row DataFrame with the original dataset columns.

    Runs every branch of the hybrid architecture and the KNN combiner.
    """
    feats = engineer_features(raw)
    X = feats.drop(columns=[c for c in TARGET_COLS + ["listing_price_usd"] if c in feats.columns])

    # base models
    rf_order = list(RF.named_steps["clf"].classes_)
    rf_p = RF.predict_proba(X)
    svm_s = SVM.decision_function(X)
    Z = HYBRID_PREP.transform(X).astype(np.float32)
    gru_p = gru_proba(GRU, build_sequence(X), Z)
    reg = LINREG.predict(Z)

    rf_pred = RF.predict(X)[0]
    svm_pred = SVM.predict(X)[0]
    gru_pred = CLASS_ORDER[int(gru_p[0].argmax())]
    reg_class = str(log_price_to_class(reg)[0])
    reg_price = float(10 ** reg[0])

    # combiner
    hybrid = str(KNN.predict(meta_features(rf_p, svm_s, gru_p, reg))[0])

    rf_map = {c: float(p) for c, p in zip(rf_order, rf_p[0])}
    votes = [rf_pred, svm_pred, gru_pred]
    return {
        "final": hybrid,
        "models": {
            "hybrid_knn": hybrid,
            "gru_rnn": gru_pred,
            "svm": svm_pred,
            "random_forest": rf_pred,
            "linear_regression": reg_class,
        },
        "regression_price_usd": round(reg_price, 2),
        "rf_probabilities": [{"cls": c, "p": round(rf_map.get(c, 0.0), 4)} for c in CLASS_ORDER],
        "gru_probabilities": [{"cls": c, "p": round(float(gru_p[0][i]), 4)} for i, c in enumerate(CLASS_ORDER)],
        "agreement": sum(v == hybrid for v in votes),      # out of 3 classifiers
        # backwards-compatible fields
        "svm": svm_pred, "random_forest": rf_pred, "agree": rf_pred == svm_pred,
    }


@app.get("/")
def index():
    return send_from_directory(DIST, "index.html")


@app.get("/api/charts")
def charts():
    return jsonify(CHARTS)


@app.get("/api/meta")
def meta():
    dist = DF["price_label"].map(CLASS_NAMES).value_counts(normalize=True)
    return jsonify({
        "n_assets": int(len(DF)),
        "n_features": 135,
        "n_test": int(len(TEST_IDX)),
        "accuracy": {
            "svm": round(METRICS["svm_rbf"]["accuracy"], 4),
            "random_forest": round(METRICS["random_forest"]["accuracy"], 4),
            "gru_rnn": METRICS_HYBRID["gru_rnn"]["accuracy"],
            "hybrid_knn": METRICS_HYBRID["hybrid_knn"]["accuracy"],
        },
        "hybrid_metrics": METRICS_HYBRID,
        "class_ranges": CLASS_RANGES,
        "class_order": CLASS_ORDER,
        "class_distribution": {c: round(float(dist.get(c, 0)), 4) for c in CLASS_ORDER},
    })


# Fields shown on the asset profile card, grouped for the frontend.
PROFILE_GROUPS = {
    "twitter": [
        "followers_count_mean", "friends_count_mean", "statuses_count_mean",
        "nlikes_mean", "nretweets_mean", "nreplies_mean",
        "number_of_tweets", "verified",
    ],
    "market": [
        "floor_price", "average_price", "total_sales", "total_volume",
        "market_cap", "num_owners", "total_supply",
    ],
    "activity": [
        "numEvents", "successful", "transfer", "created",
        "bid_entered", "offer_entered",
    ],
}


def _val(row, col):
    if col not in row.index:
        return None
    v = row[col]
    return None if pd.isna(v) else round(float(v), 4)


@app.get("/api/sample")
def sample():
    """A random held-out test asset: form values + readable profile + truth."""
    i = request.args.get("row_id", type=int)
    if i is None or i not in TEST_SET:
        i = int(np.random.choice(TEST_IDX))
    row = DF.iloc[i]
    values = {f: _val(row, f) for f in FORM_FIELDS}
    profile = {
        group: {c: _val(row, c) for c in cols}
        for group, cols in PROFILE_GROUPS.items()
    }
    return jsonify({
        "row_id": i,
        "values": values,
        "profile": profile,
        "created": {
            "year": _val(row, "creation_year"),
            "month": _val(row, "creation_month"),
        },
        "listing_price_usd": _val(row, "listing_price_usd"),
        # truth is sent but the UI only reveals it after the prediction
        "actual": CLASS_NAMES[int(row["price_label"])],
        "price_usd": round(float(row["avg_price_usd"]), 2),
    })


PREVIEW_COLS = [
    "followers_count_mean", "nlikes_mean", "nretweets_mean", "number_of_tweets",
    "floor_price", "total_sales", "num_owners", "numEvents",
    "listing_price_usd", "avg_price_usd",
]


@app.get("/api/preview")
def preview():
    """A few real rows (mixed classes) so the UI can show what the data looks like."""
    rng = np.random.default_rng()
    picks = []
    for label, k in [(0, 3), (1, 2), (2, 2), (3, 1), (4, 1)]:
        pool = DF.index[DF["price_label"] == label].to_numpy()
        picks.extend(rng.choice(pool, size=min(k, len(pool)), replace=False).tolist())
    rows = []
    for i in picks:
        row = DF.iloc[int(i)]
        rec = {c: _val(row, c) for c in PREVIEW_COLS}
        rec["row_id"] = int(i)
        rec["price_class"] = CLASS_NAMES[int(row["price_label"])]
        rows.append(rec)
    return jsonify({"columns": PREVIEW_COLS, "rows": rows})


@app.post("/api/predict")
def predict():
    body = request.get_json(force=True)
    actual_price = None
    listing = None
    if "row_id" in body and body["row_id"] is not None:
        # Full real asset row — the honest demo path.
        raw = DF.iloc[[int(body["row_id"])]].copy()
        actual = CLASS_NAMES[int(raw["price_label"].iloc[0])]
        actual_price = round(float(raw["avg_price_usd"].iloc[0]), 2)
        listing = _val(raw.iloc[0], "listing_price_usd")
    else:
        # Manual input: start from an all-NaN row (pipeline median-imputes the
        # rest), overlay the user's values.
        raw = pd.DataFrame([{c: np.nan for c in DF.columns}])
        for k, v in (body.get("features") or {}).items():
            if k in FORM_FIELDS and v is not None and v != "":
                raw.at[0, k] = float(v)
        actual = None
        lp = body.get("listing_usd")
        listing = float(lp) if lp not in (None, "") else None
    result = predict_row(raw)
    result["actual"] = actual
    result["actual_price"] = actual_price
    result["valuation"] = valuation(result["final"], listing)
    return jsonify(result)


@app.post("/api/live")
def live():
    """Value a real NFT straight from the OpenSea API (needs an API key).

    Body: {"url": <opensea asset url>, "api_key": <optional, else env
           OPENSEA_API_KEY>, "twitter": {<optional creator Twitter stats>}}
    """
    body = request.get_json(force=True)
    url = (body.get("url") or "").strip()
    try:
        chain, contract, token_id = parse_asset_url(url)
        live_data = fetch_live_asset(chain, contract, token_id, api_key=body.get("api_key"))
    except OpenSeaError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:  # network, parsing
        return jsonify({"error": f"Live lookup failed: {type(e).__name__}: {e}"}), 502

    raw = pd.DataFrame([{c: np.nan for c in DF.columns}])
    for k, v in live_data["features"].items():
        if k in raw.columns and v is not None:
            raw.at[0, k] = float(v)
    for k, v in (body.get("twitter") or {}).items():
        if k in FORM_FIELDS and v not in (None, ""):
            raw.at[0, k] = float(v)

    result = predict_row(raw)
    result["actual"] = None
    result["actual_price"] = None
    result["valuation"] = valuation(result["final"], live_data.get("listing_usd"))
    result["live"] = {k: v for k, v in live_data.items() if k != "features"}
    result["live"]["features"] = live_data["features"]
    return jsonify(result)


# --------------------------------------------------------------------------
# CSV upload: value many NFTs at once
# --------------------------------------------------------------------------
FEATURE_COLS = [c for c in DF.columns if c not in TARGET_COLS + ["listing_price_usd"]]
CSV_MAX_ROWS = 5000
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024      # 12 MB upload limit

ASKING_ALIASES = ["listing_price_usd", "asking_price_usd", "asking_price", "listing_usd"]
ID_ALIASES = ["name", "asset_name", "nft", "permalink", "asset_id", "id"]
SAMPLE_FILES = {
    "full": "sample_upload_full.csv",
    "minimal": "sample_upload_minimal.csv",
}
_TRUTHY = {"true": 1, "yes": 1, "y": 1, "false": 0, "no": 0, "n": 0}


def predict_frame(raw: pd.DataFrame):
    """Run every model on many rows. `raw` holds dataset feature columns."""
    feats = engineer_features(raw)
    X = feats.drop(columns=[c for c in TARGET_COLS + ["listing_price_usd"] if c in feats.columns])
    rf_p = RF.predict_proba(X)
    svm_s = SVM.decision_function(X)
    Z = HYBRID_PREP.transform(X).astype(np.float32)
    gru_p = gru_proba(GRU, build_sequence(X), Z)
    reg = LINREG.predict(Z)
    return {
        "final": KNN.predict(meta_features(rf_p, svm_s, gru_p, reg)),
        "gru_rnn": np.array(CLASS_ORDER)[gru_p.argmax(1)],
        "svm": SVM.predict(X),
        "random_forest": RF.predict(X),
        "confidence": gru_p.max(1),
        "regression_price_usd": 10 ** reg,
    }


def _actual_classes(df: pd.DataFrame):
    """Optional answer column: price_label (0-5) or price_class / actual_class (names)."""
    if "price_label" in df.columns:
        lab = pd.to_numeric(df["price_label"], errors="coerce")
        return lab.map(lambda v: CLASS_NAMES.get(int(v)) if pd.notna(v) and int(v) in CLASS_NAMES else None)
    for col in ("price_class", "actual_class"):
        if col in df.columns:
            s = df[col].astype(str).str.strip().str.lower()
            return s.where(s.isin(CLASS_ORDER), None)
    return None


@app.post("/api/predict-csv")
def predict_csv():
    """Value every NFT in an uploaded CSV with the full hybrid model.

    Columns are matched by name against the dataset's feature columns; any that
    are missing are filled with the typical value, unknown ones are ignored.
    Optional columns: an asking price (for the fair-price verdict), an answer
    column (to score the predictions) and a name/id column (for display).
    """
    f = request.files.get("file")
    if f is None or not f.filename:
        return jsonify({"error": "No file received. Choose a .csv file first."}), 400
    try:
        df = pd.read_csv(f.stream, sep=None, engine="python")
    except Exception as e:
        return jsonify({"error": f"Could not read this file as CSV ({type(e).__name__}). "
                                 "Save it as a comma-separated .csv and try again."}), 400

    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    if df.empty:
        return jsonify({"error": "The file has a header but no data rows."}), 400
    used = [c for c in FEATURE_COLS if c in df.columns]
    if not used:
        return jsonify({"error": "None of the column names match the dataset. Download a sample "
                                 "file to see the expected column names (for example "
                                 "followers_count_mean, nlikes_mean, floor_price, total_sales)."}), 400
    truncated = len(df) > CSV_MAX_ROWS
    df = df.head(CSV_MAX_ROWS).reset_index(drop=True)

    # numeric feature frame, in the dataset's column order
    raw = pd.DataFrame(index=df.index, columns=DF.columns, dtype="float64")
    for c in used:
        col = df[c]
        if col.dtype == object:
            col = col.map(lambda v: _TRUTHY.get(str(v).strip().lower(), v))
        raw[c] = pd.to_numeric(col, errors="coerce")
    raw = raw.replace([np.inf, -np.inf], np.nan)

    out = predict_frame(raw)

    ask_col = next((c for c in ASKING_ALIASES if c in df.columns), None)
    asking = pd.to_numeric(df[ask_col], errors="coerce").tolist() if ask_col else None
    id_col = next((c for c in ID_ALIASES if c in df.columns), None)
    actual = _actual_classes(df)
    labels = [
        str(df[id_col][i]) if id_col and pd.notna(df[id_col][i]) else f"row {i + 1}"
        for i in range(len(df))
    ]
    payload = _batch_payload(out, labels, asking, None if actual is None else actual.tolist())

    known = set(FEATURE_COLS) | set(ASKING_ALIASES) | set(ID_ALIASES) | {
        "price_label", "price_class", "actual_class", "sale_label", "avg_price_usd"}
    payload.update({
        "source": "csv",
        "filename": f.filename,
        "truncated": truncated,
        "max_rows": CSV_MAX_ROWS,
        "columns_used": len(used),
        "columns_total": len(FEATURE_COLS),
        "columns_ignored": [c for c in df.columns if c not in known][:20],
        "has_asking": ask_col is not None,
    })
    return jsonify(payload)


def _batch_payload(out, labels, asking=None, actual=None, extra=None):
    """Row-by-row results + summary shared by CSV upload and the real-NFT batch."""
    rows, verdicts, n_scored, n_correct = [], {}, 0, 0
    for i, label in enumerate(labels):
        final = str(out["final"][i])
        ask = asking[i] if asking is not None else None
        ask = float(ask) if ask is not None and pd.notna(ask) else None
        val = valuation(final, ask)
        if val:
            verdicts[val["verdict"]] = verdicts.get(val["verdict"], 0) + 1
        act = actual[i] if actual is not None else None
        correct = None
        if act:
            n_scored += 1
            correct = act == final
            n_correct += int(correct)
        row = {
            "row": i + 1,
            "id": label if len(label) <= 46 else "…" + label[-44:],
            "final": final,
            "gru_rnn": str(out["gru_rnn"][i]),
            "svm": str(out["svm"][i]),
            "random_forest": str(out["random_forest"][i]),
            "confidence": round(float(out["confidence"][i]), 3),
            "regression_price_usd": round(float(out["regression_price_usd"][i]), 2),
            "asking_usd": None if ask is None else round(ask, 2),
            "valuation": val["verdict"] if val else None,
            "actual": act,
            "correct": correct,
        }
        if extra:
            row.update(extra[i])
        rows.append(row)

    counts = pd.Series([r["final"] for r in rows]).value_counts()
    return {
        "n_rows": len(rows),
        "has_asking": asking is not None,
        "has_actual": n_scored > 0,
        "class_counts": [{"cls": c, "count": int(counts.get(c, 0))} for c in CLASS_ORDER],
        "verdict_counts": verdicts,
        "n_scored": n_scored,
        "n_correct": n_correct,
        "accuracy": round(n_correct / n_scored, 4) if n_scored else None,
        "rows": rows,
    }


BATCH_SIZES = (10, 25, 50, 100, 250)


@app.get("/api/sample-batch")
def sample_batch():
    """Predict N random held-out test NFTs at once and compare with reality."""
    try:
        n = int(request.args.get("n", 25))
    except ValueError:
        n = 25
    n = min(max(n, 1), max(BATCH_SIZES))
    idx = np.random.choice(TEST_IDX, size=n, replace=False)
    part = DF.iloc[idx]
    out = predict_frame(part.copy())
    payload = _batch_payload(
        out,
        labels=[f"NFT #{int(i)}" for i in idx],
        asking=part["listing_price_usd"].tolist(),
        actual=[CLASS_NAMES[int(v)] for v in part["price_label"]],
        extra=[{"row_id": int(i), "sold_usd": round(float(p), 2)}
               for i, p in zip(idx, part["avg_price_usd"])],
    )
    payload.update({"source": "test_set", "n_test": int(len(TEST_IDX))})
    return jsonify(payload)


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "That file is larger than 12 MB. Split it into smaller files."}), 413


@app.get("/api/sample-csv/<kind>")
def sample_csv(kind):
    name = SAMPLE_FILES.get(kind)
    if not name or not (ROOT / "data" / name).exists():
        return jsonify({"error": "Sample file not found."}), 404
    return send_from_directory(ROOT / "data", name, as_attachment=True, mimetype="text/csv")


@app.get("/figures/<path:name>")
def figures(name):
    return send_from_directory(ROOT / "reports" / "figures", name)


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
