export const WEBR_ANALYSIS_IDS = Object.freeze({
  BINARY_LOGISTIC_REGRESSION: "binary_logistic_regression",
  RANDOM_FOREST_CHALLENGER: "random_forest_challenger",
  MMM_ELASTIC_NET_CHALLENGER: "mmm_elastic_net_challenger",
  // 0/1이 아닌 성과변수가 전부 OLS로 가던 경로를 나눈다(utils/outcomeType.js).
  RATE_BETA_REGRESSION: "rate_beta_regression",
  COUNT_REGRESSION: "count_regression",
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
  // CTR·CVR·리텐션 같은 0~1 유계 비율. OLS는 구간 밖을 예측하고 분산이 평균에
  // 묶인 걸 무시한다. betareg는 로짓 링크 + 정밀도 파라미터로 그 구조를 반영한다.
  [WEBR_ANALYSIS_IDS.RATE_BETA_REGRESSION]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.RATE_BETA_REGRESSION,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["betareg"]),
    minObservationsPerParameter: 10,
    resultKind: "rate-regression",
  }),
  // 설치·전환 같은 카운트. Poisson으로 먼저 적합해 Pearson χ²/df로 과산포를
  // 검정하고, 넘으면 MASS::glm.nb로 전환한다. 과산포를 무시하면 SE가 과소추정돼
  // 없는 유의가 생긴다.
  [WEBR_ANALYSIS_IDS.COUNT_REGRESSION]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.COUNT_REGRESSION,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["MASS"]),
    minObservationsPerParameter: 10,
    overdispersionRatio: 1.5,
    resultKind: "count-regression",
  }),
});

export function getWebRAnalysisDefinition(analysisId) {
  return WEBR_ANALYSES[analysisId] || null;
}
