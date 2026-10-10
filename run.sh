#!/usr/bin/env bash
# NFT Valuator — one short command for everything.
#
#   ./run.sh setup         FIRST TIME: install everything, train the models, build the frontend
#   ./run.sh               start the app (backend + built frontend) -> http://localhost:5000
#   ./run.sh dev           frontend dev server with hot reload      -> http://localhost:5173
#   ./run.sh build         rebuild the React frontend (after editing frontend/src)
#   ./run.sh train         retrain SVM + Random Forest
#   ./run.sh train-hybrid  retrain GRU-RNN + linear regression + KNN combiner
#   ./run.sh evaluate      regenerate the evaluation figures
#   ./run.sh data          rebuild data/nft_dataset_real.csv from the raw FinWebWWW folder

set -e
cd "$(dirname "$0")"
PY=.venv/bin/python
DATA=data/nft_dataset_real.csv

need_setup() {
  if [ ! -x "$PY" ] || [ ! -f models/knn_combiner.joblib ] || [ ! -f frontend/dist/index.html ]; then
    echo "This project is not set up yet. Run:  ./run.sh setup"; exit 1
  fi
}

case "${1:-app}" in
  app)
    need_setup
    exec $PY backend/app.py ;;

  dev)
    cd frontend && { [ -d node_modules ] || npm install --no-audit --no-fund; } && exec npm run dev ;;

  build)
    cd frontend && npm install --no-audit --no-fund && npm run build ;;

  train)        exec $PY backend/src/train.py --data $DATA ;;
  train-hybrid) exec $PY backend/src/train_hybrid.py --data $DATA ;;
  evaluate)     exec $PY backend/src/evaluate.py --data $DATA ;;
  data)         exec $PY backend/src/prepare_real_data.py ;;

  setup)
    command -v python3 >/dev/null || { echo "Python 3.10+ is required."; exit 1; }
    command -v npm >/dev/null     || { echo "Node.js 18+ (with npm) is required."; exit 1; }
    [ -f "$DATA" ] || { echo "Missing $DATA — it should come with the repository."; exit 1; }

    echo "==> [1/5] Python environment"
    [ -x "$PY" ] || python3 -m venv .venv
    $PY -m pip install --quiet --upgrade pip
    $PY -m pip install --quiet -r requirements.txt

    echo "==> [2/5] PyTorch (CPU build)"
    $PY -c "import torch" 2>/dev/null \
      || $PY -m pip install --quiet torch --index-url https://download.pytorch.org/whl/cpu \
      || $PY -m pip install --quiet torch

    echo "==> [3/5] Training SVM + Random Forest (about 30 seconds)"
    [ -f models/random_forest.joblib ] && [ -f models/svm_rbf.joblib ] || $PY backend/src/train.py --data $DATA

    echo "==> [4/5] Training GRU-RNN + regression + KNN combiner (about 2 minutes)"
    [ -f models/knn_combiner.joblib ] && [ -f models/gru.pt ] || $PY backend/src/train_hybrid.py --data $DATA

    echo "==> [5/5] Building the frontend"
    (cd frontend && npm install --no-audit --no-fund && npm run build)

    echo
    echo "Setup complete. Start the app with:  ./run.sh"
    ;;

  *)
    echo "usage: ./run.sh [setup|app|dev|build|train|train-hybrid|evaluate|data]"; exit 1 ;;
esac
