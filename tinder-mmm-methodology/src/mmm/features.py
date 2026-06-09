"""
Feature engineering.

Key methodology choices (rationale in CLAUDE.md):
  - Media: geometric adstock THEN log1p. log = saturation, adstock = carryover.
  - Seasonality: FULL sin+cos PAIR per period. A lone sin or cos cannot fit phase
    and leaks into trend/holidays — exactly the under-specification the sheet had.
  - Lunar holidays: marked by explicit week index (moving dates), every year, so a
    52-week harmonic isn't asked to do an impossible job.
  - Structural breaks: permanent step dummies (1 for week >= from_week).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .config import load


def adstock(x: np.ndarray, lam: float) -> np.ndarray:
    """Geometric adstock: a_t = x_t + lam * a_{t-1}."""
    x = np.asarray(x, float)
    out = np.zeros_like(x)
    for i in range(len(x)):
        out[i] = x[i] + (lam * out[i - 1] if i > 0 else 0.0)
    return out


def ln_media(df: pd.DataFrame, col: str, lam: float, fill_missing=True) -> np.ndarray:
    """
    log1p of adstocked spend. Missing values (NaN) are treated as gaps and imputed
    with the trailing mean of the log-series over active weeks (carry-last-level).
    True zeros are left as zeros (genuine 'no spend', adstock decays naturally).
    """
    raw = df[col].to_numpy(float)
    missing = np.isnan(raw)
    series = np.log1p(adstock(np.where(missing, 0.0, raw), lam))
    if fill_missing and missing.any():
        active = (~missing) & (np.nan_to_num(raw) > 0)
        if active.sum() > 6:
            fill = float(np.mean(series[active][-8:]))
            series = np.where(missing, fill, series)
    return series


def fourier(t: np.ndarray, periods) -> pd.DataFrame:
    """Full sin+cos pair per period."""
    t = np.asarray(t, float)
    out = {}
    for i, P in enumerate(periods):
        out[f"sin_{i}"] = np.sin(2 * np.pi * t / P)
        out[f"cos_{i}"] = np.cos(2 * np.pi * t / P)
    return pd.DataFrame(out)


def build_features(
    df: pd.DataFrame,
    cfg=None,
    *,
    lam: float = 0.6,
    with_trend: bool = True,
    with_steps: bool = True,
    use_lunar: bool = True,
    channels: list[str] | None = None,
    drop_folded: bool = True,
) -> pd.DataFrame:
    """
    Build the design matrix (no intercept; add_constant downstream).

    channels: list of channel keys to include as ln_<key>. Defaults to all
              configured channels MINUS those folded into the regime.
    """
    cfg = cfg or load()
    wk = cfg.data.week_col
    t = df[wk].to_numpy(float)
    X = pd.DataFrame(index=df.index)

    # smooth seasonality (full pairs)
    fo = fourier(t, cfg.seasonality.periods_weeks)
    for c in fo.columns:
        X[c] = fo[c].values

    # holidays
    if use_lunar:
        X["lny"] = df[wk].isin(set(sum([list(cfg.lunar_weeks.seollal)], []))).astype(float)
        X["chuseok"] = df[wk].isin(set(cfg.lunar_weeks.chuseok)).astype(float)
    else:
        for key, col in (cfg.dummies or {}).items():
            X[key] = df[col].astype(float)

    # structural steps
    if with_steps:
        for name, spec in (cfg.steps or {}).items():
            X[name] = (df[wk] >= spec["from_week"]).astype(float)

    # media
    folded = set(cfg.collinearity.fold_into_regime or []) if drop_folded else set()
    keys = channels if channels is not None else [k for k in cfg.channels if k not in folded]
    for key in keys:
        X[f"ln_{key}"] = ln_media(df, cfg.channels[key], lam)

    # trend (standardised for conditioning)
    if with_trend:
        X["trend"] = (t - t.mean()) / t.std()
    return X


def sheet_design(df: pd.DataFrame, cfg=None, *, with_brand=False) -> pd.DataFrame:
    """Reproduce the EXACT spreadsheet spec (reduced Fourier, G_Total, original dummies)."""
    cfg = cfg or load()
    wk = cfg.data.week_col
    t = df[wk].to_numpy(float)
    X = pd.DataFrame(index=df.index)
    X["ln_G"] = np.log1p(df[cfg.sheet_audit.spec_channels_combined].to_numpy(float))  # no adstock
    X["sin13"] = np.sin(2 * np.pi * t / 13.0)   # reduced single terms, as in the sheet
    X["cos52"] = np.cos(2 * np.pi * t / 52.0)
    for key in cfg.sheet_audit.spec_dummies:
        if key == "LineOff":
            X["LineOff"] = (df[wk] >= cfg.steps["line_off"]["from_week"]).astype(float)
        else:
            X[key] = df[cfg.dummies[key]].astype(float)
    X["t"] = t
    if with_brand:
        b = df[cfg.channels["brand"]].replace(0, np.nan).ffill().bfill()
        X["ln_Brand"] = np.log1p(b.to_numpy(float))
    return X
