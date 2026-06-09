"""
Does a downward trend EXIST? — test it, never assume it.

Putting a linear `t` in a regression and reading its coefficient PRESUPPOSES a
trend (t absorbs any smooth drift + collinear spend ramp). To decide existence we
use methods that do NOT impose a line:

  STL            data-driven trend shape (no linear assumption)
  Mann-Kendall   monotonic-trend test; + Hamed-Rao (autocorrelation-robust),
                 seasonal, and on the deseasonalised series
  ADF + KPSS     deterministic trend vs stochastic (random-walk) => spurious-trend risk
  diff-drift     constant in Δy (drift); low power for trend-stationary series
  resid-MK       trend in residuals AFTER media+season+holidays => organic decline?

Verdict logic:
  - assumption-free tests say "no trend"  -> the fitted t-coefficient is an artifact
  - tests agree "trend" AND ADF/KPSS => trend-stationary -> a real deterministic decline
"""
from __future__ import annotations
import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.tsa.seasonal import STL
import statsmodels.api as sm
import pymannkendall as mk
from .config import load
from .features import build_features


def _stl_trend(y, period=52):
    idx = pd.date_range("2024-01-01", periods=len(y), freq="W")
    res = STL(pd.Series(y, index=idx), period=period, robust=True).fit()
    return res.trend.values, res.seasonal.values


def trend_existence(df, target, cfg=None) -> dict:
    cfg = cfg or load()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        y = df[target].to_numpy(float)
        tr, seas = _stl_trend(y)
        deseason = y - seas

        adf = adfuller(y, regression="ct", autolag="AIC")
        kp = kpss(y, regression="ct", nlags="auto")

        out = {
            "target": target,
            "stl_pct": round((tr[-1] - tr[0]) / y.mean() * 100, 1),
            "mk_raw": (mk.original_test(y).trend, round(mk.original_test(y).p, 4)),
            "mk_ac_robust": (mk.hamed_rao_modification_test(y).trend,
                             round(mk.hamed_rao_modification_test(y).p, 4)),
            "mk_seasonal": (mk.seasonal_test(y, period=52).trend,
                            round(mk.seasonal_test(y, period=52).p, 4)),
            "mk_deseason": (mk.hamed_rao_modification_test(deseason).trend,
                            round(mk.hamed_rao_modification_test(deseason).p, 4)),
            "adf_ct_p": round(float(adf[1]), 4),
            "kpss_ct_p": round(float(kp[1]), 4),
        }

        # drift in first differences (robust to a random-walk level)
        dy = np.diff(y)
        md = sm.OLS(dy, np.ones(len(dy))).fit(cov_type="HAC", cov_kwds={"maxlags": 6})
        out["diff_drift_per_wk"] = (round(float(md.params[0]), 1), round(float(md.pvalues[0]), 4))

        # residual trend AFTER media + seasonality + holidays (no trend term)
        X = build_features(df, cfg, lam=0.6, with_trend=False)
        res = sm.OLS(y, sm.add_constant(X)).fit().resid
        rmk = mk.hamed_rao_modification_test(res)
        out["resid_after_media_mk"] = (rmk.trend, round(rmk.p, 4))

        # verdict
        assumption_free_no = (out["mk_ac_robust"][0] == "no trend"
                              and out["mk_deseason"][0] == "no trend")
        organic = out["resid_after_media_mk"][0] != "no trend"
        ts = (out["adf_ct_p"] < 0.05) and (out["kpss_ct_p"] >= 0.05)
        if assumption_free_no:
            out["verdict"] = "NO robust trend — a fitted t-coefficient would be an artifact"
        elif organic and ts:
            out["verdict"] = "trend EXISTS (trend-stationary, not spurious); organic component survives media removal"
        else:
            out["verdict"] = "mixed — trend present but small / partly media-confounded"
    return out
