import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildToolDemo } from "@/lib/toolDemo";
import { allocationHistory, prepareAllocationObservations } from "@/utils/allocationObservations";
import { allocationPointMap } from "@/utils/allocationModels";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { allocationAt, plannerEvidence, prepareAllocationPlanner } from "./allocationAdapter";
import { CREATIVE_STATES } from "./creativeLifecycle";
import { PLANNER_NODE_STATES, PLANNER_VERDICTS } from "./plannerConfig";
import { BINDING_LABELS, CREATIVE_STATE_LABELS, NODE_STATE_LABELS, PVM_COLUMN_LABELS, VERDICT_LABELS, bindingLabel } from "./plannerLabels";
import { PVM_COLUMNS } from "./plannerPvm";

describe("플래너 화면 이름표", () => {
  it("엔진이 내는 상태·판정·소재 상태·분해 열을 전부 KO/EN으로 덮는다", () => {
    for (const [table, codes] of [[NODE_STATE_LABELS, PLANNER_NODE_STATES], [VERDICT_LABELS, PLANNER_VERDICTS], [CREATIVE_STATE_LABELS, CREATIVE_STATES], [PVM_COLUMN_LABELS, PVM_COLUMNS]]) {
      expect(codes.length).toBeGreaterThan(3);
      for (const code of codes) {
        expect(table[code]?.ko, code).toBeTruthy();
        expect(table[code]?.en, code).toBeTruthy();
      }
    }
  });

  it("배분 엔진 소스에 적힌 제약 코드는 모두 이름이 있다(소스에서 파생)", () => {
    // 주석을 먼저 지우고 실제 코드의 source 문자열만 센다.
    const file = readFileSync(new URL("./plannerAllocate.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // 제약 사유를 만드는 곳은 nodeBounds 하나다(배분 결과 전체의 source 표식과 섞지 않는다).
    const start = file.indexOf("export function nodeBounds");
    const source = file.slice(start, file.indexOf("\nfunction ", start + 1));
    expect(start).toBeGreaterThan(-1);
    expect(source).toContain("learning_minimum");
    const codes = new Set([
      ...[...source.matchAll(/source:\s*"([a-z_]+)"/g)].map((m) => m[1]),
      ...[...source.matchAll(/tighten\([^,]+,[^,]+,\s*"([a-z_]+)"/g)].map((m) => m[1]),
    ]);
    codes.add("low_confidence"); // 5-3 연결층이 넘기는 고정 사유
    expect(codes.size).toBeGreaterThan(6);
    for (const code of codes) expect(BINDING_LABELS[code], code).toBeTruthy();
  });

  it("상태 규칙 제약은 어느 상태여도 상태 이름으로 읽힌다", () => {
    for (const state of PLANNER_NODE_STATES) {
      expect(bindingLabel(`state:${state}`, "ko")).not.toContain("state:");
      expect(bindingLabel(`state:${state}`, "en")).not.toContain("state:");
    }
  });

  it("예시 데이터의 실제 배분에서 나온 제약이 모두 이름으로 읽힌다", () => {
    const rows = getMappedRows(buildToolDemo("5-3"));
    const seen = new Set();
    for (const unitField of ["channel", "country", "campaign_name"]) {
      const obs = prepareAllocationObservations(rows, { metric: "installs", unit: unitField });
      const keys = [...allocationPointMap(obs.rows, unitField, "installs").keys()];
      const currentSpends = Object.fromEntries(keys.map((key) => [key, allocationHistory(obs.rows, unitField, key, "installs", { recentDays: 7 })?.totalCost || 0]));
      const planner = prepareAllocationPlanner(obs.rows, { unitField, metric: "installs", adv: { trendType: "auto", outlierMethod: "iqr", weightMode: "none", regimeMode: "all" }, currentSpends });
      for (const pace of ["paced", "full"]) {
        const { minBudget, maxBudget } = plannerEvidence(planner, { pace });
        for (const budget of [minBudget, (minBudget + maxBudget) / 2, maxBudget]) {
          for (const item of allocationAt(planner, budget, { pace }).allocation.items) if (item.binding) seen.add(item.binding);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(2);
    for (const code of seen) expect(bindingLabel(code, "ko"), code).not.toBe(code);
  });
});
