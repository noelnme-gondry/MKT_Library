import { describe, expect, it } from "vitest";
import { OUTCOME_LABEL, buildReportDraft, describeAction, renderReportText } from "./reportDraft";
import { DECISION_OUTCOME } from "./decisionScore";

const PERIOD = { start: "2026-08-31", end: "2026-09-06", days: 7 };
const PREV = { start: "2026-08-24", end: "2026-08-30", days: 7 };
const PROJECT = { name: "Korea Android", kpi: { metric: "cpa", basis: "actions", direction: "lower_is_better" } };

function routing(overrides = {}) {
  return {
    status: "signal",
    reason: null,
    kpi: {
      significant: true, reason: null, delta: 0.62, deltaPct: 0.0836,
      z: 2.25, outcome: "worse", baselineKnown: true,
    },
    run: [{ analysis: "variance", triggers: ["kpi_change"], emphasis: [], evidence: [] }],
    skipped: [],
    ...overrides,
  };
}

function draft(overrides = {}) {
  return buildReportDraft({
    project: PROJECT,
    period: PERIOD,
    previousPeriod: PREV,
    routing: routing(),
    drivers: [{ label: "Google UAC A", share: 0.62 }],
    split: { efficiency: 0.75, mix: 0.25 },
    ...overrides,
  });
}

function sectionIds(result) {
  return result.sections.map((item) => item.id);
}

describe("받은 것만 쓴다 — 빈 절을 만들지 않는다", () => {
  it("원인 분해를 안 돌렸으면 '왜' 절이 없다", () => {
    expect(sectionIds(draft())).toContain("why");
    expect(sectionIds(draft({ split: null }))).not.toContain("why");
    expect(sectionIds(draft({ routing: routing({ run: [] }) }))).not.toContain("why");
  });

  it("지난 결정이 없으면 그 절이 없다", () => {
    expect(sectionIds(draft())).not.toContain("last_decision");
    const withDecision = draft({
      lastDecision: {
        decision: { actionKind: "increase_budget", actionTarget: "Meta AAP", actionAmount: "+15%", createdAt: "2026-09-01" },
        score: { outcome: DECISION_OUTCOME.WORKED, checks: { goal: {}, guardrail: {} }, reason: null },
      },
    });
    expect(sectionIds(withDecision)).toContain("last_decision");
  });

  it("이번 주 결정을 안 했으면 결정·다음주 확인 절이 없다", () => {
    expect(sectionIds(draft())).not.toContain("this_decision");
    expect(sectionIds(draft())).not.toContain("watch_next");
  });

  it("가드레일 없이 결정만 저장하면 '다음 주 확인'은 만들지 않는다", () => {
    const result = draft({ thisDecision: { actionKind: "decrease_budget", actionTarget: "UAC A", actionAmount: "-10%" } });
    expect(sectionIds(result)).toContain("this_decision");
    expect(sectionIds(result)).not.toContain("watch_next");
  });

  it("신호는 있는데 원인 항목을 못 받으면 지어내지 않고 그 사실을 쓴다", () => {
    const result = draft({ drivers: [] });
    const what = result.sections.find((item) => item.id === "what_changed");
    expect(what.text).toMatch(/좁히지 못했습니다/);
    expect(what.drivers).toEqual([]);
  });

  it("본문이 없는 절은 제목도 렌더되지 않는다", () => {
    const text = renderReportText(draft({ split: null }));
    expect(text).not.toMatch(/■ 왜/);
    expect(text).toMatch(/■ 성과/);
  });
});

describe("조용한 주와 판정 불가를 구분해서 쓴다", () => {
  it("조용한 주는 유지됐다고 쓰고 원인 절을 만들지 않는다", () => {
    const quiet = draft({
      routing: routing({
        status: "quiet", reason: "no_signal", run: [],
        kpi: { significant: false, reason: "change_too_small", delta: 0.06, deltaPct: 0.008, z: 0.13, outcome: "worse", baselineKnown: true },
      }),
      split: null,
    });
    expect(sectionIds(quiet)).not.toContain("why");
    expect(quiet.sections.find((item) => item.id === "what_changed").quiet).toBe(true);
    expect(renderReportText(quiet)).toMatch(/평소 변동 범위 안에서 유지/);
  });

  it("판정 불가는 조용함과 다른 문장을 쓴다", () => {
    const unknown = draft({
      routing: routing({
        status: "unknown", reason: "no_value", run: [],
        kpi: { significant: false, reason: "no_value", delta: null, deltaPct: null, z: null, outcome: "unknown", baselineKnown: false },
      }),
      split: null,
    });
    const text = renderReportText(unknown);
    expect(text).toMatch(/잴 수 없어/);
    expect(text).not.toMatch(/유지됐습니다/);
    expect(unknown.sections.find((item) => item.id === "performance").unmeasured).toBe(true);
  });

  it("평소 범위를 모르면 그 사실을 성과 줄에 붙인다", () => {
    const noBaseline = draft({
      routing: routing({ kpi: { ...routing().kpi, baselineKnown: false } }),
    });
    expect(renderReportText(noBaseline)).toMatch(/평소 변동 범위는 아직 모름/);
  });
});

describe("결정 결과를 정직하게 쓴다", () => {
  function withOutcome(outcome, reason = null) {
    return draft({
      lastDecision: {
        decision: { actionKind: "increase_budget", actionTarget: "Meta AAP", actionAmount: "+15%" },
        score: { outcome, reason, checks: { goal: {}, guardrail: {} } },
      },
    });
  }

  it("NO_EFFECT를 '효과 없음'이라고 쓰지 않는다", () => {
    const text = renderReportText(withOutcome(DECISION_OUTCOME.NO_EFFECT));
    expect(text).toMatch(/뚜렷한 변화를 확인하지 못함/);
    expect(text).toMatch(/효과가 없다는 뜻은 아닙니다/);
    // 이 문구가 보고서에 들어가면 검정력 없는 부정 주장이 된다.
    expect(text).not.toMatch(/효과 없음/);
  });

  it("판정 불가는 왜 못 했는지 함께 쓴다", () => {
    const text = renderReportText(withOutcome(DECISION_OUTCOME.UNSCORED, "no_terms_recorded"));
    expect(text).toMatch(/판정 불가/);
    expect(text).toMatch(/목표·가드레일이 기록되지 않았습니다/);
  });

  it("모든 판정에 문구가 있다 — 라벨 없는 판정이 남지 않는다", () => {
    for (const outcome of Object.values(DECISION_OUTCOME)) {
      expect(OUTCOME_LABEL[outcome]).toBeTruthy();
    }
    // 가드가 빈 목록을 보고 통과하지 않도록 개수도 본다.
    expect(Object.keys(OUTCOME_LABEL)).toHaveLength(Object.keys(DECISION_OUTCOME).length);
  });
});

describe("평문 렌더", () => {
  it("제목·기간·절이 순서대로 나온다", () => {
    const text = renderReportText(draft({
      lastDecision: {
        decision: { actionKind: "increase_budget", actionTarget: "Meta AAP", actionAmount: "+15%" },
        score: { outcome: DECISION_OUTCOME.WORKED, reason: null, checks: { goal: {}, guardrail: {} } },
      },
      thisDecision: {
        actionKind: "decrease_budget", actionTarget: "Google UAC A", actionAmount: "-10%",
        guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: 8,
      },
    }));
    expect(text.split("\n")[0]).toBe("Weekly Performance Review — Korea Android");
    expect(text).toMatch(/2026-08-31 ~ 2026-09-06 \(vs 2026-08-24 ~ 2026-08-30\)/);
    const order = ["■ 성과", "■ 무엇이 바뀌었나", "■ 왜", "■ 지난 결정의 결과", "■ 이번 주 결정", "■ 다음 주 확인"];
    let cursor = -1;
    for (const heading of order) {
      const next = text.indexOf(heading);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it("통화 표기는 주입받는다 — 여기서 만들지 않는다", () => {
    const text = renderReportText(
      draft({ thisDecision: { actionKind: "hold", actionTarget: "UAC A", guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: 8 } }),
      { number: (value) => `$${Number(value).toFixed(2)}` },
    );
    expect(text).toMatch(/cpa ≤ \$8\.00/);
  });

  it("행동 문장은 대상·종류·크기를 순서대로 붙인다", () => {
    expect(describeAction({ actionKind: "decrease_budget", actionTarget: "Google UAC A", actionAmount: "-10%" }))
      .toBe("Google UAC A 예산 감액 -10%");
    expect(describeAction({ actionKind: "investigate", actionTarget: "Meta AAP" })).toBe("Meta AAP 추가 확인");
    expect(describeAction(null)).toBeNull();
  });

  it("만들 수 없는 초안은 빈 문자열이지 반쪽 보고서가 아니다", () => {
    expect(buildReportDraft({ project: PROJECT }).ok).toBe(false);
    expect(buildReportDraft({ project: PROJECT }).reason).toBe("no_period");
    expect(buildReportDraft({ project: PROJECT, period: PERIOD }).reason).toBe("no_routing");
    expect(renderReportText(buildReportDraft({ project: PROJECT }))).toBe("");
  });

  it("프로젝트 이름이 없어도 제목을 지어내지 않는다", () => {
    const anon = buildReportDraft({ period: PERIOD, routing: routing() });
    expect(anon.title).toBe("Weekly Performance Review");
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    expect(renderReportText(draft())).toBe(renderReportText(draft()));
  });
});
