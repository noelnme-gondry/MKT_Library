export const WEBR_ANALYSIS_IDS = Object.freeze({
  BINARY_LOGISTIC_REGRESSION: "binary_logistic_regression",
  RANDOM_FOREST_CHALLENGER: "random_forest_challenger",
  MMM_ELASTIC_NET_CHALLENGER: "mmm_elastic_net_challenger",
});

export const WEBR_ANALYSES = Object.freeze({
  [WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["sandwich"]),
    minMinorityOutcomesPerParameter: 10,
    resultKind: "logistic-regression",
  }),
  [WEBR_ANALYSIS_IDS.RANDOM_FOREST_CHALLENGER]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.RANDOM_FOREST_CHALLENGER,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["randomForest"]),
    minObservations: 100,
    minObservationsPerPredictor: 20,
    resultKind: "predictive-challenger",
  }),
  [WEBR_ANALYSIS_IDS.MMM_ELASTIC_NET_CHALLENGER]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.MMM_ELASTIC_NET_CHALLENGER,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["glmnet"]),
    minObservations: 78,
    resultKind: "mmm-predictive-challenger",
  }),
});

export function getWebRAnalysisDefinition(analysisId) {
  return WEBR_ANALYSES[analysisId] || null;
}
