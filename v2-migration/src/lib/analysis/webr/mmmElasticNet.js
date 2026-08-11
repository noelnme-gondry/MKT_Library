import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.MMM_ELASTIC_NET_CHALLENGER);
const BIND_PREFIX = ".mkt_webr_mmm_";
const ADSTOCK_GRID = Object.freeze([0, 0.3, 0.6, 0.8]);

function geometricAdstock(values, alpha) {
  let carry = 0;
  return values.map((value) => {
    carry = Math.max(0, Number(value) || 0) + alpha * carry;
    return carry;
  });
}

function hasVariation(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value))) return false;
  const first = values[0];
  return values.some((value) => Math.abs(value - first) > 1e-12);
}

function pushFeature(features, values, meta) {
  if (!hasVariation(values)) return;
  features.push({ values, ...meta });
}

export function buildMmmElasticNetDesign(panel = {}) {
  const n = panel.week?.length || 0;
  const yTarget = Object.values(panel.targets || {}).find((values) => Array.isArray(values) && values.length === n);
  if (!n || !yTarget) return null;
  const features = [];
  const trend = Array.from({ length: n }, (_, index) => n > 1 ? index / (n - 1) : 0);
  pushFeature(features, trend, { name: "trend", group: "Trend", kind: "control", isMedia: false });
  pushFeature(features, trend.map((value) => value * value), { name: "trend_squared", group: "Trend", kind: "control", isMedia: false });
  if (n >= 78) {
    for (let harmonic = 1; harmonic <= 2; harmonic += 1) {
      pushFeature(features, trend.map((_, index) => Math.sin(2 * Math.PI * harmonic * index / 52)), {
        name: `annual_sin_${harmonic}`, group: "Seasonality", kind: "control", isMedia: false,
      });
      pushFeature(features, trend.map((_, index) => Math.cos(2 * Math.PI * harmonic * index / 52)), {
        name: `annual_cos_${harmonic}`, group: "Seasonality", kind: "control", isMedia: false,
      });
    }
  }
  (panel.channels || []).forEach((channel) => {
    const raw = panel.ch?.[channel.key];
    if (!Array.isArray(raw) || raw.length !== n || raw.some((value) => !Number.isFinite(value))) return;
    ADSTOCK_GRID.forEach((alpha) => {
      pushFeature(features, geometricAdstock(raw, alpha).map((value) => Math.log1p(value)), {
        name: `media_${channel.key}_adstock_${alpha}`,
        group: channel.label || channel.key,
        kind: "media",
        isMedia: true,
      });
    });
  });
  [
    [panel.dummy, "Events"],
    [panel.steps, "Regime change"],
    [panel.external, "Industry controls"],
  ].forEach(([collection, group]) => {
    Object.entries(collection || {}).forEach(([key, values]) => {
      if (!Array.isArray(values) || values.length !== n) return;
      pushFeature(features, values.map((value) => typeof value === "number" ? value : Number.NaN), {
        name: `control_${key}`, group, kind: "control", isMedia: false,
      });
    });
  });
  if (!features.some((feature) => feature.isMedia)) return null;
  return {
    X: Array.from({ length: n }, (_, rowIndex) => features.map((feature) => feature.values[rowIndex])),
    terms: features.map(({ values: _values, ...meta }) => meta),
  };
}

export function prepareMmmElasticNetInput({ panel, run, target } = {}) {
  const y = panel?.targets?.[target];
  if (!Array.isArray(y) || y.some((value) => !Number.isFinite(value)) || new Set(y).size < 2) {
    return { ok: false, reason: "invalid_target" };
  }
  if (y.length < DEFINITION.minObservations) {
    return { ok: false, reason: "insufficient_history", n: y.length, requiredObservations: DEFINITION.minObservations };
  }
  const design = buildMmmElasticNetDesign({ ...panel, targets: { [target]: y } });
  if (!design?.X?.length || design.X.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return { ok: false, reason: "invalid_design" };
  }
  const rolling = run?.rollingBacktest || run?.aggregateRollingBacktest;
  const hasRollingWindows = Array.isArray(rolling?.cuts) && rolling.cuts.length >= 2 && Number(rolling.horizon) > 0;
  const cuts = hasRollingWindows ? rolling.cuts.slice() : [Math.floor(y.length * 0.8)];
  const horizon = hasRollingWindows ? Number(rolling.horizon) : y.length - cuts[0];
  const baselineWmape = Number(run?.backtest?.wmape);
  return {
    ok: true,
    ...design,
    y,
    n: y.length,
    predictorCount: design.terms.length,
    cuts,
    horizon,
    baselineWmape: Number.isFinite(baselineWmape) ? baselineWmape : null,
    sameValidationWindows: Number.isFinite(baselineWmape),
    baselineEngine: run?.methodLabel || "Current JS MMM",
  };
}

export function normalizeMmmElasticNetResult(rawRows = [], input = {}) {
  if (!Array.isArray(rawRows) || rawRows.length !== input.predictorCount) {
    return { status: "failed", reason: "invalid_webr_result" };
  }
  const model = rawRows[0] || {};
  const byGroup = new Map();
  rawRows.forEach((row, index) => {
    const term = input.terms[index];
    const importance = Number(row.importance);
    if (!term || !Number.isFinite(importance)) return;
    const current = byGroup.get(term.group) || { name: term.group, kind: term.kind, importance: 0 };
    current.importance += importance;
    byGroup.set(term.group, current);
  });
  const importance = [...byGroup.values()].sort((left, right) => right.importance - left.importance);
  const wmape = Number(model.wmape);
  const baselineWmape = input.baselineWmape;
  const relativeGain = Number.isFinite(baselineWmape) && baselineWmape > 1e-12
    ? (baselineWmape - wmape) / baselineWmape
    : null;
  const replacementCandidate = input.sameValidationWindows
    && input.cuts.length >= 2
    && Number.isFinite(relativeGain)
    && relativeGain >= 0.05;
  const recommendation = replacementCandidate
    ? "predictive_replacement_candidate"
    : Number.isFinite(relativeGain) && relativeGain <= -0.05
      ? "keep_current_js"
      : "more_validation_required";
  return {
    analysisId: WEBR_ANALYSIS_IDS.MMM_ELASTIC_NET_CHALLENGER,
    engine: "webr",
    engineVersion: `webr-0.6.0-r-4.6.0-glmnet-${String(model.package_version || "runtime")}`,
    status: "complete",
    n: Number(model.n) || input.n,
    folds: Number(model.folds) || input.cuts.length,
    horizon: input.horizon,
    alpha: Number(model.alpha),
    lambdaFactor: Number(model.lambda_factor),
    nonzeroFeatures: Number(model.nonzero_features),
    wmape,
    baselineWmape,
    baselineEngine: input.baselineEngine,
    sameValidationWindows: input.sameValidationWindows,
    relativeGain,
    replacementCandidate,
    recommendation,
    importance,
    estimand: "predictive-only-fixed-causal-feature-library",
    validationMode: "nested-time-ordered-outer-wmape",
  };
}

function elasticNetRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  return `local({
    suppressPackageStartupMessages(library(glmnet))
    model_x <- as.matrix(data.frame(${bindings.join(", ")}))
    model_y <- ${BIND_PREFIX}y
    fold_cuts <- as.integer(${BIND_PREFIX}cuts)
    fold_horizon <- as.integer(${BIND_PREFIX}horizon[1])
    lower_limits <- ${BIND_PREFIX}lower
    alpha_grid <- c(0.05, 0.25, 0.5, 0.75, 1)
    lambda_factors <- 10^seq(0, -4, length.out=30)
    outer_wmapes <- numeric(length(fold_cuts))
    selected_alphas <- numeric(length(fold_cuts))
    selected_factors <- numeric(length(fold_cuts))
    for (fold_index in seq_along(fold_cuts)) {
      cut <- fold_cuts[fold_index]
      test_end <- min(nrow(model_x), cut + fold_horizon)
      outer_train_rows <- seq_len(cut)
      outer_test_rows <- seq.int(cut + 1L, test_end)
      inner_horizon <- min(fold_horizon, max(4L, floor(cut * 0.15)))
      inner_cut <- cut - inner_horizon
      if (inner_cut < 20L) stop("insufficient_inner_training_history")
      inner_train_rows <- seq_len(inner_cut)
      inner_test_rows <- seq.int(inner_cut + 1L, cut)
      inner_denominator <- sum(abs(model_y[inner_test_rows]))
      if (!(inner_denominator > 1e-9)) stop("invalid_inner_wmape_denominator")
      inner_score <- matrix(Inf, nrow=length(alpha_grid), ncol=length(lambda_factors))
      inner_scale <- max(sd(model_y[inner_train_rows]), 1e-6)
      inner_lambda <- inner_scale * lambda_factors
      for (alpha_index in seq_along(alpha_grid)) {
        inner_fit <- glmnet::glmnet(
          model_x[inner_train_rows, , drop=FALSE],
          model_y[inner_train_rows],
          family="gaussian",
          alpha=alpha_grid[alpha_index],
          lambda=inner_lambda,
          lower.limits=lower_limits,
          standardize=TRUE,
          intercept=TRUE
        )
        inner_prediction <- predict(inner_fit, model_x[inner_test_rows, , drop=FALSE], s=inner_lambda)
        inner_score[alpha_index, ] <- colSums(abs(inner_prediction - model_y[inner_test_rows])) / inner_denominator * 100
      }
      selected <- arrayInd(which.min(inner_score), dim(inner_score))[1, ]
      selected_alphas[fold_index] <- alpha_grid[selected[1]]
      selected_factors[fold_index] <- lambda_factors[selected[2]]
      outer_scale <- max(sd(model_y[outer_train_rows]), 1e-6)
      outer_lambda <- outer_scale * selected_factors[fold_index]
      outer_fit <- glmnet::glmnet(
        model_x[outer_train_rows, , drop=FALSE],
        model_y[outer_train_rows],
        family="gaussian",
        alpha=selected_alphas[fold_index],
        lambda=outer_lambda,
        lower.limits=lower_limits,
        standardize=TRUE,
        intercept=TRUE
      )
      outer_prediction <- as.numeric(predict(outer_fit, model_x[outer_test_rows, , drop=FALSE], s=outer_lambda))
      outer_denominator <- sum(abs(model_y[outer_test_rows]))
      if (!(outer_denominator > 1e-9)) stop("invalid_outer_wmape_denominator")
      outer_wmapes[fold_index] <- sum(abs(outer_prediction - model_y[outer_test_rows])) / outer_denominator * 100
    }
    selected_alpha <- selected_alphas[length(selected_alphas)]
    selected_factor <- selected_factors[length(selected_factors)]
    selected_wmape <- mean(outer_wmapes)
    final_lambda <- max(sd(model_y), 1e-6) * selected_factor
    final_fit <- glmnet::glmnet(
      model_x,
      model_y,
      family="gaussian",
      alpha=selected_alpha,
      lambda=final_lambda,
      lower.limits=lower_limits,
      standardize=TRUE,
      intercept=TRUE
    )
    final_coef <- as.numeric(coef(final_fit, s=final_lambda))[-1]
    feature_scale <- apply(model_x, 2, sd)
    model_importance <- abs(final_coef * feature_scale)
    data.frame(
      term=colnames(model_x),
      coefficient=final_coef,
      importance=model_importance,
      n=rep(nrow(model_x), ncol(model_x)),
      folds=rep(length(fold_cuts), ncol(model_x)),
      alpha=rep(selected_alpha, ncol(model_x)),
      lambda_factor=rep(selected_factor, ncol(model_x)),
      wmape=rep(selected_wmape, ncol(model_x)),
      nonzero_features=rep(sum(abs(final_coef) > 1e-10), ncol(model_x)),
      package_version=rep(as.character(packageVersion("glmnet")), ncol(model_x))
    )
  })`;
}

async function executeMmmElasticNet(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`, `${BIND_PREFIX}cuts`, `${BIND_PREFIX}horizon`, `${BIND_PREFIX}lower`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}cuts`, input.cuts);
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}horizon`, [input.horizon]);
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}lower`, input.terms.map((term) => term.isMedia ? 0 : -Infinity));
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(elasticNetRCode(input.predictorCount));
    return normalizeMmmElasticNetResult(await resultObject.toD3(), input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRMmmElasticNet(payload = {}) {
  const input = prepareMmmElasticNetInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeMmmElasticNet(runtime, input),
  });
}
