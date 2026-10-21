import { describe, expect, it } from "vitest";
import { decisionReviewFollowUpMode, normalizeDecisionReviewRows, serializeDecisionReviewCsv, sanitizeDecisionReviewRecord } from "@/lib/decisionReview";
import Papa from "papaparse";
import { actualForPlan, createAllocationPlanSnapshot, findAllocationPlanMatches, plannerDowngradeUnits, planReviewText, reviewAllocationPlan } from "./planReview";
import { allocationPlanEnd, parseAllocationPlan, serializeAllocationPlan } from "./planSnapshot";
import { addDays } from "./plannerStats";

const PLAN = {
  start: "2026-09-01",
  days: 7,
  metric: "installs",
  unitField: "channel",
  byPlatform: true,
  targets: [
    { unit: "KR · Meta · iOS", cost: 7000, results: 70 },
    { unit: "KR · TikTok; \"A|B\" · iOS", cost: 7000, results: 35 },
  ],
};

function rowsFor({ from = "2026-08-25", to = "2026-09-08", meta = [1000, 10], tiktok = [1000, 5] } = {}) {
  const rows = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    rows.push({ date, country: "KR", channel: "Meta", platform: "iOS", cost: String(meta[0]), installs: String(meta[1]) });
    rows.push({ date, country: "KR", channel: "TikTok; \"A|B\"", platform: "iOS", cost: String(tiktok[0]), installs: String(tiktok[1]) });
    rows.push({ date, country: "US", channel: "Meta", platform: "iOS", cost: "999", installs: "1" });
  }
  return rows;
}

describe("배분안 스냅샷 직렬화", () => {
  it("구분자·따옴표가 든 이름도 왕복한다", () => {
    const text = serializeAllocationPlan(PLAN);
    expect(parseAllocationPlan(text)).toEqual({ ...PLAN, targets: [...PLAN.targets].sort((a, b) => a.unit.localeCompare(b.unit)) });
    expect(allocationPlanEnd(PLAN)).toBe("2026-09-07");
  });

  it("깨진 칸·모르는 버전·중복 대상은 일부만 살리지 않고 통째로 거절한다", () => {
    const text = serializeAllocationPlan(PLAN);
    expect(parseAllocationPlan(text.replace("v1|", "v9|"))).toBeNull();
    expect(parseAllocationPlan(`${text};broken`)).toBeNull();
    expect(parseAllocationPlan(text.replace("|7000|", "|-1|"))).toBeNull();
    expect(serializeAllocationPlan({ ...PLAN, targets: [PLAN.targets[0], PLAN.targets[0]] })).toBe("");
    expect(serializeAllocationPlan({ ...PLAN, targets: Array.from({ length: 61 }, (_, i) => ({ unit: `u${i}`, cost: 1, results: 1 })) })).toBe("");
  });

  it("결정 기록 CSV를 거쳐도 그대로 남고, 다른 비교 종류에서는 지워진다 · 후속 방식은 plan_auto", () => {
    const allocationPlan = serializeAllocationPlan(PLAN);
    const record = sanitizeDecisionReviewRecord({ id: "r1", toolId: "5-3", action: "배분안 적용", comparisonKind: "allocation_plan", allocationPlan, forecastPeriod: PLAN.start });
    expect(record.allocationPlan).toBe(allocationPlan);
    expect(decisionReviewFollowUpMode(record)).toBe("plan_auto");
    const parsed = Papa.parse(serializeDecisionReviewCsv([record]).replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" }).data;
    expect(normalizeDecisionReviewRows(parsed)[0].allocationPlan).toBe(allocationPlan);
    expect(sanitizeDecisionReviewRecord({ ...record, comparisonKind: "" }).allocationPlan).toBe("");
    expect(sanitizeDecisionReviewRecord({ ...record, allocationPlan: `${allocationPlan};x|y` }).allocationPlan).toBe("");
  });
});

describe("계획 대비 실적 대조 (spec §8.2)", () => {
  it("기간을 다 덮지 못한 CSV로는 대조하지 않는다", () => {
    const plan = parseAllocationPlan(serializeAllocationPlan(PLAN));
    expect(actualForPlan(plan, rowsFor({ to: "2026-09-06" }))).toBeNull();
    expect(actualForPlan(plan, rowsFor({ from: "2026-09-02" }))).toBeNull();
    // D7 매출은 기간 끝 + 7일까지 데이터가 있어야 한다.
    const revenue = parseAllocationPlan(serializeAllocationPlan({ ...PLAN, metric: "revenue_d7" }));
    expect(actualForPlan(revenue, rowsFor({ to: "2026-09-13" }))).toBeNull();
  });

  it("계획 대상만, 같은 단위 키로 모은다(다른 국가 행은 섞이지 않는다)", () => {
    const plan = parseAllocationPlan(serializeAllocationPlan(PLAN));
    const actual = actualForPlan(plan, rowsFor());
    expect(actual).toEqual([
      { unit: "KR · Meta · iOS", cost: 7000, results: 70 },
      { unit: "KR · TikTok; \"A|B\" · iOS", cost: 7000, results: 35 },
    ]);
  });

  it("계획대로 썼는데 TikTok 효율만 빗나가면 차이는 모형 오차, 큰 오차 대상으로 TikTok만 남는다", () => {
    const record = { id: "r1", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), reviewDate: "2026-09-08", action: "a" };
    const match = reviewAllocationPlan(record, rowsFor({ tiktok: [1000, 4] }));
    expect(match.totals).toMatchObject({ plannedCost: 14000, actualCost: 14000, plannedResults: 105 });
    expect(match.totals.actualResults).toBeCloseTo(98, 9);
    expect(match.split.execution).toBeCloseTo(0, 9);
    expect(match.split.model).toBeCloseTo(14000 / 98 - 14000 / 105, 9);
    expect(match.largeErrorUnits).toEqual(["KR · TikTok; \"A|B\" · iOS"]);
    const text = planReviewText(match, { locale: "ko", formatCpr: (v) => v.toFixed(1) });
    expect(text.actual).toContain("실제 CPI 142.9 · 계획 133.3 (+7.1%)");
    expect(text.actual).toContain("모형 오차");
    expect(text.learning).toContain("TikTok");
  });

  it("효율은 그대로인데 비싼 대상에 더 쓰면 차이는 실행 편차", () => {
    const record = { id: "r1", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), reviewDate: "2026-09-08", action: "a" };
    const match = reviewAllocationPlan(record, rowsFor({ meta: [500, 5], tiktok: [1500, 7.5] }));
    expect(match.split.model).toBeCloseTo(0, 9);
    expect(match.split.execution).toBeGreaterThan(0);
    expect(match.largeErrorUnits).toEqual([]);
    expect(planReviewText(match, { locale: "en", formatCpr: String }).actual).toContain("execution");
  });

  it("한 대상의 실제 결과가 0이어도 분해한다 — 그 대상은 큰 오차, 계획대로 썼으니 실행 편차 0", () => {
    const record = { id: "r1", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), action: "a" };
    const match = reviewAllocationPlan(record, rowsFor({ tiktok: [1000, 0] }));
    expect(match.split.execution).toBeCloseTo(0, 9);
    expect(match.split.execution + match.split.model).toBeCloseTo(14000 / 70 - 14000 / 105, 9);
    expect(match.largeErrorUnits).toEqual(["KR · TikTok; \"A|B\" · iOS"]);
  });

  it("기간 결과 합계가 0이면 분해하지 않고 그 사실을 말한다", () => {
    const record = { id: "r1", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), action: "a" };
    const match = reviewAllocationPlan(record, rowsFor({ meta: [1000, 0], tiktok: [1000, 0] }));
    expect(match.split).toBeNull();
    expect(planReviewText(match, { locale: "ko" }).actual).toContain("원인 분해 불가");
  });

  it("이미 실제값을 적은 기록·다른 도구 기록은 후보에서 빠진다", () => {
    const base = { toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), action: "a" };
    const records = [{ ...base, id: "todo" }, { ...base, id: "done", actual: "기록함" }, { ...base, id: "other", toolId: "5-21" }];
    expect(findAllocationPlanMatches(records, rowsFor()).map((match) => match.recordId)).toEqual(["todo"]);
  });

  it("같은 대상의 큰 오차가 연속 2회면 다음 배분에서 신뢰도를 낮출 대상이다", () => {
    const second = { ...PLAN, start: "2026-09-08" };
    const records = [
      { id: "a", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(PLAN), action: "a", actual: "기록함" },
      { id: "b", toolId: "5-3", comparisonKind: "allocation_plan", allocationPlan: serializeAllocationPlan(second), action: "b" },
    ];
    const rows = rowsFor({ to: "2026-09-15", tiktok: [1000, 4] });
    expect(plannerDowngradeUnits(records.slice(0, 1), rows)).toEqual([]);
    expect(plannerDowngradeUnits(records, rows)).toEqual(["KR · TikTok; \"A|B\" · iOS"]);
  });
});

describe("스냅샷 만들기", () => {
  const forecast = {
    startDate: "2026-09-01",
    horizonDays: 14,
    total: { results: 105, lo: 90, hi: 120 },
    flags: { unpredictableNodes: 0 },
    nodes: [{ unit: "KR · Meta · iOS", cost: 7000, results: 70 }, { unit: "KR · TikTok · iOS", cost: 7000, results: 35 }],
  };

  it("예측 기간·합계 구간을 싣고 검토일은 기간 다음 날(D7 매출이면 7일 더)", () => {
    const snapshot = createAllocationPlanSnapshot({ forecast, metric: "installs", unitField: "channel", byPlatform: true, asOf: "2026-08-31" });
    expect(snapshot).toMatchObject({ comparisonKind: "allocation_plan", forecastPeriod: "2026-09-01", forecastValue: "105", forecastLower: "90", forecastUpper: "120", forecastSourceThrough: "2026-08-31", reviewDate: "2026-09-15" });
    expect(createAllocationPlanSnapshot({ forecast, metric: "revenue_d7", unitField: "channel", byPlatform: true }).reviewDate).toBe("2026-09-22");
  });

  it("예측할 수 없는 대상이 있으면 만들지 않는다 — 일부만 대조하면 실행 편차가 거짓으로 커진다", () => {
    expect(createAllocationPlanSnapshot({ forecast: { ...forecast, flags: { unpredictableNodes: 1 } }, metric: "installs", unitField: "channel", byPlatform: true })).toBeNull();
  });
});
