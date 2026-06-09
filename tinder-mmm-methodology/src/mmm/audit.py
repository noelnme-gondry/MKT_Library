"""
Audit the spreadsheet "winner" model — verify what is real vs artifact.

Checks, each tied to a concrete claim in the screenshot:
  reproduce       fit the exact spec; show OLS vs HAC p-values (weekly autocorrelation)
  brand_test      does ADDING brand lower R2? (it cannot — refutes "R2 too low w/ brand")
  channel_swing   same spec on Regs vs React -> Google coefficient instability (collinearity)
  composite_check RR == Regs + React (mean sanity vs sheet)
"""
from __future__ import annotations
import numpy as np
import pandas as pd
import statsmodels.api as sm
from .config import load
from .features import sheet_design
from .models import fit_hac, hac_lags


def _window(df, cfg):
    w = cfg.sheet_audit.window_weeks
    return df if not w else df.tail(int(w)).reset_index(drop=True)


def reproduce(df, cfg=None) -> dict:
    cfg = cfg or load()
    d = _window(df, cfg)
    tgt = cfg.sheet_audit.target
    X = sheet_design(d, cfg, with_brand=False)
    ols = sm.OLS(d[tgt].to_numpy(float), sm.add_constant(X)).fit()
    hac = fit_hac(d[tgt], X, cfg)
    tab = []
    for v in ["ln_G", "t", "LineOff", "Seollal", "sin13", "cos52"]:
        if v in ols.params.index:
            tab.append(dict(var=v, coef=round(float(ols.params[v]), 2),
                            ols_p=round(float(ols.pvalues[v]), 4),
                            hac_p=round(float(hac.pvalues[v]), 4)))
    return {"target": tgt, "n": int(ols.nobs), "r2": round(ols.rsquared, 4),
            "adj_r2": round(ols.rsquared_adj, 4), "hac_maxlags": hac_lags(len(d), cfg),
            "coefficients": pd.DataFrame(tab)}


def brand_test(df, cfg=None) -> pd.DataFrame:
    """R2 with vs without brand for each target. Adding a regressor cannot lower R2."""
    cfg = cfg or load()
    d = _window(df, cfg)
    rows = []
    for tgt in list(cfg.targets.components) + [cfg.targets.composite["name"]]:
        r0 = sm.OLS(d[tgt].to_numpy(float), sm.add_constant(sheet_design(d, cfg, with_brand=False))).fit()
        r1 = sm.OLS(d[tgt].to_numpy(float), sm.add_constant(sheet_design(d, cfg, with_brand=True))).fit()
        rows.append(dict(target=tgt,
                         R2_no_brand=round(r0.rsquared, 4), R2_with_brand=round(r1.rsquared, 4),
                         adjR2_no_brand=round(r0.rsquared_adj, 4), adjR2_with_brand=round(r1.rsquared_adj, 4),
                         brand_p=round(float(r1.pvalues["ln_Brand"]), 4)))
    return pd.DataFrame(rows)


def channel_swing(df, cfg=None) -> pd.DataFrame:
    """Google (ln_G) coefficient across targets under the same spec — collinearity tell."""
    cfg = cfg or load()
    d = _window(df, cfg)
    rows = []
    for tgt in list(cfg.targets.components) + [cfg.targets.composite["name"]]:
        m = fit_hac(d[tgt], sheet_design(d, cfg, with_brand=False), cfg)
        rows.append(dict(target=tgt, ln_G_coef=round(float(m.params["ln_G"]), 2),
                         hac_p=round(float(m.pvalues["ln_G"]), 4),
                         trend_coef=round(float(m.params["t"]), 2)))
    return pd.DataFrame(rows)


def composite_check(df, cfg=None) -> dict:
    cfg = cfg or load()
    name = cfg.targets.composite["name"]
    return {f"mean_{name}": round(float(df[name].mean())),
            "components_mean_sum": round(float(df[[*cfg.targets.composite["sum_of"]]].sum(axis=1).mean())),
            "note": "compare to the sheet's 'Mean Android' to confirm RR definition"}
