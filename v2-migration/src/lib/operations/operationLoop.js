import { readOperationAction, serializeOperationAction, OPERATION_ACTION_KINDS } from "./actionContract";
import { compareOperationsChange, shiftDate, HISTORY_RULES } from "./changeHistory";
import { parseNumericStrict } from "@/utils/parseNumeric";
import { operationsEntityKey, operationsUnit } from "./operationsIdentity";
import { normalizePlannerRows, dailyByNode } from "@/lib/budgetPlanner/plannerData";
import { resolvePlannerConfig } from "@/lib/budgetPlanner/plannerConfig";
import { buildCreativeLifecycle } from "@/lib/budgetPlanner/creativeLifecycle";
import { OPERATIONS_TOOL_ID, OPERATIONS_PATH } from "./operationsDemo";

export function operationsCreativeSignals(rows, metric) {
  const unit = operationsUnit(rows);
  const invalid = new Set(rows.filter(row => [row.cost, row[metric]].some(value => parseNumericStrict(value) == null || parseNumericStrict(value) < 0)).map(row => operationsEntityKey(row, unit)));
  const normalized = normalizePlannerRows(rows.filter(row => !invalid.has(operationsEntityKey(row, unit))).map(row => ({ ...row, campaign_name: operationsEntityKey(row, unit) })), { metric }).rows;
  const dates = [...new Set(normalized.map(row => row.date))].sort();
  if (!dates.length) return [];
  const cfg = resolvePlannerConfig().config, levels = ["country", "platform", "channel", "campaign_name", "creative_id"];
  const lifecycle = buildCreativeLifecycle(normalized, cfg, { levels, allocateLevel: "campaign_name", asOf: dates.at(-1), dataStart: dates[0],
    nodes: dailyByNode(normalized, "campaign_name", levels), configForPath: () => cfg });
  return lifecycle.entries.filter(entry => !entry.ended).map(entry => ({
    entityId: entry.path.campaign_name, creative: entry.creativeId, state: entry.state,
    fatigued: !!entry.fatigue?.fatigued, fatigueAvailable: !!entry.fatigue, etaDays: entry.fatigue?.etaDays ?? null,
    needsAction: !!entry.fatigue?.fatigued || ["LOSER", "STALLED"].includes(entry.state)
      || (entry.fatigue?.etaDays != null && entry.fatigue.etaDays <= 14),
  }));
}

export function operationRecommendations(brief, plan, signals) {
  const entities = new Map(brief.campaigns.map(row => [row.id, row]));
  const budget = (plan.ok ? plan.items : []).filter(row => row.current > 0 && Math.abs(row.budget / row.current - 1) >= 0.01).map(row => ({
    id: `budget:${row.id}`, entityId: row.id, target: entities.get(row.id).target, name: entities.get(row.id).name,
    kind: "budget", source: "recommendation", beforeBudget: row.current, afterBudget: row.budget,
    ...(plan.planRange ? { plannedDate: plan.planRange.start, reviewDays: plan.horizonDays, planContext: { mode: plan.mode, ...plan.planRange, totalBudget: plan.totalBudget * plan.horizonDays } } : {}),
    baselineCpr: row.currentResults > 0 ? row.current / row.currentResults : null, expectedCpr: row.expectedCpr,
    expectedOutcomeChange: row.expectedResults - row.currentResults, overallChangePct: plan.improvementPct,
    creativeAttention: signals.some(signal => signal.entityId === row.id && signal.needsAction),
  }));
  const creative = signals.filter(signal => signal.needsAction && entities.has(signal.entityId)).map(signal => ({
    id: `creative:${signal.entityId}:${signal.creative}`, entityId: signal.entityId, target: entities.get(signal.entityId).target,
    name: entities.get(signal.entityId).name, kind: "creative_replace", source: "recommendation", creative: signal.creative, signal,
  }));
  return [...budget, ...creative];
}

export function reviewOperationRecord(record, rows, { metric, currency, today }) {
  const action = readOperationAction(record.operationAction);
  if (!action) return { state: "legacy" };
  if (action.state !== "executed") return { state: action.state, action };
  if (!action.executedDate) return { state: "date", action };
  const due = shiftDate(action.executedDate, action.reviewDays);
  if (action.metric !== metric || action.currency !== currency) return { state: "scope", action, due };
  if (today < due) return { state: "waiting", action, due };
  const comparison = compareOperationsChange(rows, { date: action.executedDate, days: action.reviewDays, metric, target: action.target });
  const rollback = comparison.ok && comparison.cprChange >= HISTORY_RULES.changeThreshold && comparison.costChange > 0
    && action.kind === "budget" && action.beforeBudget != null && action.afterBudget > action.beforeBudget;
  return { state: comparison.ok ? "ready" : comparison.reason, action, due, comparison, forecastCheck: operationForecastCheck(action, comparison),
    followup: rollback ? { ...action, beforeBudget: action.afterBudget, afterBudget: action.beforeBudget } : null };
}

/**
 * 저장한 예측과 실행 후 같은 기간의 실제. 예측 창은 실행일부터 forecast.days일이고, 이는 검토의 "실행 후" 창과 같다.
 * 검토 일수를 바꿨으면 창이 달라 대조하지 않는다. 지출이 계획과 다르면 단가 차이의 일부는 실행 차이다.
 */
export function operationForecastCheck(action, comparison) {
  const forecast = action?.forecast;
  if (!forecast) return null;
  if (action.reviewDays !== forecast.days) return { ok: false, reason: "window" };
  if (!comparison?.ok) return { ok: false, reason: comparison?.reason || "coverage" };
  const plannedSpend = forecast.dailySpend * forecast.days, expectedResults = forecast.dailyResults * forecast.days;
  const expectedCpr = forecast.dailySpend / forecast.dailyResults;
  const { cost: actualSpend, results: actualResults, cpr: actualCpr } = comparison.current;
  return { ok: true, days: forecast.days, plannedSpend, actualSpend, expectedResults, actualResults, expectedCpr, actualCpr,
    spendGap: actualSpend / plannedSpend - 1,
    resultsGap: actualResults / expectedResults - 1,
    cprGap: actualCpr != null ? actualCpr / expectedCpr - 1 : null };
}

export function createOperationRecord({ draft, locale = "ko", today, sourceThrough = "", parentDecisionId = "" }) {
  const read = readOperationAction({ ...draft, version: 1 });
  // 예측은 저장 당시 금액에 대한 것이다. 금액을 바꾼 기록에는 예측을 남기지 않는다.
  const keepsForecast = read?.forecast && read.afterBudget != null && Math.abs(read.afterBudget - read.forecast.dailySpend) <= Math.max(0.005, read.forecast.dailySpend * 1e-6);
  const action = read && read.forecast && !keepsForecast ? (({ forecast, ...rest }) => rest)(read) : read;
  if (!action?.plannedDate || !action.metric || !action.currency) return null;
  if (action.state === "executed" && (!action.executedDate || action.executedDate > today)) return null;
  if (action.kind === "budget" && action.afterBudget == null) return null;
  if (action.kind.startsWith("creative") && !action.creative) return null;
  if (action.kind === "creative_replace" && action.state === "executed" && !action.replacementCreative) return null;
  const date = action.executedDate && action.state === "executed" ? action.executedDate : action.plannedDate;
  const label = OPERATION_ACTION_KINDS[action.kind][locale === "en" ? 1 : 0];
  const target = [action.target.country, action.target.platform, action.target.channel, action.target.campaign || action.target.campaignId].filter(Boolean).join(" · ");
  const metricLabel = action.metric === "actions" ? "CPA" : "CPI";
  const budget = action.kind === "budget" ? ` · ${action.beforeBudget ?? (action.forecast ? `${locale === "en" ? "observed " : "관측 "}${Math.round(action.forecast.currentDailySpend)}` : "?")} → ${Math.round(action.afterBudget * 100) / 100} ${action.currency}/${locale === "en" ? "day" : "일"}${action.forecast ? ` · ${locale === "en" ? "expected" : "예상"} ${metricLabel} ${Math.round(action.forecast.dailySpend / action.forecast.dailyResults * 100) / 100}` : ""}` : "";
  return { toolId: OPERATIONS_TOOL_ID, sourcePath: OPERATIONS_PATH, dataOrigin: "real", locale,
    action: `${label} · ${target}${action.creative ? ` · ${action.creative}${action.kind === "creative_replace" && action.replacementCreative ? ` → ${action.replacementCreative}` : ""}` : ""}${budget}${action.note ? ` — ${action.note}` : ""}`,
    actionTarget: target, actionKind: action.kind.startsWith("creative") ? "replace" : "investigate",
    operationAction: serializeOperationAction(action), parentDecisionId,
    metric: action.metric === "actions" ? "CPA" : "CPI", targetDirection: "lower",
    baselineDate: date, reviewDate: shiftDate(date, action.reviewDays), comparisonWindowDays: action.reviewDays,
    sourcePeriod: sourceThrough, status: "pending", actual: "", learning: "",
    reviewQuestion: locale === "en" ? "Compare spend, unit cost, outcome share and cost per outcome by creative before and after execution. Concurrent changes do not establish causation."
      : "실행 전후 비용·단가와 소재별 성과 비중·성과당 비용 변화를 비교합니다. 같은 시기에 나타난 변화만으로 원인을 확정하지 않습니다.",
  };
}
