import { describe, expect, it } from "vitest";

import { kaplanMeier, normalizeSurvivalRows } from "@/utils/subscriptionSurvivalMath";
import { validateAnalysisResult } from "./analysisResultContract";
import { runSubscriptionAnalysis, SUBSCRIPTION_ANALYSIS_TOOL_IDS, subscriptionAdapterFor } from "./subscriptionAnalysisAdapters";

const raw = Array.from({ length: 12 }, (_, index) => ({
  Tenure: String(index + 1),
  Churned: index % 3 === 1 ? "1" : "0",
}));
const csvData = {
  raw,
  mapping: { Tenure: "tenure_periods", Churned: "event_observed" },
  fileName: "subscriptions.csv",
};
const signatures = { inputSignature: "input-v1", mappingSignature: "mapping-v1" };

describe("Dochi action-survival adapter", () => {
  it("registers the independent 5-28 baseline adapter", () => {
    expect(SUBSCRIPTION_ANALYSIS_TOOL_IDS).toEqual(["5-28"]);
    expect(subscriptionAdapterFor("5-28")).toBeTruthy();
    expect(subscriptionAdapterFor("5-21")).toBeNull();
  });

  it("keeps the survival curve aligned with the existing Kaplan–Meier engine", () => {
    const result = runSubscriptionAnalysis({ toolId: "5-28", csvData, ...signatures });
    const expected = kaplanMeier(normalizeSurvivalRows(raw.map((row) => ({
      tenure_periods: row.Tenure,
      event_observed: row.Churned,
    }))).validRows);
    expect(result.status).toBe("success");
    expect(result.visualizations).toHaveLength(2);
    expect(result.visualizations[0].data.map((point) => point.survival)).toEqual(expected.map((point) => point.survival));
    expect(validateAnalysisResult(result)).toEqual({ valid: true, errors: [] });
    expect(result.manifest).not.toHaveProperty("raw");
    expect(result.manifest).not.toHaveProperty("rows");
    expect(result.manifest).not.toHaveProperty("headers");
  });

  it("withholds a survival estimate when no exit event is observed", () => {
    const result = runSubscriptionAnalysis({
      toolId: "5-28",
      csvData: { ...csvData, raw: raw.map((row) => ({ ...row, Churned: "0" })) },
      ...signatures,
    });
    expect(result.status).toBe("not_computable");
    expect(result.verdict.evidenceState).toBe("not_computable");
    expect(result.visualizations).toEqual([]);
  });

  it("accepts generic action duration and dropout aliases", () => {
    const result = runSubscriptionAnalysis({
      toolId: "5-28",
      csvData: {
        ...csvData,
        raw: [
          { "Action Survival Duration": "3", "Dropout Observed": "1" },
          { "Action Survival Duration": "5", "Dropout Observed": "0" },
        ],
        mapping: { "Action Survival Duration": "tenure_periods", "Dropout Observed": "event_observed" },
      },
      ...signatures,
    });
    expect(result.status).toBe("success");
    expect(result.verdict.headline).toMatch(/action survival|생존/i);
  });
});
