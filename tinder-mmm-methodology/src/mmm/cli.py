#!/usr/bin/env python3
"""
Command-line entry for the methodology.

    python -m mmm.cli validate
    python -m mmm.cli audit            # verify the spreadsheet model
    python -m mmm.cli trend            # does a decline exist? (per target)
    python -m mmm.cli cannibalization  # cannibalization vs organic
    python -m mmm.cli mmm              # adstock CV, elasticities, Shapley, saturation
    python -m mmm.cli all              # everything + figures + outputs/verdict.md

Add  --config path/to/config.yaml  to point at another dataset.
"""
from __future__ import annotations
import argparse
import sys
import pandas as pd
from . import config as cfgmod
from . import data as datamod
from . import diagnostics, models, trend, attribution, saturation, cannibalization, audit, report

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 30)


def _hdr(t): print("\n" + "=" * 78 + f"\n  {t}\n" + "=" * 78)


def cmd_validate(df, cfg):
    _hdr("DATA VALIDATION")
    rep = datamod.validate(df, cfg)
    for k, v in rep.items():
        print(f"  {k}: {v}")
    _hdr("MACRO FACTS (model-independent headline)")
    for k, v in datamod.macro_facts(df, cfg).items():
        print(f"  {k}: {v}")
    return rep


def cmd_audit(df, cfg):
    _hdr("SHEET AUDIT — reproduce the exact spec")
    rep = audit.reproduce(df, cfg)
    print(f"  target={rep['target']}  n={rep['n']}  R2={rep['r2']}  adjR2={rep['adj_r2']}"
          f"  (HAC maxlags={rep['hac_maxlags']})")
    print(rep["coefficients"].to_string(index=False))
    _hdr("Does adding BRAND lower R2?  (claim check)")
    print(audit.brand_test(df, cfg).to_string(index=False))
    _hdr("Google coefficient across targets (collinearity tell)")
    print(audit.channel_swing(df, cfg).to_string(index=False))
    _hdr("Composite (RR) definition check")
    for k, v in audit.composite_check(df, cfg).items():
        print(f"  {k}: {v}")
    return rep


def cmd_trend(df, cfg):
    res = {}
    for t in cfg.targets.components:
        _hdr(f"TREND EXISTENCE — {t}")
        r = trend.trend_existence(df, t, cfg)
        for k, v in r.items():
            print(f"  {k}: {v}")
        res[t] = r
    return res


def cmd_cannibalization(df, cfg):
    res = {}
    for t in cfg.targets.components:
        _hdr(f"CANNIBALIZATION vs ORGANIC — {t}")
        el = models.elasticities(df, t, cfg)
        roi = el[el["var"] == "ln_google_roi"]
        roi_row = roi.iloc[0] if len(roi) else {"coef": float("nan"), "p": float("nan")}
        r = cannibalization.verdict(df, t, roi_row, cfg)
        for k, v in r.items():
            print(f"  {k}: {v}")
        res[t] = r
    return res


def cmd_mmm(df, cfg):
    res = {}
    for t in cfg.targets.components:
        _hdr(f"MMM — {t}")
        ad = models.select_adstock(df, t, cfg)
        print(f"  adstock CV-RMSE: {ad['cv_rmse']}  -> best lambda = {ad['best_lambda']}")
        lam = ad["best_lambda"]
        _hdr(f"VIF / collinearity — {t} (lambda={lam})")
        from .features import build_features
        X = build_features(df, cfg, lam=lam)
        print(diagnostics.vif_table(X).head(8).to_string(index=False))
        cp = diagnostics.collinear_pairs(X)
        if len(cp):
            print("  high-collinearity pairs:"); print(cp.to_string(index=False))
        _hdr(f"Elasticities (log-log, AR1) — {t}")
        el = models.elasticities(df, t, cfg, lam=lam)
        print(el.to_string(index=False))
        _hdr(f"Shapley R2 decomposition — {t}")
        sh = attribution.shapley_r2(df, t, cfg, lam=lam)
        print(f"  total R2={sh.attrs['total_r2']}")
        print(sh.to_string(index=False))
        if "ln_google_roi" in X.columns:
            _hdr(f"Saturation (Google ROI) — {t}")
            print("  ", saturation.response(df, t, "google_roi", cfg, lam=lam))
        res[t] = {"adstock": ad, "elasticities": el, "shapley": sh}
    return res


def cmd_all(df, cfg):
    v = cmd_validate(df, cfg)
    a = cmd_audit(df, cfg)
    tr = cmd_trend(df, cfg)
    cn = cmd_cannibalization(df, cfg)
    mm = cmd_mmm(df, cfg)
    # figures + verdict
    figs = []
    for t in cfg.targets.components:
        figs += [report.fig_trend(df, t, cfg), report.fig_decomp(df, t, cfg)]
    sections = {
        "Macro facts": datamod.macro_facts(df, cfg),
        "Sheet audit — reproduced coefficients": a["coefficients"],
        "Sheet audit — brand inclusion test": audit.brand_test(df, cfg),
        "Sheet audit — Google coef across targets": audit.channel_swing(df, cfg),
        "Trend existence (Regs)": tr[cfg.targets.components[0]],
        "Trend existence (React)": tr[cfg.targets.components[1]],
        "Cannibalization verdict (React)": cn[cfg.targets.components[1]]["verdict"],
        "Figures": {"written": figs},
    }
    path = report.write_verdict(sections)
    _hdr("DONE")
    print(f"  verdict -> {path}\n  figures -> {figs}")
    return {"verdict": path}


CMDS = {"validate": cmd_validate, "audit": cmd_audit, "trend": cmd_trend,
        "cannibalization": cmd_cannibalization, "mmm": cmd_mmm, "all": cmd_all}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Deterministic MMM / regression methodology")
    ap.add_argument("command", choices=list(CMDS))
    ap.add_argument("--config", default=None)
    args = ap.parse_args(argv)
    cfg = cfgmod.load(args.config)
    df = datamod.load_panel(cfg)
    if args.command != "validate":
        datamod.validate(df, cfg)  # always validate first
    CMDS[args.command](df, cfg)


if __name__ == "__main__":
    sys.exit(main())
