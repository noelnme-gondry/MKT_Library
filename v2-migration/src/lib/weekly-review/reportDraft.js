/**
 * 주간 보고서 초안 조립.
 *
 * Weekly Review를 끝내면 보고서 내용은 **이미 정해져 있다**. 그래서 기존 `/weekly-report`처럼
 * 카드를 하나씩 골라 담게 하지 않고 자동으로 만든다.
 *
 * 이 모듈은 **받은 것만 쓴다.** 원인 분석을 돌리지 않았으면 "왜" 절이 없고, 지난 결정이 없으면
 * 그 절이 없다. 빈 절을 만들어 두고 "—"로 채우면 보고서를 받는 사람이 그걸 "확인했는데 없음"
 * 으로 읽는다. 없는 것은 절 자체가 없어야 한다.
 *
 * 초안은 **구조화된 데이터**이고 문자열 렌더는 따로다. 통화 표기는 앱의 `utils/format.js`가
 * 소유하므로 여기서 다시 만들지 않고 렌더러가 주입받는다.
 */

import { DECISION_OUTCOME } from "./decisionScore";

/** 판정 → 화면·보고서 문구. `NO_EFFECT`를 "효과 없음"이라고 쓰지 않는다. */
export const OUTCOME_LABEL = Object.freeze({
  [DECISION_OUTCOME.WORKED]: "효과 있었음",
  [DECISION_OUTCOME.MIXED]: "목표는 달성, 가드레일 이탈",
  [DECISION_OUTCOME.NO_EFFECT]: "뚜렷한 변화를 확인하지 못함",
  [DECISION_OUTCOME.BACKFIRED]: "역효과",
  [DECISION_OUTCOME.NOT_APPLIED]: "실행되지 않은 것으로 보임",
  [DECISION_OUTCOME.NO_DATA]: "대상 데이터가 없어 확인 불가",
  [DECISION_OUTCOME.UNSCORED]: "판정 불가",
});

const ACTION_LABEL = Object.freeze({
  increase_budget: "예산 증액",
  decrease_budget: "예산 감액",
  hold: "유지",
  replace: "소재 교체",
  investigate: "추가 확인",
});

function section(id, title, body) {
  return { id, title, ...body };
}

/**
 * 보고서 초안을 만든다.
 *
 * @param {object} project      `{ name, kpi }`
 * @param {object} period       `{ start, end, days }`
 * @param {object} previousPeriod
 * @param {object} routing      `routeAnalyses()` 결과
 * @param {object[]} drivers    원인 상위 항목 `[{ label, share }]` — 없으면 "왜" 절을 만들지 않는다
 * @param {object} split        `{ efficiency, mix }` 기여 비율 — 없으면 문장을 만들지 않는다
 * @param {object} lastDecision `{ decision, score }` — 없으면 그 절이 없다
 * @param {object} thisDecision 이번 주에 저장한 결정
 */
export function buildReportDraft({
  project = {},
  period = null,
  previousPeriod = null,
  routing = null,
  drivers = [],
  split = null,
  lastDecision = null,
  thisDecision = null,
} = {}) {
  if (!period || !routing) {
    return { ok: false, reason: !period ? "no_period" : "no_routing", sections: [] };
  }

  const sections = [];
  const kpiName = project.kpi?.metric ?? null;
  const assessment = routing.kpi;

  // ── 성과 ────────────────────────────────────────────────
  if (assessment && assessment.deltaPct !== null) {
    sections.push(section("performance", "성과", {
      metric: kpiName,
      delta: assessment.delta,
      deltaPct: assessment.deltaPct,
      outcome: assessment.outcome,
      significant: assessment.significant,
      baselineKnown: assessment.baselineKnown,
    }));
  } else {
    sections.push(section("performance", "성과", {
      metric: kpiName,
      deltaPct: null,
      unmeasured: true,
      reason: assessment?.reason ?? routing.reason ?? null,
    }));
  }

  // ── 무엇이 바뀌었나 ──────────────────────────────────────
  if (routing.status === "quiet") {
    sections.push(section("what_changed", "무엇이 바뀌었나", {
      text: "평소 변동 범위 안에서 유지됐습니다.",
      quiet: true,
    }));
  } else if (routing.status === "unknown") {
    sections.push(section("what_changed", "무엇이 바뀌었나", {
      text: "이번 기간의 핵심 지표를 잴 수 없어 판정하지 못했습니다.",
      unmeasured: true,
    }));
  } else if (drivers.length > 0) {
    sections.push(section("what_changed", "무엇이 바뀌었나", {
      text: `${drivers[0].label}의 영향이 가장 컸습니다.`,
      drivers: drivers.slice(0, 3),
    }));
  } else {
    // 신호는 있는데 원인 항목을 못 받았다. 지어내지 않고 그 사실을 남긴다.
    sections.push(section("what_changed", "무엇이 바뀌었나", {
      text: "변화는 확인했지만 원인을 캠페인 수준까지 좁히지 못했습니다.",
      drivers: [],
    }));
  }

  // ── 왜 (분해가 실제로 돌았을 때만) ────────────────────────
  const ranVariance = (routing.run || []).some((entry) => entry.analysis === "variance");
  if (ranVariance && split && Number.isFinite(split.efficiency) && Number.isFinite(split.mix)) {
    sections.push(section("why", "왜", {
      efficiency: split.efficiency,
      mix: split.mix,
      lead: split.efficiency >= split.mix ? "efficiency" : "mix",
    }));
  }

  // ── 지난 결정의 결과 (있을 때만) ──────────────────────────
  if (lastDecision && lastDecision.decision && lastDecision.score) {
    const { decision, score } = lastDecision;
    sections.push(section("last_decision", "지난 결정의 결과", {
      action: describeAction(decision),
      decidedAt: decision.createdAt ?? null,
      outcome: score.outcome,
      label: OUTCOME_LABEL[score.outcome] ?? null,
      goal: score.checks?.goal ?? null,
      guardrail: score.checks?.guardrail ?? null,
      reason: score.reason ?? null,
    }));
  }

  // ── 이번 주 결정 / 다음 주 확인 ───────────────────────────
  if (thisDecision) {
    sections.push(section("this_decision", "이번 주 결정", { action: describeAction(thisDecision) }));
    if (thisDecision.guardrailMetric && thisDecision.guardrailOp) {
      sections.push(section("watch_next", "다음 주 확인", {
        metric: thisDecision.guardrailMetric,
        op: thisDecision.guardrailOp,
        value: thisDecision.guardrailValue ?? null,
      }));
    }
  }

  return {
    ok: true,
    reason: null,
    title: project.name ? `Weekly Performance Review — ${project.name}` : "Weekly Performance Review",
    period,
    previousPeriod,
    sections,
  };
}

export function describeAction(decision) {
  if (!decision) return null;
  const kind = ACTION_LABEL[decision.actionKind] ?? decision.actionKind ?? null;
  const target = decision.actionTarget ?? null;
  const amount = decision.actionAmount ?? null;
  return [target, kind, amount].filter(Boolean).join(" ") || null;
}

const OP_TEXT = { lte: "≤", gte: "≥" };

/** 기본 포맷터 — 앱에서는 `utils/format.js`를 주입해 통화 규칙을 하나로 유지한다. */
const PLAIN_FORMAT = {
  percent: (value) => (value === null || value === undefined ? "—" : `${value >= 0 ? "+" : "−"}${(Math.abs(value) * 100).toFixed(1)}%`),
  number: (value) => (value === null || value === undefined ? "—" : String(value)),
};

/** 초안을 붙여넣기 좋은 평문으로. 절이 없으면 제목도 나오지 않는다. */
export function renderReportText(draft, format = PLAIN_FORMAT) {
  if (!draft || !draft.ok) return "";
  const fmt = { ...PLAIN_FORMAT, ...format };
  const lines = [draft.title];

  const periodText = draft.previousPeriod
    ? `${draft.period.start} ~ ${draft.period.end} (vs ${draft.previousPeriod.start} ~ ${draft.previousPeriod.end})`
    : `${draft.period.start} ~ ${draft.period.end}`;
  lines.push(periodText, "");

  for (const item of draft.sections) {
    const body = renderSection(item, fmt);
    if (!body) continue; // 내용이 없으면 제목도 쓰지 않는다
    lines.push(`■ ${item.title}`, `  ${body}`, "");
  }

  return lines.join("\n").trimEnd();
}

function renderSection(item, fmt) {
  switch (item.id) {
    case "performance":
      if (item.unmeasured) return "핵심 지표를 잴 수 없었습니다.";
      return `${item.metric ?? "핵심 지표"} ${fmt.percent(item.deltaPct)}`
        + (item.baselineKnown ? "" : " (평소 변동 범위는 아직 모름)");
    case "what_changed":
      return item.text;
    case "why": {
      const eff = fmt.percent(item.efficiency).replace(/^[+−]/, "");
      const mix = fmt.percent(item.mix).replace(/^[+−]/, "");
      return `효율 저하가 ${eff}, 예산 믹스 변화가 ${mix}를 설명합니다.`;
    }
    case "last_decision": {
      const head = `${item.action ?? "지난 결정"} → ${item.label ?? "판정 불가"}`;
      if (item.outcome === "UNSCORED") return `${head} (목표·가드레일이 기록되지 않았습니다)`;
      if (item.outcome === "NO_EFFECT") {
        // "효과가 없다"고 쓰지 않는다 — 1주 표본으로 효과를 부정할 검정력이 없다.
        return `${head}. 효과가 없다는 뜻은 아닙니다.`;
      }
      return head;
    }
    case "this_decision":
      return item.action;
    case "watch_next":
      return `${item.metric} ${OP_TEXT[item.op] ?? item.op} ${fmt.number(item.value)}`;
    default:
      return null;
  }
}
