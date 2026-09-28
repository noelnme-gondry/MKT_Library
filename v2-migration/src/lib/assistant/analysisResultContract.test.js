import { describe, expect, it } from "vitest";

import { createAnalysisResult, validateAnalysisResult } from "./analysisResultContract";

const base = {
  toolId: "5-2",
  status: "success",
  inputSignature: "input-v1",
  mappingSignature: "mapping-v1",
  verdict: { evidenceState: "descriptive", headline: "성과를 확인할 수 있습니다.", stats: [{ id: "cpa", label: "CPA", value: 12, unit: "KRW" }] },
  manifest: { toolId: "5-2", methodId: "dashboard" },
};

describe("Dochi result contract", () => {
  it("returns serializable chart data rather than a component or Chart instance", () => {
    const result = createAnalysisResult({ ...base, visualizations: [{ id: "trend", kind: "line", question: "추이는?", data: { labels: ["2026-01-01"], values: [12] } }] });
    expect(JSON.parse(JSON.stringify(result)).visualizations[0].kind).toBe("line");
  });

  it("rejects manifests that copy original rows or headers", () => {
    const validation = validateAnalysisResult({ ...base, visualizations: [], manifest: { raw: [{ secret: 1 }] } });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("manifest.private_data");
  });

  it("names a representative stat only when that stat exists", () => {
    expect(createAnalysisResult({ ...base, verdict: { ...base.verdict, primaryStatId: "cpa" } }).verdict.primaryStatId).toBe("cpa");
    expect(createAnalysisResult(base).verdict.primaryStatId).toBeNull();
    // 없는 수치를 대표값으로 가리키면 목록이 빈 칸을 그린다 — 계약에서 막는다.
    expect(() => createAnalysisResult({ ...base, verdict: { ...base.verdict, primaryStatId: "roas" } })).toThrow(/primaryStatId/);
  });

  it("points a next step only at another analysis", () => {
    expect(createAnalysisResult({ ...base, verdict: { ...base.verdict, nextToolId: "5-21" } }).verdict.nextToolId).toBe("5-21");
    expect(() => createAnalysisResult({ ...base, verdict: { ...base.verdict, nextToolId: "5-2" } })).toThrow(/nextToolId/);
  });

  it("does not permit an unknown result state to look complete", () => {
    expect(() => createAnalysisResult({ ...base, status: "ready" })).toThrow(/status/);
  });
});
