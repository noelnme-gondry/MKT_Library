import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "./analysisRegistry";
import { runWebRAdvancedTask } from "./webRClient";

const DEFINITION = getWebRAnalysisDefinition(WEBR_ANALYSIS_IDS.SVM_CHALLENGER);
const BIND_PREFIX = ".mkt_webr_svm_";

function isFiniteMatrix(X) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || X[0].length < 3) return false;
  const width = X[0].length;
  return X.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite));
}

export function prepareSvmInput({ X = [], y = [], terms = [], numericFeatureCount = 0 } = {}) {
  if (!isFiniteMatrix(X) || !Array.isArray(y) || y.length !== X.length || y.some((value) => !Number.isFinite(value))) {
    return { ok: false, reason: "invalid_numeric_input" };
  }
  const predictorCount = X[0].length - 1;
  if (terms.length !== predictorCount + 1) return { ok: false, reason: "invalid_term_contract" };
  if (predictorCount > DEFINITION.maxPredictors) {
    return { ok: false, reason: "too_many_predictors", predictorCount, maxPredictors: DEFINITION.maxPredictors, n: y.length };
  }
  if (numericFeatureCount < 2) {
    return { ok: false, reason: "insufficient_continuous_features", predictorCount, numericFeatureCount, requiredNumericFeatures: 2, n: y.length };
  }
  const distinct = new Set(y).size;
  if (distinct < 2) return { ok: false, reason: "constant_outcome", predictorCount, n: y.length };
  const outcomeType = y.every((value) => value === 0 || value === 1) ? "classification" : "regression";
  const requiredObservations = Math.max(DEFINITION.minObservations, predictorCount * DEFINITION.minObservationsPerPredictor);
  if (y.length < requiredObservations) {
    return { ok: false, reason: "insufficient_observations", predictorCount, n: y.length, requiredObservations, outcomeType };
  }
  if (outcomeType === "classification") {
    const minorityCount = Math.min(y.filter((value) => value === 0).length, y.filter((value) => value === 1).length);
    if (minorityCount < 20) return { ok: false, reason: "insufficient_class_support", predictorCount, n: y.length, minorityCount, requiredMinority: 20, outcomeType };
  } else if (distinct < 5) {
    return { ok: false, reason: "insufficient_outcome_diversity", predictorCount, n: y.length, distinctOutcomes: distinct, outcomeType };
  }
  return { ok: true, X, y, terms, predictorCount, numericFeatureCount, n: y.length, requiredObservations, outcomeType };
}

function svmRCode(predictorCount) {
  const bindings = Array.from({ length: predictorCount }, (_, index) => `x${index}=${BIND_PREFIX}x${index}`);
  return `local({
    suppressPackageStartupMessages(library(e1071))
    set.seed(20260811)
    model_x <- data.frame(${bindings.join(", ")})
    model_y <- ${BIND_PREFIX}y
    model_n <- nrow(model_x)
    model_p <- ncol(model_x)
    is_classification <- all(model_y %in% c(0, 1)) && length(unique(model_y)) == 2
    fold_count <- min(5L, max(3L, floor(model_n / 30L)))
    fold_id <- sample(rep(seq_len(fold_count), length.out=model_n))
    svm_prediction <- rep(NA_real_, model_n)
    baseline_prediction <- rep(NA_real_, model_n)
    selected_cost <- rep(NA_real_, fold_count)
    selected_gamma <- rep(NA_real_, fold_count)
    gamma_grid <- unique(c(1 / max(1L, model_p), 0.1, 1))
    for (fold in seq_len(fold_count)) {
      train <- fold_id != fold
      test <- !train
      train_y <- if (is_classification) factor(model_y[train], levels=c(0, 1)) else model_y[train]
      tuned <- e1071::tune.svm(
        x=model_x[train, , drop=FALSE], y=train_y,
        kernel="radial", scale=TRUE,
        cost=c(0.1, 1, 10), gamma=gamma_grid,
        probability=is_classification,
        tunecontrol=e1071::tune.control(cross=3)
      )
      selected_cost[fold] <- tuned$best.parameters$cost
      selected_gamma[fold] <- tuned$best.parameters$gamma
      if (is_classification) {
        predicted <- predict(tuned$best.model, model_x[test, , drop=FALSE], probability=TRUE)
        probabilities <- attr(predicted, "probabilities")
        svm_prediction[test] <- probabilities[, "1"]
        baseline_fit <- suppressWarnings(glm(model_y[train] ~ ., data=model_x[train, , drop=FALSE], family=binomial()))
        baseline_prediction[test] <- predict(baseline_fit, model_x[test, , drop=FALSE], type="response")
      } else {
        svm_prediction[test] <- predict(tuned$best.model, model_x[test, , drop=FALSE])
        baseline_fit <- lm(model_y[train] ~ ., data=model_x[train, , drop=FALSE])
        baseline_prediction[test] <- predict(baseline_fit, model_x[test, , drop=FALSE])
      }
    }
    if (any(!is.finite(svm_prediction)) || any(!is.finite(baseline_prediction))) stop("non_finite_cv_prediction")
    if (is_classification) {
      svm_primary <- mean((svm_prediction - model_y)^2)
      baseline_primary <- mean((baseline_prediction - model_y)^2)
      svm_secondary <- mean((svm_prediction >= 0.5) == model_y)
      baseline_secondary <- mean((baseline_prediction >= 0.5) == model_y)
      primary_metric <- "brier"
      secondary_metric <- "accuracy"
    } else {
      svm_primary <- sqrt(mean((svm_prediction - model_y)^2))
      baseline_primary <- sqrt(mean((baseline_prediction - model_y)^2))
      target_variance <- sum((model_y - mean(model_y))^2)
      svm_secondary <- 1 - sum((svm_prediction - model_y)^2) / target_variance
      baseline_secondary <- 1 - sum((baseline_prediction - model_y)^2) / target_variance
      primary_metric <- "rmse"
      secondary_metric <- "oos_r2"
    }
    relative_gain <- if (baseline_primary > 1e-12) (baseline_primary - svm_primary) / baseline_primary else 0
    data.frame(
      n=model_n, folds=fold_count,
      primary_metric=primary_metric, secondary_metric=secondary_metric,
      svm_primary=svm_primary, baseline_primary=baseline_primary,
      svm_secondary=svm_secondary, baseline_secondary=baseline_secondary,
      relative_gain=relative_gain,
      median_cost=median(selected_cost), median_gamma=median(selected_gamma),
      package_version=as.character(packageVersion("e1071"))
    )
  })`;
}

export function normalizeSvmResult(rawRows = [], input = {}) {
  const model = rawRows?.[0];
  if (!model) return { status: "failed", reason: "invalid_webr_result" };
  const relativeGain = Number(model.relative_gain);
  return {
    analysisId: WEBR_ANALYSIS_IDS.SVM_CHALLENGER,
    engine: "webr",
    engineVersion: `webr-0.6.0-r-4.6.0-e1071-${String(model.package_version || "runtime")}`,
    status: "complete",
    outcomeType: input.outcomeType,
    n: Number(model.n) || input.n,
    folds: Number(model.folds) || 0,
    primaryMetric: String(model.primary_metric || ""),
    secondaryMetric: String(model.secondary_metric || ""),
    svm: { primary: Number(model.svm_primary), secondary: Number(model.svm_secondary) },
    baseline: { engine: input.outcomeType === "classification" ? "logistic_regression" : "ols", primary: Number(model.baseline_primary), secondary: Number(model.baseline_secondary) },
    relativeGain,
    recommendation: relativeGain >= 0.05 ? "svm_candidate" : relativeGain <= -0.05 ? "baseline_regression" : "no_material_difference",
    tuning: { cost: Number(model.median_cost), gamma: Number(model.median_gamma) },
  };
}

async function executeSvm(runtime, input) {
  const boundNames = [`${BIND_PREFIX}y`];
  runtime.objs.globalEnv.bind(`${BIND_PREFIX}y`, input.y);
  for (let index = 0; index < input.predictorCount; index += 1) {
    const name = `${BIND_PREFIX}x${index}`;
    boundNames.push(name);
    runtime.objs.globalEnv.bind(name, input.X.map((row) => row[index + 1]));
  }
  let resultObject;
  try {
    resultObject = await runtime.evalR(svmRCode(input.predictorCount));
    return normalizeSvmResult(await resultObject.toD3(), input);
  } finally {
    if (resultObject) await runtime.destroy(resultObject);
    await runtime.evalRVoid(`rm(list=c(${boundNames.map((name) => `"${name}"`).join(", ")}), envir=.GlobalEnv)`);
  }
}

export async function runWebRSvm(payload = {}) {
  const input = prepareSvmInput(payload);
  if (!input.ok) return { status: "blocked", ...input };
  return runWebRAdvancedTask({ packages: DEFINITION.packages, execute: (runtime) => executeSvm(runtime, input) });
}
