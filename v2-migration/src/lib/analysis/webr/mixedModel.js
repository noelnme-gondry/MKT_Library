import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";
import { adjustBenjaminiHochberg } from "./logisticRegression";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.MIXED_MODEL);
const BIND_PREFIX = ".mkt_webr_lmm_";

function finiteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 2) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

// 군집 라벨은 사용자 CSV 값이라 R 코드에 문자열로 절대 삽입하지 않는다(§webR 규약).
// 정수 인덱스로 바꿔 bind하고, 표시용 라벨은 JS 쪽에 남긴다.
export function encodeGroups(groups = []) {
  const labels = [];
  const index = new Map();
  const codes = groups.map((value) => {
    const key = String(value);
    if (!index.has(key)) {
      index.set(key, labels.length);
      labels.push(key);
    }
    return index.get(key) + 1;
  });
  const sizes = labels.map((_, position) => codes.filter((code) => code === position + 1).length);
  return { codes, labels, sizes };
}

export function prepareMixedInput({ X = [], y = [], terms = [], groups = [] } = {}) {
  if (!finiteMatrix(X) || !Array.isArray(y) || y.length !== X.length || !y.every(Number.isFinite)) {
    return { ok: false, reason: "invalid_mixed_input" };
  }
  if (!Array.isArray(groups) || groups.length !== y.length || groups.some((value) => value == null || value === "")) {
    return { ok: false, reason: "missing_group_identifier" };
  }
  const parameterCount = X[0].length;
  const predictorCount = parameterCount - 1;
  if (terms.length !== parameterCount || predictorCount < 1) {
    return { ok: false, reason: "invalid_term_contract" };
  }
  if (new Set(y).size < 2) return { ok: false, reason: "constant_outcome" };

  const encoded = encodeGroups(groups);
  // 군집이 너무 적으면 random effect 분산 자체를 추정할 수 없다. 이때 억지로 돌리면
  // 분산 0으로 수렴해(싱귤러 적합) 사실상 OLS인데 이름만 혼합모형이 된다.
  if (encoded.labels.length < DEFINITION.minGroups) {
    return { ok: false, reason: "too_few_groups", groups: encoded.labels.length, requiredGroups: DEFINITION.minGroups };
  }
  const repeated = encoded.sizes.filter((size) => size >= DEFINITION.minObservationsPerGroup).length;
  if (repeated < 2) {
    return { ok: false, reason: "no_repeated_measures", groupsWithRepeats: repeated };
  }
  const required = parameterCount * DEFINITION.minObservationsPerParameter;
  if (y.length < required) {
    return { ok: false, reason: "insufficient_rows", rows: y.length, requiredRows: required, parameterCount };
  }
  return {
    ok: true,
    X,
    y,
    terms,
    parameterCount,
    predictorCount,
    groupCodes: encoded.codes,
    groupLabels: encoded.labels,
    groupSizes: encoded.sizes,
    groupCount: encoded.labels.length,
  };
}

export function normalizeMixedResult(rawRows = [], terms = [], input = {}) {
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
  }));
  const hasInvalid = predictors.some((row) =>
    [row.estimate, row.stdError, row.statistic].some((value) => !Number.isFinite(value)));
  const isSingular = modelRow.singular === true;
  const isStable = modelRow.converged === true && !hasInvalid && !isSingular;
  const adjusted = adjustBenjaminiHochberg(predictors.map((row) => row.rawP));
  predictors.forEach((row, index) => {
    row.p = adjusted[index];
    row.isSignificant = isStable && row.p < 0.05;
  });
  predictors.sort((left, right) => Math.abs(right.statistic) - Math.abs(left.statistic));

  const groupSd = Number(modelRow.group_sd);
  const residualSd = Number(modelRow.residual_sd);
  const icc = Number.isFinite(groupSd) && Number.isFinite(residualSd) && groupSd ** 2 + residualSd ** 2 > 0
    ? groupSd ** 2 / (groupSd ** 2 + residualSd ** 2)
    : null;

  return {
    analysisId: WEBR_ANALYSIS_IDS.MIXED_MODEL,
    engine: "webr",
    engineVersion: "webr-0.6.0-r-4.6.0",
    family: "gaussian",
    status: isStable ? "complete" : "unstable",
    // 싱귤러 적합은 "군집 간 차이가 0"이라는 **결론**이 아니라 추정 실패에 가깝다.
    // 두 상태를 같은 문구로 뭉개면 안 된다.
    reason: isSingular ? "singular_fit" : isStable ? null : "nonconvergence",
    n: Number(modelRow.n) || input.y?.length || 0,
    groupCount: input.groupCount ?? Number(modelRow.group_count) ?? 0,
    groupSd,
    residualSd,
    // 급내상관 — 전체 변동 중 군집 간 차이가 차지하는 몫. 이 값이 크면
    // 대상별 기준선 차이를 무시한 기존 적합이 그만큼 왜곡돼 있었다는 뜻이다.
    icc,
    aic: Number(modelRow.aic),
    // lme4는 정확한 분모 자유도를 제공하지 않는다. 여기 p는 **Wald 대표본 근사**다.
    pValueMethod: "wald_normal_approximation",
    rows: predictors,
  };
}

function mixedRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  const predictors = Array.from({ length: predictorCount }, (_, index) => `x${index}`);
  return `local({
    suppressPackageStartupMessages(library(lme4))
    model_data <- data.frame(y=${BIND_PREFIX}y, g=factor(${BIND_PREFIX}g), ${bindings.join(", ")})
    model_formula <- as.formula(paste("y ~", paste(c(${predictors.map((name) => `"${name}"`).join(", ")}), collapse=" + "), "+ (1|g)"))
    model_fit <- try(suppressMessages(suppressWarnings(lmer(model_formula, data=model_data, REML=TRUE))), silent=TRUE)
    if (inherits(model_fit, "try-error")) {
      data.frame(term="(failed)", estimate=NA_real_, std_error=NA_real_, statistic=NA_real_,
                 p_value=NA_real_, ci_low=NA_real_, ci_high=NA_real_, n=NA_integer_,
                 group_count=NA_integer_, group_sd=NA_real_, residual_sd=NA_real_,
                 aic=NA_real_, converged=FALSE, singular=TRUE)
    } else {
      coefs <- summary(model_fit)$coefficients
      model_estimate <- coefs[, 1]
      model_se <- coefs[, 2]
      model_statistic <- coefs[, 3]
      # lme4는 분모 자유도를 주지 않는다 — Wald 정규근사로 p를 낸다(결과에 명시).
      model_p <- 2 * pnorm(abs(model_statistic), lower.tail=FALSE)
      model_low <- model_estimate - qnorm(0.975) * model_se
      model_high <- model_estimate + qnorm(0.975) * model_se
      variance_components <- as.data.frame(VarCorr(model_fit))
      group_sd_value <- variance_components$sdcor[variance_components$grp == "g"][1]
      residual_sd_value <- variance_components$sdcor[variance_components$grp == "Residual"][1]
      data.frame(
        term=rownames(coefs),
        estimate=unname(model_estimate),
        std_error=unname(model_se),
        statistic=unname(model_statistic),
        p_value=unname(model_p),
        ci_low=unname(model_low),
        ci_high=unname(model_high),
        n=rep(nobs(model_fit), length(model_estimate)),
        group_count=rep(ngrps(model_fit)[["g"]], length(model_estimate)),
        group_sd=rep(as.numeric(group_sd_value), length(model_estimate)),
        residual_sd=rep(as.numeric(residual_sd_value), length(model_estimate)),
        aic=rep(AIC(model_fit), length(model_estimate)),
        converged=rep(is.null(model_fit@optinfo$conv$lme4$code), length(model_estimate)),
        singular=rep(isSingular(model_fit, tol=1e-4), length(model_estimate))
      )
    }
  })`;
}

async function executeMixedModel(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`, `${BIND_PREFIX}g`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}g`, input.groupCodes);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(mixedRCode(input.predictorCount));
    const rows = await resultObject.toD3();
    if (rows.length === 1 && rows[0]?.term === "(failed)") {
      return { status: "failed", reason: "mixed_fit_failed" };
    }
    return normalizeMixedResult(rows, input.terms, input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRMixedModel(payload = {}) {
  const input = prepareMixedInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeMixedModel(runtime, input),
  });
}
