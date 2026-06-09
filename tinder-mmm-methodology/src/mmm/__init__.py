"""
Deterministic MMM / regression methodology for weekly mobile-growth analytics.

Pipeline (see CLAUDE.md for the decision logic behind each step):
  data      -> load + validate weekly panel
  features  -> adstock, FULL sin+cos seasonality, dummies, structural steps, logs
  diagnostics -> VIF / collinearity map / autocorrelation
  models    -> OLS+HAC, AR(1) GLSAR, adstock CV, elasticities
  trend     -> EXISTENCE tests (STL, Mann-Kendall, ADF/KPSS) — do not assume a trend
  attribution -> Shapley R2 + valid centered weekly decomposition
  saturation -> response curve + marginal productivity
  cannibalization -> precedence / detrending / net-incrementality
  audit     -> reproduce & critique the spreadsheet "winner" model
"""
__version__ = "0.1.0"
