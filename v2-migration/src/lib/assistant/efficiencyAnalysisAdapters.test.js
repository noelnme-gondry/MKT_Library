import { describe, expect, it } from "vitest";

import { buildDashboardVerdict } from "@/utils/dashboardVerdict";
import { PVM_MATH } from "@/utils/pvmMath";
import { SAT_CONFIG, SAT_MATH, satBuildPoints } from "@/utils/satMath";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { validateAnalysisResult } from "./analysisResultContract";
import { EFFICIENCY_TOOL_IDS, efficiencyAdapterFor, runEfficiencyAnalysis } from "./efficiencyAnalysisAdapters";

const raw = Array.from({ length: 14 }, (_, day) => {
  const date = `2026-01-${String(day + 1).padStart(2, "0")}`;
  return [
    { Date: date, Channel: "Alpha", Spend: String(100 + day * 5), Installs: String(10 + day), Actions: String(4 + Math.floor(day / 2)) },
    { Date: date, Channel: "Beta", Spend: String(80 + day * 2), Installs: String(12 + Math.floor(day / 2)), Actions: String(5 + Math.floor(day / 3)) },
  ];
}).flat();

const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs", Actions: "actions" };
const csvData = { raw, mapping, fileName: "fixture.csv" };
const input = { csvData, inputSignature: "input-v1", mappingSignature: "mapping-v1" };

describe("Dochi efficiency analysis adapters", () => {
  it("registers exactly the reusable efficiency-family adapter surface", () => {
    expect(EFFICIENCY_TOOL_IDS).toEqual(["5-2", "5-21", "5-22", "5-3"]);
    expect(EFFICIENCY_TOOL_IDS.every((toolId) => efficiencyAdapterFor(toolId))).toBe(true);
  });

  it("keeps the dashboard verdict headline and metric table aligned with the existing engine", () => {
    const expected = buildDashboardVerdict({ csvData, windowDays: 7 });
    const actual = runEfficiencyAnalysis({ toolId: "5-2", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.headline).toBe(expected.headline);
    expect(actual.visualizations[0]).toMatchObject({ kind: "bar", options: { variant: "period-comparison" } });
    expect(actual.visualizations[0].table.rows.find((row) => row.metric === "cost")).toMatchObject({
      prior: expected.metricRows.find((row) => row.key === "cost").prev,
      recent: expected.metricRows.find((row) => row.key === "cost").recent,
    });
  });

  it("keeps PVM total unit costs aligned with PVM_MATH", () => {
    const rows = raw.map((row) => ({ date: row.Date, channel: row.Channel, cost: row.Spend, installs: row.Installs, actions: row.Actions, spend: row.Spend }));
    const expected = PVM_MATH.decomposeFinest(rows.slice(0, 14), rows.slice(14), { ch: "channel", cmp: null, cr: null, resultField: "installs" });
    const actual = runEfficiencyAnalysis({ toolId: "5-21", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "prior-unit-cost", value: expected.CPA1 }));
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "recent-unit-cost", value: expected.CPA2 }));
  });

  it("keeps saturation analyzable counts aligned with SAT_MATH", () => {
    const rows = raw.map((row) => ({ date: row.Date, channel: row.Channel, cost: Number(row.Spend), installs: Number(row.Installs) }));
    const expected = [...satBuildPoints(rows, "channel", "installs", null).values()]
      .map((points) => SAT_MATH.analyzeEntity(points, SAT_CONFIG))
      .filter((entry) => entry.ok && entry.verdict).length;
    const actual = runEfficiencyAnalysis({ toolId: "5-22", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "analyzable", value: expected }));
    expect(actual.visualizations[0]).toMatchObject({ kind: "bar", options: { x: "entity", y: "saturationIndex" } });
    expect(actual.visualizations[0].table.rows).toHaveLength(expected);
  });

  it("returns a safe estimated baseline allocation and never puts CSV rows in its manifest", () => {
    const actual = runEfficiencyAnalysis({ toolId: "5-3", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.evidenceState).toBe("estimated");
    expect(actual.manifest.budgetSource).toBe("observed_daily_total");
    expect(validateAnalysisResult(actual)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(actual.manifest)).not.toEqual(expect.arrayContaining(["raw", "rows", "headers", "samples", "canonicalData"]));
  });

  it("never recommends a split that the same curves expect to do worse than the current one", () => {
    // 그리디만 쓰던 때 샘플에서 하루 8,782 → 6,072건(전환), 24,271 → 16,191건(설치)으로 줄어드는 안이 나왔다.
    for (const denomBasis of ["installs", "actions"]) {
      const actual = runEfficiencyAnalysis({ toolId: "5-3", csvData: buildSampleJourney("ko"), inputSignature: "i", mappingSignature: "m", locale: "ko", options: { denomBasis } });
      expect(actual.status, denomBasis).toBe("success");
      const stat = (id) => actual.verdict.stats.find((entry) => entry.id === id)?.value;
      expect(stat("current-results"), denomBasis).toBeGreaterThan(0);
      expect(stat("expected-results"), denomBasis).toBeGreaterThanOrEqual(stat("current-results"));
      expect(actual.verdict.headline, denomBasis).not.toContain("지금 배분이 더 낫습니다");
      expect(actual.manifest.allocationSource, denomBasis).toBe("from_current");
    }
  });

  it("does not turn missing PVM inputs into a success result", () => {
    const actual = runEfficiencyAnalysis({
      toolId: "5-21",
      csvData: { raw, mapping: { Date: "date", Spend: "cost", Installs: "installs" } },
      inputSignature: "input-v1",
      mappingSignature: "mapping-v1",
    });
    expect(actual.status).toBe("not_computable");
    expect(actual.verdict.evidenceState).toBe("not_computable");
  });

  // 목록 요약은 분석마다 대표값 하나를 보여 준다 — 그 값이 제목과 같은 이야기를 해야 한다(2026-09-28).
  it("names a representative stat that matches each headline on the sample", () => {
    const csv = buildSampleJourney("ko");
    const run = (toolId) => runEfficiencyAnalysis({ toolId, csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" });
    const primary = (result) => result.verdict.stats.find((stat) => stat.id === result.verdict.primaryStatId);

    const pvm = run("5-21");
    // 대표값은 그림이 그리는 채널별 기여 중 절댓값이 가장 큰 것 — 제목이 가리키는 채널과 같아야 한다.
    const rows = pvm.visualizations.find((item) => item.id === "pvm-channel-contributions").data;
    const largest = rows.reduce((best, row) => (Math.abs(row.contribution) > Math.abs(best.contribution) ? row : best));
    expect(pvm.verdict.primaryStatId).toBe("driver-contribution");
    expect(pvm.verdict.headline.startsWith(`${largest.entity}의 `)).toBe(true);
    expect(primary(pvm)).toMatchObject({ label: `${largest.entity} 기여`, value: largest.contribution, unit: "currency-change" });

    const dashboard = run("5-2");
    expect(primary(dashboard)?.label).toMatch(/CPA|CPI/);

    const budget = run("5-3");
    expect(budget.verdict.primaryStatId).toBe("results-gain");
    const stat = (id) => budget.verdict.stats.find((entry) => entry.id === id).value;
    expect(primary(budget).value).toBeCloseTo(stat("expected-results") - stat("current-results"), 6);
  });

  // 성과 변동이 지목한 채널은 그 채널만 걸러 주간 점검으로 열 수 있어야 한다 — 필터 값이 행의 채널 값과 같아야 0행이 아니다.
  it("drills the channel decomposition down to the named channel", () => {
    const csv = buildSampleJourney("ko");
    const pvm = runEfficiencyAnalysis({ toolId: "5-21", csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" });
    const driver = pvm.verdict.headline.split("의 ")[0];
    expect(pvm.verdict.drillDown).toEqual({ toolId: "5-2", field: "channel", value: driver });
    const channelColumn = Object.keys(csv.mapping).find((column) => csv.mapping[column] === "channel");
    expect(csv.raw.some((row) => String(row[channelColumn]).trim() === driver)).toBe(true);
    // 채널 값이 비면 "미지정" 묶음이라 필터로 다시 고를 수 없다 — 버튼을 만들지 않는다.
    const { canonicalData: _canonical, mappedRows: _mapped, ...rest } = csv;
    const blank = { ...rest, raw: csv.raw.map((row) => ({ ...row, [channelColumn]: "" })) };
    const unscoped = runEfficiencyAnalysis({ toolId: "5-21", csvData: blank, inputSignature: "i", mappingSignature: "m2", locale: "ko" });
    expect(unscoped.status).toBe("success");
    expect(unscoped.verdict.headline.startsWith("미지정의 ")).toBe(true);
    expect(unscoped.verdict.drillDown).toBeNull();
  });

  it("points a bad weekly verdict at the channel decomposition, and nothing else", () => {
    const csv = buildSampleJourney("ko");
    const dashboard = runEfficiencyAnalysis({ toolId: "5-2", csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" });
    const verdict = buildDashboardVerdict({ csvData: csv, windowDays: 7 });
    expect(dashboard.verdict.nextToolId).toBe(verdict.tone === "bad" ? "5-21" : null);
    // 성과 변동의 행동(변경 이력 점검)은 앱 밖 운영 과제다 — 버튼을 붙이지 않는다.
    expect(runEfficiencyAnalysis({ toolId: "5-21", csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" }).verdict.nextToolId).toBeNull();
  });

  // 포화와 여유가 함께 있을 때만 재배분으로, 배분안이 성과를 늘릴 때만 증액 여력으로 잇는다(2026-09-28).
  it.each(["ko", "en"])("links saturation and reallocation only when the verdict calls for it (%s)", (locale) => {
    const csv = buildSampleJourney(locale);
    const run = (toolId) => runEfficiencyAnalysis({ toolId, csvData: csv, inputSignature: "i", mappingSignature: "m", locale });
    const stat = (result, id) => result.verdict.stats.find((entry) => entry.id === id)?.value;

    const saturation = run("5-22");
    const canShift = stat(saturation, "saturated") > 0 && stat(saturation, "headroom") > 0;
    expect(saturation.verdict.nextToolId).toBe(canShift ? "5-3" : null);
    // 샘플은 포화 2 · 여유 0이다 — 옮길 곳이 없으니 재배분으로 보내지 않는다.
    expect(canShift).toBe(false);

    const budget = run("5-3");
    const gain = stat(budget, "results-gain");
    const raises = gain >= Math.max(1, stat(budget, "current-results") * 0.01);
    expect(raises).toBe(true);
    expect(budget.verdict.nextToolId).toBe("5-22");
    // 제목(늘어납니다)과 행동(증액 여력 확인)이 같은 판정을 쓴다.
    expect(budget.verdict.headline).toMatch(locale === "en" ? /raises/ : /늘어납니다/);
    expect(budget.verdict.action).toMatch(locale === "en" ? /headroom/ : /증액 여력/);
  });

  // 합성 데이터: 수확체감(√) 채널 · 선형 채널 · 수확체증(1.4제곱) 채널 — 포화와 여유가 함께 있다.
  it("sends a saturated-plus-headroom verdict to the reallocation", () => {
    const mapping = { Date: "date", Channel: "channel", Cost: "cost", Installs: "installs" };
    const raw = [];
    for (let d = 0; d < 56; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      const cost = 1000 + ((d * 37) % 23) * 200;
      raw.push({ Date: date, Channel: "Sat", Cost: String(cost), Installs: String(Math.round(40 * Math.sqrt(cost))) });
      raw.push({ Date: date, Channel: "Room", Cost: String(cost), Installs: String(Math.round(0.002 * cost ** 1.4)) });
      raw.push({ Date: date, Channel: "Flat", Cost: String(cost), Installs: String(Math.round(cost / 10)) });
    }
    const csv = { raw, headers: Object.keys(mapping), mapping, canonicalData: buildCanonicalDataset({ raw, headers: Object.keys(mapping), mapping }) };
    const saturation = runEfficiencyAnalysis({ toolId: "5-22", csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" });
    const stat = (id) => saturation.verdict.stats.find((entry) => entry.id === id).value;
    expect([stat("saturated"), stat("headroom")]).toEqual([1, 1]);
    expect(saturation.verdict.nextToolId).toBe("5-3");
    expect(saturation.verdict.action).toMatch(/옮기는 안/);
    // 캠페인 단위 진단은 5-3의 채널 배분과 단위가 달라 잇지 않는다 — 캠페인 열이 없으면 채널 단위로 돈다.
    expect(saturation.manifest.grain).toBe("channel");
  });
});
