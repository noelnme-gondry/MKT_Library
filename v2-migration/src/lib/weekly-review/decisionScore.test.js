import { describe, expect, it } from "vitest";
import { DECISION_OUTCOME, parsePercentAmount, rowsForTarget, scoreDecision } from "./decisionScore";
import { buildSnapshot } from "./snapshot";

const CUR = { start: "2026-08-31", end: "2026-09-06", days: 7 };
const PREV = { start: "2026-08-24", end: "2026-08-30", days: 7 };

function snap(period, rows) {
  return buildSnapshot({ period, rows: rows.map((r) => ({ date: period.start, ...r })) });
}

/** 명세 §6.3의 사례 — Meta AAP 예산 +15%, 목표 전환 증가, 가드레일 CPA ≤ $8.00 */
const DECISION = Object.freeze({
  actionKind: "increase_budget",
  actionTarget: "Meta AAP",
  actionAmount: "+15%",
  goalMetric: "conversions",
  goalDirection: "up",
  guardrailMetric: "cpa",
  guardrailOp: "lte",
  guardrailValue: 8.0,
  createdAt: "2026-09-01",
});

/** 지난 기간 Meta AAP: 비용 36,000 / 전환 5,000 → CPA 7.20 */
const PREVIOUS = [{ campaign: "Meta AAP", cost: 36_000, actions: 5_000 }, { campaign: "ASA Brand", cost: 5_000, actions: 700 }];
/** 이번: 비용 +14.1% · 전환 +16.8% → CPA 7.03 (가드레일 $8 안) */
const CURRENT_WORKED = [{ campaign: "Meta AAP", cost: 41_076, actions: 5_840 }, { campaign: "ASA Brand", cost: 5_000, actions: 700 }];

const HISTORY = [4_800, 5_200, 4_900, 5_150, 4_950, 5_100, 5_000];

function score(currentRows, overrides = {}) {
  return scoreDecision({
    decision: { ...DECISION, ...(overrides.decision || {}) },
    current: snap(CUR, currentRows),
    previous: snap(PREV, overrides.previousRows || PREVIOUS),
    history: overrides.history === undefined ? HISTORY : overrides.history,
  });
}

describe("금액 표기 읽기", () => {
  it("퍼센트만 비율로 읽는다", () => {
    expect(parsePercentAmount("+15%")).toBeCloseTo(0.15, 12);
    expect(parsePercentAmount("-10 %")).toBeCloseTo(-0.1, 12);
    expect(parsePercentAmount(15)).toBeCloseTo(0.15, 12);
  });

  it("절대금액이나 빈 값은 비율이 아니다", () => {
    // "+$5,000"을 0.05로 읽으면 실행 판정이 통째로 틀린다.
    expect(parsePercentAmount("+$5,000")).toBeNull();
    expect(parsePercentAmount("증액")).toBeNull();
    expect(parsePercentAmount(null)).toBeNull();
    expect(parsePercentAmount("")).toBeNull();
  });
});

describe("대상 좁히기", () => {
  it("캠페인 또는 채널 이름으로 고른다", () => {
    const snapshot = buildSnapshot({
      period: CUR,
      rows: [
        { date: CUR.start, campaign: "Meta AAP", channel: "Meta", cost: 10 },
        { date: CUR.start, campaign: "Meta RT", channel: "Meta", cost: 20 },
        { date: CUR.start, campaign: "UAC A", channel: "Google", cost: 30 },
      ],
    });
    expect(rowsForTarget(snapshot, "Meta AAP")).toHaveLength(1);
    expect(rowsForTarget(snapshot, "Meta")).toHaveLength(2);
    expect(rowsForTarget(snapshot, "없는 캠페인")).toHaveLength(0);
    expect(rowsForTarget(snapshot, "")).toHaveLength(0);
  });
});

describe("판정 5단계", () => {
  it("목표 달성 + 가드레일 안 = 효과 있었음", () => {
    const result = score(CURRENT_WORKED);
    expect(result.outcome).toBe(DECISION_OUTCOME.WORKED);
    expect(result.checks.goal.pass).toBe(true);
    expect(result.checks.guardrail.pass).toBe(true);
    expect(result.checks.guardrail.actual).toBeCloseTo(41_076 / 5_840, 10);
    expect(result.checks.applied.pass).toBe(true);
  });

  it("목표는 달성했는데 가드레일을 넘으면 MIXED", () => {
    // 전환은 크게 늘었지만 CPA가 $8을 넘는다
    const result = score([{ campaign: "Meta AAP", cost: 50_000, actions: 5_840 }]);
    expect(result.checks.goal.pass).toBe(true);
    expect(result.checks.guardrail.pass).toBe(false);
    expect(result.outcome).toBe(DECISION_OUTCOME.MIXED);
  });

  it("목표 미달 + 가드레일 안 = NO_EFFECT", () => {
    // 비용은 +5.6% 늘렸는데 전환은 +2%(무유의) — CPA 7.45로 가드레일 안
    const result = score([{ campaign: "Meta AAP", cost: 38_000, actions: 5_100 }]);
    expect(result.checks.goal.pass).toBe(false);
    expect(result.checks.guardrail.pass).toBe(true);
    expect(result.outcome).toBe(DECISION_OUTCOME.NO_EFFECT);
  });

  it("목표 미달 + 가드레일 이탈 = 역효과", () => {
    const result = score([{ campaign: "Meta AAP", cost: 46_000, actions: 5_100 }]);
    expect(result.outcome).toBe(DECISION_OUTCOME.BACKFIRED);
  });

  it("예산이 움직이지 않았으면 NOT_APPLIED — 목표를 채점하지 않는다", () => {
    const result = score([{ campaign: "Meta AAP", cost: 36_200, actions: 5_840 }]);
    expect(result.outcome).toBe(DECISION_OUTCOME.NOT_APPLIED);
    expect(result.checks.goal).toBeNull();
    expect(result.checks.applied.pass).toBe(false);
  });

  it("반대 방향으로 움직였어도 실행된 것이 아니다", () => {
    const result = score([{ campaign: "Meta AAP", cost: 30_000, actions: 5_840 }]);
    expect(result.outcome).toBe(DECISION_OUTCOME.NOT_APPLIED);
  });

  it("예정치의 1/3을 넘으면 실행된 것으로 본다", () => {
    // +15%의 1/3 = +5%. 36,000 × 1.05 = 37,800
    const result = score([{ campaign: "Meta AAP", cost: 37_800, actions: 5_840 }]);
    expect(result.checks.applied.pass).toBe(true);
    expect(result.outcome).not.toBe(DECISION_OUTCOME.NOT_APPLIED);
  });
});

describe("옛 레코드를 추측으로 채우지 않는다", () => {
  it("목표·가드레일이 없으면 UNSCORED이고 무엇이 없는지 말한다", () => {
    const result = scoreDecision({
      // v8 레코드에는 이 필드들이 아예 없다.
      decision: { action: "Meta 예산 증액", actionTarget: "Meta AAP", createdAt: "2026-08-11" },
      current: snap(CUR, CURRENT_WORKED),
      previous: snap(PREV, PREVIOUS),
    });
    expect(result.outcome).toBe(DECISION_OUTCOME.UNSCORED);
    expect(result.reason).toBe("no_terms_recorded");
    expect(result.missing.sort()).toEqual(["goal", "guardrail"]);
    expect(result.checks).toBeNull();
  });

  it("가드레일만 없어도 채점하지 않는다", () => {
    const result = score(CURRENT_WORKED, { decision: { guardrailValue: null } });
    expect(result.outcome).toBe(DECISION_OUTCOME.UNSCORED);
    expect(result.missing).toEqual(["guardrail"]);
  });

  it("대상이 데이터에 없으면 NO_DATA — 0으로 채우지 않는다", () => {
    const gone = score([{ campaign: "다른 캠페인", cost: 41_076, actions: 5_256 }]);
    expect(gone.outcome).toBe(DECISION_OUTCOME.NO_DATA);
    expect(gone.reason).toBe("target_missing_in_current");

    const brandNew = score(CURRENT_WORKED, { previousRows: [{ campaign: "ASA Brand", cost: 5_000, actions: 700 }] });
    expect(brandNew.outcome).toBe(DECISION_OUTCOME.NO_DATA);
    expect(brandNew.reason).toBe("target_missing_in_previous");
  });

  it("가드레일 지표를 잴 수 없으면 UNSCORED", () => {
    const result = score([{ campaign: "Meta AAP", cost: 41_076, actions: 5_840 }], {
      decision: { guardrailMetric: "roas", guardrailValue: 1.5, guardrailOp: "gte" },
    });
    expect(result.checks.guardrail.actual).toBeNull(); // 매출 컬럼이 없다
    expect(result.outcome).toBe(DECISION_OUTCOME.UNSCORED);
    expect(result.reason).toBe("guardrail_not_measurable");
  });
});

describe("무유의를 성공으로도 실패로도 단정하지 않는다", () => {
  it("NO_EFFECT는 '효과 없음'이 아니다", () => {
    const result = score([{ campaign: "Meta AAP", cost: 38_000, actions: 5_100 }]);
    expect(result.outcome).toBe(DECISION_OUTCOME.NO_EFFECT);
    // 1주 표본으로 효과를 부정할 검정력이 없다. 화면 문구가 이 플래그를 따라야 한다.
    expect(result.meansNoEffect).toBe(false);
  });

  it("작은 변화를 목표 달성이라고 부르지 않는다", () => {
    // 전환 +1.2% — 예산은 실행됐지만 목표라고 하기엔 작다
    const result = score([{ campaign: "Meta AAP", cost: 38_000, actions: 5_060 }]);
    expect(result.checks.goal.pass).toBe(false);
    expect(result.checks.goal.assessment.reason).toBe("change_too_small");
  });

  it("가드레일은 유의미성을 묻지 않는다 — 넘었으면 넘은 것이다", () => {
    const result = score([{ campaign: "Meta AAP", cost: 50_000, actions: 5_840 }]);
    expect(result.checks.guardrail.actual).toBeGreaterThan(8);
    expect(result.checks.guardrail.pass).toBe(false);
    expect(result.checks.guardrail).not.toHaveProperty("assessment");
  });
});

describe("목표 방향", () => {
  it("유지가 목표면 유의미하게 나빠지지 않은 것으로 충분하다", () => {
    const hold = score([{ campaign: "Meta AAP", cost: 38_000, actions: 5_100 }], {
      decision: { goalDirection: "hold" },
    });
    expect(hold.checks.goal.pass).toBe(true);
    expect(hold.outcome).toBe(DECISION_OUTCOME.WORKED);
  });

  it("유지가 목표여도 유의미하게 나빠지면 실패다", () => {
    const hold = score([{ campaign: "Meta AAP", cost: 41_076, actions: 3_400 }], {
      decision: { goalDirection: "hold" },
    });
    expect(hold.checks.goal.pass).toBe(false);
  });

  it("낮추는 것이 목표면 내려가야 달성이다", () => {
    // CPA 7.20 → 6.51 (−9.6%), 평소 범위 7.13~7.26 밖
    const down = score([{ campaign: "Meta AAP", cost: 38_000, actions: 5_840 }], {
      decision: { goalMetric: "cpa", goalDirection: "down" },
      history: [7.3, 7.1, 7.25, 7.15, 7.2, 7.18, 7.2],
    });
    expect(down.checks.goal.assessment.outcome).toBe("better");
    expect(down.checks.goal.pass).toBe(true);
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    expect(JSON.stringify(score(CURRENT_WORKED))).toBe(JSON.stringify(score(CURRENT_WORKED)));
  });

  it("결정이 없으면 지어내지 않는다", () => {
    const result = scoreDecision({});
    expect(result.outcome).toBe(DECISION_OUTCOME.UNSCORED);
    expect(result.reason).toBe("no_decision");
  });
});
