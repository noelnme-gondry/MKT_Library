import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";
import { adjustBenjaminiHochberg } from "./logisticRegression";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.RATE_BETA_REGRESSION);
const BIND_PREFIX = ".mkt_webr_beta_";

function finiteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 2) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

// betareg는 개구간 (0,1)만 받는다. CTR·CVR은 0이 흔하므로 경계를 축소변환한다
// (Smithson & Verkuilen 2006): y' = (y·(n−1) + 0.5) / n.
// **변환했다는 사실은 결과에 실어 보낸다** — 화면이 그 사실을 숨기면 안 된다.
export function squeezeProportions(y) {
  const n = y.length;
  return y.map((value) => (value * (n - 1) + 0.5) / n);
}

export function prepareRateInput({ X = [], y = [], terms = [] } = {}) {
  if (!finiteMatrix(X) || !Array.isArray(y) || y.length !== X.length) {
    return { ok: false, reason: "invalid_rate_input" };
  }
  if (y.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    return { ok: false, reason: "outcome_out_of_unit_interval" };
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
  const hasBoundary = y.some((value) => value <= 0 || value >= 1);
  return {
    ok: true,
    X,
    y: hasBoundary ? squeezeProportions(y) : y,
    rawY: y,
    terms,
    parameterCount,
    predictorCount,
    boundaryAdjusted: hasBoundary,
  };
}

export function normalizeRateResult(rawRows = [], terms = [], input = {}) {
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
    // 로짓 계수의 지수 = 오즈비. 비율 자료에서 해석 단위는 이쪽이 자연스럽다.
    // 구간도 같은 단위로 넘겨 표가 로지스틱 결과와 같은 열 계약을 쓰게 한다.
    oddsRatio: Number(row.odds_ratio),
    oddsRatioLow: Math.exp(Number(row.ci_low)),
    oddsRatioHigh: Math.exp(Number(row.ci_high)),
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
  return {
    analysisId: WEBR_ANALYSIS_IDS.RATE_BETA_REGRESSION,
    engine: "webr",
    engineVersion: "webr-0.6.0-r-4.6.0",
    family: "beta",
    link: "logit",
    status: isStable ? "complete" : "unstable",
    reason: isStable ? null : "nonconvergence",
    n: Number(modelRow.n) || input.y?.length || 0,
    pseudoR2: Number(modelRow.pseudo_r2),
    precision: Number(modelRow.phi),
    boundaryAdjusted: Boolean(input.boundaryAdjusted),
    rows: predictors,
  };
}

function rateRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  const predictors = Array.from({ length: predictorCount }, (_, index) => `x${index}`);
  return `local({
    suppressPackageStartupMessages(library(betareg))
    model_data <- data.frame(y=${BIND_PREFIX}y, ${bindings.join(", ")})
    model_fit <- try(suppressWarnings(betareg(reformulate(c(${predictors.map((name) => `"${name}"`).join(", ")}), response="y"), data=model_data)), silent=TRUE)
    if (inherits(model_fit, "try-error")) {
      data.frame(term="(failed)", estimate=NA_real_, std_error=NA_real_, statistic=NA_real_,
                 p_value=NA_real_, ci_low=NA_real_, ci_high=NA_real_, odds_ratio=NA_real_,
                 n=NA_integer_, pseudo_r2=NA_real_, phi=NA_real_, converged=FALSE)
    } else {
      model_summary <- summary(model_fit)
      mean_coefs <- model_summary$coefficients$mean
      model_estimate <- mean_coefs[, 1]
      model_se <- mean_coefs[, 2]
      model_statistic <- mean_coefs[, 3]
      model_p <- mean_coefs[, 4]
      model_low <- model_estimate - qnorm(0.975) * model_se
      model_high <- model_estimate + qnorm(0.975) * model_se
      data.frame(
        term=rownames(mean_coefs),
        estimate=unname(model_estimate),
        std_error=unname(model_se),
        statistic=unname(model_statistic),
        p_value=unname(model_p),
        ci_low=unname(model_low),
        ci_high=unname(model_high),
        odds_ratio=unname(exp(model_estimate)),
        n=rep(nobs(model_fit), length(model_estimate)),
        pseudo_r2=rep(as.numeric(model_fit$pseudo.r.squared), length(model_estimate)),
        phi=rep(as.numeric(model_fit$coefficients$precision[1]), length(model_estimate)),
        converged=rep(isTRUE(model_fit$converged), length(model_estimate))
      )
    }
  })`;
}

async function executeRateRegression(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(rateRCode(input.predictorCount));
    const rows = await resultObject.toD3();
    if (rows.length === 1 && rows[0]?.term === "(failed)") {
      return { status: "failed", reason: "beta_fit_failed" };
    }
    return normalizeRateResult(rows, input.terms, input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRRateRegression(payload = {}) {
  const input = prepareRateInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeRateRegression(runtime, input),
  });
}
