"""Identification & residual diagnostics: VIF, pairwise collinearity, autocorrelation."""
from __future__ import annotations
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor as _vif
from statsmodels.stats.stattools import durbin_watson
from statsmodels.stats.diagnostic import acorr_ljungbox


def vif_table(X: pd.DataFrame) -> pd.DataFrame:
    """VIF per regressor. VIF > 10 => that coefficient is not separately identified."""
    Xc = sm.add_constant(X)
    rows = [(n, _vif(Xc.values, i)) for i, n in enumerate(Xc.columns) if n != "const"]
    return (
        pd.DataFrame(rows, columns=["var", "VIF"])
        .sort_values("VIF", ascending=False)
        .reset_index(drop=True)
    )


def collinear_pairs(X: pd.DataFrame, threshold=0.85) -> pd.DataFrame:
    """Pairs of regressors with |corr| >= threshold — the practical confounds."""
    c = X.corr().abs()
    out = []
    cols = c.columns
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            if c.iloc[i, j] >= threshold:
                out.append((cols[i], cols[j], round(X.corr().iloc[i, j], 3)))
    return pd.DataFrame(out, columns=["a", "b", "corr"]).sort_values(
        "corr", key=lambda s: s.abs(), ascending=False
    )


def autocorrelation(resid: np.ndarray, lags=10) -> dict:
    """Durbin-Watson + Ljung-Box. DW<1.5 or LB p<0.05 => OLS SEs understate uncertainty."""
    dw = float(durbin_watson(resid))
    lb = acorr_ljungbox(resid, lags=[lags], return_df=True)
    return {
        "durbin_watson": round(dw, 3),
        "ljung_box_p": round(float(lb["lb_pvalue"].iloc[0]), 4),
        "autocorrelated": bool(dw < 1.5 or lb["lb_pvalue"].iloc[0] < 0.05),
    }
