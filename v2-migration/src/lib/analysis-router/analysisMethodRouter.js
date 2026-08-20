import { chooseOutcomeModel } from "@/utils/outcomeType";
import { getWebRAnalysisDefinition, WEBR_ANALYSIS_IDS } from "@/lib/analysis/webr/analysisRegistry";

// 도구별 "열 수가 맞는가" 판정(evaluateEligibility)과 달리, 이 모듈은 사용자가
// 밝힌 질문·설계·결과 척도에서 어떤 통계 방법을 검토할 수 있는지만 결정한다.
// 따라서 route/toolId나 원본 헤더명은 입력으로 쓰지 않는다.
export const ANALYSIS_METHOD_STATUS = Object.freeze({
  READY: "READY",
  CAUTION: "CAUTION",
  BLOCKED: "BLOCKED",
  ABSTAIN: "ABSTAIN",
});

export const ANALYSIS_INTENT = Object.freeze({
  ASSOCIATION: "association",
  GROUP_COMPARISON: "group_comparison",
  REGRESSION: "regression",
});

export const ANALYSIS_ESTIMAND = Object.freeze({
  MEAN_DIFFERENCE: "mean_difference",
  RANK_DISTRIBUTION: "rank_distribution",
});

export const ANALYSIS_DESIGN = Object.freeze({
  INDEPENDENT: "independent",
  PAIRED: "paired",
  REPEATED: "repeated",
  CLUSTERED: "clustered",
  TIME_SERIES: "time_series",
});

export const ANALYSIS_METHOD_IDS = Object.freeze({
  PEARSON_CORRELATION: "pearson_correlation",
  SPEARMAN_CORRELATION: "spearman_correlation",
  WELCH_T_TEST: "welch_t_test",
  FISHER_EXACT_2X2: "fisher_exact_2x2",
  GAUSSIAN_OLS: "gaussian_ols",
  PAIRED_T_TEST: "paired_t_test",
  WILCOXON_RANK_SUM: "wilcoxon_rank_sum",
  WILCOXON_SIGNED_RANK: "wilcoxon_signed_rank",
  WELCH_ANOVA: "welch_anova",
  GAMES_HOWELL: "games_howell",
  KRUSKAL_WALLIS: "kruskal_wallis",
  DUNN_HOLM: "dunn_holm",
  MIXED_MODEL: WEBR_ANALYSIS_IDS.MIXED_MODEL,
  BINARY_LOGISTIC_REGRESSION: WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION,
  RATE_BETA_REGRESSION: WEBR_ANALYSIS_IDS.RATE_BETA_REGRESSION,
  COUNT_REGRESSION: WEBR_ANALYSIS_IDS.COUNT_REGRESSION,
});

function webRMethod(id) {
  const definition = getWebRAnalysisDefinition(id);
  return Object.freeze({
    id,
    engine: definition.engine,
    packages: definition.packages,
    execution: "explicit",
    heavyDownload: Boolean(definition.heavyDownload),
    available: true,
  });
}

// Phase B의 공용 registry. JS 엔진도 WebR 엔진과 같은 후보 계약으로 내보내되,
// 아직 구현되지 않은 방법은 available:false로 명시해 기존 방법으로 바꿔 실행하지 않는다.
export const ANALYSIS_METHODS = Object.freeze({
  [ANALYSIS_METHOD_IDS.PEARSON_CORRELATION]: Object.freeze({ id: ANALYSIS_METHOD_IDS.PEARSON_CORRELATION, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.SPEARMAN_CORRELATION]: Object.freeze({ id: ANALYSIS_METHOD_IDS.SPEARMAN_CORRELATION, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.WELCH_T_TEST]: Object.freeze({ id: ANALYSIS_METHOD_IDS.WELCH_T_TEST, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.FISHER_EXACT_2X2]: Object.freeze({ id: ANALYSIS_METHOD_IDS.FISHER_EXACT_2X2, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.GAUSSIAN_OLS]: Object.freeze({ id: ANALYSIS_METHOD_IDS.GAUSSIAN_OLS, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.PAIRED_T_TEST]: Object.freeze({ id: ANALYSIS_METHOD_IDS.PAIRED_T_TEST, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.WILCOXON_RANK_SUM]: Object.freeze({ id: ANALYSIS_METHOD_IDS.WILCOXON_RANK_SUM, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.WILCOXON_SIGNED_RANK]: Object.freeze({ id: ANALYSIS_METHOD_IDS.WILCOXON_SIGNED_RANK, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.WELCH_ANOVA]: Object.freeze({ id: ANALYSIS_METHOD_IDS.WELCH_ANOVA, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.GAMES_HOWELL]: Object.freeze({ id: ANALYSIS_METHOD_IDS.GAMES_HOWELL, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.KRUSKAL_WALLIS]: Object.freeze({ id: ANALYSIS_METHOD_IDS.KRUSKAL_WALLIS, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.DUNN_HOLM]: Object.freeze({ id: ANALYSIS_METHOD_IDS.DUNN_HOLM, engine: "js", packages: [], execution: "tool_specific", heavyDownload: false, available: true }),
  [ANALYSIS_METHOD_IDS.MIXED_MODEL]: webRMethod(ANALYSIS_METHOD_IDS.MIXED_MODEL),
  [ANALYSIS_METHOD_IDS.BINARY_LOGISTIC_REGRESSION]: webRMethod(ANALYSIS_METHOD_IDS.BINARY_LOGISTIC_REGRESSION),
  [ANALYSIS_METHOD_IDS.RATE_BETA_REGRESSION]: webRMethod(ANALYSIS_METHOD_IDS.RATE_BETA_REGRESSION),
  [ANALYSIS_METHOD_IDS.COUNT_REGRESSION]: webRMethod(ANALYSIS_METHOD_IDS.COUNT_REGRESSION),
});

export function getAnalysisMethodDefinition(analysisId) {
  return ANALYSIS_METHODS[analysisId] || null;
}

const KNOWN_DESIGNS = new Set(Object.values(ANALYSIS_DESIGN));
const KNOWN_INTENTS = new Set(Object.values(ANALYSIS_INTENT));
const KNOWN_ESTIMANDS = new Set(Object.values(ANALYSIS_ESTIMAND));
const KNOWN_OUTCOME_KINDS = new Set(["binary", "proportion", "count", "continuous", "degenerate"]);

function asPositiveInteger(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function normalizeOutcome(outcome = {}) {
  if (Array.isArray(outcome.values)) {
    const choice = chooseOutcomeModel(outcome.values);
    return {
      key: outcome.key || null,
      kind: choice.classification.kind,
      model: choice.model,
      reason: choice.reason,
      n: choice.classification.n,
      hasBoundary: Boolean(choice.classification.hasBoundary),
    };
  }
  const kind = KNOWN_OUTCOME_KINDS.has(outcome.kind) ? outcome.kind : null;
  return {
    key: outcome.key || null,
    kind,
    model: outcome.model || null,
    reason: outcome.reason || null,
    n: asPositiveInteger(outcome.validN) ?? asPositiveInteger(outcome.n) ?? 0,
    hasBoundary: Boolean(outcome.hasBoundary),
  };
}

function normalizeDiagnostics(diagnostics = {}, outcome = {}) {
  const groupCounts = diagnostics.groupCounts && typeof diagnostics.groupCounts === "object"
    ? diagnostics.groupCounts : {};
  const clusterCounts = diagnostics.clusterCounts && typeof diagnostics.clusterCounts === "object"
    ? diagnostics.clusterCounts : {};
  return {
    validN: asPositiveInteger(diagnostics.validN) ?? asPositiveInteger(diagnostics.n) ?? outcome.n,
    predictorCount: asPositiveInteger(diagnostics.predictorCount) ?? 0,
    groupCount: asPositiveInteger(diagnostics.groupCount) ?? Object.keys(groupCounts).length,
    clusterCount: asPositiveInteger(diagnostics.clusterCount) ?? Object.keys(clusterCounts).length,
    repeatedClusterCount: asPositiveInteger(diagnostics.repeatedClusterCount)
      ?? Object.values(clusterCounts).filter((count) => Number(count) >= 2).length,
  };
}

function candidate(analysisId, {
  status = ANALYSIS_METHOD_STATUS.READY,
  role = "primary",
  reasons = [],
  requiredConfirmation = [],
} = {}) {
  const definition = getAnalysisMethodDefinition(analysisId);
  return {
    analysisId,
    status,
    role,
    reasons,
    requiredConfirmation,
    engine: definition?.engine || null,
    packages: definition?.packages || [],
    // WebR은 package 설치/분석 모두 사용자가 실행할 때만 시작한다. READY라도
    // 자동 다운로드하라는 뜻이 아니다.
    execution: definition?.execution || null,
    heavyDownload: Boolean(definition?.heavyDownload),
    available: Boolean(definition?.available),
  };
}

function blocked(analysisId, reasons, requiredConfirmation = []) {
  return candidate(analysisId, {
    status: ANALYSIS_METHOD_STATUS.BLOCKED,
    reasons,
    requiredConfirmation,
  });
}

function baseResult({ intent, design, outcome, diagnostics, status, reasons = [], requiredConfirmation = [], candidates = [] }) {
  return {
    intent,
    design,
    outcome,
    diagnostics,
    status,
    reasons,
    requiredConfirmation,
    candidates,
  };
}

function hasUsableRegressionRows(diagnostics) {
  // 절편 + predictor 수보다 관측이 많아야 최소한의 잔차 자유도가 생긴다.
  return diagnostics.validN > diagnostics.predictorCount + 1;
}

function routeAssociation({ outcome, diagnostics, design }) {
  if (design === ANALYSIS_DESIGN.TIME_SERIES) {
    return baseResult({
      intent: ANALYSIS_INTENT.ASSOCIATION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["time_series_transformation_required"],
      candidates: [blocked(ANALYSIS_METHOD_IDS.PEARSON_CORRELATION, ["raw_time_series_correlation_not_allowed"])],
    });
  }
  if (diagnostics.validN < 3) {
    return baseResult({
      intent: ANALYSIS_INTENT.ASSOCIATION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["insufficient_observations"],
      candidates: [blocked(ANALYSIS_METHOD_IDS.PEARSON_CORRELATION, ["minimum_three_paired_observations_required"])],
    });
  }
  return baseResult({
    intent: ANALYSIS_INTENT.ASSOCIATION,
    design,
    outcome,
    diagnostics,
    status: ANALYSIS_METHOD_STATUS.READY,
    candidates: [
      candidate(ANALYSIS_METHOD_IDS.PEARSON_CORRELATION, {
        reasons: ["numeric_association_requested"],
      }),
      candidate(ANALYSIS_METHOD_IDS.SPEARMAN_CORRELATION, {
        role: "sensitivity",
        reasons: ["rank_based_robustness_check"],
      }),
    ],
  });
}

function routeGroupComparison({ outcome, diagnostics, design, hasPairId, hasClusterId, estimand }) {
  if (diagnostics.groupCount < 2) {
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["at_least_two_groups_required"],
      candidates: [],
    });
  }
  // 대응·반복·군집 표본은 Welch/Fisher의 독립성 가정을 만족하지 않는다. 현재
  // registry에 맞는 공용 엔진이 없으면 "가까운" 독립 방법으로 바꾸지 않는다.
  if (design === ANALYSIS_DESIGN.PAIRED && !hasPairId) {
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["pair_id_required"],
      requiredConfirmation: ["pairId"],
      candidates: [blocked(ANALYSIS_METHOD_IDS.PAIRED_T_TEST, ["pair_id_required"], ["pairId"])],
    });
  }
  if (design === ANALYSIS_DESIGN.PAIRED) {
    if (diagnostics.groupCount !== 2) {
      return baseResult({
        intent: ANALYSIS_INTENT.GROUP_COMPARISON,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.BLOCKED,
        reasons: ["paired_comparison_requires_two_conditions"],
        candidates: [],
      });
    }
    if (outcome.kind === "continuous" && !KNOWN_ESTIMANDS.has(estimand)) {
      return baseResult({
        intent: ANALYSIS_INTENT.GROUP_COMPARISON,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.CAUTION,
        reasons: ["comparison_estimand_required"],
        requiredConfirmation: ["estimand"],
        candidates: [],
      });
    }
    const analysisId = estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE
      ? ANALYSIS_METHOD_IDS.PAIRED_T_TEST : estimand === ANALYSIS_ESTIMAND.RANK_DISTRIBUTION
        ? ANALYSIS_METHOD_IDS.WILCOXON_SIGNED_RANK : null;
    if (analysisId && getAnalysisMethodDefinition(analysisId)?.available) {
      return baseResult({
        intent: ANALYSIS_INTENT.GROUP_COMPARISON,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.READY,
        candidates: [candidate(analysisId, { reasons: ["paired_design_with_pair_id"] })],
      });
    }
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["paired_engine_not_registered"],
      candidates: [blocked(ANALYSIS_METHOD_IDS.PAIRED_T_TEST, ["paired_engine_not_registered"])],
    });
  }
  if (design === ANALYSIS_DESIGN.CLUSTERED || design === ANALYSIS_DESIGN.REPEATED) {
    const reasons = hasClusterId ? ["clustered_group_comparison_engine_not_registered"] : ["cluster_id_required"];
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons,
      requiredConfirmation: hasClusterId ? [] : ["clusterId"],
      candidates: [],
    });
  }
  if (outcome.kind === "binary") {
    if (diagnostics.groupCount !== 2) {
      return baseResult({
        intent: ANALYSIS_INTENT.GROUP_COMPARISON,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.BLOCKED,
        reasons: ["two_by_two_table_required"],
        candidates: [],
      });
    }
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.READY,
      candidates: [candidate(ANALYSIS_METHOD_IDS.FISHER_EXACT_2X2, {
        reasons: ["two_by_two_binary_comparison"],
      })],
    });
  }
  if (outcome.kind !== "continuous") {
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["unsupported_outcome_for_current_two_group_engine"],
      candidates: [],
    });
  }
  if (!KNOWN_ESTIMANDS.has(estimand)) {
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.CAUTION,
      reasons: ["comparison_estimand_required"],
      requiredConfirmation: ["estimand"],
      candidates: [],
    });
  }
  if (diagnostics.groupCount > 2) {
    const primary = estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE
      ? ANALYSIS_METHOD_IDS.WELCH_ANOVA : ANALYSIS_METHOD_IDS.KRUSKAL_WALLIS;
    const sensitivity = estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE
      ? ANALYSIS_METHOD_IDS.GAMES_HOWELL : ANALYSIS_METHOD_IDS.DUNN_HOLM;
    return baseResult({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.READY,
      candidates: [
        candidate(primary, { reasons: [estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE ? "multi_group_mean_comparison" : "multi_group_rank_distribution_comparison"] }),
        candidate(sensitivity, { role: "follow_up", reasons: ["run_only_after_omnibus_test"] }),
      ],
    });
  }
  return baseResult({
    intent: ANALYSIS_INTENT.GROUP_COMPARISON,
    design,
    outcome,
    diagnostics,
    status: ANALYSIS_METHOD_STATUS.READY,
    candidates: [candidate(estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE
      ? ANALYSIS_METHOD_IDS.WELCH_T_TEST : ANALYSIS_METHOD_IDS.WILCOXON_RANK_SUM, {
      reasons: [estimand === ANALYSIS_ESTIMAND.MEAN_DIFFERENCE ? "independent_two_group_mean_comparison" : "independent_two_group_rank_distribution_comparison"],
    })],
  });
}

function regressionCandidateForOutcome(outcome) {
  if (outcome.kind === "binary") return ANALYSIS_METHOD_IDS.BINARY_LOGISTIC_REGRESSION;
  if (outcome.kind === "proportion") return ANALYSIS_METHOD_IDS.RATE_BETA_REGRESSION;
  if (outcome.kind === "count") return ANALYSIS_METHOD_IDS.COUNT_REGRESSION;
  if (outcome.kind === "continuous") return ANALYSIS_METHOD_IDS.GAUSSIAN_OLS;
  return null;
}

function routeRegression({ outcome, diagnostics, design, hasClusterId }) {
  if (design === ANALYSIS_DESIGN.TIME_SERIES) {
    return baseResult({
      intent: ANALYSIS_INTENT.REGRESSION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["time_series_model_required"],
      candidates: [],
    });
  }
  if (!hasUsableRegressionRows(diagnostics)) {
    return baseResult({
      intent: ANALYSIS_INTENT.REGRESSION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["insufficient_degrees_of_freedom"],
      candidates: [],
    });
  }
  if (design === ANALYSIS_DESIGN.PAIRED) {
    return baseResult({
      intent: ANALYSIS_INTENT.REGRESSION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["paired_regression_engine_not_registered"],
      candidates: [],
    });
  }
  if (design === ANALYSIS_DESIGN.CLUSTERED || design === ANALYSIS_DESIGN.REPEATED) {
    if (!hasClusterId) {
      return baseResult({
        intent: ANALYSIS_INTENT.REGRESSION,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.BLOCKED,
        reasons: ["cluster_id_required"],
        requiredConfirmation: ["clusterId"],
        candidates: [blocked(ANALYSIS_METHOD_IDS.MIXED_MODEL, ["cluster_id_required"], ["clusterId"])],
      });
    }
    const definition = getWebRAnalysisDefinition(ANALYSIS_METHOD_IDS.MIXED_MODEL);
    const enoughClusters = diagnostics.clusterCount >= definition.minGroups
      && diagnostics.repeatedClusterCount >= 2;
    if (outcome.kind !== "continuous" || !enoughClusters) {
      return baseResult({
        intent: ANALYSIS_INTENT.REGRESSION,
        design,
        outcome,
        diagnostics,
        status: ANALYSIS_METHOD_STATUS.BLOCKED,
        reasons: [outcome.kind !== "continuous" ? "mixed_family_not_registered" : "insufficient_repeated_clusters"],
        candidates: [blocked(ANALYSIS_METHOD_IDS.MIXED_MODEL, [outcome.kind !== "continuous" ? "mixed_family_not_registered" : "insufficient_repeated_clusters"])],
      });
    }
    return baseResult({
      intent: ANALYSIS_INTENT.REGRESSION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.READY,
      candidates: [candidate(ANALYSIS_METHOD_IDS.MIXED_MODEL, {
        reasons: ["declared_repeated_or_clustered_design"],
      })],
    });
  }
  const analysisId = regressionCandidateForOutcome(outcome);
  if (!analysisId) {
    return baseResult({
      intent: ANALYSIS_INTENT.REGRESSION,
      design,
      outcome,
      diagnostics,
      status: ANALYSIS_METHOD_STATUS.ABSTAIN,
      reasons: ["outcome_scale_not_identified"],
      candidates: [],
    });
  }
  const reasons = [outcome.reason || `${outcome.kind}_outcome`];
  const candidateStatus = outcome.kind === "proportion" && outcome.hasBoundary
    ? ANALYSIS_METHOD_STATUS.CAUTION : ANALYSIS_METHOD_STATUS.READY;
  if (outcome.kind === "proportion" && outcome.hasBoundary) reasons.push("boundary_adjustment_required");
  return baseResult({
    intent: ANALYSIS_INTENT.REGRESSION,
    design,
    outcome,
    diagnostics,
    status: candidateStatus,
    reasons: candidateStatus === ANALYSIS_METHOD_STATUS.CAUTION ? ["boundary_adjustment_required"] : [],
    candidates: [candidate(analysisId, { status: candidateStatus, reasons })],
  });
}

/**
 * Canonical role/profile → eligible analysis candidates.
 *
 * `toolId` is intentionally absent: identical profiled data must produce the
 * same candidate set regardless of the upload entry point. Tool eligibility,
 * navigation, and actual engine invocation remain separate consumers.
 */
export function routeAnalysisMethods({
  intent = null,
  estimand = null,
  outcome = {},
  design = {},
  diagnostics = {},
} = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  const normalizedDiagnostics = normalizeDiagnostics(diagnostics, normalizedOutcome);
  const designKind = design?.design || null;
  const hasPairId = Boolean(design?.pairId);
  const hasClusterId = Boolean(design?.clusterId);

  if (!KNOWN_INTENTS.has(intent)) {
    return baseResult({
      intent,
      design: designKind,
      outcome: normalizedOutcome,
      diagnostics: normalizedDiagnostics,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
      reasons: ["analysis_intent_required"],
      requiredConfirmation: ["intent"],
    });
  }
  if (!KNOWN_DESIGNS.has(designKind)) {
    return baseResult({
      intent,
      design: designKind,
      outcome: normalizedOutcome,
      diagnostics: normalizedDiagnostics,
      status: ANALYSIS_METHOD_STATUS.CAUTION,
      reasons: ["design_declaration_required"],
      requiredConfirmation: ["design"],
    });
  }
  if (!normalizedOutcome.kind || normalizedOutcome.kind === "degenerate") {
    return baseResult({
      intent,
      design: designKind,
      outcome: normalizedOutcome,
      diagnostics: normalizedDiagnostics,
      status: ANALYSIS_METHOD_STATUS.ABSTAIN,
      reasons: [normalizedOutcome.reason || "outcome_scale_not_identified"],
    });
  }
  if (intent === ANALYSIS_INTENT.ASSOCIATION) {
    return routeAssociation({ outcome: normalizedOutcome, diagnostics: normalizedDiagnostics, design: designKind });
  }
  if (intent === ANALYSIS_INTENT.GROUP_COMPARISON) {
    return routeGroupComparison({
      outcome: normalizedOutcome,
      diagnostics: normalizedDiagnostics,
      design: designKind,
      hasPairId,
      hasClusterId,
      estimand,
    });
  }
  return routeRegression({ outcome: normalizedOutcome, diagnostics: normalizedDiagnostics, design: designKind, hasClusterId });
}
