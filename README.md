# Analysis of Trending NFTs using Time-Series Data and Machine Learning

ML pipeline that classifies NFTs into price bands (low / mid / high / premium) from
Twitter engagement + OpenSea market features, following the "asset valuation"
approach (average selling price, logarithmic bins) described in the project report.

## Run it (after cloning)

You need **Python 3.10+**, **Node.js 18+** and about 3 GB of free disk space.

```bash
git clone <your-repo-url>
cd <repo-folder>
./run.sh setup      # first time only, ~3–5 minutes
./run.sh            # start the app -> http://localhost:5000
```

`./run.sh setup` creates the Python environment, installs the packages, trains all
five models (they are too large to store on GitHub) and builds the frontend.
`./run.sh` then starts the backend, which also serves the frontend, on port 5000
(`PORT=8080 ./run.sh` to use another port).

To work on the frontend with hot reload, keep `./run.sh` running and open a second
terminal:

```bash
./run.sh dev        # frontend dev server -> http://localhost:5173
```

On Windows, run these commands in **Git Bash** or **WSL**; the manual equivalent
for PowerShell is at the bottom of this file.

## Project structure

```
NFT-project/
├── run.sh                       # ONE command for everything (see below)
├── backend/
│   ├── app.py                   # Flask API: /api/predict, /api/sample, /api/meta
│   └── src/
│       ├── prepare_real_data.py # merge FinWeb Twitter+OpenSea files -> training CSV
│       ├── preprocess.py        # cleaning, feature engineering, price bins, PCA
│       ├── train.py             # trains Random Forest + SVM, saves models + metrics
│       ├── evaluate.py          # confusion matrices, PCA curve, heatmap figures
│       ├── predict.py           # CLI prediction on new assets
│       └── generate_sample_data.py  # synthetic data (pipeline testing only)
├── frontend/                    # React (Vite) app — 5 pages, hash-routed
│   ├── src/
│   │   ├── App.jsx              # router + shared predictor state
│   │   ├── pages/               # Home, Predictor, Dataset, Models, Guide
│   │   ├── components/          # Navbar, Layout, Charts, AssetProfile, forms, ResultPanel
│   │   ├── theme.js, app.css    # colour system (per-page hues, model + class palettes)
│   ├── dist/                    # production build (served by Flask)
│   ├── index.html, vite.config.js, package.json
│   └── legacy/                  # previous vanilla HTML/JS version (unused)
├── data/                        # nft_dataset_real.csv (62,997 real assets)
├── models/                      # trained .joblib pipelines
├── reports/                     # metrics.json + figures/*.png
├── notebooks/                   # NFT_Analysis_Colab.ipynb (Google Colab)
├── FinWebWWW/                   # raw downloaded dataset
└── requirements.txt
```

## Commands (short)

```bash
./run.sh            # start the web app  -> http://localhost:5000
./run.sh build      # rebuild the React frontend (after editing frontend/src)
./run.sh train      # retrain SVM + Random Forest
./run.sh train-hybrid  # train GRU-RNN + regression + KNN combiner
./run.sh evaluate   # regenerate all evaluation figures
./run.sh data       # rebuild the merged training CSV from FinWebWWW
./run.sh setup      # first-time install (venv + dependencies)
```

Stack: **React 18 (Vite)** frontend · **Flask** REST API backend · **scikit-learn**
models. The production build in `frontend/dist` is served by Flask, so `./run.sh`
alone runs everything; `npm run dev` inside `frontend/` gives hot-reload during
frontend development (proxies API calls to :5000).

## Quick start (local, real FinWeb/TweetBoost dataset)

The real dataset lives in `FinWebWWW/WWW - FinWeb/Data/` (62,997 assets).

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 1. merge Twitter + OpenSea feature files into one training CSV
.venv/bin/python src/prepare_real_data.py

# 2. train both models
.venv/bin/python src/train.py --data data/nft_dataset_real.csv

# 3. produce evaluation figures
.venv/bin/python src/evaluate.py --data data/nft_dataset_real.csv

# 4. predict on new assets
.venv/bin/python src/predict.py --model models/svm_rbf.joblib --input data/new_assets.csv
```

Latest results (80/20 stratified split, 6 classes: unsold + 5 log price bins):
**SVM (RBF) 89.2% accuracy, Random Forest 85.8%** — see `reports/metrics.json`.

## Hybrid architecture (report Fig 4.1)

`./run.sh train-hybrid` trains the remaining branches of the report's architecture
on top of the SVM / Random Forest:

| Branch | File | Test result |
|---|---|---|
| **GRU-RNN** — recurrent net over the collection's 1-day→7-day→30-day market windows, fused with the PCA features | `models/gru.pt` | **91.1%** acc · macro-F1 0.652 (best single model) |
| **Linear regression** — log10(price) for assets that sell | `models/linear_regression.joblib` | R² 0.34 on sold test assets |
| **KNN combiner** — stacks every model's output (fit on 3-fold out-of-fold predictions) | `models/knn_combiner.joblib` | **91.5%** acc (final system) |
| Soft vote (moving-average alternative) | — | 89.7% acc · macro-F1 0.635 |

Full numbers: `reports/metrics_hybrid.json`. Code: `backend/src/hybrid.py`,
`backend/src/train_hybrid.py`. (PyTorch CPU build is required:
`.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu`.)

## Valuation: predicted band vs asking price

`data/nft_dataset_real.csv` now carries each asset's seller listing price
(`listing_price_usd`, comparison only — never a model feature). The app compares
the asking price with the predicted price band and reports **undervalued / fair /
overvalued** (report §4.2).

## Live OpenSea lookup (report §3.2.1)

`backend/src/opensea_client.py` queries the OpenSea API v2 for any asset URL —
collection stats (total + 1/7/30-day windows), the asset's event history and its
best listing — maps them to the dataset's feature names, and the hybrid model values
it live (`POST /api/live`, "🌐 Live from OpenSea" tab in the UI). Requires a free
OpenSea API key, pasted in the form or exported as `OPENSEA_API_KEY`. Creator
Twitter stats are entered manually (X/Twitter API is no longer free) or
median-imputed.

## Web frontend

```bash
.venv/bin/python webapp/app.py     # then open http://localhost:5000
```

Dashboard features: live price-class prediction from Twitter + OpenSea inputs
(blank fields are median-imputed by the pipeline), a **"Load real NFT"** button
that pulls a random *held-out test* asset and compares the prediction against
its actual class, Random Forest class probabilities, and the full evaluation
figure gallery. Light/dark theme follows the OS setting; responsive to phone width.

## Pipeline design

1. **Cleaning** — drop duplicates, remove rows with non-positive price, median/mode imputation for missing values.
2. **Feature engineering** — `log1p` transforms on heavy-tailed counts (followers, likes, retweets, collection size), plus ratios: engagement rate, sales velocity, follower/following ratio, owner concentration.
3. **Target** — `avg_price_usd` binned into 4 log-spaced classes: `<$15`, `$15–100`, `$100–1500`, `>$1500` (matches the market skew: ~75% of NFTs under $15, ~1% above $1500).
4. **Dimensionality reduction** — StandardScaler + one-hot encoding, then **PCA keeping 95% explained variance**.
5. **Models** — **Random Forest** (300 trees, class-balanced) and **SVM** (RBF kernel, class-balanced, subsampled training because SVM is O(n²)).
6. **Evaluation** — accuracy, per-class precision/recall/F1, normalized confusion matrices. *Note: with heavy class imbalance, always report macro-F1 alongside accuracy — a model that predicts "low" for everything already gets ~80% accuracy.*

## Replacing the synthetic data with the real dataset

The report references the **TweetBoost dataset** (Twitter + OpenSea joined on the NFT
permalink; 62,997 assets, Jan–Mar 2021). To use it:

1. Get the dataset from the TweetBoost paper authors' release (search
   "TweetBoost: Influence of Social Media on NFT Valuation" — ICWSM 2022 — their
   GitHub/dataset link) or any Kaggle mirror of OpenSea sales + NFT tweets.
2. Make sure the CSV has a USD price column; rename it to `avg_price_usd`
   (or edit `preprocess.py` to point to your column).
3. Keep/rename social columns to match where possible: `followers`, `followings`,
   `tweet_likes`, `retweets`, `num_sales`, `listed_count`, ... Columns that don't
   exist are simply not used; extra numeric columns are used automatically.
4. Re-run `train.py` and `evaluate.py`.

## Google Colab

Upload `notebooks/NFT_Analysis_Colab.ipynb` at https://colab.research.google.com
(File → Upload notebook) and run the cells top to bottom. The notebook contains the
entire pipeline self-contained, with options to upload your CSV, mount Google Drive,
or generate synthetic data.

## Windows (PowerShell) without `run.sh`

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python backend\src\train.py --data data\nft_dataset_real.csv
.venv\Scripts\python backend\src\train_hybrid.py --data data\nft_dataset_real.csv
cd frontend; npm install; npm run build; cd ..
.venv\Scripts\python backend\app.py          # http://localhost:5000
```

Frontend dev server (second terminal): `cd frontend; npm run dev` → http://localhost:5173
