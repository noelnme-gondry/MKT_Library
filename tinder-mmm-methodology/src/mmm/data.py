"""
Load and VALIDATE the weekly panel.

Validation is non-optional: silent schema problems (off-by-one weeks, a channel
that is all-zero, end-of-series blanks coded as 0) are the single biggest source
of wrong conclusions. We fail loud here so they never reach the model.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .config import load


def load_panel(cfg=None) -> pd.DataFrame:
    cfg = cfg or load()
    df = pd.read_csv(cfg.data.path)
    wk = cfg.data.week_col
    if wk not in df.columns:
        raise ValueError(f"week column '{wk}' missing from {cfg.data.path}")
    df = df.sort_values(wk).reset_index(drop=True)
    df["date"] = pd.to_datetime(cfg.data.week1_start) + pd.to_timedelta(
        (df[wk] - 1) * 7, unit="D"
    )
    # composite target
    comp = cfg.targets.composite
    df[comp["name"]] = df[[c for c in comp["sum_of"]]].sum(axis=1)
    # combined channels (e.g. G_Total)
    for name, parts in (cfg.combined_channels or {}).items():
        cols = [cfg.channels[p] for p in parts]
        df[name] = df[cols].sum(axis=1)
    return df


def validate(df: pd.DataFrame, cfg=None) -> dict:
    """Return a report dict; raise on hard failures."""
    cfg = cfg or load()
    wk = cfg.data.week_col
    rep: dict = {"n_weeks": len(df), "issues": [], "warnings": []}

    # 1) contiguous weekly grid
    gaps = np.where(np.diff(df[wk].values) != 1)[0]
    if len(gaps):
        rep["issues"].append(f"non-contiguous weeks at index {gaps.tolist()}")

    # 2) targets present & positive
    for t in list(cfg.targets.components) + [cfg.targets.composite["name"]]:
        if t not in df.columns:
            rep["issues"].append(f"target '{t}' missing")
        elif (df[t] <= 0).any():
            rep["warnings"].append(f"target '{t}' has non-positive values")

    # 3) channels: flag all-zero and end-of-series zero runs (likely missing-not-zero)
    for key, col in cfg.channels.items():
        if col not in df.columns:
            rep["issues"].append(f"channel '{key}' column '{col}' missing")
            continue
        nz = int((df[col] > 0).sum())
        rep[f"nonzero::{key}"] = f"{nz}/{len(df)}"
        n_missing = int(df[col].isna().sum())
        if n_missing:
            rep["warnings"].append(
                f"channel '{key}': {n_missing} missing (NaN) values — imputed in features"
            )
        if nz == 0:
            rep["warnings"].append(f"channel '{key}' is all-zero -> not identifiable")
        tail = df[col].tail(6)
        if (tail == 0).all() and (df[col] > 0).sum() > 6:
            rep["warnings"].append(
                f"channel '{key}': last 6 weeks are 0 — verify missing-vs-true-zero"
            )

    # 4) dummies are 0/1
    for key, col in (cfg.dummies or {}).items():
        if col in df.columns and not df[col].dropna().isin([0, 1]).all():
            rep["issues"].append(f"dummy '{key}' not binary")

    if rep["issues"]:
        raise ValueError("DATA VALIDATION FAILED:\n  - " + "\n  - ".join(rep["issues"]))
    return rep


def macro_facts(df: pd.DataFrame, cfg=None) -> dict:
    """Spec-independent headline: YoY spend vs KPI. The strongest, model-free slide."""
    cfg = cfg or load()
    df = df.copy()
    df["year"] = df["date"].dt.year
    g_total = next(iter((cfg.combined_channels or {}).keys()), None)
    out: dict = {}
    if g_total and {2024, 2025}.issubset(set(df["year"])):
        a = df.loc[df.year == 2024, g_total].sum()
        b = df.loc[df.year == 2025, g_total].sum()
        out["google_spend_yoy_%"] = round((b / a - 1) * 100, 1)
        for t in cfg.targets.components:
            ya, yb = df.loc[df.year == 2024, t].sum(), df.loc[df.year == 2025, t].sum()
            out[f"{t}_yoy_%"] = round((yb / ya - 1) * 100, 1)
    return out
