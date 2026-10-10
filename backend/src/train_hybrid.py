"""
Train the hybrid architecture from the report (Fig 4.1):

    PCA -> { SVM, Random Forest, GRU-RNN, Linear Regression } -> KNN combiner

Reuses the already-trained SVM / Random Forest pipelines (models/*.joblib,
same train/test split) and adds:
  * models/hybrid_prep.joblib        shared impute+scale+PCA for GRU & regression
  * models/gru.pt                    GRU classifier weights
  * models/linear_regression.joblib  log10(price) regressor
  * models/knn_combiner.joblib       stacking KNN over all base-model outputs
  * reports/metrics_hybrid.json      per-model + hybrid test metrics

Out-of-fold predictions (3-fold) on the training set are used to fit the KNN
combiner so it never sees base-model outputs on data those models trained on.

Usage:
    python backend/src/train_hybrid.py --data data/nft_dataset_real.csv
"""

import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import torch
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.metrics import accuracy_score, f1_score, r2_score, mean_squared_error
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from hybrid import (CLASS_ORDER, CLASS_TO_IDX, build_sequence, gru_proba,
                    log_price_to_class, meta_features, regression_target, train_gru)
from preprocess import build_preprocessor, load_and_prepare

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"


def class_weights(y_idx, n=6):
    counts = np.bincount(y_idx, minlength=n).astype(float)
    w = np.sqrt(counts.sum() / np.maximum(counts, 1))     # softened "balanced"
    return w / w.mean()


def fit_base_models(X_tr, y_tr, price_tr, svm_sample, seed=42, verbose=False):
    """Fit prep + RF + SVM + LR + GRU on one training subset."""
    prep = build_preprocessor(X_tr).fit(X_tr)
    Z = prep.transform(X_tr).astype(np.float32)
    rf = Pipeline([("prep", clone(prep)), ("clf", RandomForestClassifier(
        n_estimators=200, min_samples_leaf=2, n_jobs=-1,
        class_weight="balanced", random_state=seed))]).fit(X_tr, y_tr)

    rng = np.random.default_rng(seed)
    idx = rng.choice(len(X_tr), min(svm_sample, len(X_tr)), replace=False)
    svm = Pipeline([("prep", clone(prep)), ("clf", SVC(
        kernel="rbf", C=10, gamma="scale", class_weight="balanced",
        random_state=seed))]).fit(X_tr.iloc[idx], y_tr.iloc[idx])

    # Price-level regression is only meaningful for assets that actually sold.
    sold = (price_tr.to_numpy() > 0)
    lr = LinearRegression().fit(Z[sold], regression_target(price_tr)[sold])

    y_idx = y_tr.map(CLASS_TO_IDX).to_numpy()
    gru = train_gru(build_sequence(X_tr), Z, y_idx,
                    class_weight=class_weights(y_idx), seed=seed, verbose=verbose)
    return prep, rf, svm, lr, gru


def base_outputs(models, X):
    prep, rf, svm, lr, gru = models
    Z = prep.transform(X).astype(np.float32)
    rf_p = rf.predict_proba(X)
    svm_s = svm.decision_function(X)
    gru_p = gru_proba(gru, build_sequence(X), Z)
    reg = lr.predict(Z)
    return rf_p, svm_s, gru_p, reg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/nft_dataset_real.csv")
    ap.add_argument("--svm-sample", type=int, default=15_000)
    ap.add_argument("--folds", type=int, default=3)
    args = ap.parse_args()

    X, y, df = load_and_prepare(args.data)
    price = df.loc[X.index, "avg_price_usd"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    p_tr, p_te = price.loc[X_tr.index], price.loc[X_te.index]
    print(f"Train {len(X_tr):,}  Test {len(X_te):,}")

    # ---- 1. out-of-fold base-model outputs on the training set -------------
    print(f"\n[1/3] {args.folds}-fold out-of-fold predictions for the combiner")
    oof = np.zeros((len(X_tr), 19), dtype=np.float32)
    skf = StratifiedKFold(n_splits=args.folds, shuffle=True, random_state=42)
    for k, (a, b) in enumerate(skf.split(X_tr, y_tr), 1):
        t0 = time.time()
        models = fit_base_models(X_tr.iloc[a], y_tr.iloc[a], p_tr.iloc[a], args.svm_sample)
        oof[b] = meta_features(*base_outputs(models, X_tr.iloc[b]))
        print(f"  fold {k}/{args.folds} done in {time.time() - t0:.0f}s")

    # ---- 2. full-train base models + test outputs -------------------------
    print("\n[2/3] Fitting base models on the full training set")
    t0 = time.time()
    prep, rf_full, svm_full, lr, gru = fit_base_models(X_tr, y_tr, p_tr, args.svm_sample, verbose=True)
    # Use the project's already-trained SVM / RF for the final test outputs so
    # the hybrid is built on exactly the models reported elsewhere.
    rf_main = joblib.load(MODELS / "random_forest.joblib")
    svm_main = joblib.load(MODELS / "svm_rbf.joblib")
    models_te = (prep, rf_main, svm_main, lr, gru)
    rf_p, svm_s, gru_p, reg = base_outputs(models_te, X_te)
    meta_te = meta_features(rf_p, svm_s, gru_p, reg)
    print(f"  done in {time.time() - t0:.0f}s")

    # ---- 3. KNN combiner ---------------------------------------------------
    print("\n[3/3] Fitting the KNN combiner on out-of-fold outputs")
    knn = Pipeline([("scale", StandardScaler()),
                    ("knn", KNeighborsClassifier(n_neighbors=25, weights="distance"))])
    knn.fit(oof, y_tr)

    # ---- metrics -----------------------------------------------------------
    cls = np.array(CLASS_ORDER)
    preds = {
        "svm_rbf": svm_main.predict(X_te),
        "random_forest": rf_main.predict(X_te),
        "gru_rnn": cls[gru_p.argmax(1)],
        "linear_regression": log_price_to_class(reg),
        "hybrid_knn": knn.predict(meta_te),
    }
    # moving-average style soft vote (the report's alternative combiner)
    svm_onehot = np.eye(6)[[CLASS_TO_IDX[c] for c in preds["svm_rbf"]]]
    rf_order = list(rf_main.named_steps["clf"].classes_)
    rf_aligned = rf_p[:, [rf_order.index(c) for c in CLASS_ORDER]]
    soft = (rf_aligned + svm_onehot + gru_p) / 3
    preds["soft_vote"] = cls[soft.argmax(1)]

    metrics = {}
    print("\n=== Held-out test results ===")
    for name, p in preds.items():
        acc = accuracy_score(y_te, p)
        mf1 = f1_score(y_te, p, average="macro", zero_division=0)
        metrics[name] = {"accuracy": round(acc, 4), "macro_f1": round(mf1, 4)}
        print(f"{name:18s} accuracy {acc:.4f}   macro-F1 {mf1:.4f}")

    sold = p_te.to_numpy() > 0
    y_log = np.log10(p_te.to_numpy()[sold])
    metrics["linear_regression"].update({
        "r2_sold_assets": round(r2_score(y_log, reg[sold]), 4),
        "rmse_log10_price": round(float(np.sqrt(mean_squared_error(y_log, reg[sold]))), 4),
        "n_sold_test": int(sold.sum()),
    })
    print(f"\nLinear regression on sold test assets: R² {metrics['linear_regression']['r2_sold_assets']}, "
          f"RMSE(log10 $) {metrics['linear_regression']['rmse_log10_price']}")

    # ---- save --------------------------------------------------------------
    MODELS.mkdir(exist_ok=True); REPORTS.mkdir(exist_ok=True)
    joblib.dump(prep, MODELS / "hybrid_prep.joblib")
    joblib.dump(lr, MODELS / "linear_regression.joblib")
    joblib.dump(knn, MODELS / "knn_combiner.joblib")
    torch.save({"state_dict": gru.state_dict(),
                "n_static": int(prep.named_steps["pca"].n_components_)},
               MODELS / "gru.pt")
    with open(REPORTS / "metrics_hybrid.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nSaved hybrid models to {MODELS}/ and metrics to {REPORTS}/metrics_hybrid.json")


if __name__ == "__main__":
    main()
