import { dateOrdinal, periodDays } from "@/lib/analysisPeriod";
import { parseNumericStrict } from "@/utils/parseNumeric";
import { PVM_MATH } from "@/utils/pvmMath";
import { efficiencyStages } from "@/utils/efficiencyStages";
import { allocationModelMap, allocationPointMap, predictAllocationCost } from "@/utils/allocationModels";
import { allocConfidence } from "@/utils/allocationConfidence";
import { getAllocationEvidenceLimits, improveAllocationFromCurrent, isAllocationFullyFunded } from "@/utils/budgetAllocTool";

export const OPERATIONS_HOLDS = {
  period: { ko: "유효한 분석 기간이 필요합니다.", en: "A valid analysis period is required." },
  empty: { ko: "선택한 기간에 분석할 데이터가 없습니다.", en: "There are no observations in the selected period." },
  missing: { ko: "비용·성과 또는 날짜가 누락되거나 유효하지 않아 예산 예측을 보류했습니다.", en: "Budget forecasts are withheld because spend, outcomes or dates are missing or invalid." },
  cadence: { ko: "매일의 관측이 확인되지 않아 하루 예산 예측을 보류했습니다. 주간 집계는 예산 배분 도구에서 분석하세요.", en: "Daily coverage is incomplete, so daily budget forecasts are withheld. Analyze weekly aggregates in Budget allocation." },
  countries: { ko: "국가가 여러 개입니다. 공용 필터에서 국가 하나를 선택해 예산을 계산하세요.", en: "Multiple countries are selected. Choose one country in the shared filter to calculate a budget plan." },
  outcomes: { ko: "비용이 있지만 성과가 0인 관측이 있어 예산 예측을 보류했습니다.", en: "Budget forecasts are withheld because an observation has spend but zero outcomes." },
  confidence: { ko: "관측 수 또는 모형 적합도가 부족해 예산 예측을 보류했습니다.", en: "Budget forecasts are withheld because observations or model fit are insufficient." },
  range: { ko: "현재 하루 지출이 모형의 관측·안전 범위 밖이라 조정안을 보류했습니다.", en: "The current daily spend is outside the model’s observed or safe range, so the plan is withheld." },
  constraints: { ko: "예산 합계와 변경 한도를 동시에 만족하는 안을 계산할 수 없습니다.", en: "A plan satisfying both the total budget and change limits could not be calculated." },
};

const text = value => String(value ?? "").trim();
const validValue = value => { const n = parseNumericStrict(value); return n != null && n >= 0 ? n : null; };
const inRange = (row, range) => dateOrdinal(row.date) != null && row.date >= range.start && row.date <= range.end;
const addTo = (map, key, row) => { if (!map.has(key)) map.set(key, []); map.get(key).push(row); };

// 누락을 0으로 바꾸지 않고, 같은 분자·분모에서 단가를 계산한다.
export function operationsTotals(rows, metric) {
  if (!rows.length) return { cost: null, results: null, cpr: null };
  let cost = 0, results = 0;
  for (const row of rows) {
    const x = validValue(row.cost), y = validValue(row[metric]);
    if (x == null || y == null) return { cost: null, results: null, cpr: null };
    cost += x; results += y;
  }
  if (![cost, results].every(Number.isFinite)) return { cost: null, results: null, cpr: null };
  return { cost, results, cpr: results > 0 ? cost / results : null };
}

export function operationsDailyTrend(rows, metric) {
  const byDate = new Map();
  for (const row of rows) if (dateOrdinal(row.date) != null) addTo(byDate, row.date, row);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return [];
  const start = dateOrdinal(dates[0]), end = dateOrdinal(dates.at(-1));
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const date = new Date((start + index) * 86400000).toISOString().slice(0, 10);
    return { date, ...operationsTotals(byDate.get(date) || [], metric) };
  });
}

export function prepareOperationsBrief({ rows, periods, metric = "installs", mappedFields = [] }) {
  const days = periodDays(periods.current);
  const unit = rows.some(row => text(row.campaign_id) || text(row.campaign_name)) ? "campaign" : "channel";
  const keyOf = row => JSON.stringify([text(row.country), text(row.platform), text(row.channel), text(row.source),
    unit === "campaign" ? text(row.campaign_id) || text(row.campaign_name) : ""]);
  const history = rows.filter(row => dateOrdinal(row.date) != null && row.date <= periods.current.end);
  const recent = history.filter(row => inRange(row, periods.current));
  const prior = history.filter(row => inRange(row, periods.previous));
  const grouped = new Map(), priorGroups = new Map(), recentGroups = new Map(), firstSeen = new Map();
  for (const row of history) {
    const id = keyOf(row);
    addTo(grouped, id, row);
    if (text(row.creative_id)) {
      const creativeKey = JSON.stringify([id, text(row.creative_id)]);
      if (!firstSeen.has(creativeKey) || row.date < firstSeen.get(creativeKey)) firstSeen.set(creativeKey, row.date);
    }
  }
  for (const row of prior) addTo(priorGroups, keyOf(row), row);
  for (const row of recent) addTo(recentGroups, keyOf(row), row);
  const campaigns = [...recentGroups].map(([id, after]) => {
    const before = priorGroups.get(id) || [];
    const current = operationsTotals(after, metric), previous = operationsTotals(before, metric);
    const row = after[0];
    const name = unit === "campaign" ? text(row.campaign_name) || text(row.campaign_id) : text(row.channel);
    const context = [row.country, row.platform, unit === "campaign" ? row.channel : "", row.source].map(text).filter(Boolean).join(" · ");
    const projected = values => values.map(item => ({ ...item, spend: item.cost, _entity: id, creative_id: text(item.creative_id) }));
    const keys = { ch: "_entity", cr: "creative_id", resultField: metric };
    const pvm = before.length && PVM_MATH.inspectFinestInputs(projected(before), projected(after), keys).ok
      ? PVM_MATH.decomposeFinest(projected(before), projected(after), keys) : null;
    return { id, name, context, current, previous,
      changePct: previous.cpr > 0 && current.cpr != null ? (current.cpr / previous.cpr - 1) * 100 : null,
      pvm, stages: efficiencyStages(projected(before), projected(after), metric, mappedFields),
      observedDays: new Set(after.map(item => item.date)).size,
      trend: operationsDailyTrend(grouped.get(id), metric) };
  }).sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity) || (b.current.cost ?? 0) - (a.current.cost ?? 0));

  const creatives = [];
  for (const campaign of campaigns) {
    const buckets = new Map(), established = [];
    for (const row of recentGroups.get(campaign.id)) {
      const creative = text(row.creative_id);
      if (!creative) continue;
      addTo(buckets, creative, row);
      if (firstSeen.get(JSON.stringify([campaign.id, creative])) < periods.current.start) established.push(row);
    }
    const reference = operationsTotals(established, metric);
    for (const [creative, values] of buckets) {
      const firstDate = firstSeen.get(JSON.stringify([campaign.id, creative]));
      const totals = operationsTotals(values, metric);
      creatives.push({ id: JSON.stringify([campaign.id, creative]), creative, campaignId: campaign.id, campaign: campaign.name,
        context: campaign.context, firstDate, isNew: firstDate >= periods.current.start,
        days: new Set(values.map(row => row.date)).size, ...totals,
        vsEstablishedPct: firstDate >= periods.current.start && totals.cpr != null && reference.cpr > 0
          ? (totals.cpr / reference.cpr - 1) * 100 : null });
    }
  }
  creatives.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.firstDate.localeCompare(a.firstDate) || (b.cost ?? 0) - (a.cost ?? 0));

  const active = campaigns.filter(c => c.current.cost == null || c.current.cost > 0);
  const budgetHolds = [];
  if (!days) budgetHolds.push({ reason: "period" });
  else if (!active.length) budgetHolds.push({ reason: "empty" });
  if (rows.some(row => dateOrdinal(row.date) == null)) budgetHolds.push({ reason: "missing" });
  if (new Set(history.map(row => text(row.country))).size > 1) budgetHolds.push({ reason: "countries" });
  const models = new Map(), currentSpends = {};
  for (const campaign of active) {
    const values = grouped.get(campaign.id), daily = new Map();
    for (const row of values) addTo(daily, row.date, row);
    const totals = [...daily.values()].map(items => operationsTotals(items, metric));
    let reason = null;
    if (totals.some(item => item.cost == null || item.results == null)) reason = "missing";
    else if (totals.some(item => item.cost > 0 && item.results === 0)) reason = "outcomes";
    else if (campaign.observedDays !== days) reason = "cadence";
    if (reason) { budgetHolds.push({ id: campaign.id, reason }); continue; }
    const modelRows = values.map(row => ({ ...row, country: "", platform: "", channel: campaign.id }));
    const fitted = allocationModelMap(allocationPointMap(modelRows, "channel", metric), {
      regimeMode: "auto", weightMode: "exponential", halfLifeDays: 14, periodDays: 1,
    }).get(campaign.id);
    if (!fitted || allocConfidence(fitted)?.level === "low") {
      budgetHolds.push({ id: campaign.id, reason: "confidence" }); continue;
    }
    models.set(campaign.id, fitted);
    currentSpends[campaign.id] = campaign.current.cost / days;
  }
  return { metric, unit, days, periods, campaigns, creatives, models, currentSpends, budgetHolds,
    trend: operationsDailyTrend(history, metric),
    current: operationsTotals(recent, metric), previous: operationsTotals(prior, metric),
    historyStart: history.reduce((start, row) => !start || row.date < start ? row.date : start, ""), historyEnd: periods.current.end,
    recentObservations: recent.length, priorObservations: prior.length,
    missingCreativeRows: recent.filter(row => !text(row.creative_id)).length };
}

export function planOperationsBudget(brief, { changeLimit = 0.2, currency = "KRW" } = {}) {
  const withheld = holds => ({ ok: false, holds, items: [], baselineResults: null, expectedResults: null, improvementPct: null });
  if (brief.budgetHolds.length) return withheld(brief.budgetHolds);
  if (!Number.isFinite(changeLimit) || changeLimit < 0 || changeLimit > 1) return withheld([{ reason: "constraints" }]);
  const evidence = getAllocationEvidenceLimits({ modelsMap: brief.models });
  const minSpends = {}, maxSpends = {}, baseline = new Map();
  let totalBudget = 0, baselineResults = 0;
  for (const [id, wrapper] of brief.models) {
    const cost = brief.currentSpends[id];
    const cap = evidence.maxSpends[id];
    if (!(cost > 0) || cost < wrapper.xMin || cost > cap) return withheld([{ id, reason: "range" }]);
    const predicted = predictAllocationCost(wrapper, cost);
    if (!predicted || predicted.estimated) return withheld([{ id, reason: "range" }]);
    baseline.set(id, predicted);
    minSpends[id] = Math.max(wrapper.xMin, cost * (1 - changeLimit));
    maxSpends[id] = Math.min(cap, cost * (1 + changeLimit));
    totalBudget += cost; baselineResults += predicted.results;
  }
  if (!(totalBudget > 0 && baselineResults > 0)) return withheld([{ reason: "empty" }]);
  const allocation = improveAllocationFromCurrent({ modelsMap: brief.models, currentSpends: brief.currentSpends,
    totalBudget, minSpends, maxSpends, currency });
  if (!isAllocationFullyFunded({ allocation, budget: totalBudget, currency }) || allocation.constraintViolation
    || allocation.items.length !== brief.models.size
    || Math.abs(allocation.totalAllocated - totalBudget) > Math.max(1e-6, totalBudget * 1e-9)) return withheld([{ reason: "constraints" }]);
  const items = allocation.items.map(item => {
    const predicted = predictAllocationCost(brief.models.get(item.channel), item.cost);
    return { id: item.channel, current: brief.currentSpends[item.channel], budget: item.cost,
      currentResults: baseline.get(item.channel).results, expectedResults: predicted?.results ?? null,
      expectedCpr: predicted?.cpr ?? null, min: minSpends[item.channel], max: maxSpends[item.channel] };
  });
  if (items.some(item => item.expectedResults == null || item.budget < item.min - 1e-6 || item.budget > item.max + 1e-6)) return withheld([{ reason: "constraints" }]);
  const expectedResults = items.reduce((sum, item) => sum + item.expectedResults, 0);
  if (expectedResults < baselineResults - 1e-8) return withheld([{ reason: "constraints" }]);
  return { ok: true, holds: [], items, totalBudget, baselineResults, expectedResults,
    improvementPct: (expectedResults / baselineResults - 1) * 100,
    baselineCpr: totalBudget / baselineResults, expectedCpr: totalBudget / expectedResults, changeLimit };
}
