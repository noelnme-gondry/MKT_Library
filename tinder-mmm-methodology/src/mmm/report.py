"""Figures + a single verdict.md. Charts use English labels (font-safe)."""
from __future__ import annotations
import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from .config import load
from .attribution import weekly_decomposition
from .trend import _stl_trend

OUT = "outputs"


def _ensure():
    os.makedirs(OUT, exist_ok=True)


def fig_trend(df, target, cfg=None):
    _ensure()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        y = df[target].to_numpy(float); tr, _ = _stl_trend(y)
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(df["date"], y, color="#b0b0b0", lw=1, label="actual")
    ax.plot(df["date"], tr, color="#c0392b", lw=3, label="STL data-driven trend")
    ax.axhline(y.mean(), color="#999", ls=":", lw=0.8)
    ax.set_title(f"{target}: trend existence (STL, no linear assumption)")
    ax.legend(); fig.tight_layout()
    p = f"{OUT}/trend_{target}.png"; fig.savefig(p, dpi=130); plt.close(fig); return p


def fig_decomp(df, target, cfg=None):
    _ensure()
    dec = weekly_decomposition(df, target, cfg)
    comps = [c for c in dec.columns if c not in
             ("t", "date", "actual", "baseline", "fitted", "residual")]
    fig, ax = plt.subplots(figsize=(12, 4.5))
    pos = np.zeros(len(dec)); neg = np.zeros(len(dec))
    cmap = plt.get_cmap("tab10")
    for i, g in enumerate(comps):
        v = dec[g].values; vp = np.where(v > 0, v, 0); vn = np.where(v < 0, v, 0)
        ax.bar(dec["date"], vp, bottom=pos, width=6, color=cmap(i % 10), label=g)
        ax.bar(dec["date"], vn, bottom=neg, width=6, color=cmap(i % 10))
        pos += vp; neg += vn
    ax.plot(dec["date"], dec["actual"] - dec["baseline"], color="black", lw=1.4, label="actual (dev.)")
    ax.axhline(0, color="#333", lw=1)
    ax.set_title(f"{target}: weekly driver decomposition (centered, semi-log-valid)")
    ax.legend(ncol=4, fontsize=8); fig.tight_layout()
    p = f"{OUT}/decomp_{target}.png"; fig.savefig(p, dpi=130); plt.close(fig); return p


def write_verdict(sections: dict, path=f"{OUT}/verdict.md"):
    _ensure()
    lines = ["# MMM methodology — run verdict\n"]
    for title, body in sections.items():
        lines.append(f"## {title}\n")
        if isinstance(body, pd.DataFrame):
            lines.append(body.to_markdown(index=False)); lines.append("")
        elif isinstance(body, dict):
            for k, v in body.items():
                lines.append(f"- **{k}**: {v}")
            lines.append("")
        else:
            lines.append(str(body)); lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path
