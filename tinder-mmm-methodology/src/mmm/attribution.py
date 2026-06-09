"""
Attribution — two complementary, valid views.

1. shapley_r2: fair share of EXPLAINED VARIANCE per driver group (Monte-Carlo LMG).
   Order-independent; correct under collinearity. Answers "what drives the variation".

2. weekly_decomposition: CENTERED additive contributions, contribution_jt =
   beta_j * (X_jt - mean(X_j)). Sums exactly to (fitted - mean(Y)); baseline = mean(Y).
   VALID for semi-log because it never extrapolates spend->0 (the naive level-share
   decomposition that yields absurd >100% media shares is forbidden — see CLAUDE.md).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
import statsmodels.api as sm
from .config import load
from .features import build_features

# map design columns -> driver groups
def _groups(cfg):
    return {
        "Trend": ["trend"],
        "Seasonality": ["sin_0", "cos_0", "sin_1", "cos_1"],
        "Holidays": ["lny", "chuseok"],
        "Regime(steps)": list((cfg.steps or {}).keys()),
        "Google ROI": ["ln_google_roi"],
        "Brand": ["ln_brand"],
        "Meta": ["ln_meta"],
        "TikTok": ["ln_tiktok"],
    }


def _r2(y, X):
    if X.shape[1] == 0:
        return 0.0
    m = sm.OLS(y, sm.add_constant(X)).fit()
    return m.rsquared


def shapley_r2(df, target, cfg=None, *, lam=0.6, n_perm=None, seed=0) -> pd.DataFrame:
    cfg = cfg or load()
    n_perm = n_perm or int(cfg.shapley.n_permutations)
    X = build_features(df, cfg, lam=lam, with_trend=True)
    y = df[target].to_numpy(float)
    groups = {g: [c for c in cols if c in X.columns] for g, cols in _groups(cfg).items()}
    groups = {g: c for g, c in groups.items() if c}
    keys = list(groups)
    rng = np.random.default_rng(seed)
    contrib = {g: 0.0 for g in keys}
    for _ in range(n_perm):
        order = list(keys); rng.shuffle(order)
        present, prev = [], 0.0
        for g in order:
            present += groups[g]
            cur = _r2(y, X[present])
            contrib[g] += cur - prev
            prev = cur
    total = _r2(y, X[[c for cs in groups.values() for c in cs]])
    rows = [(g, contrib[g] / n_perm) for g in keys]
    out = pd.DataFrame(rows, columns=["driver", "r2_share"])
    out["pct_of_explained"] = (out["r2_share"] / out["r2_share"].sum() * 100).round(1)
    out.attrs["total_r2"] = round(float(total), 3)
    return out.sort_values("r2_share", ascending=False).reset_index(drop=True)


def weekly_decomposition(df, target, cfg=None, *, lam=0.6) -> pd.DataFrame:
    cfg = cfg or load()
    X = build_features(df, cfg, lam=lam, with_trend=True)
    y = df[target].to_numpy(float)
    m = sm.OLS(y, sm.add_constant(X)).fit()
    ybar = float(y.mean())
    groups = {g: [c for c in cols if c in X.columns] for g, cols in _groups(cfg).items()}
    out = pd.DataFrame({"t": df[cfg.data.week_col].values, "date": df["date"].values,
                        "actual": y, "baseline": ybar})
    for g, cols in groups.items():
        if cols:
            out[g] = sum(m.params[c] * (X[c] - X[c].mean()) for c in cols).values
    grp_cols = [g for g in groups if groups[g]]
    out["fitted"] = ybar + out[grp_cols].sum(axis=1)
    out["residual"] = out["actual"] - out["fitted"]
    return out
