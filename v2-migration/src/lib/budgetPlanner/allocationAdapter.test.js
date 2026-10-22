import { describe, expect, it } from "vitest";
import { buildToolDemo } from "@/lib/toolDemo";
import { allocationHistory, prepareAllocationObservations } from "@/utils/allocationObservations";
import { allocationPointMap } from "@/utils/allocationModels";
import { selectBudgetForTarget } from "@/utils/budgetAllocTool";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { allocationAt, deltaAllocationAt, plannerEvidence, plannerFrontier, plannerScenarios, prepareAllocationPlanner } from "./allocationAdapter";

const demoRows = getMappedRows(buildToolDemo("5-3"));
const ADV = { trendType: "auto", outlierMethod: "iqr", outlierStrength: "standard", weightMode: "none", regimeMode: "all" };

function setup(unitField, extra = {}) {
  const obs = prepareAllocationObservations(demoRows, { cadence: "daily", metric: "installs", unit: unitField, groupByPlatform: true });
  const keys = [...allocationPointMap(obs.rows, unitField, "installs").keys()];
  const historyByCh = Object.fromEntries(keys.map((key) => [key, allocationHistory(obs.rows, unitField, key, "installs", { recentDays: 7 })]));
  const currentSpends = Object.fromEntries(Object.entries(historyByCh).map(([key, history]) => [key, history?.totalCost || 0]));
  const planner = prepareAllocationPlanner(obs.rows, { unitField, metric: "installs", adv: ADV, currentSpends, ...extra });
  return { obs, keys, historyByCh, currentSpends, planner };
}

describe("5-3 ↔ 플래너 어댑터", () => {
  it.each(["channel", "country", "campaign_name"])("단위 %s: 5-3 단위 키와 플래너 노드가 1:1로 맞고 빠진 키가 없다", (unitField) => {
    const { keys, planner, currentSpends } = setup(unitField);
    expect(planner.ok).toBe(true);
    expect(keys.length).toBeGreaterThan(3);
    expect([...planner.modelsMap.keys()].sort()).toEqual([...keys].sort());
    // 현재 지출은 화면이 쓰는 값 그대로다(두 곳에서 따로 세지 않는다).
    for (const node of planner.allocationNodes) expect(node.current).toBe(currentSpends[planner.toUnit.get(node.key)]);
  });

  it("배분은 예산 안·노드 상하한 안이고, 5-3 단위 키로 돌아온다", () => {
    const { planner, keys } = setup("channel");
    const evidence = plannerEvidence(planner);
    const budget = (evidence.minBudget + evidence.maxBudget) / 2;
    const { allocation } = allocationAt(planner, budget);
    expect(allocation.source).toBe("planner");
    expect(allocation.totalAllocated).toBeLessThanOrEqual(budget + 1e-6);
    expect(allocation.totalAllocated).toBeGreaterThan(budget * 0.999);
    for (const item of allocation.items) {
      expect(keys).toContain(item.channel);
      expect(item.cost).toBeGreaterThanOrEqual(item.lower - 1e-6);
      expect(item.cost).toBeLessThanOrEqual(item.upper + 1e-6);
    }
    expect(allocation.items.reduce((acc, item) => acc + item.weight, 0)).toBeCloseTo(1, 9);
  });

  it("목표 배분(변경폭 제한 없음)은 이번 실행안보다 가능한 예산 범위가 넓다", () => {
    const { planner } = setup("channel");
    const paced = plannerEvidence(planner, { pace: "paced" });
    const full = plannerEvidence(planner, { pace: "full" });
    expect(full.minBudget).toBeLessThan(paced.minBudget);
    expect(full.maxBudget).toBeGreaterThanOrEqual(paced.maxBudget);
  });

  it("저신뢰 고정은 그 값 그대로, 고정 사유와 함께 나온다", () => {
    const { planner, currentSpends } = setup("channel");
    const unit = [...planner.modelsMap.keys()].find((key) => planner.modelsMap.get(key));
    const { allocation } = allocationAt(planner, plannerEvidence(planner).maxBudget, { holds: { [unit]: currentSpends[unit] } });
    expect(allocation.items.find((item) => item.channel === unit)).toMatchObject({ cost: currentSpends[unit], locked: true, binding: "low_confidence" });
  });

  it("예산이 하한보다 작으면 하한에서 멈추고 초과로 표시한다(목표 역산에서 쓸 수 없는 안)", () => {
    const { planner } = setup("channel");
    const evidence = plannerEvidence(planner);
    const { allocation } = allocationAt(planner, evidence.minBudget * 0.5);
    expect(allocation.overspent).toBe(true);
    expect(allocation.warnings[0].code).toBe("budget_below_minimums");
  });

  it("목표 역산 사다리·시나리오·증감분 비교가 같은 플래너 배분을 쓴다", () => {
    const { planner, historyByCh } = setup("channel");
    const evidence = plannerEvidence(planner);
    const frontier = plannerFrontier(planner, { minBudget: evidence.minBudget, maxBudget: evidence.maxBudget, metric: "installs", historyByCh, steps: 9 });
    expect(frontier.length).toBeGreaterThan(5);
    expect(frontier.every((point, i) => i === 0 || point.budget > frontier[i - 1].budget)).toBe(true);
    const target = frontier[Math.floor(frontier.length / 2)].value * 1.05;
    expect(["met", "cap_reached", "unreachable"]).toContain(selectBudgetForTarget({ frontier, targetValue: target, metric: "installs" }).status);
    const mid = frontier[3];
    expect(allocationAt(planner, mid.budget).allocation.totalAllocated).toBe(mid.allocation.totalAllocated);
    const scenarios = plannerScenarios(planner, evidence.maxBudget * 0.9);
    expect(scenarios.map((s) => s.m)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    const delta = deltaAllocationAt(planner, evidence.maxBudget);
    expect(delta.blocked).toBeFalsy();
    for (const item of delta.items) expect(planner.modelsMap.has(item.channel)).toBe(true);
  });

  it("곡선 검증에서 확정한 모형은 그 단위에만 적용된다", () => {
    const base = setup("channel");
    const unit = [...base.planner.modelsMap.keys()].find((key) => base.planner.modelsMap.get(key)?.model.type !== "Linear");
    const pinned = setup("channel", { groupModels: { [unit]: "linear" } });
    expect(pinned.planner.modelsMap.get(unit).model.type).toBe("Linear");
    const other = [...base.planner.modelsMap.keys()].find((key) => key !== unit && base.planner.modelsMap.get(key));
    expect(pinned.planner.modelsMap.get(other).model.type).toBe(base.planner.modelsMap.get(other).model.type);
  });

  it("한 대상이 두 이름으로 갈리면(국가 없는 행이 채널 이름으로 묶임) 섞지 않고 거절한다", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, country: "KR", channel: "Meta", platform: "", cost: 1000, installs: 10 })),
      ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, country: "", channel: "Meta", platform: "", cost: 800, installs: 8 })),
      ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, country: "", channel: "TikTok", platform: "", cost: 500, installs: 5 })),
    ];
    const planner = prepareAllocationPlanner(rows, { unitField: "country", metric: "installs", adv: ADV });
    expect(planner).toMatchObject({ ok: false, code: "UNIT_KEY_CONFLICT" });
    expect(planner.units).toEqual(["Meta", "TikTok"]);
  });

  it("주간 관측은 요일 효과를 재지 않는다", () => {
    const obs = prepareAllocationObservations(demoRows, { cadence: "daily", metric: "installs", unit: "channel" });
    const planner = prepareAllocationPlanner(obs.rows, { unitField: "channel", metric: "installs", adv: ADV, cadence: "weekly" });
    expect(planner.cfg.dow.enabled).toBe(false);
    for (const node of planner.allocationNodes) if (node.curve) expect(node.curve.cprDow).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});
