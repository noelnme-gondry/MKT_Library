import { describe, expect, it } from "vitest";
import { ANALYSIS_CONTRACTS, evaluateEligibility, formatEligibilityBlocker, rankRecommendedAnalyses } from "./evaluateEligibility";
import { RESPONSE_SUBTOOL_IDS } from "@/lib/responseSubtoolContent";
import { ROUTES, isRoutePublished } from "@/lib/routeMap";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";

const isoDay = (index) => new Date(Date.UTC(2026, 6, index + 1)).toISOString().slice(0, 10);
const canonicalData = {
  records: Array.from({ length: 24 }, (_, index) => ({
    date: isoDay(index),
    dimensions: { channel: index % 2 ? "Meta" : "Google" },
    metrics: { cost: 100 + index, installs: 10 + (index % 4) },
  })),
};

function mmmData(weeks) {
  return {
    records: Array.from({ length: weeks }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, 1 + index * 7)).toISOString().slice(0, 10),
      dimensions: {},
      metrics: {
        mmm_reg: 100 + index,
        ch_google_roi: 200 + (index % 5) * 80,
        ch_meta: 160 + ((index * 3) % 7) * 55,
      },
    })),
  };
}

function efficiencyPanel(days, rowsForDay) {
  return {
    records: Array.from({ length: days }, (_, day) => rowsForDay(day)).flat(),
  };
}

describe("analysis eligibility", () => {
  it("blocks a tool when required concepts are missing", () => {
    const result = evaluateEligibility({ toolId: "5-2", mapping: { Date: "date", Spend: "cost" }, canonicalData });
    expect(result).toMatchObject({ status: "blocked" });
    expect(result.reasons[0]).toContain("installs/actions");
    expect(formatEligibilityBlocker(result, "ko")).toContain("CSV 매핑");
    expect(formatEligibilityBlocker(result, "en")).toContain("Map these required fields");
  });

  it("marks enough time series data as ready", () => {
    const result = evaluateEligibility({ toolId: "5-22", mapping: { Date: "date", Spend: "cost", Channel: "channel", Installs: "installs" }, canonicalData });
    expect(result).toMatchObject({ status: "ready", periodCount: 24 });
  });

  it("ranks ready analyses before caution", () => {
    expect(rankRecommendedAnalyses([{ status: "caution", priority: 1 }, { status: "ready", priority: 4 }])[0].status).toBe("ready");
  });

  it("recognizes a search-term report and prioritizes ASA actions over generic analysis", () => {
    const asa = evaluateEligibility({
      toolId: "5-26",
      mapping: { Date: "date", SearchTerm: "search_term", Cost: "cost", Taps: "clicks", Installs: "installs" },
      canonicalData: {
        records: [{
          date: "2026-08-01",
          dimensions: { search_term: "가계부" },
          metrics: { cost: 4000, clicks: 250, installs: 42 },
        }],
      },
    });
    expect(asa).toMatchObject({ status: "ready", recommendationScore: 120 });
    expect(asa.recommendationReason).toContain("Exact 승격 후보");
    expect(rankRecommendedAnalyses([
      { status: "ready", priority: 1, recommendationScore: 0 },
      asa,
    ])[0].toolId).toBe("5-26");
  });

  it("recognizes a creative report and prioritizes fatigue analysis", () => {
    const creative = evaluateEligibility({
      toolId: "9-6",
      mapping: { Creative: "creative_id", Date: "date", Channel: "channel", Impressions: "impressions", Clicks: "clicks", Installs: "installs", Spend: "spend" },
      canonicalData: efficiencyPanel(8, (day) => [{
        date: isoDay(day),
        dimensions: { creative_id: "cr_a", channel: "Meta" },
        metrics: { impressions: 1000 + day * 30, clicks: 30 - day, installs: 5, spend: 300 + day * 5 },
      }]),
    });
    expect(creative).toMatchObject({ status: "ready", recommendationScore: 110 });
    expect(creative.recommendationReason).toContain("소재별 노출");
  });

  it("accepts the store-specific source axis after a real store-console mapping", () => {
    const headers = ["Date", "Source Type", "Product Page Views", "Total Downloads"];
    const mapping = { Date: "date", "Source Type": "store_source", "Product Page Views": "product_page_views", "Total Downloads": "installs" };
    const raw = Array.from({ length: 4 }, (_, day) => ["App Store Search", "App Store Browse"].map((storeSource, index) => ({
      Date: isoDay(day),
      "Source Type": storeSource,
      "Product Page Views": String(1000 + day * 20 + index * 100),
      "Total Downloads": String(300 + day * 5 + index * 20),
    }))).flat();
    const canonicalData = buildCanonicalDataset({ raw, headers, mapping });
    const result = evaluateEligibility({
      toolId: "5-27",
      mapping,
      canonicalData,
    });
    expect(canonicalData.records[0].dimensions.store_source).toBe("App Store Search");
    expect(result).toMatchObject({ status: "ready", periodCount: 4 });
    expect(result.entityCoverage.entities).toHaveLength(2);
  });

  it("offers VIF when channel spend has enough independent periods", () => {
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: efficiencyPanel(8, (day) => ["Google", "Meta"].map((channel, index) => ({
        date: isoDay(day),
        dimensions: { channel },
        metrics: { cost: 100 + day * (index + 1) },
      }))),
    });
    expect(vif).toMatchObject({ status: "ready", periodCount: 8 });
    expect(vif.recommendationReason).toContain("MMM 전에 중복 움직임");
  });

  it("blocks a required automatic mapping that still needs confirmation", () => {
    const result = evaluateEligibility({
      toolId: "5-2",
      mapping: { 일자: "date", 광고비: "cost", 성과: "installs" },
      canonicalData: efficiencyPanel(2, (day) => [{
        date: isoDay(day), dimensions: {}, metrics: { cost: 100, installs: 10 },
      }]),
      mappingContract: {
        conflicts: [],
        assessments: [{ header: "성과", field: "installs", state: "must_confirm" }],
      },
    });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({ code: "mapping_confirmation" });
    expect(formatEligibilityBlocker(result, "ko")).toContain("자동 매핑을 확인");
  });

  it("blocks VIF when dates do not exceed the channel count by three", () => {
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: efficiencyPanel(5, (day) => ["A", "B", "C"].map((channel) => ({
        date: isoDay(day), dimensions: { channel }, metrics: { cost: 100 + day },
      }))),
    });
    expect(vif).toMatchObject({ status: "blocked" });
    expect(vif.reasons.join(" ")).toContain("최소 6개 기간");
  });

  it("reports the shared VIF period threshold only once", () => {
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: efficiencyPanel(4, (day) => ["Google", "Meta", "Apple"].map((channel) => ({
        date: isoDay(day), dimensions: { channel }, metrics: { cost: 100 + day },
      }))),
    });
    expect(vif.blockers.filter((blocker) => blocker.code === "min_periods")).toEqual([
      { code: "min_periods", required: 6, current: 4 },
    ]);
  });

  it("counts only dates with a valid VIF entity and spend", () => {
    const validDates = efficiencyPanel(4, (day) => ["Google", "Meta"].map((channel, index) => ({
      date: isoDay(day), dimensions: { channel }, metrics: { cost: 100 + day * (index + 1) },
    }))).records;
    const invalidEntityDate = [0, 1].map((index) => ({
      date: isoDay(4), dimensions: { channel: "" }, metrics: { cost: 300 + index },
    }));
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: { records: [...validDates, ...invalidEntityDate] },
    });
    expect(vif).toMatchObject({ status: "blocked", periodCount: 4 });
    expect(vif.blockers).toContainEqual({ code: "min_periods", required: 5, current: 4 });
  });

  it("does not let an entity with blank spend raise the VIF period threshold", () => {
    const records = efficiencyPanel(5, (day) => [
      { date: isoDay(day), dimensions: { channel: "A" }, metrics: { cost: 100 + day } },
      { date: isoDay(day), dimensions: { channel: "B" }, metrics: { cost: 200 + day * 2 } },
      { date: isoDay(day), dimensions: { channel: "Blank" }, metrics: { cost: null } },
    ]).records;
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: { records },
    });
    expect(vif.status).not.toBe("blocked");
    expect(vif.periodCount).toBe(5);
    expect(vif.blockers.filter((blocker) => blocker.code === "min_periods")).toEqual([]);
  });

  it("blocks VIF when fewer than two spend columns vary over time", () => {
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: efficiencyPanel(8, (day) => ["Google", "Meta"].map((channel) => ({
        date: isoDay(day), dimensions: { channel }, metrics: { cost: 100 },
      }))),
    });
    expect(vif.status).toBe("blocked");
    expect(vif.blockers).toContainEqual({ code: "insufficient_variation", required: 2, current: 0 });
    expect(formatEligibilityBlocker(vif, "en")).toContain("must vary over time");
  });

  it("blocks VIF for a single channel instead of offering an unusable result", () => {
    const vif = evaluateEligibility({
      toolId: "5-25",
      mapping: { Date: "date", Channel: "channel", Cost: "cost" },
      canonicalData: efficiencyPanel(10, (day) => [{
        date: isoDay(day), dimensions: { channel: "Google" }, metrics: { cost: 100 + day },
      }]),
    });
    expect(vif).toMatchObject({ status: "blocked" });
    expect(formatEligibilityBlocker(vif, "ko")).toContain("최소 2개");
    expect(formatEligibilityBlocker(vif, "en")).toContain("at least 2");
  });

  it("uses a data-backed recommendation score within the same readiness tier", () => {
    const ranked = rankRecommendedAnalyses([
      { status: "ready", priority: 1, recommendationScore: 0 },
      { status: "ready", priority: 4, recommendationScore: 100 },
    ]);
    expect(ranked[0].recommendationScore).toBe(100);
  });

  it("keeps 12-week MMM open for exploration, not budget decisions", () => {
    const result = evaluateEligibility({
      toolId: "5-18-mmm",
      mapping: { Week: "week", Registrations: "mmm_reg", Google: "ch_google_roi", Meta: "ch_meta" },
      canonicalData: mmmData(12),
    });
    expect(result).toMatchObject({ status: "caution", confidenceTier: "exploratory" });
    expect(result.reasonDetails.join(" ")).toContain("52주 미만");
  });

  it("marks a 52-week independent MMM panel as decision-ready", () => {
    const result = evaluateEligibility({
      toolId: "5-18-mmm",
      mapping: { Week: "week", Registrations: "mmm_reg", Google: "ch_google_roi", Meta: "ch_meta" },
      canonicalData: mmmData(52),
    });
    expect(result).toMatchObject({ status: "ready", confidenceTier: "decision" });
  });

  it("warns when PVM channel coverage does not span enough active dates", () => {
    const result = evaluateEligibility({
      toolId: "5-21",
      mapping: { Date: "date", Spend: "spend", Channel: "channel", Installs: "installs" },
      canonicalData: efficiencyPanel(14, (day) => [{
        date: isoDay(day), dimensions: { channel: "Google" }, metrics: { spend: day < 7 ? 100 : 0, installs: day < 7 ? 10 : 0 },
      }]),
    });
    expect(result).toMatchObject({ status: "caution" });
    expect(result.reasonDetails.join(" ")).toContain("운영 관측이 8기간 미만");
  });

  it("accepts standard cost as the PVM spend input", () => {
    const result = evaluateEligibility({
      toolId: "5-21",
      mapping: { Date: "date", Cost: "cost", Channel: "channel", Installs: "installs" },
      canonicalData,
    });
    expect(result).toMatchObject({ status: "ready" });
    expect(result.recommendationReason).toContain("최근 성과 변화의 원인");
  });

  it("warns when saturation data has no meaningful spend variation", () => {
    const result = evaluateEligibility({
      toolId: "5-22",
      mapping: { Date: "date", Cost: "cost", Channel: "channel", Installs: "installs" },
      canonicalData: efficiencyPanel(10, (day) => ["Google", "Meta"].map((channel) => ({
        date: isoDay(day), dimensions: { channel }, metrics: { cost: 100, installs: 10 + (day % 2) },
      }))),
    });
    expect(result).toMatchObject({ status: "caution" });
    expect(result.reasonDetails.join(" ")).toContain("지출 변동이 너무 작은");
  });

  it("treats duration and event episodes as a valid no-date survival dataset", () => {
    const result = evaluateEligibility({
      toolId: "5-28",
      mapping: { Duration: "tenure_periods", Event: "event_observed" },
      canonicalData: {
        summary: {},
        records: [
          { date: null, dimensions: {}, metrics: { tenure_periods: 1, event_observed: 1 } },
          { date: null, dimensions: {}, metrics: { tenure_periods: 2, event_observed: 0 } },
        ],
      },
    });

    expect(result.blockers).toEqual([]);
    expect(result).toMatchObject({ status: "ready", statisticalStatus: "READY" });
    expect(result.quality).toMatchObject({ grade: "ready", requiresDate: false, periodCount: 0 });
    expect(result.quality.issues.map((issue) => issue.code)).not.toEqual(expect.arrayContaining(["missing_date", "duplicates"]));
  });
});

// /start가 어떤 도구를 "평가조차 안 하는지"는 목록에서 빠졌다는 사실로만 드러난다.
// 실제로 5-20·9-1이 계약 없이 빠져 있었고, 5-23처럼 의도적으로 뺀 것과 구분되지
// 않았다. 목록은 ROUTES에서 파생해 대조한다 — 새 도구가 조용히 빠지지 않도록.
describe("analysis contract coverage", () => {
  const publishedToolIds = ROUTES
    .filter((route) => isRoutePublished(route) && /^(5|9)-\d+$/.test(route.id))
    .map((route) => route.id);

  it("declares a contract for every published analysis tool", () => {
    const missing = publishedToolIds.filter((id) => !ANALYSIS_CONTRACTS[id]);
    expect(missing).toEqual([]);
  });

  it("keeps every response subtool on the same uploader eligibility path as /start", () => {
    const missing = RESPONSE_SUBTOOL_IDS.filter((toolId) => !ANALYSIS_CONTRACTS[toolId]);
    expect(missing).toEqual([]);
    expect(ANALYSIS_CONTRACTS["5-18-paid-organic"]).toMatchObject({ minRows: 2, minPeriods: 2 });
    expect(ANALYSIS_CONTRACTS["5-18-forecast"]).toMatchObject({ minRows: 12, minPeriods: 12 });
  });

  it("blocks foreign-grain tools with the columns they actually need", () => {
    for (const [toolId, contract] of Object.entries(ANALYSIS_CONTRACTS)) {
      if (!contract.foreignGrain) continue;
      const result = evaluateEligibility({ toolId, mapping: {}, canonicalData, locale: "ko" });
      expect(result.status, toolId).toBe("blocked");
      const blocker = result.blockers.find((item) => item.code === "foreign_grain");
      expect(blocker, toolId).toBeTruthy();
      expect(blocker.grain, toolId).toBeTruthy();
      expect(blocker.fields.length, toolId).toBeGreaterThan(0);
      // 영어 화면에서도 같은 이유가 나와야 한다(§2.11).
      const en = evaluateEligibility({ toolId, mapping: {}, canonicalData, locale: "en" });
      expect(en.blockers.some((item) => item.code === "foreign_grain"), toolId).toBe(true);
    }
  });

  it("keeps foreign-grain tools out of the recommended list", () => {
    const foreign = Object.entries(ANALYSIS_CONTRACTS).filter(([, c]) => c.foreignGrain).map(([id]) => id);
    expect(foreign.length).toBeGreaterThan(0);
    const results = foreign.map((toolId) => evaluateEligibility({ toolId, mapping: {}, canonicalData, locale: "ko" }));
    expect(rankRecommendedAnalyses(results)).toEqual([]);
  });
});
