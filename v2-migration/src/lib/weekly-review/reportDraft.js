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
  [DECISION_OUTCOME.WORKED]: "목표 방향 변화·가드레일 충족",
  [DECISION_OUTCOME.MIXED]: "목표는 달성, 가드레일 이탈",
  [DECISION_OUTCOME.NO_EFFECT]: "뚜렷한 변화를 확인하지 못함",
  [DECISION_OUTCOME.BACKFIRED]: "목표 변화 미확인·가드레일 이탈",
  [DECISION_OUTCOME.NOT_APPLIED]: "지출에서 예정 변화 미확인",
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
  locale = "ko",
  notes = [],
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
      text: "설정한 확인 기준을 넘는 변화가 없습니다. 성과 동등성이나 효과 없음을 뜻하지 않습니다.",
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
      metric: kpiName === "cpi" ? "CPI" : "CPA",
      efficiency: split.efficiency,
      mix: split.mix,
      lead: split.efficiency >= split.mix ? "efficiency" : "mix",
    }));
  }

  // ── 지난 결정의 결과 (있을 때만) ──────────────────────────
  if (lastDecision && lastDecision.decision && lastDecision.score) {
    const { decision, score } = lastDecision;
    sections.push(section("last_decision", "지난 결정의 결과", {
      action: describeAction(decision, locale),
      decidedAt: decision.createdAt ?? null,
      outcome: score.outcome,
      label: outcomeLabel(score.outcome, locale),
      goal: score.checks?.goal ?? null,
      guardrail: score.checks?.guardrail ?? null,
      reason: score.reason ?? null,
    }));
  }

  // ── 이번 주 결정 / 다음 주 확인 ───────────────────────────
  if (thisDecision) {
    sections.push(section("this_decision", "이번 주 결정", { action: describeAction(thisDecision, locale) }));
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
    locale,
    notes,
    sections: locale === "en" ? sections.map(localizeSection) : sections,
  };
}

export function describeAction(decision, locale = "ko") {
  if (!decision) return null;
  const kind = (locale === "en" ? ACTION_LABEL_EN : ACTION_LABEL)[decision.actionKind] ?? decision.actionKind ?? null;
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
    const body = draft.locale === "en" ? renderEnglishSection(item, fmt) : renderSection(item, fmt);
    if (!body) continue; // 내용이 없으면 제목도 쓰지 않는다
    lines.push(`■ ${item.title}`, `  ${body}`, "");
  }

  for (const note of draft.notes || []) if (note) lines.push(String(note));
  return lines.join("\n").trimEnd();
}

const ACTION_LABEL_EN = { increase_budget: "Increase budget", decrease_budget: "Decrease budget", hold: "Hold", replace: "Replace creative", investigate: "Investigate" };
const OUTCOME_LABEL_EN = {
  WORKED: "Goal-direction change; guardrail met", MIXED: "Goal-direction change; guardrail exceeded",
  NO_EFFECT: "No clear goal-direction change confirmed", BACKFIRED: "Goal change unconfirmed; guardrail exceeded",
  NOT_APPLIED: "Planned change not observed in spend", NO_DATA: "Target data unavailable", UNSCORED: "Not scorable",
};
export function outcomeLabel(outcome, locale = "ko") {
  return (locale === "en" ? OUTCOME_LABEL_EN : OUTCOME_LABEL)[outcome] || (locale === "en" ? "Not scorable" : "판정 불가");
}
function localizeSection(item) {
  const titles = { performance: "Performance", what_changed: "What changed", why: "Breakdown", last_decision: "Last decision", this_decision: "This week's decision", watch_next: "Next review" };
  if (item.id !== "what_changed") return { ...item, title: titles[item.id] || item.title };
  const text = item.quiet ? "No change crossed the configured review criteria. This does not establish equivalence or no effect."
    : item.unmeasured ? "The headline metric could not be assessed."
      : item.drivers?.length ? `${item.drivers[0].label} had the largest arithmetic contribution within the breakdown scope.`
        : "A change was observed, but its campaign-level breakdown is unavailable.";
  return { ...item, title: titles[item.id], text };
}
function renderEnglishSection(item, fmt) {
  switch (item.id) {
    case "performance": return item.unmeasured ? "The headline metric could not be measured." : `${item.metric} ${fmt.percent(item.deltaPct)}` + (item.baselineKnown ? "" : " (usual variation is unknown)");
    case "what_changed": return item.text;
    case "why": return `${item.metric || "CPA"}-change contributions within the breakdown scope: efficiency ${fmt.percent(item.efficiency)}, result mix ${fmt.percent(item.mix)}. Arithmetic decomposition, not causal effects.`;
    case "last_decision": return `${item.action || "Last decision"} → ${item.label}` + (item.outcome === "NO_EFFECT" ? ". This does not establish no effect." : "");
    case "this_decision": return item.action;
    case "watch_next": return `${item.metric} ${OP_TEXT[item.op] || item.op} ${fmt.number(item.value)}`;
    default: return null;
  }
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
      const eff = fmt.percent(item.efficiency);
      const mix = fmt.percent(item.mix);
      return `분해 범위의 ${item.metric || "CPA"} 변화 기여: 효율 ${eff}, 결과 비중 변화 ${mix}. 인과효과가 아닌 산술 분해입니다.`;
    }
    case "last_decision": {
      const head = `${item.action ?? "지난 결정"} → ${item.label ?? "판정 불가"}`;
      if (item.outcome === "UNSCORED") return `${head} (${item.reason === "no_terms_recorded" ? "목표·가드레일이 기록되지 않았습니다" : item.reason === "comparison_context_mismatch" ? "저장 당시와 비교 기간·통화·전환 기준이 다릅니다" : "관측 근거 또는 사전 판정 기준이 부족합니다"})`;
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
