import { describe, expect, it } from "vitest";
import { ANALYSIS_STATUS, analysisStatusLabel, deriveAnalysisStatus } from "./analysisStatus";

describe("deriveAnalysisStatus", () => {
  it("prioritizes active work and failures", () => {
    expect(deriveAnalysisStatus({ hasData: true, hasRequiredMapping: true, isAnalyzing: true, error: new Error("x") })).toBe(ANALYSIS_STATUS.ANALYZING);
    expect(deriveAnalysisStatus({ hasData: true, hasRequiredMapping: true, error: new Error("x") })).toBe(ANALYSIS_STATUS.FAILED);
  });

  it("distinguishes empty, blocked, stale, and complete", () => {
    expect(deriveAnalysisStatus()).toBe(ANALYSIS_STATUS.EMPTY);
    expect(deriveAnalysisStatus({ hasData: true })).toBe(ANALYSIS_STATUS.BLOCKED);
    expect(deriveAnalysisStatus({ hasData: true, hasRequiredMapping: true })).toBe(ANALYSIS_STATUS.READY);
    expect(deriveAnalysisStatus({ hasData: true, hasRequiredMapping: true, isAnalyzed: true, isStale: true })).toBe(ANALYSIS_STATUS.STALE);
    expect(deriveAnalysisStatus({ hasData: true, hasRequiredMapping: true, isAnalyzed: true })).toBe(ANALYSIS_STATUS.COMPLETE);
  });

  it("localizes labels without changing status", () => {
    expect(analysisStatusLabel(ANALYSIS_STATUS.STALE, "ko")).toBe("재분석 필요");
    expect(analysisStatusLabel(ANALYSIS_STATUS.STALE, "en")).toBe("Re-analysis needed");
  });
});
