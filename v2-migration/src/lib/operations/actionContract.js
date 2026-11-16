// Small allowlisted project metadata only. Never stores CSV rows or prediction claims about creatives.
export const OPERATION_ACTION_KINDS = Object.freeze({
  budget: ["예산 조정", "Adjust budget"], creative_replace: ["소재 교체", "Replace creative"],
  creative_launch: ["소재 추가", "Launch creative"], creative_stop: ["소재 종료", "Stop creative"],
  investigate: ["추가 관찰", "Observe"],
});
const text = (value, max = 160) => String(value ?? "").slice(0, max);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value ? value : "";
const amount = value => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const positive = value => { const number = amount(value); return number != null && number > 0 ? number : null; };
// Budget forecasts only: daily planned spend and the model's daily outcomes over `days` from execution.
// Creatives never carry a forecast (no unit-cost prediction for launches, removals or replacements).
function readForecast(kind, input) {
  if (kind !== "budget" || !input || typeof input !== "object") return null;
  const days = Number(input.days);
  const forecast = { days, dailySpend: positive(input.dailySpend), dailyResults: positive(input.dailyResults),
    currentDailySpend: positive(input.currentDailySpend), currentDailyResults: positive(input.currentDailyResults) };
  return Number.isInteger(days) && days >= 1 && days <= 92 && Object.values(forecast).every(value => value != null) ? forecast : null;
}
function readPlanContext(context) {
  if (!context || !["maintain", "increase", "decrease"].includes(context.mode) || !date(context.start) || !date(context.end) || context.end < context.start || !(amount(context.totalBudget) > 0)) return null;
  const planId = /^[A-Za-z0-9-]{1,64}$/.test(String(context.planId || "")) ? String(context.planId) : "";
  const selected = Number(context.selected);
  const extra = planId && Number.isInteger(selected) && selected >= 1 && selected <= 60 && positive(context.expectedResults) != null && positive(context.baselineResults) != null
    ? { planId, selected, expectedResults: positive(context.expectedResults), baselineResults: positive(context.baselineResults) } : {};
  return { mode: context.mode, start: context.start, end: context.end, totalBudget: amount(context.totalBudget), ...extra };
}
export function readOperationAction(value) {
  try {
    const input = typeof value === "string" ? JSON.parse(value) : value;
    if (!input || input.version !== 1 || !Object.hasOwn(OPERATION_ACTION_KINDS, input.kind) || !input.target) return null;
    const target = { unit: input.target.unit === "channel" ? "channel" : "campaign", ...Object.fromEntries(["country", "platform", "channel", "source", "campaignId", "campaign"].map(key => [key, text(input.target[key])])) };
    if (!target.channel && !target.campaign && !target.campaignId) return null;
    const planContext = readPlanContext(input.planContext);
    const forecast = readForecast(input.kind, input.forecast);
    return { version: 1, kind: input.kind, target, creative: text(input.creative).trim(), replacementCreative: text(input.replacementCreative).trim(), note: text(input.note, 500).trim(),
      ...(planContext ? { planContext } : {}),
      ...(forecast ? { forecast } : {}),
      source: ["manual", "observed", "recommendation"].includes(input.source) ? input.source : "manual",
      eventId: text(input.eventId, 1200), state: ["planned", "executed", "cancelled"].includes(input.state) ? input.state : "planned",
      plannedDate: date(input.plannedDate), executedDate: date(input.executedDate),
      beforeBudget: amount(input.beforeBudget), afterBudget: amount(input.afterBudget),
      reviewDays: Number.isInteger(Number(input.reviewDays)) && input.reviewDays >= 1 && input.reviewDays <= 90 ? Number(input.reviewDays) : 7,
      metric: ["installs", "actions"].includes(input.metric) ? input.metric : "",
      currency: ["KRW", "USD"].includes(input.currency) ? input.currency : "" };
  } catch { return null; }
}
export function serializeOperationAction(value) {
  const action = readOperationAction(value);
  return action ? JSON.stringify(action) : "";
}
