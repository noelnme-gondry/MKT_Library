// 계획 대비 실적 리뷰 (spec §8.2). 5-3에서 저장한 배분안(결정 기록의 allocationPlan)을
// 새 CSV의 같은 기간·같은 대상 실제값과 대조해 차이를 실행 편차(계획과 다르게 쓴 비중)와
// 모형 오차(대상별 CPR 예측 오차)로 나눈다. 원본 행은 저장하지 않는다 — 대조는 매번 새로 계산한다.
import { getRowGroupKey } from "@/utils/budgetAllocTool";
import { parseNumericOrZero } from "@/utils/parseNumeric";
import { resolvePlannerConfig } from "./plannerConfig";
import { reviewPlanVsActual, shouldDowngradeConfidence } from "./plannerPvm";
import { allocationPlanEnd, parseAllocationPlan, PLAN_SNAPSHOT_MAX_TARGETS, serializeAllocationPlan } from "./planSnapshot";

// D7 매출은 설치 후 7일이 지나야 다 찬다 — 기간 끝 + 7일까지 데이터가 있어야 대조한다.
const MATURITY_DAYS = { installs: 0, actions: 0, revenue_d7: 7 };

function addDays(iso, n) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/**
 * 결정 기록에 실을 스냅샷. 예측 기간 전체의 대상별 계획 지출·예측 결과와 합계 구간을 담는다.
 * 예측할 수 없는 대상이 있거나 대상이 너무 많으면 자동 대조를 만들지 않는다(null) — 일부만 대조하면
 * 합계가 계획과 달라 실행 편차가 거짓으로 커진다.
 * @param {object} forecast allocationAt(..., {withForecast:true}).forecast (nodes[].unit 포함)
 */
export function createAllocationPlanSnapshot({ forecast, metric, unitField, byPlatform, asOf }) {
  if (!forecast?.nodes?.length || forecast.flags?.unpredictableNodes > 0) return null;
  if (forecast.nodes.length > PLAN_SNAPSHOT_MAX_TARGETS) return null;
  const allocationPlan = serializeAllocationPlan({
    start: forecast.startDate,
    days: forecast.horizonDays,
    metric,
    unitField,
    byPlatform,
    targets: forecast.nodes.map((node) => ({ unit: node.unit, cost: node.cost, results: node.results })),
  });
  if (!allocationPlan) return null;
  const plan = parseAllocationPlan(allocationPlan);
  return {
    comparisonKind: "allocation_plan",
    allocationPlan,
    forecastPeriod: plan.start,
    forecastValue: String(forecast.total.results),
    forecastLower: Number.isFinite(forecast.total.lo) ? String(forecast.total.lo) : "",
    forecastUpper: Number.isFinite(forecast.total.hi) ? String(forecast.total.hi) : "",
    forecastSourceThrough: asOf || "",
    // 기간이 끝난 다음 날(D7 매출이면 7일 더) 검토한다.
    reviewDate: addDays(allocationPlanEnd(plan), 1 + (MATURITY_DAYS[metric] ?? 0)),
  };
}

function resultOf(row, metric) {
  return parseNumericOrZero(row[metric]);
}

/** 새 행에서 계획 기간·대상의 실제 지출·결과. 기간을 다 덮지 못하면 null(일부 기간으로 판정하지 않는다). */
export function actualForPlan(plan, rows) {
  const end = allocationPlanEnd(plan);
  const dates = rows.map((row) => String(row.date || "")).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (!dates.length || dates[0] > plan.start || dates.at(-1) < addDays(end, MATURITY_DAYS[plan.metric] ?? 0)) return null;
  const wanted = new Map(plan.targets.map((target) => [target.unit, { unit: target.unit, cost: 0, results: 0 }]));
  for (const row of rows) {
    const date = String(row.date || "");
    if (date < plan.start || date > end) continue;
    const unit = getRowGroupKey(plan.byPlatform ? row : { ...row, platform: "" }, plan.unitField);
    const target = wanted.get(unit);
    if (!target) continue;
    target.cost += parseNumericOrZero(row.cost);
    target.results += resultOf(row, plan.metric);
  }
  return [...wanted.values()];
}

/**
 * 한 기록의 대조. 실제 결과 합계가 0이면 CPR이 정의되지 않으므로 합계만 낸다.
 * @returns {null | {plan, planned, actual, totals, review}}
 */
export function reviewAllocationPlan(record, rows, cfg = resolvePlannerConfig().config) {
  if (record?.comparisonKind !== "allocation_plan") return null;
  const plan = parseAllocationPlan(record.allocationPlan);
  if (!plan) return null;
  const actual = actualForPlan(plan, rows);
  if (!actual) return null;
  const planned = plan.targets.map((target) => ({ unit: target.unit, cost: target.cost, results: target.results }));
  const sum = (items, field) => items.reduce((acc, item) => acc + item[field], 0);
  const totals = {
    plannedCost: sum(planned, "cost"),
    plannedResults: sum(planned, "results"),
    actualCost: sum(actual, "cost"),
    actualResults: sum(actual, "results"),
  };
  totals.plannedCpr = totals.plannedResults > 0 ? totals.plannedCost / totals.plannedResults : null;
  totals.actualCpr = totals.actualResults > 0 ? totals.actualCost / totals.actualResults : null;
  const review = reviewPlanVsActual(planned.map((item) => ({ key: item.unit, ...item })), actual.map((item) => ({ key: item.unit, ...item })), cfg);
  const execution = review.ok ? review.nodes.reduce((acc, node) => acc + node.executionDeviation, 0) : null;
  const model = review.ok ? review.nodes.reduce((acc, node) => acc + node.modelErrorContribution, 0) : null;
  return {
    recordId: record.id,
    reviewDate: record.reviewDate,
    action: record.action,
    plan,
    end: allocationPlanEnd(plan),
    planned,
    actual,
    totals,
    review,
    split: review.ok ? { execution, model } : null,
    largeErrorUnits: review.ok ? review.nodes.filter((node) => node.largeError).map((node) => node.key).sort() : [],
  };
}

/** 아직 실제값을 기록하지 않은 5-3 배분안 중 새 행으로 대조할 수 있는 것. */
export function findAllocationPlanMatches(records = [], rows = [], cfg) {
  if (!Array.isArray(records) || !rows?.length) return [];
  return records
    .filter((record) => record?.toolId === "5-3" && record.comparisonKind === "allocation_plan" && !String(record.actual || "").trim())
    .map((record) => reviewAllocationPlan(record, rows, cfg))
    .filter(Boolean)
    .sort((a, b) => a.plan.start.localeCompare(b.plan.start) || String(a.recordId).localeCompare(String(b.recordId)));
}

/**
 * 대상별 모형 오차 이력 → 신뢰도를 한 단계 낮출 대상 (spec §6.5·§8.2: reviewDowngradeAfter회 연속 큰 오차).
 * 이미 실제값을 기록한 배분안도 포함한다 — 이력은 현재 CSV가 덮는 기간에서 매번 다시 계산한다.
 */
export function plannerDowngradeUnits(records = [], rows = [], cfg = resolvePlannerConfig().config) {
  const reviews = (Array.isArray(records) ? records : [])
    .filter((record) => record?.toolId === "5-3" && record.comparisonKind === "allocation_plan")
    .map((record) => reviewAllocationPlan(record, rows, cfg))
    .filter((match) => match?.review.ok)
    .sort((a, b) => a.plan.start.localeCompare(b.plan.start));
  const history = new Map();
  for (const match of reviews) {
    for (const node of match.review.nodes) {
      if (!history.has(node.key)) history.set(node.key, []);
      history.get(node.key).push({ largeError: node.largeError, start: match.plan.start });
    }
  }
  return [...history].filter(([, items]) => shouldDowngradeConfidence(items, cfg)).map(([unit]) => unit).sort();
}

const METRIC_LABELS = { installs: "CPI", actions: "CPA", revenue_d7: "ROAS" };

/** 지표 표시 이름(CPR 공간의 지표를 사람이 읽는 이름으로). */
export function planMetricLabel(metric) {
  return METRIC_LABELS[metric] || "CPR";
}

function signedPct(value) {
  if (!Number.isFinite(value)) return "—";
  const pct = value * 100;
  const text = Math.abs(pct).toFixed(1);
  return Number(text) === 0 ? "0%" : `${pct > 0 ? "+" : "−"}${text}%`;
}

/**
 * 결정 기록에 남길 문장. 숫자는 호출 화면의 통화 포맷을 쓴다(formatCpr: 내부 CPR → 표시 문자열).
 * 실행 편차·모형 오차는 크기보다 "어느 쪽이 컸는지"를 말한다 — ROAS처럼 역수 지표에서는
 * CPR 공간의 금액이 직관적이지 않다.
 * @returns {{actual:string, learning:string}}
 */
export function planReviewText(match, { locale = "ko", formatCpr = (value) => String(value), formatCount = (value) => String(Math.round(value)) } = {}) {
  const en = locale === "en";
  const label = planMetricLabel(match.plan.metric);
  const { totals } = match;
  // ROAS는 CPR의 역수 — 변화율도 역수로 읽는다.
  const isRoas = match.plan.metric === "revenue_d7";
  const change = totals.plannedCpr > 0 && totals.actualCpr > 0
    ? (isRoas ? totals.plannedCpr / totals.actualCpr - 1 : totals.actualCpr / totals.plannedCpr - 1)
    : null;
  const period = `${match.plan.start}–${match.end}`;
  const parts = [
    en
      ? `${period}: actual ${label} ${formatCpr(totals.actualCpr)} vs plan ${formatCpr(totals.plannedCpr)} (${signedPct(change)})`
      : `${period}: 실제 ${label} ${formatCpr(totals.actualCpr)} · 계획 ${formatCpr(totals.plannedCpr)} (${signedPct(change)})`,
    en
      ? `results ${formatCount(totals.actualResults)} vs ${formatCount(totals.plannedResults)} planned`
      : `결과 ${formatCount(totals.actualResults)} · 계획 ${formatCount(totals.plannedResults)}`,
  ];
  if (match.split) {
    const executionLed = Math.abs(match.split.execution) >= Math.abs(match.split.model);
    parts.push(executionLed
      ? (en ? "gap mostly from spending a different mix than planned (execution)" : "차이는 주로 계획과 다르게 쓴 예산 비중(실행 편차)")
      : (en ? "gap mostly from per-target efficiency forecast error (model)" : "차이는 주로 대상별 효율 예측 오차(모형 오차)"));
  } else {
    parts.push(en ? "split not available (no results in the period)" : "기간 결과가 0이라 원인 분해 불가");
  }
  const shown = match.largeErrorUnits.slice(0, 6).join(", ");
  const more = match.largeErrorUnits.length - 6;
  const units = more > 0 ? (en ? `${shown} and ${more} more` : `${shown} 외 ${more}개`) : shown;
  const learning = match.largeErrorUnits.length
    ? (en
      ? `Forecast error above threshold: ${units}. Repeated misses lower that target's confidence in the next plan.`
      : `예측 오차가 기준을 넘은 대상: ${units}. 연속으로 빗나가면 다음 배분에서 그 대상의 신뢰도를 낮춥니다.`)
    : "";
  return { actual: parts.join(" · "), learning };
}
