import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT, KPI_OPTIONS, kpiFor, pickDecisionToScore, runReview } from "./reviewPipeline";
import { mergeSnapshots } from "./snapshotStore";
import { buildSnapshot } from "./snapshot";
import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./significance";

/** 하루씩 펼친 두 주 — 이번(08-31~09-06) · 지난(08-24~08-30). */
function rows({ currentCost = 44_000, currentActions = 3_650 } = {}) {
  const week = (startDay, list) =>
    list.flatMap((row) =>
      Array.from({ length: 7 }, (_, day) => ({
        date: `2026-0${startDay + day > 31 ? 9 : 8}-${String(((startDay + day - 1) % 31) + 1).padStart(2, "0")}`,
        ...row,
        cost: row.cost / 7,
        actions: row.actions / 7,
      })),
    );
  return [
    ...week(24, [{ campaign: "UAC A", channel: "Google", cost: 30_000, actions: 3_600 },
      { campaign: "AAP", channel: "Meta", cost: 36_000, actions: 5_000 }]),
    ...week(31, [{ campaign: "UAC A", channel: "Google", cost: currentCost, actions: currentActions },
      { campaign: "AAP", channel: "Meta", cost: 37_000, actions: 5_050 }]),
  ];
}

/** 최근 8주 이력 — CPA가 7.2 근처에서 흔들린다. */
function storedHistory() {
  let list = [];
  const weeks = [
    ["2026-07-06", 30_000, 4_150], ["2026-07-13", 31_000, 4_300],
    ["2026-07-20", 30_500, 4_240], ["2026-07-27", 31_500, 4_370],
    ["2026-08-03", 30_800, 4_280], ["2026-08-10", 31_200, 4_330],
    ["2026-08-17", 30_900, 4_290],
  ];
  for (const [start, cost, actions] of weeks) {
    list = mergeSnapshots(list, buildSnapshot({
      period: { start, end: start, days: 7 },
      rows: [{ date: start, campaign: "UAC A", cost, actions }],
    }));
  }
  return list;
}

describe("KPI 선택", () => {
  it("방향은 지표가 소유한다 — 사용자가 고르게 하면 CPA를 '높을수록 좋음'으로 둘 수 있다", () => {
    expect(kpiFor("cpa").direction).toBe(LOWER_IS_BETTER);
    expect(kpiFor("roas").direction).toBe(HIGHER_IS_BETTER);
    expect(kpiFor("conversions").direction).toBe(HIGHER_IS_BETTER);
  });

  it("모르는 지표는 기본값으로 떨어지되 방향이 뒤집히지 않는다", () => {
    expect(kpiFor("없는지표").metric).toBe(KPI_OPTIONS[0].metric);
    expect(kpiFor("없는지표").direction).toBe(LOWER_IS_BETTER);
  });

  it("기준(설치/가입)은 따로 받는다", () => {
    expect(kpiFor("cpa", "installs").basis).toBe("installs");
  });
});

describe("이력이 있으면 평소 범위를 안다", () => {
  it("저장된 스냅샷 없이는 크기·표본 두 축만 남는다", () => {
    const review = runReview({ rows: rows() });
    expect(review.ok).toBe(true);
    expect(review.routing.kpi.baselineKnown).toBe(false);
    expect(review.routing.kpi.checks.variability.skipped).toBe(true);
  });

  it("저장된 스냅샷이 있으면 세 축으로 판정한다", () => {
    const review = runReview({ rows: rows(), storedSnapshots: storedHistory() });
    expect(review.routing.kpi.baselineKnown).toBe(true);
    expect(review.routing.kpi.z).not.toBeNull();
    expect(review.routing.kpi.checks.variability.skipped).toBe(false);
  });

  it("이번 기간은 이력에서 빠진다 — 자기 자신과 비교하지 않는다", () => {
    const withCurrent = mergeSnapshots(storedHistory(), buildSnapshot({
      period: { start: "2026-08-31", end: "2026-09-06", days: 7 },
      rows: [{ date: "2026-08-31", campaign: "UAC A", cost: 44_000, actions: 3_650 }],
    }));
    const review = runReview({ rows: rows(), storedSnapshots: withCurrent });
    expect(review.history.cpa).toHaveLength(7); // 8장 중 이번 주 1장이 빠졌다
  });

  it("평소 범위를 알면 같은 변화도 다르게 판정될 수 있다", () => {
    const quietRows = rows({ currentCost: 31_500, currentActions: 3_610 });
    const withHistory = runReview({ rows: quietRows, storedSnapshots: storedHistory() });
    expect(withHistory.routing.kpi.baselineKnown).toBe(true);
    // 평소 범위를 아는 쪽은 사유를 구체적으로 말할 수 있다.
    expect(["within_normal_range", "change_too_small", "no_signal", null]).toContain(withHistory.routing.reason);
  });
});

describe("지난 결정 고르기", () => {
  const records = [
    { id: "old", createdAt: "2026-08-10", actionTarget: "AAP" },
    { id: "recent", createdAt: "2026-08-25", actionTarget: "UAC A" },
    { id: "thisWeek", createdAt: "2026-09-02", actionTarget: "AAP" },
  ];

  it("이번 기간이 시작되기 전 결정만 채점 대상이다", () => {
    // 이번 주에 내린 결정을 이번 주 결과로 채점하면 인과가 뒤집힌다.
    expect(pickDecisionToScore(records, { currentPeriodStart: "2026-08-31" }).id).toBe("recent");
  });

  it("가장 최근 것을 고른다", () => {
    expect(pickDecisionToScore(records, { currentPeriodStart: "2026-12-01" }).id).toBe("thisWeek");
  });

  it("날짜가 없는 레코드는 고르지 않는다 — 언제 내린 결정인지 모르면 채점할 수 없다", () => {
    expect(pickDecisionToScore([{ id: "x" }], { currentPeriodStart: "2026-08-31" })).toBeNull();
    expect(pickDecisionToScore([], {})).toBeNull();
    expect(pickDecisionToScore(null, {})).toBeNull();
  });
});

describe("지난 결정 채점이 화면까지 연결된다", () => {
  const decision = {
    id: "d1",
    createdAt: "2026-08-25",
    actionKind: "increase_budget",
    actionTarget: "Google / UAC A",
    actionAmount: "+15%",
    goalMetric: "conversions",
    goalDirection: "up",
    guardrailMetric: "cpa",
    guardrailOp: "lte",
    guardrailValue: 9,
  };

  it("v9 필드가 있으면 판정이 붙는다", () => {
    const review = runReview({ rows: rows(), decisionRecords: [decision], storedSnapshots: storedHistory() });
    expect(review.lastDecision).not.toBeNull();
    expect(review.lastDecision.score.outcome).toBeTruthy();
    // 대상을 못 찾으면 checks가 null로 떨어진다 — 합성 라벨 매칭이 실제로 붙었는지 본다.
    expect(review.lastDecision.score.outcome).not.toBe("NO_DATA");
    expect(review.lastDecision.score.checks).toBeTruthy();
  });

  it("v8 레코드는 판정 불가로 남고 추측하지 않는다", () => {
    const legacy = { id: "d0", createdAt: "2026-08-25", action: "Meta 예산 증액" };
    const review = runReview({ rows: rows(), decisionRecords: [legacy] });
    expect(review.lastDecision.score.outcome).toBe("UNSCORED");
    expect(review.lastDecision.score.reason).toBe("no_terms_recorded");
  });

  it("결정이 없으면 그 자리를 비운다", () => {
    expect(runReview({ rows: rows() }).lastDecision).toBeNull();
  });
});

describe("사용자 날짜 필터", () => {
  it("지정한 기간으로 비교한다", () => {
    const review = runReview({
      rows: rows(),
      customPeriod: { currentStart: "2026-08-31", currentEnd: "2026-09-02" },
    });
    expect(review.periods.current).toEqual({ start: "2026-08-31", end: "2026-09-02", days: 3 });
    expect(review.periods.previous.days).toBe(3);
    expect(review.periods.partial).toBe(true);
  });

  it("길이가 다르면 막지 않고 경고를 남긴다", () => {
    const review = runReview({
      rows: rows(),
      customPeriod: {
        currentStart: "2026-08-31", currentEnd: "2026-09-06",
        previousStart: "2026-08-28", previousEnd: "2026-08-30",
      },
    });
    expect(review.ok).toBe(true);
    expect(review.periods.warnings).toContain("length_mismatch");
  });
});

describe("계산할 수 없으면 사유를 준다", () => {
  it("행이 없으면 no_rows", () => {
    expect(runReview({ rows: [] }).reason).toBe("no_rows");
  });

  it("비교할 지난 기간이 없으면 사유가 남는다", () => {
    const onlyOneWeek = rows().filter((row) => row.date >= "2026-08-31");
    const review = runReview({ rows: onlyOneWeek });
    expect(review.ok).toBe(false);
    expect(review.reason).toBe("no_previous_data");
  });

  it("기본 프로젝트는 CPA·가입 기준·낮을수록 좋음이다", () => {
    expect(DEFAULT_PROJECT.kpi).toEqual({ metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER });
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    const args = { rows: rows(), storedSnapshots: storedHistory() };
    expect(JSON.stringify(runReview(args))).toBe(JSON.stringify(runReview(args)));
  });
});
