import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION);
const BIND_PREFIX = ".mkt_webr_logistic_";

function finiteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 2) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

export function prepareLogisticInput({ X = [], y = [], terms = [] } = {}) {
  if (!finiteMatrix(X) || !Array.isArray(y) || y.length !== X.length || y.some((value) => value !== 0 && value !== 1)) {
    return { ok: false, reason: "invalid_binary_input" };
  }
  const parameterCount = X[0].length;
  const predictorCount = parameterCount - 1;
  if (terms.length !== parameterCount || predictorCount < 1) {
    return { ok: false, reason: "invalid_term_contract" };
  }
  const classCounts = {
    zero: y.filter((value) => value === 0).length,
    one: y.filter((value) => value === 1).length,
  };
  const minorityCount = Math.min(classCounts.zero, classCounts.one);
  const requiredMinority = parameterCount * DEFINITION.minMinorityOutcomesPerParameter;
  if (minorityCount < requiredMinority) {
    return {
      ok: false,
      reason: "insufficient_class_support",
      classCounts,
      minorityCount,
      requiredMinority,
      parameterCount,
      predictorCount,
    };
  }
  return {
    ok: true,
    X,
    y,
    terms,
    classCounts,
    minorityCount,
    requiredMinority,
    parameterCount,
    predictorCount,
  };
}

export function adjustBenjaminiHochberg(values = []) {
  const indexed = values.map((value, index) => ({ index, value: Number.isFinite(value) ? value : 1 }))
    .sort((left, right) => left.value - right.value);
  const adjusted = new Array(values.length).fill(1);
  let next = 1;
  for (let rank = indexed.length - 1; rank >= 0; rank -= 1) {
    next = Math.min(next, indexed[rank].value * indexed.length / (rank + 1));
    adjusted[indexed[rank].index] = Math.min(1, next);
  }
  return adjusted;
}

export function normalizeLogisticResult(rawRows = [], terms = [], input = {}) {
  if (!Array.isArray(rawRows) || rawRows.length !== terms.length) {
    return { status: "failed", reason: "invalid_webr_result" };
  }
  const modelRow = rawRows[0] || {};
  const predictors = rawRows.slice(1).map((row, index) => ({
    name: terms[index + 1],
    estimate: Number(row.estimate),
    stdError: Number(row.std_error),
    statistic: Number(row.statistic),
    rawP: Number(row.p_value),
    ciLow: Number(row.ci_low),
    ciHigh: Number(row.ci_high),
    oddsRatio: Number(row.odds_ratio),
    oddsRatioLow: Number(row.odds_ratio_low),
    oddsRatioHigh: Number(row.odds_ratio_high),
  }));
  const hasInvalidEstimate = predictors.some((row) =>
    [row.estimate, row.stdError, row.statistic, row.rawP, row.ciLow, row.ciHigh, row.oddsRatio]
      .some((value) => !Number.isFinite(value)));
  const isStable = modelRow.converged === true && modelRow.separation !== true && !hasInvalidEstimate;
  const adjusted = adjustBenjaminiHochberg(predictors.map((row) => row.rawP));
  predictors.forEach((row, index) => {
    row.p = adjusted[index];
    row.isSignificant = isStable && row.p < 0.05;
  });
  predictors.sort((left, right) => Math.abs(right.statistic) - Math.abs(left.statistic));
  return {
    analysisId: WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION,
    engine: "webr",
    engineVersion: "webr-0.6.0-r-4.6.0",
    status: isStable ? "complete" : "unstable",
    reason: isStable ? null : "separation_or_nonconvergence",
    n: Number(modelRow.n) || input.y?.length || 0,
    classCounts: input.classCounts || null,
    aic: Number(modelRow.aic),
    pseudoR2: Number(modelRow.pseudo_r2),
    rows: predictors,
  };
}

function logisticRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  const predictors = Array.from({ length: predictorCount }, (_, index) => `x${index}`);
  return `local({
    suppressPackageStartupMessages(library(sandwich))
    model_data <- data.frame(y=${BIND_PREFIX}y, ${bindings.join(", ")})
    model_fit <- suppressWarnings(glm(reformulate(c(${predictors.map((name) => `"${name}"`).join(", ")}), response="y"), family=binomial(), data=model_data))
    model_vcov <- sandwich::vcovHC(model_fit, type="HC3")
    model_estimate <- coef(model_fit)
    model_se <- sqrt(diag(model_vcov))
    model_statistic <- model_estimate / model_se
    model_p <- 2 * pnorm(abs(model_statistic), lower.tail=FALSE)
    model_low <- model_estimate - qnorm(0.975) * model_se
    model_high <- model_estimate + qnorm(0.975) * model_se
    model_fitted <- fitted(model_fit)
    model_separation <- !isTRUE(model_fit$converged) || any(!is.finite(model_estimate)) || any(abs(model_estimate) > 20) || any(model_fitted < 1e-8 | model_fitted > 1 - 1e-8)
    data.frame(
      term=names(model_estimate),
      estimate=unname(model_estimate),
      std_error=unname(model_se),
      statistic=unname(model_statistic),
      p_value=unname(model_p),
      ci_low=unname(model_low),
      ci_high=unname(model_high),
      odds_ratio=unname(exp(model_estimate)),
      odds_ratio_low=unname(exp(model_low)),
      odds_ratio_high=unname(exp(model_high)),
      n=rep(nobs(model_fit), length(model_estimate)),
      aic=rep(AIC(model_fit), length(model_estimate)),
      pseudo_r2=rep(if (model_fit$null.deviance > 0) 1 - model_fit$deviance / model_fit$null.deviance else NA_real_, length(model_estimate)),
      converged=rep(isTRUE(model_fit$converged), length(model_estimate)),
      separation=rep(model_separation, length(model_estimate))
    )
  })`;
}

async function executeLogisticRegression(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(logisticRCode(input.predictorCount));
    const rows = await resultObject.toD3();
    return normalizeLogisticResult(rows, input.terms, input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRLogisticRegression(payload = {}) {
  const input = prepareLogisticInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeLogisticRegression(runtime, input),
  });
}
