"""
Hybrid model components from the report's architecture (Fig 4.1):

    Raw features -> PCA -> { SVM, RNN (GRU), Linear Regression } -> KNN combiner -> output

* GRUClassifier  – a recurrent network over the asset's collection time-series
                   (1-day / 7-day / 30-day market windows), fused with the PCA
                   components of the static Twitter + OpenSea features.
* Linear regression – predicts log10(average selling price); its output is
                   also mapped onto the price classes so it can vote.
* KNN combiner   – learns, from every base model's output, which final class
                   best matches (stacking; the report's "KNN to discover the
                   best match for each individual value").

Shared helpers live here so train_hybrid.py and the Flask app use exactly the
same feature construction.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

# ---- the time-series part -------------------------------------------------
# Each asset's collection has the same 4 market metrics measured over three
# trailing windows -> a 3-step sequence (1d -> 7d -> 30d) of 4 features.
WINDOWS = ["one_day", "seven_day", "thirty_day"]
METRICS = ["volume", "change", "sales", "average_price"]
SEQ_COLS = [[f"{w}_{m}" for m in METRICS] for w in WINDOWS]

CLASS_ORDER = ["unsold", "bin1", "bin2", "bin3", "bin4", "bin5"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASS_ORDER)}

# log10(price) boundaries of the dataset's price bins (bin1 = $10-100 ...)
LOG_EDGES = [1, 2, 3, 4, 5]


def build_sequence(df: pd.DataFrame) -> np.ndarray:
    """(n, 3, 4) array of signed-log-scaled window metrics."""
    seq = np.zeros((len(df), len(WINDOWS), len(METRICS)), dtype=np.float32)
    for t, cols in enumerate(SEQ_COLS):
        block = df.reindex(columns=cols).to_numpy(dtype=np.float64)
        block = np.nan_to_num(block, nan=0.0, posinf=0.0, neginf=0.0)
        seq[:, t, :] = np.sign(block) * np.log1p(np.abs(block))
    return seq


def log_price_to_class(log_price: np.ndarray) -> np.ndarray:
    """Map a predicted log10(price) to a class name using the bin edges."""
    idx = np.digitize(log_price, LOG_EDGES)          # 0 -> below $10 (unsold)
    return np.array(CLASS_ORDER)[idx]


def regression_target(price: pd.Series) -> np.ndarray:
    """log10(price) for sold assets; unsold assets sit just below bin1 (0.0)."""
    p = price.to_numpy(dtype=np.float64)
    out = np.where(p > 0, np.log10(np.clip(p, 1e-6, None)), 0.0)
    return np.clip(out, 0.0, None)


class GRUClassifier(nn.Module):
    """GRU over the market-window sequence, fused with static PCA features."""

    def __init__(self, n_static: int, seq_feat: int = 4, hidden: int = 32,
                 n_classes: int = 6, dropout: float = 0.2):
        super().__init__()
        self.gru = nn.GRU(seq_feat, hidden, batch_first=True)
        self.static = nn.Sequential(nn.Linear(n_static, 64), nn.ReLU(), nn.Dropout(dropout))
        self.head = nn.Sequential(
            nn.Linear(hidden + 64, 64), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, n_classes),
        )

    def forward(self, seq, static):
        _, h = self.gru(seq)                 # h: (1, batch, hidden)
        z = torch.cat([h[-1], self.static(static)], dim=1)
        return self.head(z)


def train_gru(seq, static, y_idx, n_classes=6, epochs=12, lr=2e-3,
              batch=256, class_weight=None, seed=42, verbose=True):
    """Train a GRUClassifier; returns the fitted model (eval mode)."""
    torch.manual_seed(seed)
    model = GRUClassifier(n_static=static.shape[1], n_classes=n_classes)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    w = torch.tensor(class_weight, dtype=torch.float32) if class_weight is not None else None
    loss_fn = nn.CrossEntropyLoss(weight=w)

    S = torch.tensor(seq); X = torch.tensor(static, dtype=torch.float32)
    Y = torch.tensor(y_idx, dtype=torch.long)
    n = len(Y)
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(n)
        total = 0.0
        for i in range(0, n, batch):
            idx = perm[i:i + batch]
            opt.zero_grad()
            loss = loss_fn(model(S[idx], X[idx]), Y[idx])
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        if verbose:
            print(f"  epoch {ep + 1:02d}/{epochs}  loss {total / n:.4f}")
    model.eval()
    return model


@torch.no_grad()
def gru_proba(model, seq, static) -> np.ndarray:
    model.eval()
    logits = model(torch.tensor(seq), torch.tensor(static, dtype=torch.float32))
    return torch.softmax(logits, dim=1).numpy()


def meta_features(rf_proba, svm_scores, gru_prob, reg_logprice) -> np.ndarray:
    """Stack every base model's output into one vector for the KNN combiner."""
    return np.hstack([
        rf_proba,                                  # 6
        svm_scores,                                # 6 (one-vs-rest decision scores)
        gru_prob,                                  # 6
        reg_logprice.reshape(-1, 1),               # 1
    ]).astype(np.float32)
