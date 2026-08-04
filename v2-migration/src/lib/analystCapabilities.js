// Analyst-only layers must be declared per tool + estimator. This prevents a
// regression diagnostic panel from being accidentally rendered for engines that
// do not expose a compatible OLS fit (for example PVM decomposition).
export const ANALYST_CAPABILITIES = Object.freeze({
  "9-1:ols": Object.freeze({
    diagnostics: Object.freeze(["residual-plots", "influence", "vif", "serial-correlation", "hc3-sensitivity"]),
  }),
});

export function analystCapability(scope) {
  return ANALYST_CAPABILITIES[scope] || null;
}

export function canRenderModelDiagnostics(scope, fit, X) {
  const capability = analystCapability(scope);
  if (!capability) return false;
  return Boolean(
    fit
      && Array.isArray(fit.resid)
      && Array.isArray(fit.yhat)
      && Array.isArray(fit.XtXi)
      && Array.isArray(X)
      && X.length === fit.resid.length,
  );
}
