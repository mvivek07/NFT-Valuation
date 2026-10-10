"""
Train Random Forest and SVM classifiers on the pre-processed NFT dataset.

Pipeline per model: impute -> scale -> one-hot -> PCA -> classifier.
Saves fitted models to models/ and a metrics report to reports/.

Usage:
    python src/train.py --data data/nft_dataset.csv
    python src/train.py --data data/nft_dataset.csv --svm-sample 20000
"""

import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC

from preprocess import build_preprocessor, load_and_prepare

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"


def train_model(name, clf, X_train, y_train, X_test, y_test, preprocessor):
    # Clone: fitting one model must not refit the preprocessor shared by others.
    pipe = Pipeline([("prep", clone(preprocessor)), ("clf", clf)])
    t0 = time.time()
    pipe.fit(X_train, y_train)
    fit_s = time.time() - t0

    y_pred = pipe.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"\n=== {name} ===  (fit {fit_s:.1f}s)")
    print(f"Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, zero_division=0))

    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(pipe, MODELS_DIR / f"{name}.joblib")
    return {"accuracy": acc, "fit_seconds": fit_s, "report": report, "confusion_matrix": cm}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/nft_dataset.csv")
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument(
        "--svm-sample", type=int, default=20_000,
        help="Rows used to train the (O(n^2)) SVM; 0 = use all rows",
    )
    args = ap.parse_args()

    X, y, _ = load_and_prepare(args.data)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=42
    )
    print(f"Train: {len(X_train):,}  Test: {len(X_test):,}  Features: {X.shape[1]}")
    print(f"Class balance:\n{y.value_counts(normalize=True).round(3)}")

    preprocessor = build_preprocessor(X)
    results = {}

    rf = RandomForestClassifier(
        n_estimators=300, max_depth=None, min_samples_leaf=2,
        n_jobs=-1, class_weight="balanced", random_state=42,
    )
    results["random_forest"] = train_model(
        "random_forest", rf, X_train, y_train, X_test, y_test, preprocessor
    )

    # SVM with RBF kernel scales ~O(n^2); subsample the train split if large.
    if args.svm_sample and len(X_train) > args.svm_sample:
        idx = np.random.default_rng(42).choice(len(X_train), args.svm_sample, replace=False)
        X_svm, y_svm = X_train.iloc[idx], y_train.iloc[idx]
    else:
        X_svm, y_svm = X_train, y_train
    svm = SVC(kernel="rbf", C=10, gamma="scale", class_weight="balanced", random_state=42)
    results["svm_rbf"] = train_model(
        "svm_rbf", svm, X_svm, y_svm, X_test, y_test, preprocessor
    )

    REPORTS_DIR.mkdir(exist_ok=True)
    with open(REPORTS_DIR / "metrics.json", "w") as f:
        json.dump(results, f, indent=2)
    best = max(results, key=lambda k: results[k]["accuracy"])
    print(f"\nBest model: {best}  (accuracy {results[best]['accuracy']:.4f})")
    print(f"Models saved to {MODELS_DIR}/, metrics to {REPORTS_DIR}/metrics.json")


if __name__ == "__main__":
    main()
