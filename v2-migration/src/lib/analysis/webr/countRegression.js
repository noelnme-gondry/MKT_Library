import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";
import { adjustBenjaminiHochberg } from "./logisticRegression";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.COUNT_REGRESSION);
const BIND_PREFIX = ".mkt_webr_count_";

function finiteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 2) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

export function prepareCountInput({ X = [], y = [], terms = [] } = {}) {
  if (!finiteMatrix(X) || !Array.isArray(y) || y.length !== X.length) {
    return { ok: false, reason: "invalid_count_input" };
  }
  if (y.some((value) => !Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
    return { ok: false, reason: "outcome_not_counts" };
  }
  const parameterCount = X[0].length;
  const predictorCount = parameterCount - 1;
  if (terms.length !== parameterCount || predictorCount < 1) {
    return { ok: false, reason: "invalid_term_contract" };
  }
  if (new Set(y).size < 2) return { ok: false, reason: "constant_outcome" };
  const required = parameterCount * DEFINITION.minObservationsPerParameter;
  if (y.length < required) {
    return { ok: false, reason: "insufficient_rows", rows: y.length, requiredRows: required, parameterCount };
  }
  return { ok: true, X, y, terms, parameterCount, predictorCount };
}

export function normalizeCountResult(rawRows = [], terms = [], input = {}) {
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
    // 로그 링크 계수의 지수 = 발생률비(IRR). "1건당 몇 배"로 읽는 단위다.
    rateRatio: Number(row.rate_ratio),
    rateRatioLow: Number(row.rate_ratio_low),
    rateRatioHigh: Number(row.rate_ratio_high),
  }));
  const hasInvalid = predictors.some((row) =>
    [row.estimate, row.stdError, row.statistic, row.rawP].some((value) => !Number.isFinite(value)));
  const isStable = modelRow.converged === true && !hasInvalid;
  const adjusted = adjustBenjaminiHochberg(predictors.map((row) => row.rawP));
  predictors.forEach((row, index) => {
    row.p = adjusted[index];
    row.isSignificant = isStable && row.p < 0.05;
  });
  predictors.sort((left, right) => Math.abs(right.statistic) - Math.abs(left.statistic));
  const family = String(modelRow.family || "poisson");
  return {
    analysisId: WEBR_ANALYSIS_IDS.COUNT_REGRESSION,
    engine: "webr",
    engineVersion: "webr-0.6.0-r-4.6.0",
    family,
    link: "log",
    status: isStable ? "complete" : "unstable",
    reason: isStable ? null : "nonconvergence",
    n: Number(modelRow.n) || input.y?.length || 0,
    aic: Number(modelRow.aic),
    // 실제 Poisson 적합의 Pearson χ²/df. 주변분포 근사(outcomeType)가 아니라
    // 이 값이 최종 판단 근거다.
    dispersionRatio: Number(modelRow.dispersion),
    switchedToNegativeBinomial: family === "negbin",
    theta: Number.isFinite(Number(modelRow.theta)) ? Number(modelRow.theta) : null,
    rows: predictors,
  };
}

function countRCode(predictorCount, overdispersionRatio) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  const predictors = Array.from({ length: predictorCount }, (_, index) => `x${index}`);
  return `local({
    suppressPackageStartupMessages(library(MASS))
    model_data <- data.frame(y=${BIND_PREFIX}y, ${bindings.join(", ")})
    model_formula <- reformulate(c(${predictors.map((name) => `"${name}"`).join(", ")}), response="y")
    poisson_fit <- suppressWarnings(glm(model_formula, family=poisson(), data=model_data))
    # 과산포 검정: Pearson χ² / 잔차 자유도. 1을 크게 넘으면 Poisson의 var=mean 가정이
    # 깨진 것이고, 그대로 두면 SE가 과소추정돼 없는 유의가 생긴다.
    pearson_chisq <- sum(residuals(poisson_fit, type="pearson")^2)
    dispersion_ratio <- pearson_chisq / df.residual(poisson_fit)
    use_negbin <- is.finite(dispersion_ratio) && dispersion_ratio > ${overdispersionRatio}
    model_fit <- poisson_fit
    model_family <- "poisson"
    model_theta <- NA_real_
    if (use_negbin) {
      negbin_fit <- try(suppressWarnings(MASS::glm.nb(model_formula, data=model_data)), silent=TRUE)
      if (!inherits(negbin_fit, "try-error")) {
        model_fit <- negbin_fit
        model_family <- "negbin"
        model_theta <- as.numeric(negbin_fit$theta)
      }
    }
    model_summary <- summary(model_fit)
    coefs <- model_summary$coefficients
    model_estimate <- coefs[, 1]
    model_se <- coefs[, 2]
    model_statistic <- coefs[, 3]
    model_p <- coefs[, 4]
    model_low <- model_estimate - qnorm(0.975) * model_se
    model_high <- model_estimate + qnorm(0.975) * model_se
    data.frame(
      term=rownames(coefs),
      estimate=unname(model_estimate),
      std_error=unname(model_se),
      statistic=unname(model_statistic),
      p_value=unname(model_p),
      ci_low=unname(model_low),
      ci_high=unname(model_high),
      rate_ratio=unname(exp(model_estimate)),
      rate_ratio_low=unname(exp(model_low)),
      rate_ratio_high=unname(exp(model_high)),
      n=rep(nobs(model_fit), length(model_estimate)),
      aic=rep(AIC(model_fit), length(model_estimate)),
      dispersion=rep(as.numeric(dispersion_ratio), length(model_estimate)),
      theta=rep(model_theta, length(model_estimate)),
      family=rep(model_family, length(model_estimate)),
      converged=rep(isTRUE(model_fit$converged), length(model_estimate))
    )
  })`;
}

async function executeCountRegression(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(countRCode(input.predictorCount, DEFINITION.overdispersionRatio));
    const rows = await resultObject.toD3();
    return normalizeCountResult(rows, input.terms, input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRCountRegression(payload = {}) {
  const input = prepareCountInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeCountRegression(runtime, input),
  });
}
