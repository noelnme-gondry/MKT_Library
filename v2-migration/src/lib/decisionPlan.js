// User-defined success criteria. Never infer a causal effect from a threshold comparison.
export const PLAN_MODES = Object.freeze({
  at_least: ["목표값 이상", "At least"], at_most: ["목표값 이하", "At most"],
  increase_percent: ["기준 대비 % 증가", "% increase from baseline"], decrease_percent: ["기준 대비 % 감소", "% decrease from baseline"],
  increase_absolute: ["기준 대비 수량 증가", "Absolute increase from baseline"], decrease_absolute: ["기준 대비 수량 감소", "Absolute decrease from baseline"],
});
export const PLAN_METHODS = Object.freeze({ observe: ["같은 조건의 전후 관측", "Before/after observation"], holdout: ["채널 홀드아웃 실험", "Channel holdout experiment"], controlled: ["대조군 실험", "Controlled experiment"], rerun: ["원본 도구 재분석", "Rerun source analysis"] });
const text = (value, max = 400) => typeof value === "string" || typeof value === "number" ? String(value).slice(0, max) : "";
export function readDecisionPlan(value) {
  try {
    const input = typeof value === "string" ? JSON.parse(value) : value;
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    return { method: Object.hasOwn(PLAN_METHODS, input.method) ? input.method : "", mode: Object.hasOwn(PLAN_MODES, input.mode) ? input.mode : "",
      value: text(input.value, 40), baseline: text(input.baseline, 40), unit: text(input.unit, 40), target: text(input.target, 160), control: text(input.control), window: text(input.window), metric: text(input.metric, 100) };
  } catch { return {}; }
}
export function serializeDecisionPlan(input) {
  const plan = readDecisionPlan(input);
  return Object.values(plan).some(Boolean) ? JSON.stringify(plan) : "";
}
const number = value => { const raw = String(value ?? "").trim(); return raw && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : null; };
export function decisionPlanError(input, locale = "ko") {
  const p = readDecisionPlan(input), en = locale === "en";
  if (p.mode && (number(p.value) === null || !p.unit?.trim())) return en ? "Enter a numeric target and the measurement unit." : "목표값과 측정 단위를 입력하세요.";
  if (p.mode && !p.mode.startsWith("at_") && (number(p.value) < 0 || number(p.baseline) === null)) return en ? "Enter a nonnegative change target and a numeric baseline." : "변화 목표는 0 이상으로, 기준값은 숫자로 입력하세요.";
  if (p.mode?.endsWith("percent") && number(p.baseline) <= 0) return en ? "A percentage change needs a baseline greater than zero." : "% 변화는 0보다 큰 기준값이 필요합니다.";
  if (["holdout", "controlled"].includes(p.method) && (!p.target?.trim() || !p.control?.trim() || !p.window?.trim())) return en ? "Record the experiment target, comparison group and observation window." : "실험 대상·비교군·관측 기간을 기록하세요.";
  return "";
}
export function assessDecisionPlan(input, observed) {
  const p = readDecisionPlan(input);
  if (!p.mode || decisionPlanError(p)) return { state: "incomplete" };
  const actual = number(observed); if (actual === null) return { state: "waiting" };
  const baseline = number(p.baseline), target = number(p.value);
  const measured = p.mode.startsWith("at_") ? actual : p.mode.endsWith("percent") ? (actual - baseline) / baseline * 100 : actual - baseline;
  if (!Number.isFinite(measured)) return { state: "incomplete" };
  const decreasing = p.mode.startsWith("decrease");
  // Ignore only floating-point roundoff, never a business-level tolerance.
  const compared = decreasing ? -measured : measured;
  const equalWithinRoundoff = Math.abs(compared - target) <= Number.EPSILON * Math.max(Math.abs(compared), Math.abs(target)) * 8;
  const met = equalWithinRoundoff || (p.mode === "at_most" ? measured <= target : compared >= target);
  return { state: met ? "met" : "not_met", measured, target };
}
export function decisionPlanRows(input, locale = "ko") {
  const p = readDecisionPlan(input), en = locale === "en", lang = en ? 1 : 0;
  return [[en ? "Review method" : "검토 방법", PLAN_METHODS[p.method]?.[lang]], [en ? "Target channel / group" : "대상 채널·집단", p.target], [en ? "Comparison group" : "비교군", p.control], [en ? "Observation window" : "관측 기간", p.window], [en ? "Success metric" : "목표 지표", p.metric], [en ? "Operating target" : "운영 목표", p.mode ? `${PLAN_MODES[p.mode][lang]} ${p.value}${p.mode.endsWith("percent") ? "%" : ` ${p.unit}`}` : ""], [en ? "Baseline" : "기준값", p.baseline !== "" && p.baseline != null ? `${p.baseline} ${p.unit}` : ""]].filter(([, value]) => value);
}

export function needsExplicitPlanReview(input) {
  const p = readDecisionPlan(input);
  return Boolean(p.mode || ["holdout", "controlled"].includes(p.method));
}

// Descriptive change and operating progress are not an experiment effect estimate.
export function decisionObservationRows(input, observed, locale = "ko") {
  const p = readDecisionPlan(input), en = locale === "en";
  const actual = number(observed), baseline = number(p.baseline), target = number(p.value);
  if (actual === null) return [];
  const fmt = value => value.toLocaleString(en ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  const signed = value => `${value > 0 ? "+" : ""}${fmt(value)}`;
  const rows = [[en ? "Observed value" : "실제 관측값", `${fmt(actual)} ${p.unit || ""}`]];
  if (baseline !== null) {
    const change = actual - baseline;
    if (Number.isFinite(change)) rows.push([en ? "Observed change (not causal lift)" : "관측 변화량 (인과효과 아님)", `${signed(change)} ${p.unit}${baseline > 0 && Number.isFinite(change / baseline * 100) ? ` (${signed(change / baseline * 100)}%)` : ""}`]);
  }
  const assessment = assessDecisionPlan(p, observed);
  if (["met", "not_met"].includes(assessment.state)) {
    const changed = !p.mode.startsWith("at_");
    const measured = p.mode.startsWith("decrease") ? -assessment.measured : assessment.measured;
    if (changed && target > 0 && Number.isFinite(measured / target * 100)) rows.push([en ? "Operating target progress (not recovery share)" : "운영 목표 진행률 (카니발 회복률 아님)", `${fmt(measured / target * 100)}%`]);
    rows.push([en ? "Operating target comparison" : "운영 목표 비교", assessment.state === "met" ? (en ? "Reached; effect evidence must be reviewed separately" : "목표 도달 · 효과 근거는 별도 검토") : (en ? "Below target; this does not mean no effect" : "목표 미달 · 효과 없음이라는 뜻 아님")]);
  }
  return rows;
}
