import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.RANDOM_FOREST_CHALLENGER);
const BIND_PREFIX = ".mkt_webr_rf_";

function isFiniteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 2) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

export function prepareRandomForestInput({ X = [], y = [], terms = [] } = {}) {
  if (!isFiniteMatrix(X) || !Array.isArray(y) || y.length !== X.length || y.some((value) => !Number.isFinite(value))) {
    return { ok: false, reason: "invalid_numeric_input" };
  }
  const predictorCount = X[0].length - 1;
  if (terms.length !== predictorCount + 1 || predictorCount < 1) return { ok: false, reason: "invalid_term_contract" };
  if (y.length > DEFINITION.maxObservations) {
    return { ok: false, reason: "too_many_observations", n: y.length, maxObservations: DEFINITION.maxObservations, predictorCount };
  }
  if (new Set(y).size < 2) return { ok: false, reason: "constant_outcome" };
  const outcomeType = y.every((value) => value === 0 || value === 1) ? "classification" : "regression";
  const requiredObservations = Math.max(
    DEFINITION.minObservations,
    predictorCount * DEFINITION.minObservationsPerPredictor,
  );
  if (y.length < requiredObservations) {
    return { ok: false, reason: "insufficient_observations", n: y.length, requiredObservations, predictorCount, outcomeType };
  }
  if (outcomeType === "classification") {
    const minorityCount = Math.min(
      y.filter((value) => value === 0).length,
      y.filter((value) => value === 1).length,
    );
    if (minorityCount < 20) {
      return { ok: false, reason: "insufficient_class_support", n: y.length, minorityCount, requiredMinority: 20, predictorCount, outcomeType };
    }
  }
  return {
    ok: true,
    X,
    y,
    terms,
    n: y.length,
    predictorCount,
    outcomeType,
    requiredObservations,
  };
}

export function normalizeRandomForestResult(rawRows = [], input = {}) {
  if (!Array.isArray(rawRows) || rawRows.length !== input.predictorCount) {
    return { status: "failed", reason: "invalid_webr_result" };
  }
  const model = rawRows[0] || {};
  const importance = rawRows.map((row, index) => ({
    name: input.terms[index + 1],
    importance: Number(row.importance),
  })).filter((row) => Number.isFinite(row.importance))
    .sort((left, right) => right.importance - left.importance);
  const relativeGain = Number(model.relative_gain);
  const recommendation = relativeGain >= 0.05
    ? "random_forest_candidate"
    : relativeGain <= -0.05
      ? "baseline_regression"
      : "no_material_difference";
  return {
    analysisId: WEBR_ANALYSIS_IDS.RANDOM_FOREST_CHALLENGER,
    engine: "webr",
    engineVersion: `webr-0.6.0-r-4.6.0-randomForest-${String(model.package_version || "runtime")}`,
    status: "complete",
    outcomeType: input.outcomeType,
    n: Number(model.n) || input.n,
    folds: Number(model.folds) || 0,
    primaryMetric: String(model.primary_metric || ""),
    secondaryMetric: String(model.secondary_metric || ""),
    randomForest: {
      primary: Number(model.rf_primary),
      secondary: Number(model.rf_secondary),
    },
    baseline: {
      engine: input.outcomeType === "classification" ? "logistic_regression" : "ols",
      primary: Number(model.baseline_primary),
      secondary: Number(model.baseline_secondary),
    },
    relativeGain,
    recommendation,
    importance,
  };
}

function randomForestRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  return `local({
    suppressPackageStartupMessages(library(randomForest))
    set.seed(20260811)
    model_x <- data.frame(${bindings.join(", ")})
    model_y <- ${BIND_PREFIX}y
    model_n <- nrow(model_x)
    model_p <- ncol(model_x)
    is_classification <- all(model_y %in% c(0, 1)) && length(unique(model_y)) == 2
    fold_count <- min(5L, max(3L, floor(model_n / 30L)))
    fold_id <- sample(rep(seq_len(fold_count), length.out=model_n))
    rf_prediction <- rep(NA_real_, model_n)
    baseline_prediction <- rep(NA_real_, model_n)
    for (fold in seq_len(fold_count)) {
      train <- fold_id != fold
      test <- !train
      if (is_classification) {
        rf_fit <- randomForest::randomForest(
          x=model_x[train, , drop=FALSE],
          y=factor(model_y[train], levels=c(0, 1)),
          ntree=500,
          mtry=max(1L, floor(sqrt(model_p))),
          importance=TRUE
        )
        rf_prediction[test] <- predict(rf_fit, model_x[test, , drop=FALSE], type="prob")[, "1"]
        baseline_data <- data.frame(y=model_y[train], model_x[train, , drop=FALSE])
        baseline_fit <- suppressWarnings(glm(y ~ ., data=baseline_data, family=binomial()))
        if (!isTRUE(baseline_fit$converged) || any(!is.finite(coef(baseline_fit))) || any(abs(coef(baseline_fit)) > 25)) stop("baseline_regression_not_estimable")
        baseline_prediction[test] <- predict(baseline_fit, model_x[test, , drop=FALSE], type="response")
      } else {
        rf_fit <- randomForest::randomForest(
          x=model_x[train, , drop=FALSE],
          y=model_y[train],
          ntree=500,
          mtry=max(1L, floor(model_p / 3L)),
          importance=TRUE
        )
        rf_prediction[test] <- predict(rf_fit, model_x[test, , drop=FALSE])
        baseline_data <- data.frame(y=model_y[train], model_x[train, , drop=FALSE])
        baseline_fit <- lm(y ~ ., data=baseline_data)
        if (any(!is.finite(coef(baseline_fit)))) stop("baseline_regression_not_estimable")
        baseline_prediction[test] <- predict(baseline_fit, model_x[test, , drop=FALSE])
      }
    }
    if (any(!is.finite(rf_prediction)) || any(!is.finite(baseline_prediction))) stop("non_finite_cv_prediction")
    full_fit <- randomForest::randomForest(
      x=model_x,
      y=if (is_classification) factor(model_y, levels=c(0, 1)) else model_y,
      ntree=500,
      mtry=if (is_classification) max(1L, floor(sqrt(model_p))) else max(1L, floor(model_p / 3L)),
      importance=TRUE
    )
    model_importance <- as.numeric(randomForest::importance(full_fit, type=1, scale=FALSE)[, 1])
    if (is_classification) {
      rf_primary <- mean((rf_prediction - model_y)^2)
      baseline_primary <- mean((baseline_prediction - model_y)^2)
      rf_secondary <- mean((rf_prediction >= 0.5) == model_y)
      baseline_secondary <- mean((baseline_prediction >= 0.5) == model_y)
      primary_metric <- "brier"
      secondary_metric <- "accuracy"
    } else {
      rf_primary <- sqrt(mean((rf_prediction - model_y)^2))
      baseline_primary <- sqrt(mean((baseline_prediction - model_y)^2))
      target_variance <- sum((model_y - mean(model_y))^2)
      rf_secondary <- 1 - sum((rf_prediction - model_y)^2) / target_variance
      baseline_secondary <- 1 - sum((baseline_prediction - model_y)^2) / target_variance
      primary_metric <- "rmse"
      secondary_metric <- "oos_r2"
    }
    relative_gain <- if (baseline_primary > 1e-12) (baseline_primary - rf_primary) / baseline_primary else 0
    data.frame(
      term=names(model_x),
      importance=model_importance,
      n=rep(model_n, model_p),
      folds=rep(fold_count, model_p),
      primary_metric=rep(primary_metric, model_p),
      secondary_metric=rep(secondary_metric, model_p),
      rf_primary=rep(rf_primary, model_p),
      baseline_primary=rep(baseline_primary, model_p),
      rf_secondary=rep(rf_secondary, model_p),
      baseline_secondary=rep(baseline_secondary, model_p),
      relative_gain=rep(relative_gain, model_p),
      package_version=rep(as.character(packageVersion("randomForest")), model_p)
    )
  })`;
}

async function executeRandomForest(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(randomForestRCode(input.predictorCount));
    return normalizeRandomForestResult(await resultObject.toD3(), input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRRandomForest(payload = {}) {
  const input = prepareRandomForestInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({
    packages: DEFINITION.packages,
    execute: (runtime) => executeRandomForest(runtime, input),
  });
}
