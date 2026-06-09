"""
Fitting & inference.

  - fit_hac:  OLS with Newey-West (HAC) SEs — robust to autocorrelated weekly errors.
  - fit_ar1:  GLSAR AR(1) — corrects the error structure for valid inference.
  - select_adstock: rolling-origin CV over the adstock grid (NOT in-sample fit).
  - elasticities: log-log coefficients = % response per % spend.

Plain-OLS p-values on weekly data are optimistic; we never report them alone.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
import statsmodels.api as sm
from .config import load
from .features import build_features


def hac_lags(n: int, cfg=None) -> int:
    cfg = cfg or load()
    v = cfg.inference.hac_maxlags
    return int(np.floor(4 * (n / 100) ** (2 / 9))) if v == "auto" else int(v)


def fit_hac(y, X, cfg=None):
    cfg = cfg or load()
    y = np.asarray(y, float)
    return sm.OLS(y, sm.add_constant(X)).fit(
        cov_type="HAC", cov_kwds={"maxlags": hac_lags(len(y), cfg)}
    )


def fit_ar1(y, X):
    y = np.asarray(y, float)
    return sm.GLSAR(y, sm.add_constant(X), rho=1).iterative_fit(maxiter=10)


def coef_table(model, keep=None) -> pd.DataFrame:
    """Tidy coefficient table with 95% CI, p, and significance stars."""
    ci = model.conf_int()
    rows = []
    names = model.params.index
    for n in names:
        if n == "const" or (keep is not None and n not in keep):
            continue
        p = float(model.pvalues[n])
        star = "***" if p < 0.01 else "**" if p < 0.05 else "*" if p < 0.10 else ""
        rows.append(
            dict(var=n, coef=round(float(model.params[n]), 4),
                 ci_lo=round(float(ci.loc[n, 0]), 4), ci_hi=round(float(ci.loc[n, 1]), 4),
                 p=round(p, 4), sig=star)
        )
    return pd.DataFrame(rows)


def select_adstock(df, target, cfg=None) -> dict:
    """Rolling-origin CV RMSE across the adstock grid; pick the lambda that GENERALISES."""
    cfg = cfg or load()
    y_full = df[target].to_numpy(float)
    grid = list(cfg.adstock.grid)
    min_train = int(cfg.adstock.cv_min_train)
    results = {}
    for lam in grid:
        X = build_features(df, cfg, lam=lam)
        errs = []
        for cut in range(min_train, len(df) - 1):
            Xtr, ytr = sm.add_constant(X.iloc[:cut]), y_full[:cut]
            try:
                b = sm.OLS(ytr, Xtr).fit().params
            except Exception:
                continue
            xrow = sm.add_constant(X).iloc[cut:cut + 1]
            xrow = xrow.reindex(columns=Xtr.columns, fill_value=0.0)
            pred = float((xrow.values @ b.values)[0])
            errs.append((y_full[cut] - pred) ** 2)
        results[lam] = float(np.sqrt(np.mean(errs))) if errs else np.nan
    best = min((l for l in grid if not np.isnan(results[l])), key=lambda l: results[l])
    return {"cv_rmse": {round(k, 2): round(v, 1) for k, v in results.items()},
            "best_lambda": best}


def elasticities(df, target, cfg=None, *, lam=0.6, with_trend=True) -> pd.DataFrame:
    """log-log elasticities via AR(1): coefficient = %ΔY per %Δspend."""
    cfg = cfg or load()
    X = build_features(df, cfg, lam=lam, with_trend=with_trend)
    m = fit_ar1(np.log(df[target].to_numpy(float)), X)
    keep = [c for c in X.columns if c.startswith("ln_") or c == "trend"]
    return coef_table(m, keep=keep)
