// Small allowlisted project metadata only. Never stores CSV rows or prediction claims about creatives.
export const OPERATION_ACTION_KINDS = Object.freeze({
  budget: ["예산 조정", "Adjust budget"], creative_replace: ["소재 교체", "Replace creative"],
  creative_launch: ["소재 추가", "Launch creative"], creative_stop: ["소재 종료", "Stop creative"],
  investigate: ["추가 관찰", "Observe"],
});
const text = (value, max = 160) => String(value ?? "").slice(0, max);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value ? value : "";
const amount = value => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export function readOperationAction(value) {
  try {
    const input = typeof value === "string" ? JSON.parse(value) : value;
    if (!input || input.version !== 1 || !Object.hasOwn(OPERATION_ACTION_KINDS, input.kind) || !input.target) return null;
    const target = { unit: input.target.unit === "channel" ? "channel" : "campaign", ...Object.fromEntries(["country", "platform", "channel", "source", "campaignId", "campaign"].map(key => [key, text(input.target[key])])) };
    if (!target.channel && !target.campaign && !target.campaignId) return null;
    const context = input.planContext;
    const planContext = context && ["maintain", "increase", "decrease"].includes(context.mode) && date(context.start) && date(context.end) && context.end >= context.start && amount(context.totalBudget) > 0
      ? { mode: context.mode, start: context.start, end: context.end, totalBudget: amount(context.totalBudget) } : null;
    return { version: 1, kind: input.kind, target, creative: text(input.creative).trim(), replacementCreative: text(input.replacementCreative).trim(), note: text(input.note, 500).trim(),
      ...(planContext ? { planContext } : {}),
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
