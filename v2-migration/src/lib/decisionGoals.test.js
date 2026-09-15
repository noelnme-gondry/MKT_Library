import { describe, it, expect } from "vitest";
import { publishedToolIds } from "@/lib/routeMap";
import { deriveMetrics } from "@/lib/weekly-review/snapshot";
import {
  RERUN_GOAL_PREFIX,
  SCORABLE_GOAL_METRICS,
  TOOL_DECISION_GOALS,
  findToolGoal,
  goalTargetDirection,
  isRerunGoalMetric,
  isScorableGoalMetric,
  registryTargetDirection,
  toolDecisionGoals,
  toolDecisionGuardrails,
} from "@/lib/decisionGoals";

const PUBLISHED = publishedToolIds();

describe("decisionGoals — 커버리지는 발행 라우트에서 파생한다", () => {
  it("검사 대상이 실제로 존재한다", () => {
    // 스캐너가 깨져 0건이 되면 아래 전수 검사가 조용히 통과한다(§7).
    expect(PUBLISHED.length).toBeGreaterThanOrEqual(15);
  });

  it.each(PUBLISHED)("%s — 목표 1개+·가드레일 1개+를 갖는다", (toolId) => {
    expect(toolDecisionGoals(toolId).length).toBeGreaterThan(0);
    expect(toolDecisionGuardrails(toolId).length).toBeGreaterThan(0);
  });

  it("레지스트리에 발행 도구가 아닌 id가 섞여 있지 않다", () => {
    const stray = Object.keys(TOOL_DECISION_GOALS).filter((id) => !PUBLISHED.includes(id));
    expect(stray).toEqual([]);
  });
});

describe("decisionGoals — 목표 키는 판정 가능성이 드러나야 한다", () => {
  const allGoals = Object.entries(TOOL_DECISION_GOALS).flatMap(([toolId, entry]) =>
    entry.goals.map((goal) => ({ toolId, ...goal })));
  const allGuardrails = Object.entries(TOOL_DECISION_GOALS).flatMap(([toolId, entry]) =>
    entry.guardrails.map((rail) => ({ toolId, ...rail })));

  it("모든 목표 키는 스냅샷으로 계산 가능하거나 rerun: 접두사를 갖는다", () => {
    const bad = allGoals.filter((goal) => !isScorableGoalMetric(goal.key) && !isRerunGoalMetric(goal.key));
    expect(bad.map((goal) => `${goal.toolId}:${goal.key}`)).toEqual([]);
  });

  it("가드레일은 전부 스냅샷으로 계산 가능해야 한다", () => {
    // 가드레일은 "넘었으면 넘은 것"이라 재실행 판정이 성립하지 않는다.
    const bad = allGuardrails.filter((rail) => !isScorableGoalMetric(rail.key));
    expect(bad.map((rail) => `${rail.toolId}:${rail.key}`)).toEqual([]);
  });

  it("SCORABLE_GOAL_METRICS는 스코어러가 실제로 내는 키와 일치한다", () => {
    // 여기 목록을 손으로 늘리면 판정이 NO_DATA로 죽는다 — deriveMetrics와 대조한다.
    const derived = Object.keys(deriveMetrics({ cost: 1, actions: 1, installs: 1, clicks: 1, impressions: 1, revenue: 1 }));
    const aliases = ["spend"]; // metricValue가 totals.cost로 번역하는 별칭
    const known = new Set([...derived, ...aliases]);
    const unknown = SCORABLE_GOAL_METRICS.filter((key) => !known.has(key));
    expect(unknown).toEqual([]);
  });

  it("가드레일 연산자는 lte/gte뿐이다", () => {
    const bad = allGuardrails.filter((rail) => !["lte", "gte"].includes(rail.op));
    expect(bad.map((rail) => `${rail.toolId}:${rail.key}`)).toEqual([]);
  });

  it("목표 방향은 up/down뿐이고 라벨은 KO·EN 둘 다 있다", () => {
    const badDirection = allGoals.filter((goal) => !["up", "down"].includes(goal.direction));
    expect(badDirection.map((goal) => `${goal.toolId}:${goal.key}`)).toEqual([]);
    const missingLabel = [...allGoals, ...allGuardrails].filter((item) => !item.label?.trim() || !item.labelEn?.trim());
    expect(missingLabel.map((item) => `${item.toolId}:${item.key}`)).toEqual([]);
  });

  it("한 도구 안에서 목표 키가 중복되지 않는다", () => {
    const dupes = Object.entries(TOOL_DECISION_GOALS).flatMap(([toolId, entry]) => {
      const seen = new Set();
      return entry.goals.filter((goal) => (seen.has(goal.key) ? true : (seen.add(goal.key), false)))
        .map((goal) => `${toolId}:${goal.key}`);
    });
    expect(dupes).toEqual([]);
  });
});

describe("decisionGoals — 방향은 추측이 아니라 선언에서 온다", () => {
  it("정규식이 못 읽던 목표에 방향이 붙는다", () => {
    // 이 둘은 decisionMetricDirection이 ""를 돌려주던 자리다.
    expect(registryTargetDirection("5-18-cannibal", `${RERUN_GOAL_PREFIX}cannib_candidates`)).toBe("lower");
    expect(registryTargetDirection("5-25", `${RERUN_GOAL_PREFIX}max_vif`)).toBe("lower");
    expect(registryTargetDirection("5-18-cannibal", `${RERUN_GOAL_PREFIX}organic_conversions`)).toBe("higher");
  });

  it("등록되지 않은 목표는 null을 돌려준다(호출부가 폴백한다)", () => {
    expect(registryTargetDirection("5-2", "made-up-metric")).toBeNull();
    expect(registryTargetDirection("nope", "cpa")).toBeNull();
  });

  it("goalTargetDirection은 up/down만 번역한다", () => {
    expect(goalTargetDirection("up")).toBe("higher");
    expect(goalTargetDirection("down")).toBe("lower");
    expect(goalTargetDirection("hold")).toBe("");
  });

  it("EN 로케일은 EN 라벨을 준다", () => {
    expect(findToolGoal("5-25", `${RERUN_GOAL_PREFIX}max_vif`, "en").label).toBe("Maximum VIF");
    expect(findToolGoal("5-25", `${RERUN_GOAL_PREFIX}max_vif`, "ko").label).toBe("최대 VIF");
  });
});

describe("decisionGoals — 잠식 결정의 자기기만 방지", () => {
  it("오가닉 목표에는 총 전환수 가드레일이 함께 제안된다", () => {
    // 광고를 끄면 오가닉 귀속이 늘지만 총량이 줄 수 있다. 가드레일이 없으면
    // "오가닉이 늘었으니 성공"이 그대로 통과한다.
    const rails = toolDecisionGuardrails("5-18-cannibal").map((rail) => rail.key);
    expect(rails).toContain("conversions");
    const goals = toolDecisionGoals("5-18-cannibal").map((goal) => goal.key);
    expect(goals).toContain(`${RERUN_GOAL_PREFIX}organic_conversions`);
  });

  it("같은 자기기만이 유입 변화맵에도 막혀 있다", () => {
    expect(toolDecisionGuardrails("5-18-paid-organic").map((rail) => rail.key)).toContain("conversions");
  });
});
