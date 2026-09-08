import { describe, expect, it } from "vitest";
import { EVALUATORS, ROUTER_CONFIG, SIGNALS, routeAnalyses } from "./router";
import { buildSnapshot } from "./snapshot";
import { LOWER_IS_BETTER } from "./significance";

const CUR = { start: "2026-08-31", end: "2026-09-06", days: 7 };
const PREV = { start: "2026-08-24", end: "2026-08-30", days: 7 };

/** 목업·명세와 같은 이력. 평소 범위 $7.18–$7.71. */
const HISTORY = { cpa: [7.15, 7.72, 7.24, 7.61, 7.79, 7.18, 7.42] };

const PROJECT = { kpi: { metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER } };

function snap(period, { cost, actions, impressions = 1_000_000, clicks = 20_000 }) {
  return buildSnapshot({
    period,
    rows: [{ date: period.start, campaign: "A", cost, actions, impressions, clicks }],
  });
}

/** 이번 CPA 8.04 · 지난 7.42 — 평소 범위 밖. */
function worsened(overrides = {}) {
  return routeAnalyses({
    current: snap(CUR, { cost: 92_940, actions: 11_551 }),
    previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
    history: HISTORY,
    project: PROJECT,
    ...overrides,
  });
}

describe("아무것도 안 하는 것이 정상 경로다", () => {
  it("평소 범위 안이면 돌릴 분석이 없다", () => {
    const result = routeAnalyses({
      // CPA 7.42 → 7.48 (+0.8%), 비용 +1.8% — 둘 다 문턱 아래
      current: snap(CUR, { cost: 84_600, actions: 11_388 }),
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    });
    expect(result.status).toBe("quiet");
    expect(result.reason).toBe("change_too_small");
    expect(result.run).toEqual([]);
    expect(result.kpi.significant).toBe(false);
  });

  it("조용함과 모름은 다르다 — 판정 불가를 조용함으로 접지 않는다", () => {
    const result = routeAnalyses({
      current: snap(CUR, { cost: 92_940, actions: 11_551 }),
      // 지난 기간에 전환이 없다. CPA는 0이 아니라 **계산 불가**이므로 지표 자체가 없다.
      previous: snap(PREV, { cost: 92_000, actions: 0 }),
      history: HISTORY,
      project: PROJECT,
    });
    expect(result.status).toBe("unknown");
    expect(result.status).not.toBe("quiet");
    expect(result.reason).toBe("no_value");
    expect(result.run).toEqual([]);
    // 판정 못 한 신호는 no_signal이 아니라 사유를 달고 남는다.
    const kpiSignal = result.skipped.find((entry) => entry.signal === "kpi_change");
    expect(kpiSignal.reason).toBe("not_assessable");
    expect(kpiSignal.detail).toBe("no_value");
  });

  it("핵심 지표를 못 재도 다른 신호가 있으면 분석은 돌리고, 못 잰 사실은 남긴다", () => {
    const result = routeAnalyses({
      current: snap(CUR, { cost: 92_940, actions: 11_551 }),
      previous: snap(PREV, { cost: 5_000, actions: 0 }), // 비용 급변 + CPA 판정 불가
      history: HISTORY,
      project: PROJECT,
    });
    expect(result.status).toBe("unknown");
    expect(result.run[0].triggers).toEqual(["spend_shift"]);
    expect(result.kpi.reason).toBe("no_value");
    expect(result.skipped.find((entry) => entry.signal === "kpi_change").reason).toBe("not_assessable");
  });

  it("지난 기간 값이 진짜 0일 때도 조용함이 아니라 모름이다", () => {
    // ROAS처럼 0이 될 수 있는 지표에서 지난 기간이 0이면 변화율이 정의되지 않는다.
    const result = routeAnalyses({
      current: buildSnapshot({ period: CUR, rows: [{ date: CUR.start, campaign: "A", cost: 100, actions: 10, revenue: 500 }] }),
      previous: buildSnapshot({ period: PREV, rows: [{ date: PREV.start, campaign: "A", cost: 100, actions: 10, revenue: 0 }] }),
      history: { roas: [1.2, 1.5, 1.3, 1.6, 1.4, 1.5, 1.35] },
      project: { kpi: { metric: "roas", basis: "actions", direction: "higher_is_better" } },
    });
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("no_previous_value");
  });

  it("비교할 스냅샷이 없으면 unknown이고 모든 신호가 사유를 갖는다", () => {
    const result = routeAnalyses({ current: snap(CUR, { cost: 100, actions: 10 }), previous: null });
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("no_previous_snapshot");
    expect(result.skipped).toHaveLength(SIGNALS.length);
  });
});

describe("신호가 있을 때만 분석을 건다", () => {
  it("핵심 지표가 유의미하게 나빠지면 변동 분석을 돌린다", () => {
    const result = worsened();
    expect(result.status).toBe("signal");
    expect(result.run).toHaveLength(1);
    expect(result.run[0].analysis).toBe("variance");
    expect(result.run[0].triggers).toContain("kpi_change");
    expect(result.kpi.significant).toBe(true);
  });

  it("비용이 크게 움직이면 같은 분석에 믹스 강조가 붙는다", () => {
    const result = worsened(); // 비용 +11.8% — 문턱(15%) 아래
    expect(result.run[0].emphasis).toEqual([]);

    const bigSpend = routeAnalyses({
      current: snap(CUR, { cost: 99_744, actions: 12_400 }), // 비용 +20%
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    });
    expect(bigSpend.run[0].triggers).toContain("spend_shift");
    expect(bigSpend.run[0].emphasis).toEqual(["mix"]);
  });

  it("같은 분석은 두 번 그리지 않고 신호만 모은다", () => {
    const bigSpend = routeAnalyses({
      current: snap(CUR, { cost: 99_744, actions: 11_100 }), // 비용 +20% · CPA 크게 악화
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    });
    expect(bigSpend.run).toHaveLength(1);
    expect(bigSpend.run[0].triggers.sort()).toEqual(["kpi_change", "spend_shift"]);
    expect(bigSpend.run[0].evidence).toHaveLength(2);
  });

  it("비용만 급변해도 분석은 걸린다", () => {
    // CPA는 거의 그대로인데 비용·전환이 함께 20% 늘어난 경우
    const result = routeAnalyses({
      current: snap(CUR, { cost: 99_744, actions: 13_445 }),
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    });
    expect(result.kpi.significant).toBe(false);
    expect(result.status).toBe("signal");
    expect(result.run[0].triggers).toEqual(["spend_shift"]);
  });

  it("문턱은 config로 갈아끼울 수 있다", () => {
    const args = {
      current: snap(CUR, { cost: 92_940, actions: 11_551 }),
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    };
    expect(routeAnalyses(args).run[0].emphasis).toEqual([]);
    expect(routeAnalyses({ ...args, config: { ...ROUTER_CONFIG, spendShiftPct: 0.1 } }).run[0].emphasis)
      .toEqual(["mix"]);
  });

  it("부분 주 소표본이면 표본 기준이 올라가 신호가 덜 걸린다", () => {
    const args = {
      current: snap(CUR, { cost: 400, actions: 45 }),
      previous: snap(PREV, { cost: 320, actions: 43 }),
      history: HISTORY,
      project: PROJECT,
    };
    expect(routeAnalyses({ ...args, volumeMultiplier: 1 }).kpi.checks.volume.pass).toBe(true);
    expect(routeAnalyses({ ...args, volumeMultiplier: 2 }).kpi.checks.volume.pass).toBe(false);
  });
});

describe("빠진 것과 일부러 뺀 것을 구분한다", () => {
  it("V1 밖 분석은 사유와 예정 버전을 달고 남는다", () => {
    const planned = worsened().skipped.filter((entry) => entry.reason === "not_in_v1");
    expect(planned.map((entry) => entry.signal).sort())
      .toEqual(["composition_shift", "creative_fatigue", "pacing"]);
    for (const entry of planned) expect(entry.plannedFor).toBeTruthy();
  });

  it("필요한 컬럼이 없으면 data_missing으로 어떤 컬럼인지 말한다", () => {
    const result = routeAnalyses({
      current: buildSnapshot({ period: CUR, rows: [{ date: CUR.start, campaign: "A", actions: 11_551 }] }),
      previous: buildSnapshot({ period: PREV, rows: [{ date: PREV.start, campaign: "A", actions: 11_204 }] }),
      history: HISTORY,
      project: PROJECT,
    });
    const spend = result.skipped.find((entry) => entry.signal === "spend_shift");
    expect(spend.reason).toBe("data_missing");
    expect(spend.missing).toEqual(["cost"]);
  });

  it("조용한 신호는 no_signal이라 데이터 없음과 헷갈리지 않는다", () => {
    const quiet = routeAnalyses({
      current: snap(CUR, { cost: 84_600, actions: 11_388 }),
      previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
      history: HISTORY,
      project: PROJECT,
    });
    const reasons = new Set(quiet.skipped.map((entry) => entry.reason));
    expect(reasons.has("no_signal")).toBe(true);
    expect(reasons.has("data_missing")).toBe(false);
  });
});

describe("조용히 사라지는 신호가 없다", () => {
  it("등록된 모든 신호는 run 또는 skipped 중 한쪽에 나타난다", () => {
    const cases = [
      worsened(),
      routeAnalyses({
        current: snap(CUR, { cost: 84_600, actions: 11_388 }),
        previous: snap(PREV, { cost: 83_120, actions: 11_204 }),
        history: HISTORY, project: PROJECT,
      }),
      routeAnalyses({
        current: snap(CUR, { cost: 92_940, actions: 11_551 }),
        previous: snap(PREV, { cost: 92_000, actions: 0 }),
        history: HISTORY, project: PROJECT,
      }),
    ];
    for (const result of cases) {
      const seen = new Set([
        ...result.skipped.map((entry) => entry.signal),
        ...result.run.flatMap((entry) => entry.triggers),
      ]);
      // 목록을 손으로 쓰지 않고 레지스트리에서 파생한다 — 신호를 추가하면 이 검사가 먼저 잡는다.
      expect([...seen].sort()).toEqual(SIGNALS.map((signal) => signal.id).sort());
    }
  });

  it("켜진 신호는 반드시 평가기를 갖는다 — 평가 안 된 것이 '신호 없음'으로 새면 안 된다", () => {
    // 처음엔 조건을 if로 늘어놓았더니, 레지스트리에만 올라간 신호가 어느 분기에도 안 걸려
    // 조용히 no_signal로 떨어졌다. "본 적 없음"과 "없음"은 다르다.
    for (const signal of SIGNALS.filter((entry) => entry.enabled)) {
      expect(typeof EVALUATORS[signal.id]).toBe("function");
    }
    // 가드가 빈 목록을 보고 통과하지 않도록 켜진 신호가 실제로 있는지도 본다.
    expect(SIGNALS.filter((entry) => entry.enabled).length).toBeGreaterThan(1);
  });

  it("평가기 없는 신호는 no_signal이 아니라 not_evaluated로 남는다", () => {
    const ghost = { id: "ghost", analysis: "ghost", enabled: true, requires: [], label: "평가기 없음" };
    const spy = [...SIGNALS, ghost];
    // 레지스트리를 직접 갈아끼울 수 없으므로, 평가기 조회가 사유를 가르는지 계약으로 확인한다.
    expect(EVALUATORS[ghost.id]).toBeUndefined();
    expect(spy.filter((entry) => entry.enabled && !EVALUATORS[entry.id]).map((entry) => entry.id))
      .toEqual(["ghost"]);
  });

  it("레지스트리에는 켜진 신호와 꺼진 신호가 함께 있고 꺼진 것은 사유가 있다", () => {
    expect(SIGNALS.some((signal) => signal.enabled)).toBe(true);
    for (const signal of SIGNALS) {
      if (!signal.enabled) expect(signal.plannedFor).toBeTruthy();
      expect(signal.analysis).toBeTruthy();
    }
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    expect(JSON.stringify(worsened())).toBe(JSON.stringify(worsened()));
  });
});
