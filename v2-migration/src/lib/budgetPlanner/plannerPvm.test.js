import { describe, expect, it } from "vitest";
import { PVM_MATH } from "@/utils/pvmMath";
import { resolvePlannerConfig } from "./plannerConfig";
import { decomposePlannerPvm, poolZeroResultCells, PVM_COLUMNS, reviewPlanVsActual, shouldDowngradeConfidence } from "./plannerPvm";

const cfg = resolvePlannerConfig().config;
const levels = cfg.hierarchy.levels;
const row = (campaign, creative, cost, result, date = "2026-07-01") => ({
  date, country: "KR", platform: "iOS", channel: "Meta", campaign_name: campaign, adgroup_name: "", creative_id: creative, cost, result,
});
const run = (rowsB, rowsR, extra = {}) => decomposePlannerPvm(rowsB, rowsR, { levels, finestLevel: "creative_id", groupLevel: "campaign_name", cfg, ...extra });
const sumColumns = (item) => PVM_COLUMNS.reduce((acc, name) => acc + item[name], 0);

describe("plannerPvm — 무잔차 분해", () => {
  const B = [row("A", "a1", 1000, 10), row("A", "a2", 2000, 10), row("B", "b1", 3000, 30)];
  const R = [row("A", "a1", 1500, 12), row("A", "a2", 1000, 4), row("B", "b1", 4000, 30)];

  it("7개 열의 합 = ΔCPA, 행·그룹 합도 맞는다", () => {
    const out = run(B, R, { rateFactors: new Map([[JSON.stringify(["KR", "iOS", "Meta", "A"]), { budget: 1.1, market: 0.95 }]]) });
    expect(out.ok).toBe(true);
    expect(Math.abs(out.residual)).toBeLessThan(1e-9);
    for (const item of out.rows) expect(sumColumns(item)).toBeCloseTo(item.contribution, 9);
    expect(out.groups.reduce((acc, group) => acc + sumColumns(group), 0)).toBeCloseTo(out.deltaCpa, 9);
    expect(out.shareBasis).toBe("result");
  });

  it("캠페인 간 mix의 그룹 합은 캠페인 grain PVM의 mix와 정확히 같다", () => {
    const out = run(B, R);
    const campaignGrain = PVM_MATH.decompose(
      new Map([["A", { cost: 3000, result: 20 }], ["B", { cost: 3000, result: 30 }]]),
      new Map([["A", { cost: 2500, result: 16 }], ["B", { cost: 4000, result: 30 }]]),
    );
    const byGroup = Object.fromEntries(out.groups.map((group) => [JSON.parse(group.key).at(-1), group.betweenMix]));
    for (const entity of campaignGrain.entities) expect(byGroup[entity.key]).toBeCloseTo(entity.mix, 9);
  });

  it("rate는 예산 곡선 → 시장 → 나머지 순서로 나뉘고, 배율 1이면 전부 나머지다", () => {
    const groupA = JSON.stringify(["KR", "iOS", "Meta", "A"]);
    const plain = run(B, R);
    const split = run(B, R, { rateFactors: new Map([[groupA, { budget: 1.2, market: 1.1 }]]) });
    const a1Plain = plain.rows.find((item) => item.creativeId === "a1");
    const a1Split = split.rows.find((item) => item.creativeId === "a1");
    expect(a1Plain.budget).toBe(0);
    expect(a1Plain.market).toBe(0);
    const sBar = (a1Split.resultShare1 + a1Split.resultShare2) / 2;
    expect(a1Split.budget).toBeCloseTo(sBar * 100 * 0.2, 9);
    expect(a1Split.market).toBeCloseTo(sBar * 100 * 1.2 * 0.1, 9);
    expect(a1Split.budget + a1Split.market + a1Split.creative).toBeCloseTo(a1Plain.creative, 9);
  });

  it("Simpson: 캠페인마다 CPA가 좋아져도 비싼 캠페인으로 결과가 옮겨가면 캠페인 간 비중 항이 악화를 진다", () => {
    const sB = [row("Cheap", "c", 1000, 100), row("Pricey", "p", 1000, 10)];
    const sR = [row("Cheap", "c", 450, 50), row("Pricey", "p", 5700, 60)];
    const out = run(sB, sR);
    expect(out.deltaCpa).toBeGreaterThan(0);
    expect(out.totals.betweenMix).toBeGreaterThan(0);
    for (const item of out.rows) expect(item.creative).toBeLessThan(0);
  });
});

describe("plannerPvm — 신규 소재 예외", () => {
  it("기준 기간에 없던 소재는 '신규 진입' 한 열로 옮기고 합은 그대로다", () => {
    const B = [row("A", "a1", 1000, 10)];
    const R = [row("A", "a1", 1000, 10), row("A", "new", 900, 5)];
    const out = run(B, R, { creativeStateOf: (cell) => (cell.creativeId === "new" ? { state: "LEARNING", fatigued: false } : null) });
    const entry = out.rows.find((item) => item.creativeId === "new");
    expect(entry.kind).toBe("entry");
    expect(entry.entry).toBeCloseTo(entry.contribution, 12);
    expect(entry.creative).toBe(0);
    expect(entry.withinMix).toBe(0);
    expect(entry.creativeState.state).toBe("LEARNING");
    expect(Math.abs(out.residual)).toBeLessThan(1e-9);
  });

  it("엔진 원본은 결과 0 소재 하나로 분해 전체를 멈춘다(재현) — 플래너는 묶어서 계속한다", () => {
    const B = [row("A", "a1", 1000, 10), row("A", "a2", 800, 8)];
    const R = [row("A", "a1", 1000, 10), row("A", "a2", 800, 8), row("A", "new1", 300, 0), row("A", "new2", 200, 3)];
    expect(PVM_MATH.decompose(
      new Map([["a1", { cost: 1000, result: 10 }], ["a2", { cost: 800, result: 8 }]]),
      new Map([["a1", { cost: 1000, result: 10 }], ["a2", { cost: 800, result: 8 }], ["new1", { cost: 300, result: 0 }]]),
    )).toBeNull();
    const out = run(B, R);
    expect(out.ok).toBe(true);
    expect(out.pooled).toHaveLength(1);
    expect(out.pooled[0].rule).toBe("mergeIntoSmallest");
    expect(out.excluded).toHaveLength(0);
    expect(out.scope).toBe("all");
  });

  it("결과 0 소재가 둘이고 기간이 엇갈리면 캠페인 묶음 하나로 합친다", () => {
    const B = [row("A", "a1", 1000, 10), row("A", "z1", 200, 0), row("A", "z2", 300, 4)];
    const R = [row("A", "a1", 1000, 10), row("A", "z1", 200, 3), row("A", "z2", 300, 0)];
    const out = run(B, R);
    expect(out.ok).toBe(true);
    expect(out.pooled[0].rule).toBe("campaign_bucket");
    expect(out.rows.some((item) => item.label.endsWith("결과 0 소재 묶음"))).toBe(true);
  });

  it("캠페인 전체가 결과 0이면 그 캠페인을 빼고 금액을 보고하며, 범위를 '분해 대상'으로 바꾼다", () => {
    const B = [row("A", "a1", 1000, 10), row("Dead", "d1", 500, 0)];
    const R = [row("A", "a1", 1200, 10), row("Dead", "d1", 700, 0)];
    const out = run(B, R);
    expect(out.ok).toBe(true);
    expect(out.excluded).toEqual([expect.objectContaining({ costB: 500, costR: 700, wholeGroup: true })]);
    expect(out.scope).toBe("decomposed_subset");
    expect(out.CPA1).toBeCloseTo(100, 12);
  });

  it("묶기 단계를 config에서 모두 빼면 정직하게 실패한다", () => {
    const strict = resolvePlannerConfig({ pvm: { zeroResultPooling: [] } }).config;
    const B = [row("A", "a1", 1000, 10)];
    const R = [row("A", "a1", 1000, 10), row("A", "z", 100, 0)];
    const out = decomposePlannerPvm(B, R, { levels, finestLevel: "creative_id", groupLevel: "campaign_name", cfg: strict });
    expect(out).toEqual({ ok: false, code: "ZERO_RESULT_UNRESOLVED", group: JSON.stringify(["KR", "iOS", "Meta", "A"]) });
  });

  it("poolZeroResultCells는 두 기간에 같은 소속 규칙을 쓴다", () => {
    const cell = (key, cost, result) => [key, { key, groupKey: "g", label: key, cost, result }];
    const out = poolZeroResultCells(new Map([cell("x", 10, 1), cell("z", 5, 0)]), new Map([cell("x", 10, 1), cell("z", 5, 2)]), cfg.pvm.zeroResultPooling);
    expect(out.target.get("z")).toBe("x");
  });
});

describe("plannerPvm — 계획 대비 실적", () => {
  it("실행 편차(mix)와 모형 오차(rate)로 나누고 큰 오차를 표시한다", () => {
    const out = reviewPlanVsActual(
      [{ key: "a", cost: 1000, results: 10 }, { key: "b", cost: 1000, results: 20 }],
      [{ key: "a", cost: 1500, results: 10 }, { key: "b", cost: 500, results: 10 }],
      cfg,
    );
    expect(out.ok).toBe(true);
    const sum = out.nodes.reduce((acc, node) => acc + node.executionDeviation + node.modelErrorContribution, 0);
    expect(sum).toBeCloseTo(out.deltaCpa, 9);
    expect(out.nodes.find((node) => node.key === "a")).toMatchObject({ modelError: 0.5, largeError: true });
    expect(out.nodes.find((node) => node.key === "b").largeError).toBe(false);
  });

  it("큰 오차가 연속 N회일 때만 신뢰도를 낮춘다", () => {
    expect(shouldDowngradeConfidence([{ largeError: true }], cfg)).toBe(false);
    expect(shouldDowngradeConfidence([{ largeError: false }, { largeError: true }, { largeError: true }], cfg)).toBe(true);
    expect(shouldDowngradeConfidence([{ largeError: true }, { largeError: false }], cfg)).toBe(false);
  });
});
