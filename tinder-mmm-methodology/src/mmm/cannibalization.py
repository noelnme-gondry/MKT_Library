"""
Separate CANNIBALIZATION (paid suppresses organic) from ORGANIC decline (exogenous).

Observational regression cannot tell them apart because spend ramps with time, so
"base falls as spend rises" fits both. We break the spend<->time collinearity with
three methodologically INDEPENDENT tests (triangulation):

  1. precedence     does the decline appear in an early LOW/FLAT-spend window,
                    before the ramp? (cause must precede effect)
  2. detrend_corr   does the negative raw spend<->KPI correlation survive detrending
                    & first-differencing? if it flips/collapses -> spurious, not causal
  3. net_increment  is the net (total-model) spend elasticity > 0? strong cannibalization
                    implies net <= 0

Definitive proof still needs a geo-holdout / spend pulse, or an organic-vs-paid split
series modelled directly. This module gives the strongest OBSERVATIONAL read.
"""
from __future__ import annotations
import warnings
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import pearsonr
from .config import load


def precedence(df, target, cfg=None, *, early_weeks=26) -> dict:
    cfg = cfg or load()
    g = next(iter((cfg.combined_channels or {}).keys()))
    early = df[df[cfg.data.week_col] <= early_weeks]
    slope = float(np.polyfit(early[cfg.data.week_col], early[target], 1)[0])
    pct = slope * early_weeks / early[target].mean() * 100
    return {"window_weeks": early_weeks,
            "avg_spend_$/wk": round(float(early[g].mean())),
            "kpi_slope_per_wk": round(slope, 1),
            "kpi_change_over_window_%": round(pct, 1),
            "declining_pre_ramp": bool(pct < -1)}


def detrend_corr(df, target, cfg=None) -> dict:
    cfg = cfg or load()
    g = next(iter((cfg.combined_channels or {}).keys()))
    lnG = np.log1p(df[g].to_numpy(float)); y = df[target].to_numpy(float)
    t = df[cfg.data.week_col].to_numpy(float)
    raw = pearsonr(lnG, y)[0]
    gr = sm.OLS(lnG, sm.add_constant(t)).fit().resid
    yr = sm.OLS(y, sm.add_constant(t)).fit().resid
    det = pearsonr(gr, yr)[0]
    diff = pearsonr(np.diff(lnG), np.diff(y))[0]
    flips = raw < 0 <= det
    return {"raw": round(raw, 3), "detrended": round(det, 3), "first_diff": round(diff, 3),
            "negative_collapses": bool(flips),
            "reading": "spurious (organic), not cannibalization" if flips
                       else "no negative association to begin with" if raw >= 0
                       else "negative survives detrend — investigate cannibalization"}


def net_incrementality(elasticity_row) -> dict:
    """Pass the Google-ROI elasticity row (coef, p) from models.elasticities()."""
    coef = float(elasticity_row["coef"]); p = float(elasticity_row["p"])
    return {"net_elasticity": coef, "p": p,
            "reading": "net positive — inconsistent with strong cannibalization"
            if coef > 0 else "net <= 0 — cannibalization plausible"}


def verdict(df, target, google_roi_elasticity_row, cfg=None) -> dict:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pr = precedence(df, target, cfg)
        dc = detrend_corr(df, target, cfg)
        ni = net_incrementality(google_roi_elasticity_row)
    organic_votes = sum([pr["declining_pre_ramp"], dc["negative_collapses"] or dc["raw"] >= 0,
                         ni["net_elasticity"] > 0])
    return {"precedence": pr, "detrend_corr": dc, "net_incrementality": ni,
            "verdict": ("ORGANIC (exogenous) — media defends, does not cause"
                        if organic_votes >= 2 else
                        "INCONCLUSIVE / possible cannibalization — run geo holdout")}
