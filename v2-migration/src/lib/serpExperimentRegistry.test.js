import { describe, expect, it } from "vitest";
import { getTermBySlug } from "@/lib/glossary";
import {
  SERP_EXPERIMENT_POLICY,
  SERP_TITLE_EXPERIMENTS,
  baselineDays,
  evaluateSerpExperiment,
  serpExperimentById,
} from "@/lib/serpExperimentRegistry";

describe("SERP title experiment registry", () => {
  it("현재 검색 제목을 control로 고정하고 후보만 따로 보관한다", () => {
    for (const experiment of SERP_TITLE_EXPERIMENTS) {
      const term = getTermBySlug(experiment.slug, experiment.locale);
      expect(term?.seoTitle).toBe(experiment.controlTitle);
      expect(experiment.candidateTitle).not.toBe(experiment.controlTitle);
      expect(experiment.candidateTitle.length).toBeLessThanOrEqual(30);
      expect(experiment.status).toBe("collecting_baseline");
    }
  });

  it("현재 7일·소량 표본 같은 입력은 실험을 열지 않는다", () => {
    const experiment = SERP_TITLE_EXPERIMENTS[0];
    const decision = evaluateSerpExperiment(experiment, {
      start: "2026-08-26",
      end: "2026-09-01",
      impressions: 50,
      averagePosition: 7.5,
    });

    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(["BASELINE_TOO_SHORT", "IMPRESSIONS_TOO_LOW"]));
  });

  it("순위가 너무 낮으면 노출이 많아도 제목 CTR 실험으로 오진하지 않는다", () => {
    const decision = evaluateSerpExperiment(SERP_TITLE_EXPERIMENTS[0], {
      start: "2026-08-26",
      end: "2026-09-22",
      impressions: 500,
      averagePosition: 32,
    });

    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain("POSITION_OUTSIDE_CTR_BAND");
  });

  it("콘텐츠 변경 뒤의 28일·충분한 노출·4~10위에서 제목 하나만 바꿀 때 열린다", () => {
    const decision = evaluateSerpExperiment(SERP_TITLE_EXPERIMENTS[1], {
      start: "2026-08-26",
      end: "2026-09-22",
      impressions: SERP_EXPERIMENT_POLICY.minimumImpressions,
      averagePosition: 8.2,
    });

    expect(decision).toEqual({ eligible: true, reasons: [], baselineDays: 28 });
  });

  it("변경 이전 표본이나 둘 이상의 변수 변경은 차단한다", () => {
    const experiment = { ...SERP_TITLE_EXPERIMENTS[0], changedFields: ["title", "description"] };
    const decision = evaluateSerpExperiment(experiment, {
      start: "2026-07-29",
      end: "2026-08-25",
      impressions: 120,
      averagePosition: 7,
    });

    expect(decision.reasons).toEqual(expect.arrayContaining(["BASELINE_PREDATES_CONTENT_CHANGE", "MULTIPLE_VARIABLES"]));
  });

  it("날짜와 id 경계가 결정론적이다", () => {
    expect(baselineDays({ start: "2026-08-26", end: "2026-09-22" })).toBe(28);
    expect(baselineDays({ start: "bad", end: "2026-09-22" })).toBe(0);
    expect(serpExperimentById("ko-glossary-uplift-title")?.slug).toBe("uplift");
    expect(serpExperimentById("missing")).toBeNull();
  });
});
