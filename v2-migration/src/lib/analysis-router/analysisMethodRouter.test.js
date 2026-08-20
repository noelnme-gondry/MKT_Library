import { describe, expect, it } from "vitest";
import {
  ANALYSIS_DESIGN,
  ANALYSIS_ESTIMAND,
  ANALYSIS_INTENT,
  ANALYSIS_METHOD_IDS,
  ANALYSIS_METHOD_STATUS,
  getAnalysisMethodDefinition,
  routeAnalysisMethods,
} from "./analysisMethodRouter";

const continuousOutcome = { key: "outcome_revenue", kind: "continuous", n: 24 };

describe("analysis method router", () => {
  it("keeps existing WebR metadata in the common method registry", () => {
    expect(getAnalysisMethodDefinition(ANALYSIS_METHOD_IDS.MIXED_MODEL)).toMatchObject({
      engine: "webr",
      execution: "explicit",
      heavyDownload: true,
      available: true,
    });
    expect(getAnalysisMethodDefinition(ANALYSIS_METHOD_IDS.PAIRED_T_TEST)).toMatchObject({ available: true, engine: "js" });
  });

  it("offers Pearson and Spearman together as a primary/sensitivity pair", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.ASSOCIATION,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 24 },
    });

    expect(result.candidates).toMatchObject([
      { analysisId: ANALYSIS_METHOD_IDS.PEARSON_CORRELATION, role: "primary" },
      { analysisId: ANALYSIS_METHOD_IDS.SPEARMAN_CORRELATION, role: "sensitivity" },
    ]);
  });

  it("uses a declared independent design for the existing Welch engine", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      estimand: ANALYSIS_ESTIMAND.MEAN_DIFFERENCE,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 24, groupCount: 2 },
    });

    expect(result.status).toBe(ANALYSIS_METHOD_STATUS.READY);
    expect(result.candidates).toMatchObject([{
      analysisId: ANALYSIS_METHOD_IDS.WELCH_T_TEST,
      status: ANALYSIS_METHOD_STATUS.READY,
      engine: "js",
    }]);
  });

  it("never changes a paired design into an independent comparison without pairId", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      estimand: ANALYSIS_ESTIMAND.MEAN_DIFFERENCE,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.PAIRED },
      diagnostics: { validN: 24, groupCount: 2 },
    });

    expect(result.status).toBe(ANALYSIS_METHOD_STATUS.BLOCKED);
    expect(result.requiredConfirmation).toEqual(["pairId"]);
    expect(result.candidates[0]).toMatchObject({
      analysisId: ANALYSIS_METHOD_IDS.PAIRED_T_TEST,
      status: ANALYSIS_METHOD_STATUS.BLOCKED,
    });
    expect(result.candidates.some((item) => item.analysisId === ANALYSIS_METHOD_IDS.WELCH_T_TEST)).toBe(false);
  });

  it("offers the paired engine only after pairId is declared", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      estimand: ANALYSIS_ESTIMAND.MEAN_DIFFERENCE,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.PAIRED, pairId: "market" },
      diagnostics: { validN: 24, groupCount: 2 },
    });

    expect(result.candidates).toMatchObject([{ analysisId: ANALYSIS_METHOD_IDS.PAIRED_T_TEST, status: ANALYSIS_METHOD_STATUS.READY }]);
  });

  it("never changes repeated or clustered group data into an independent Welch comparison", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      estimand: ANALYSIS_ESTIMAND.MEAN_DIFFERENCE,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.CLUSTERED, clusterId: "campaign" },
      diagnostics: { validN: 24, groupCount: 2, clusterCount: 4, repeatedClusterCount: 4 },
    });

    expect(result.status).toBe(ANALYSIS_METHOD_STATUS.BLOCKED);
    expect(result.reasons).toContain("clustered_group_comparison_engine_not_registered");
    expect(result.candidates.some((item) => item.analysisId === ANALYSIS_METHOD_IDS.WELCH_T_TEST)).toBe(false);
  });

  it("routes each supported outcome scale to the existing regression engine", () => {
    const base = {
      intent: ANALYSIS_INTENT.REGRESSION,
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 60, predictorCount: 2 },
    };

    expect(routeAnalysisMethods({ ...base, outcome: { values: [0, 1, 0, 1, 1, 0] } }).candidates[0].analysisId)
      .toBe(ANALYSIS_METHOD_IDS.BINARY_LOGISTIC_REGRESSION);
    expect(routeAnalysisMethods({ ...base, outcome: { values: [0.1, 0.2, 0.7, 0.4] } }).candidates[0].analysisId)
      .toBe(ANALYSIS_METHOD_IDS.RATE_BETA_REGRESSION);
    expect(routeAnalysisMethods({ ...base, outcome: { values: [0, 2, 4, 1, 8, 3] } }).candidates[0].analysisId)
      .toBe(ANALYSIS_METHOD_IDS.COUNT_REGRESSION);
    expect(routeAnalysisMethods({ ...base, outcome: { values: [-1.2, 0.5, 3.1, 6.4] } }).candidates[0].analysisId)
      .toBe(ANALYSIS_METHOD_IDS.GAUSSIAN_OLS);
  });

  it("keeps mean and rank estimands distinct for two and three independent groups", () => {
    const base = {
      intent: ANALYSIS_INTENT.GROUP_COMPARISON,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
    };
    expect(routeAnalysisMethods({ ...base, estimand: ANALYSIS_ESTIMAND.RANK_DISTRIBUTION, diagnostics: { validN: 24, groupCount: 2 } }).candidates[0].analysisId)
      .toBe(ANALYSIS_METHOD_IDS.WILCOXON_RANK_SUM);
    expect(routeAnalysisMethods({ ...base, estimand: ANALYSIS_ESTIMAND.MEAN_DIFFERENCE, diagnostics: { validN: 24, groupCount: 3 } }).candidates.map((item) => item.analysisId))
      .toEqual([ANALYSIS_METHOD_IDS.WELCH_ANOVA, ANALYSIS_METHOD_IDS.GAMES_HOWELL]);
    const rankMulti = routeAnalysisMethods({ ...base, estimand: ANALYSIS_ESTIMAND.RANK_DISTRIBUTION, diagnostics: { validN: 24, groupCount: 3 } });
    expect(rankMulti.candidates.map((item) => item.analysisId)).toEqual([ANALYSIS_METHOD_IDS.KRUSKAL_WALLIS, ANALYSIS_METHOD_IDS.DUNN_HOLM]);
  });

  it("keeps proportion boundary adjustment visible and WebR execution explicit", () => {
    const result = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: { values: [0, 0.2, 0.7, 1] },
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 40, predictorCount: 1 },
    });

    expect(result.status).toBe(ANALYSIS_METHOD_STATUS.CAUTION);
    expect(result.candidates[0]).toMatchObject({
      analysisId: ANALYSIS_METHOD_IDS.RATE_BETA_REGRESSION,
      status: ANALYSIS_METHOD_STATUS.CAUTION,
      execution: "explicit",
      reasons: expect.arrayContaining(["boundary_adjustment_required"]),
    });
  });

  it("only offers the heavy mixed-model path for declared, sufficiently repeated clusters", () => {
    const base = {
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.CLUSTERED },
      diagnostics: { validN: 60, predictorCount: 2, clusterCount: 5, repeatedClusterCount: 4 },
    };
    const missingId = routeAnalysisMethods(base);
    expect(missingId.status).toBe(ANALYSIS_METHOD_STATUS.BLOCKED);
    expect(missingId.requiredConfirmation).toEqual(["clusterId"]);

    const ready = routeAnalysisMethods({ ...base, design: { ...base.design, clusterId: "creative" } });
    expect(ready.candidates).toMatchObject([{
      analysisId: ANALYSIS_METHOD_IDS.MIXED_MODEL,
      status: ANALYSIS_METHOD_STATUS.READY,
      execution: "explicit",
      heavyDownload: true,
    }]);
  });

  it("blocks raw time-series correlation and regression instead of treating rows as independent", () => {
    const association = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.ASSOCIATION,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.TIME_SERIES, timeKey: "week" },
      diagnostics: { validN: 24 },
    });
    const regression = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: continuousOutcome,
      design: { design: ANALYSIS_DESIGN.TIME_SERIES, timeKey: "week" },
      diagnostics: { validN: 24, predictorCount: 2 },
    });

    expect(association.reasons).toContain("time_series_transformation_required");
    expect(regression.reasons).toContain("time_series_model_required");
  });

  it("abstains for a degenerate outcome and requires an explicit design declaration", () => {
    const abstain = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: { values: [5, 5, 5] },
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 3, predictorCount: 1 },
    });
    const undeclaredDesign = routeAnalysisMethods({
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: continuousOutcome,
      diagnostics: { validN: 24, predictorCount: 1 },
    });

    expect(abstain.status).toBe(ANALYSIS_METHOD_STATUS.ABSTAIN);
    expect(undeclaredDesign.status).toBe(ANALYSIS_METHOD_STATUS.CAUTION);
    expect(undeclaredDesign.requiredConfirmation).toEqual(["design"]);
  });

  it("is tool-entry independent because it only consumes canonical profile data", () => {
    const input = {
      intent: ANALYSIS_INTENT.REGRESSION,
      outcome: { key: "outcome_installs", values: [0, 1, 3, 2, 5, 8] },
      design: { design: ANALYSIS_DESIGN.INDEPENDENT },
      diagnostics: { validN: 48, predictorCount: 2 },
    };

    expect(routeAnalysisMethods(input)).toEqual(routeAnalysisMethods({ ...input, toolId: "5-2" }));
  });
});
