import { describe, expect, it } from "vitest";
import { allocationEffect, allocationHeadline, allocationIssues, allocationMoves, moveGroups } from "./allocationActions";
import { addDays } from "./plannerStats";

const unit = (name, channel, diagnosis = null) => ({ unit: name, path: { channel }, diagnosis });

describe("지금 할 일 — 대상별 행동", () => {
  const units = [
    unit("KR · Meta · iOS", "Meta"),
    unit("KR · TikTok · iOS", "TikTok", { direction: "worse", verdict: "AUCTION_COST", components: { total: Math.log(1.2) } }),
    unit("KR · Google · iOS", "Google"),
    unit("KR · ASA · iOS", "ASA"),
  ];
  const items = [
    { channel: "KR · Meta · iOS", current: 1000, cost: 1200, binding: "max_daily_increase" },
    { channel: "KR · TikTok · iOS", current: 2000, cost: 1400 },
    { channel: "KR · Google · iOS", current: 1000, cost: 1005 },
    { channel: "KR · ASA · iOS", current: 500, cost: 900 },
  ];

  it("변화가 큰 순서, 1% 미만 변화는 유지, 이유는 실제 판정에서", () => {
    const moves = allocationMoves(items, units);
    expect(moves.map((move) => [move.unit, move.direction, move.delta])).toEqual([
      ["KR · TikTok · iOS", "down", -600],
      ["KR · ASA · iOS", "up", 400],
      ["KR · Meta · iOS", "up", 200],
      ["KR · Google · iOS", "keep", 5],
    ]);
    const byUnit = Object.fromEntries(moves.map((move) => [move.unit, move.reason]));
    expect(byUnit["KR · TikTok · iOS"].code).toBe("down_worse");
    expect(byUnit["KR · TikTok · iOS"].verdict).toBe("AUCTION_COST");
    expect(byUnit["KR · TikTok · iOS"].change).toBeCloseTo(0.2, 12);
    expect(byUnit["KR · Meta · iOS"].code).toBe("up_daily_limit");
    expect(byUnit["KR · ASA · iOS"].code).toBe("up_high_marginal");
    expect(byUnit["KR · Google · iOS"].code).toBe("keep");
  });

  it("최근 일평균이 있으면 같은 행에 현재·예상 CPR을 싣는다(결과 0이면 정의하지 않는다)", () => {
    const history = { "KR · TikTok · iOS": { totalCost: 2000, totalResults: 20 }, "KR · Meta · iOS": { totalCost: 1000, totalResults: 0 } };
    const moves = allocationMoves(items.map((item) => ({ ...item, results: item.channel === "KR · TikTok · iOS" ? 14 : 0 })), units, { history });
    const byUnit = Object.fromEntries(moves.map((move) => [move.unit, move]));
    expect(byUnit["KR · TikTok · iOS"].currentCpr).toBe(100);
    expect(byUnit["KR · TikTok · iOS"].plannedCpr).toBe(100);
    expect(byUnit["KR · Meta · iOS"].currentCpr).toBeNull();
    expect(byUnit["KR · Meta · iOS"].plannedCpr).toBeNull();
    expect(byUnit["KR · ASA · iOS"].currentCpr).toBeNull();
  });

  it("ROAS면 같은 비용 공간 변화를 역으로 읽는다(CPR +20% = ROAS −16.7%)", () => {
    const [down] = allocationMoves(items, units, { isRoas: true });
    expect(down.reason.change).toBeCloseTo(1 / 1.2 - 1, 12);
  });

  it("관측 밖 감액·고정·원인 없는 감액은 각자의 이유로", () => {
    const moves = allocationMoves([
      { channel: "a", current: 100, cost: 70, state: "EXTRAPOLATING" },
      { channel: "b", current: 100, cost: 100, binding: "low_confidence" },
      { channel: "c", current: 100, cost: 60 },
    ], [unit("a", "A"), unit("b", "B"), unit("c", "C", { direction: "better", verdict: "MARKET", components: { total: -0.1 } })]);
    const byUnit = Object.fromEntries(moves.map((move) => [move.unit, move.reason.code]));
    expect(byUnit).toEqual({ a: "down_outside_history", b: "hold_low_confidence", c: "down_low_marginal" });
  });

  it("결론 문장용 묶음은 채널 단위로 합친다", () => {
    const groups = moveGroups(allocationMoves([
      { channel: "KR · Meta · iOS", current: 1000, cost: 700 },
      { channel: "US · Meta · iOS", current: 1000, cost: 800 },
      { channel: "KR · TikTok · iOS", current: 1000, cost: 1500 },
    ], [unit("KR · Meta · iOS", "Meta"), unit("US · Meta · iOS", "Meta"), unit("KR · TikTok · iOS", "TikTok")]));
    expect(groups.down).toEqual([{ channel: "Meta", count: 2, delta: -500 }]);
    expect(groups.up).toEqual([{ channel: "TikTok", count: 1, delta: 500 }]);
    expect(groups.moved).toBe(500);
    expect(groups.added).toBe(500);
  });
});

describe("확인할 점 — 실제 신호가 있을 때만", () => {
  const toUnit = new Map([["n1", "KR · Meta · iOS"], ["n2", "KR · TikTok · iOS"]]);
  const creative = (over) => ({ nodeKey: "n1", creativeId: "c1", share: 0.5, ended: false, fatigue: { fatigued: false, etaDays: null }, ...over });

  it("신호가 없으면 아무것도 말하지 않는다", () => {
    expect(allocationIssues({ creatives: [creative()], toUnit, asOf: "2026-09-30", addDays })).toEqual([]);
  });

  it("학습 부족 → 손해 소재 → 피로(지금, 예측 기간 안) → 고정 → 미배분 순서", () => {
    const issues = allocationIssues({
      creatives: [
        creative({ creativeId: "soon", fatigue: { fatigued: false, etaDays: 5.2 } }),
        creative({ creativeId: "later", fatigue: { fatigued: false, etaDays: 40 } }),
        creative({ creativeId: "now", nodeKey: "n2", fatigue: { fatigued: true } }),
        creative({ creativeId: "small", share: 0.1, fatigue: { fatigued: true } }),
        creative({ creativeId: "gone", ended: true, fatigue: { fatigued: true } }),
      ],
      toUnit,
      asOf: "2026-09-30",
      horizonDays: 14,
      learningWarnings: [{ status: "short", unit: "KR · Meta · iOS", creativeId: "new", neededDaily: 300, expectedDaily: 120 }, { status: "ok", unit: "x" }],
      loserScenario: { base: { results: 100 }, scenario: { results: 112 }, horizonDays: 14, offs: [{ unit: "KR · TikTok · iOS", creativeIds: ["bad"], multiplier: 0.8 }] },
      reviewHeldUnits: ["KR · TikTok · iOS"],
      unallocated: 250,
      addDays,
    });
    expect(issues.map((issue) => issue.code)).toEqual(["learning_short", "loser_creative", "fatigue_now", "fatigue_soon", "review_held", "unallocated"]);
    expect(issues[1].params.gain).toBe(12);
    expect(issues[2].params).toEqual({ unit: "KR · TikTok · iOS", creative: "now", date: null });
    expect(issues[3].params).toEqual({ unit: "KR · Meta · iOS", creative: "soon", date: "2026-10-06" });
  });

  it("소재를 꺼도 결과가 늘지 않으면 손해 소재로 말하지 않는다", () => {
    const issues = allocationIssues({ loserScenario: { base: { results: 100 }, scenario: { results: 100 }, offs: [{ unit: "u", creativeIds: ["c"], multiplier: 0.8 }] } });
    expect(issues).toEqual([]);
  });
});

describe("결론 문장 — 줄은 방향별, 줄 안은 끊기지 않는 덩어리", () => {
  const groups = {
    down: [{ channel: "Meta AAP", count: 4, delta: -3900000 }],
    up: [{ channel: "Google UAC", count: 3, delta: 1500000 }, { channel: "TikTok", count: 2, delta: 800000 }, { channel: "Apple Search Ads", count: 1, delta: 350000 }],
    moved: 3900000,
    added: 2650000,
  };
  const money = (value) => `₩${Math.round(value / 10000)}만`;

  it("감액 줄 · 증액 줄 · 효과 줄, 이름은 한 덩어리", () => {
    const result = allocationHeadline({ groups, change: -0.089, metricLabel: "CPI", money });
    expect(result.tone).toBe("good");
    expect(result.lines).toEqual([
      { kind: "down", chunks: ["Meta AAP", "일 ₩390만 감액"] },
      { kind: "up", chunks: ["Google UAC 외 2곳", "일 ₩265만 증액"] },
      { kind: "effect", chunks: ["→ CPI −8.9%"] },
    ]);
    expect(result.text).toBe("Meta AAP 일 ₩390만 감액 · Google UAC 외 2곳 일 ₩265만 증액 → CPI −8.9%");
  });

  it("EN과 악화·ROAS 방향", () => {
    const en = allocationHeadline({ groups, change: -0.089, metricLabel: "CPI", money: (v) => `₩${(v / 1e6).toFixed(1)}M`, locale: "en" });
    expect(en.lines.map((line) => line.chunks)).toEqual([["Cut Meta AAP", "by ₩3.9M/day"], ["Add ₩2.6M/day to", "Google UAC +2"], ["→ CPI −8.9%"]]);
    expect(allocationHeadline({ groups, change: 0.05, metricLabel: "CPI", money }).lines.at(-1).chunks[0]).toBe("→ CPI +5.0% 악화");
    expect(allocationHeadline({ groups, change: 0.05, isRoas: true, metricLabel: "ROAS", money }).tone).toBe("good");
  });

  it("변화가 2% 미만이면 유지 권고, 과거가 없으면 행동만", () => {
    expect(allocationHeadline({ groups, change: 0.01, metricLabel: "CPI", money }).text).toBe("현 배분 유지 권고 · 재배분 효과 CPI 1.0%");
    const none = allocationHeadline({ groups, change: null, metricLabel: "CPI", money });
    expect(none.tone).toBe("neutral");
    expect(none.lines.map((line) => line.kind)).toEqual(["down", "up"]);
    expect(allocationHeadline({ groups: { down: [], up: [], moved: 0, added: 0 }, change: null, metricLabel: "CPI", money }).text).toBe("현 배분 유지 권고");
  });
});

describe("배분 효과 — 지금 배분과 바꾼 배분을 같은 곡선으로", () => {
  // 곡선: A는 지출이 늘면 단가가 오르고(수확 체감), B는 일정하다.
  const predict = (channel, cost) => (channel === "A" ? 10 + cost / 100 : 20);
  const items = [
    { channel: "A", current: 1000, cost: 500, results: 500 / predict("A", 500) },
    { channel: "B", current: 1000, cost: 1500, results: 1500 / predict("B", 1500) },
  ];

  it("관측 단가가 아니라 같은 곡선의 예측끼리 비교한다", () => {
    const effect = allocationEffect(items, predict);
    const current = 1000 / 20 + 1000 / 20;
    const planned = 500 / 15 + 1500 / 20;
    expect(effect.currentResults).toBeCloseTo(current, 12);
    expect(effect.plannedResults).toBeCloseTo(planned, 12);
    expect(effect.change).toBeCloseTo((2000 / planned) / (2000 / current) - 1, 12);
    expect(effect.resultGain).toBeCloseTo(planned - current, 12);
  });

  it("지금 배분 중 하나라도 예측이 없으면 효과를 정의하지 않는다(부분 합으로 비교하지 않는다)", () => {
    const effect = allocationEffect(items, (channel, cost) => (channel === "B" ? null : predict(channel, cost)));
    expect(effect.change).toBeNull();
    expect(effect.resultGain).toBeNull();
  });
});
