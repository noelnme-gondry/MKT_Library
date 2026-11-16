// 운영 플래너 "내 실행안" — 추천 배분 중 실행할 액션과 금액을 사람이 고르고, 같은 모형으로 예측한다.
// 엔진은 바꾸지 않는다: 예측은 추천안과 같은 predictAllocationCost, 범위는 같은 근거 한도(관측 최소~안전 상한)다.
// 고르지 않은 캠페인은 현재 지출을 유지한다고 보고, 추천안의 "유지안" 예측값을 그대로 쓴다.
import { predictAllocationCost } from "@/utils/allocationModels";
import { getAllocationEvidenceLimits } from "@/utils/budgetAllocTool";
import { readOperationAction } from "./actionContract";

// 추천 목록(operationRecommendations)과 같은 기준: 1% 미만 변화는 액션으로 제안하지 않는다.
export const SELECTION_MIN_CHANGE = 0.01;

/** 추천안 그대로의 선택: 1% 이상 바뀌는 캠페인만 고르고 금액은 추천 금액(하루). */
export function defaultOperationsSelection(plan) {
  return Object.fromEntries((plan?.items || []).map(item => [item.id, {
    selected: item.current > 0 && Math.abs(item.budget / item.current - 1) >= SELECTION_MIN_CHANGE,
    budget: item.budget,
  }]));
}

/** 예측할 수 있는 하루 지출 범위. 모형이 관측한 최소 지출부터 근거 한도(관측 상한·곡선 꼭짓점)까지. */
export function operationsSelectionRanges(brief) {
  const evidence = getAllocationEvidenceLimits({ modelsMap: brief.models });
  return new Map([...brief.models].map(([id, model]) => [id, { min: model.xMin, max: evidence.maxSpends[id] }]));
}

/**
 * @param {object} brief prepareOperationsIntervals 결과(models·currentSpends)
 * @param {object} plan planOperationsScenario 결과(ok일 때만 의미가 있다)
 * @param {Record<string, {selected:boolean, budget:number}>} choices 하루 금액
 * @returns 대상별 예측과 합계. 범위 밖이거나 예측이 추정값인 선택은 invalid로 돌려주고 합계를 만들지 않는다.
 */
export function forecastOperationsSelection(brief, plan, choices = {}) {
  if (!plan?.ok) return { ok: false, items: [], invalid: [], totals: null };
  const ranges = operationsSelectionRanges(brief);
  const items = plan.items.map(item => {
    const choice = choices[item.id] || { selected: false, budget: item.current };
    const range = ranges.get(item.id) || { min: null, max: null };
    const base = { id: item.id, current: item.current, currentResults: item.currentResults, min: range.min, max: range.max, recommended: item.budget };
    if (!choice.selected) return { ...base, selected: false, budget: item.current, expectedResults: item.currentResults, expectedCpr: item.current / item.currentResults, status: "keep" };
    const budget = Number(choice.budget);
    const inRange = Number.isFinite(budget) && budget > 0 && range.min != null && range.max != null && budget >= range.min - 1e-6 && budget <= range.max + 1e-6;
    const predicted = inRange ? predictAllocationCost(brief.models.get(item.id), budget) : null;
    if (!predicted || predicted.estimated || !(predicted.results > 0)) return { ...base, selected: true, budget, expectedResults: null, expectedCpr: null, status: "range" };
    return { ...base, selected: true, budget, expectedResults: predicted.results, expectedCpr: predicted.cpr, status: "ok" };
  });
  const invalid = items.filter(item => item.status === "range").map(item => item.id);
  const changed = items.filter(item => item.selected && Math.abs(item.budget - item.current) > Math.max(1e-6, item.current * 1e-9));
  if (invalid.length) return { ok: false, items, invalid, changed, totals: null };
  const sum = key => items.reduce((total, item) => total + item[key], 0);
  const currentSpend = sum("current"), spend = sum("budget"), baselineResults = sum("currentResults"), expectedResults = sum("expectedResults");
  return { ok: true, items, invalid, changed, totals: {
    currentSpend, spend, baselineResults, expectedResults,
    baselineCpr: baselineResults > 0 ? currentSpend / baselineResults : null,
    expectedCpr: expectedResults > 0 ? spend / expectedResults : null,
    resultsChangePct: baselineResults > 0 ? (expectedResults / baselineResults - 1) * 100 : null,
  } };
}

/** 선택이 추천안과 같은가(금액 반올림 차이는 같다고 본다). */
export function isRecommendedSelection(plan, choices) {
  const recommended = defaultOperationsSelection(plan);
  return (plan?.items || []).every(item => {
    const a = recommended[item.id], b = choices[item.id];
    return b && a.selected === b.selected && (!a.selected || Math.abs(a.budget - b.budget) <= Math.max(0.5, a.budget * 1e-6));
  });
}

/**
 * 저장할 액션 초안. 바뀐 캠페인 하나당 기록 하나, 같은 계획은 planId로 묶는다.
 * 예측은 실행일부터 days일의 하루 평균으로 담고, 나중에 같은 기간 실제와 대조한다.
 * 변경 전 예산 설정값은 관측 지출과 다를 수 있어 비워 둔다(관측 지출은 forecast에 따로 남긴다).
 */
export function operationsPlanDrafts({ brief, plan, forecast, planId, plannedDate, state = "planned", executedDate = "", note = "", metric, currency }) {
  if (!forecast?.ok || !forecast.changed.length || !planId) return [];
  const campaigns = new Map(brief.campaigns.map(row => [row.id, row]));
  const days = plan.horizonDays;
  const planContext = { mode: plan.mode, start: plan.planRange.start, end: plan.planRange.end, totalBudget: forecast.totals.spend * days, planId,
    selected: forecast.changed.length, expectedResults: forecast.totals.expectedResults * days, baselineResults: forecast.totals.baselineResults * days };
  return forecast.changed.map(item => ({
    kind: "budget", source: "recommendation", target: campaigns.get(item.id)?.target, state, plannedDate, executedDate: state === "executed" ? executedDate : "",
    beforeBudget: "", afterBudget: item.budget, reviewDays: days, metric, currency, note, planContext,
    forecast: { days, dailySpend: item.budget, dailyResults: item.expectedResults, currentDailySpend: item.current, currentDailyResults: item.currentResults },
  }));
}

/**
 * 캠페인별로 아직 끝나지 않은 예산 기록(같은 지표·통화). 표가 같은 대상을 두 번 저장하지 않게 하고 상태를 보여 준다.
 * @returns {Map<string, {record:object, action:object}>}
 */
export function pendingBudgetActions(records = [], campaigns = [], { metric, currency, matches }) {
  const open = records.map(record => ({ record, action: readOperationAction(record.operationAction) }))
    .filter(({ record, action }) => action?.kind === "budget" && record.status !== "reviewed" && action.state !== "cancelled" && action.metric === metric && action.currency === currency);
  const result = new Map();
  for (const campaign of campaigns) {
    const found = open.find(({ action }) => matches({ ...action.target, campaign_id: action.target.campaignId, campaign_name: action.target.campaign }, campaign.target));
    if (found) result.set(campaign.id, found);
  }
  return result;
}

/** 아직 끝나지 않은 소재 기록이 있는 소재(같은 캠페인·소재 이름). 예측 없이 이력만 남긴 기록이다. */
export function pendingCreativeActions(records = [], creatives = [], campaigns = [], matches) {
  const open = records.map(record => ({ record, action: readOperationAction(record.operationAction) }))
    .filter(({ record, action }) => action?.creative && record.status !== "reviewed" && action.state !== "cancelled");
  const campaignById = new Map(campaigns.map(row => [row.id, row]));
  return new Set(creatives.filter(creative => {
    const parent = campaignById.get(creative.campaignId);
    return parent && open.some(({ action }) => action.creative === creative.creative
      && matches({ ...action.target, campaign_id: action.target.campaignId, campaign_name: action.target.campaign }, parent.target));
  }).map(creative => creative.id));
}
