"""
Saturation / diminishing returns for a single channel.

For a semi-log term b*ln(1+spend), marginal productivity dY/dspend = b/(1+spend).
We report marginal KPI per +$1,000/week at several spend levels — the direct
input to "scale vs reallocate" decisions.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .config import load
from .features import build_features
from .models import fit_ar1


def response(df, target, channel_key="google_roi", cfg=None, *,
             lam=0.6, levels=(10_000, 35_000, 60_000)) -> dict:
    cfg = cfg or load()
    X = build_features(df, cfg, lam=lam, with_trend=True)
    col = f"ln_{channel_key}"
    if col not in X.columns:
        raise ValueError(f"{col} not in design (folded into regime?). Available: {list(X.columns)}")
    m = fit_ar1(df[target].to_numpy(float), X)
    b = float(m.params[col])
    marg = {f"${lv//1000}k": round(b / (1 + lv) * 1000, 1) for lv in levels}
    return {"channel": channel_key, "ln_coef": round(b, 1),
            "marginal_kpi_per_+$1k_per_wk": marg}
