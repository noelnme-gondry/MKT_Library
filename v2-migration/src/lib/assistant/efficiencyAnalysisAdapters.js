import { buildDashboardVerdict } from "@/utils/dashboardVerdict";
import { getMappedRows, getMonFilteredRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { PVM_MATH } from "@/utils/pvmMath";
import { ALLOC_MATH } from "@/utils/allocationMath";
import {
  calcChannelHistorySummary,
  calculateAllocationModeB,
  computeAllocSummary,
  getAllocationEvidenceLimits,
  getRowGroupKey,
} from "@/utils/budgetAllocTool";
import {
  SAT_CONFIG,
  SAT_MATH,
  satActiveIndex,
  satActiveVerdict,
  satAvailableFields,
  satBuildPoints,
} from "@/utils/satMath";

import { ANALYSIS_RESULT_STATUS, createAnalysisResult } from "./analysisResultContract";

const EFFICIENCY_TOOL_IDS = Object.freeze(["5-2", "5-21", "5-22", "5-3"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function tr(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function mappedKeys(csvData) {
  return new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__"));
}

function resultInput(input = {}) {
  return {
    csvData: input.csvData,
    inputSignature: String(input.inputSignature || ""),
    mappingSignature: String(input.mappingSignature || ""),
    locale: input.locale === "en" ? "en" : "ko",
    options: input.options || {},
  };
}

function requireSignatures(input) {
  if (!input.inputSignature || !input.mappingSignature) {
    throw new Error("Dochi adapter requires inputSignature and mappingSignature");
  }
}

function noResult({ toolId, inputSignature, mappingSignature, locale, status = ANALYSIS_RESULT_STATUS.NOT_COMPUTABLE, headline, caveats = [], manifest = {} }) {
  return createAnalysisResult({
    toolId,
    status,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: status === ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED ? "not_identified" : "not_computable",
      headline,
      caveats,
    },
    manifest: {
      engine: "efficiency-adapter-v1",
      status,
      ...manifest,
    },
  });
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function dashboardAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const verdict = buildDashboardVerdict({
    csvData,
    filterState: options.filterState || {},
    denomBasis: options.denomBasis || "installs",
    displayCurrency: options.displayCurrency || "KRW",
    windowDays: options.windowDays || 7,
    locale,
  });
  if (verdict.insufficient) {
    return noResult({
      toolId: "5-2", inputSignature, mappingSignature, locale,
      headline: tr(locale, "운영 대시보드를 계산할 비교 기간이 부족합니다.", "There is not enough comparison-period data to calculate the operations dashboard."),
      manifest: { method: "dashboard_verdict", windowDays: options.windowDays || 7, observedDayCount: verdict.days || 0 },
    });
  }
  const metricRows = (verdict.metricRows || []).map((row) => ({
    metric: row.key,
    label: row.label,
    prior: safeNumber(row.prev),
    recent: safeNumber(row.recent),
    change: safeNumber(row.wow),
  }));
  return createAnalysisResult({
    toolId: "5-2",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: verdict.headline,
      stats: (verdict.stats || []).map((stat) => ({ id: stat.label, label: stat.label, value: stat.value })),
      action: verdict.tone === "bad"
        ? tr(locale, "급변한 날짜와 채널을 먼저 확인합니다.", "Check the spike date and channel first.")
        : tr(locale, "같은 기준으로 다음 비교 기간을 다시 확인합니다.", "Recheck the next comparison period using the same definition."),
      caveats: [tr(locale, "관측된 기간 비교이며 인과 효과 추정이 아닙니다.", "This is an observed-period comparison, not a causal estimate.")],
    },
    visualizations: [{
      id: "dashboard-period-comparison",
      kind: "bar",
      question: tr(locale, "직전 기간과 최근 기간 사이에 무엇이 변했는가?", "What changed between the prior and recent periods?"),
      data: metricRows,
      options: { variant: "period-comparison" },
      table: { columns: ["metric", "label", "prior", "recent", "change"], rows: metricRows },
    }],
    manifest: {
      engine: "dashboardVerdict-v1",
      status: "COMPLETE",
      windowDays: verdict.windowDays,
      observedDayCount: verdict.days,
      evidenceState: "descriptive",
    },
  });
}

function pvmPeriods(csvData, filterState = {}) {
  const rows = getMonFilteredRows(csvData, filterState)
    .map((row) => ({
      ...row,
      spend: row.spend ?? row.cost ?? 0,
      campaign_id: row.campaign_id ?? row.campaign_name,
      _time: Date.parse(`${row.date}T00:00:00Z`),
    }))
    .filter((row) => Number.isFinite(row._time));
  if (!rows.length) return null;
  const lastTime = rows.reduce((max, row) => Math.max(max, row._time), -Infinity);
  return {
    prior: rows.filter((row) => row._time >= lastTime - 13 * DAY_MS && row._time < lastTime - 6 * DAY_MS),
    recent: rows.filter((row) => row._time >= lastTime - 6 * DAY_MS && row._time <= lastTime),
  };
}

function pvmAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const fields = mappedKeys(csvData);
  const resultField = effectiveDenomBasis(csvData, options.denomBasis || "installs") === "actions" && fields.has("actions")
    ? "actions"
    : "installs";
  const required = ["date", "channel", resultField];
  if (!required.every((field) => fields.has(field)) || !(fields.has("spend") || fields.has("cost"))) {
    return noResult({
      toolId: "5-21", inputSignature, mappingSignature, locale,
      headline: tr(locale, "성과 변동 분해에 필요한 날짜·채널·비용·성과 매핑이 부족합니다.", "Performance decomposition needs date, channel, cost, and outcome mappings."),
      manifest: { engine: "PVM_MATH", resultField, status: "ABSTAIN" },
    });
  }
  const periods = pvmPeriods(csvData, options.filterState || {});
  if (!periods?.prior.length || !periods.recent.length) {
    return noResult({
      toolId: "5-21", inputSignature, mappingSignature, locale,
      headline: tr(locale, "성과 변동 분해에는 연속된 두 비교 기간이 필요합니다.", "Performance decomposition needs two consecutive comparison periods."),
      manifest: { engine: "PVM_MATH", resultField, status: "ABSTAIN" },
    });
  }
  const keys = {
    ch: "channel",
    cmp: fields.has("campaign_id") || fields.has("campaign_name") ? "campaign_id" : null,
    cr: fields.has("creative_id") ? "creative_id" : null,
    resultField,
  };
  const contract = PVM_MATH.inspectFinestInputs(periods.prior, periods.recent, keys);
  if (!contract.ok) {
    return noResult({
      toolId: "5-21", inputSignature, mappingSignature, locale,
      status: ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED,
      headline: tr(locale, "비용 또는 성과 값이 정의되지 않아 성과 변동을 분해하지 않았습니다.", "Cost or outcome values are not defined, so performance variation was not decomposed."),
      caveats: [contract.code],
      manifest: { engine: "PVM_MATH", resultField, status: "NOT_IDENTIFIED", reasonCode: contract.code, invalidCellCount: contract.invalidCells?.length || 0 },
    });
  }
  const decomposition = PVM_MATH.decomposeFinest(periods.prior, periods.recent, keys);
  if (!decomposition) {
    return noResult({
      toolId: "5-21", inputSignature, mappingSignature, locale,
      headline: tr(locale, "비교 기간의 성과가 0이어서 단가 변동을 분해할 수 없습니다.", "Outcomes are zero in a comparison period, so unit-cost variation cannot be decomposed."),
      manifest: { engine: "PVM_MATH", resultField, status: "ABSTAIN" },
    });
  }
  const byChannel = PVM_MATH.rollup(
    decomposition.finest,
    (row) => row.chKey || tr(locale, "미지정", "Unspecified"),
    decomposition.Result1,
    decomposition.Result2,
  ).map((row) => ({ entity: row.key, mix: safeNumber(row.mix), rate: safeNumber(row.rate), contribution: safeNumber(row.contribution) }));
  const driver = [...byChannel].sort((a, b) => Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0))[0] || null;
  const metric = resultField === "actions" ? "CPA" : "CPI";
  return createAnalysisResult({
    toolId: "5-21",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: driver
        ? tr(locale, `${driver.entity}이(가) ${metric} 변화에 가장 크게 기여했습니다.`, `${driver.entity} contributed the most to the ${metric} change.`)
        : tr(locale, "성과 변동을 분해했습니다.", "Performance variation was decomposed."),
      stats: [
        { id: "prior-unit-cost", label: tr(locale, `직전 ${metric}`, `Prior ${metric}`), value: decomposition.CPA1 },
        { id: "recent-unit-cost", label: tr(locale, `최근 ${metric}`, `Recent ${metric}`), value: decomposition.CPA2 },
        { id: "unit-cost-change", label: tr(locale, `${metric} 변화`, `${metric} change`), value: decomposition.deltaCpa },
      ],
      action: tr(locale, "가장 큰 기여 채널의 비용·믹스·단가 변화를 상세 화면에서 확인합니다.", "Inspect cost, mix, and unit-cost changes for the largest contributing channel in the detailed view."),
      caveats: [tr(locale, "분해는 관측된 단가 변화를 설명하며 인과 효과를 식별하지 않습니다.", "The decomposition describes observed unit-cost change; it does not identify causal effects.")],
    },
    visualizations: [{
      id: "pvm-channel-contributions",
      kind: "bar",
      question: tr(locale, "어느 채널이 전체 단가 변화에 기여했는가?", "Which channels contributed to the total unit-cost change?"),
      data: byChannel,
      options: { x: "entity", y: "contribution" },
    }],
    manifest: { engine: "PVM_MATH", status: "COMPLETE", resultField, periodDays: 7, entityCount: byChannel.length, evidenceState: "descriptive" },
  });
}

function saturationAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const fields = mappedKeys(csvData);
  const basis = effectiveDenomBasis(csvData, options.denomBasis || "installs");
  const metricField = fields.has(basis) ? basis : fields.has("installs") ? "installs" : fields.has("actions") ? "actions" : null;
  if (!metricField || !fields.has("cost") || !fields.has("channel")) {
    return noResult({
      toolId: "5-22", inputSignature, mappingSignature, locale,
      headline: tr(locale, "포화도 진단에 필요한 채널·비용·성과 매핑이 부족합니다.", "Saturation diagnosis needs channel, cost, and outcome mappings."),
      manifest: { engine: "SAT_MATH", status: "ABSTAIN" },
    });
  }
  const { revField } = satAvailableFields(csvData);
  const grain = options.grain === "campaign" && fields.has("campaign_name") ? "campaign" : "channel";
  const metric = options.metric === "roas" && revField ? "roas" : "cpa";
  const entities = [...satBuildPoints(getMappedRows(csvData), grain, metricField, revField)]
    .map(([name, points]) => ({ name, raw: points.length, ...SAT_MATH.analyzeEntity(points, SAT_CONFIG) }));
  const usable = entities
    .filter((entity) => entity.ok && satActiveVerdict(entity, metric))
    .sort((a, b) => satActiveIndex(b, metric) - satActiveIndex(a, metric));
  if (!usable.length) {
    return noResult({
      toolId: "5-22", inputSignature, mappingSignature, locale,
      headline: tr(locale, "관측 수나 지출 변동이 충분한 채널이 없어 포화도를 판정하지 않았습니다.", "No channel has enough observations or spend variation to classify saturation."),
      manifest: { engine: "SAT_MATH", status: "ABSTAIN", grain, metric, candidateCount: entities.length },
    });
  }
  const saturated = usable.filter((entity) => satActiveVerdict(entity, metric) === "saturated");
  const headroom = usable.filter((entity) => satActiveVerdict(entity, metric) === "scale");
  const table = usable.map((entity) => ({
    entity: entity.name,
    model: entity.modelType,
    observations: entity.n,
    r2: safeNumber(entity.r2),
    averageUnitCost: safeNumber(entity.avgCpr),
    marginalUnitCost: safeNumber(entity.marginalCpr),
    saturationIndex: metric === "roas" ? safeNumber(entity.roas?.satIndexRoas) : safeNumber(entity.satIndex),
    verdict: satActiveVerdict(entity, metric),
  }));
  return createAnalysisResult({
    toolId: "5-22",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: saturated.length
        ? tr(locale, `${saturated.length}개 ${grain === "campaign" ? "캠페인" : "채널"}은 포화 신호가 있습니다.`, `${saturated.length} ${grain === "campaign" ? "campaign(s)" : "channel(s)"} show saturation signals.`)
        : headroom.length
          ? tr(locale, `${headroom.length}개 ${grain === "campaign" ? "캠페인" : "채널"}은 관측 범위 안에서 여유 신호가 있습니다.`, `${headroom.length} ${grain === "campaign" ? "campaign(s)" : "channel(s)"} show headroom within the observed range.`)
          : tr(locale, "분석 가능한 대상은 대부분 적정 구간입니다.", "Most analyzable entities are in the steady range."),
      stats: [
        { id: "analyzable", label: tr(locale, "분석 가능", "Analyzable"), value: usable.length },
        { id: "saturated", label: tr(locale, "포화", "Saturated"), value: saturated.length },
        { id: "headroom", label: tr(locale, "여유", "Headroom"), value: headroom.length },
      ],
      action: tr(locale, "관측 범위를 넘기지 않는 소규모 증액 또는 이동 시험을 설계합니다.", "Design a small monitored increase or shift that stays within the observed range."),
      caveats: [tr(locale, "한계 효율은 관측 범위의 곡선 참고값이며 인과 효과가 아닙니다.", "Marginal efficiency is an observed-range curve reference, not a causal effect.")],
    },
    visualizations: [{
      id: "saturation-ranking",
      kind: "bar",
      question: tr(locale, "어디에 증액 위험 또는 여유 신호가 있는가?", "Where are the signals of scaling risk or headroom?"),
      data: table,
      options: { x: "entity", y: "saturationIndex" },
      table: { columns: Object.keys(table[0] || {}), rows: table },
    }],
    manifest: { engine: "SAT_MATH", status: "COMPLETE", grain, metric, resultField: metricField, candidateCount: entities.length, analyzableCount: usable.length, evidenceState: "descriptive" },
  });
}

function buildAllocationPoints(rows, unit, metric) {
  const groups = new Map();
  for (const row of rows) {
    const name = getRowGroupKey(row, unit);
    const date = row.date == null || row.date === "" ? "__nodate__" : String(row.date);
    const cost = Number(row.cost);
    const result = Number(row[metric]);
    if (!name || !Number.isFinite(cost) || !Number.isFinite(result)) continue;
    if (!groups.has(name)) groups.set(name, new Map());
    const current = groups.get(name).get(date) || { cost: 0, result: 0, date: row.date };
    current.cost += cost;
    current.result += result;
    groups.get(name).set(date, current);
  }
  return new Map([...groups.entries()].map(([name, values]) => [name, [...values.values()]
    .filter((point) => point.cost > 0 && point.result > 0)
    .map((point) => ({ x: point.cost, y: point.cost / point.result, date: point.date }))]));
}

function fitAllocationModel(points) {
  const { kept } = ALLOC_MATH.removeOutliers(points, "iqr", { iqrMult: 1.5 });
  if (!kept || kept.length < 2) return null;
  const model = ALLOC_MATH.fitBest(kept.map((point) => [point.x, point.y]));
  if (!model) return null;
  const xs = kept.map((point) => point.x);
  return {
    model,
    kept,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    poly2Shape: ALLOC_MATH.detectPoly2Shape(model),
    r2: model.r2 != null ? model.r2 : ALLOC_MATH.calcR2(kept, model),
  };
}

function allocationAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const fields = mappedKeys(csvData);
  const basis = effectiveDenomBasis(csvData, options.denomBasis || "installs");
  const metric = fields.has(basis) ? basis : fields.has("installs") ? "installs" : fields.has("actions") ? "actions" : null;
  if (!metric || !fields.has("cost") || !fields.has("channel")) {
    return noResult({
      toolId: "5-3", inputSignature, mappingSignature, locale,
      headline: tr(locale, "예산 기준 시나리오에 필요한 채널·비용·성과 매핑이 부족합니다.", "The budget baseline scenario needs channel, cost, and outcome mappings."),
      manifest: { engine: "ALLOC_MATH", status: "ABSTAIN" },
    });
  }
  const unit = options.unit === "campaign_name" && fields.has("campaign_name") ? "campaign_name" : "channel";
  const rows = getMappedRows(csvData);
  const pointMap = buildAllocationPoints(rows, unit, metric);
  const modelsMap = new Map([...pointMap.entries()].map(([name, points]) => [name, fitAllocationModel(points)]));
  const historyByCh = Object.fromEntries([...modelsMap.keys()].map((name) => [name, calcChannelHistorySummary(rows, unit, name, metric)]));
  const limits = getAllocationEvidenceLimits({ modelsMap });
  const observedDailyBudget = Object.values(historyByCh).reduce((total, history) => total + (Number(history?.totalCost) || 0), 0);
  const totalBudget = Number(options.totalBudget) > 0 ? Number(options.totalBudget) : observedDailyBudget;
  if (!(totalBudget > 0) || limits.unavailableChannels.length || !(limits.maxBudget > 0)) {
    return noResult({
      toolId: "5-3", inputSignature, mappingSignature, locale,
      headline: tr(locale, "안전한 예산 기준 시나리오를 만들 만큼 적합 가능한 채널이 부족합니다.", "There are too few fit-ready channels to create a safe budget baseline scenario."),
      manifest: { engine: "ALLOC_MATH", status: "ABSTAIN", unit, candidateCount: modelsMap.size, unavailableCount: limits.unavailableChannels.length },
    });
  }
  if (totalBudget > limits.maxBudget) {
    return noResult({
      toolId: "5-3", inputSignature, mappingSignature, locale,
      headline: tr(locale, "입력 예산이 관측 범위의 안전 상한을 넘어서 기준 시나리오를 보류했습니다.", "The requested budget exceeds the observed-range safety cap, so the baseline scenario was withheld."),
      manifest: { engine: "ALLOC_MATH", status: "ABSTAIN", unit, requestedBudget: totalBudget, observedBudgetCap: limits.maxBudget },
    });
  }
  const allocation = calculateAllocationModeB({
    modelsMap,
    totalBudget,
    maxSpends: limits.maxSpends,
    extrapolateMode: "1.0",
    currency: options.currency || "KRW",
  });
  if (!allocation.items.length) {
    return noResult({
      toolId: "5-3", inputSignature, mappingSignature, locale,
      headline: tr(locale, "적합된 곡선에서 배분 가능한 예산 시나리오를 만들지 못했습니다.", "No allocable budget scenario could be produced from the fitted curves."),
      manifest: { engine: "ALLOC_MATH", status: "ABSTAIN", unit },
    });
  }
  const summary = computeAllocSummary({ items: allocation.items, metric, historyByCh });
  const inferredBudget = !(Number(options.totalBudget) > 0);
  return createAnalysisResult({
    toolId: "5-3",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "estimated",
      headline: inferredBudget
        ? tr(locale, "현재 관측 일예산을 기준으로 한 배분 시나리오입니다.", "This is an allocation scenario using the current observed daily budget.")
        : tr(locale, "입력한 일예산을 기준으로 한 배분 시나리오입니다.", "This is an allocation scenario using the entered daily budget."),
      stats: [
        { id: "budget", label: tr(locale, "시나리오 예산", "Scenario budget"), value: allocation.totalAllocated },
        { id: "expected-results", label: tr(locale, "예상 성과", "Expected outcomes"), value: summary.next.results },
        { id: "expected-unit-cost", label: metric === "actions" ? "예상 CPA" : "예상 CPI", value: summary.nextAvgCPR },
      ],
      action: inferredBudget
        ? tr(locale, "실행 전 목표 총예산과 제약 조건을 확인합니다.", "Confirm the target total budget and constraints before execution.")
        : tr(locale, "실행 전 채널별 상한과 운영 제약을 확인합니다.", "Confirm channel caps and operating constraints before execution."),
      reviewCondition: tr(locale, "실제 집행 후 관측 단가와 성과가 시나리오 범위와 일치하는지 검토", "Review whether observed unit cost and outcomes match the scenario after execution"),
      caveats: [tr(locale, "곡선은 관측 지출 범위 안에서만 사용하며, 배분은 인과적 증분 효과를 보장하지 않습니다.", "Curves are used only within observed spend ranges; allocation does not guarantee causal incrementality.")],
    },
    visualizations: [{
      id: "budget-allocation-baseline",
      kind: "bar",
      question: tr(locale, "기준 시나리오에서 예산은 어디에 배분되는가?", "Where does the baseline scenario allocate budget?"),
      data: allocation.items.map((item) => ({ entity: item.channel, budget: safeNumber(item.cost), expectedOutcomes: safeNumber(item.results), expectedUnitCost: safeNumber(item.cpr) })),
      options: { x: "entity", y: "budget" },
    }],
    manifest: {
      engine: "ALLOC_MATH+calculateAllocationModeB",
      status: "COMPLETE",
      unit,
      resultField: metric,
      budgetSource: inferredBudget ? "observed_daily_total" : "user_input",
      scenarioBudget: allocation.totalAllocated,
      observedBudgetCap: limits.maxBudget,
      entityCount: allocation.items.length,
      evidenceState: "estimated",
    },
  });
}

export const EFFICIENCY_ANALYSIS_ADAPTERS = Object.freeze({
  "5-2": Object.freeze({ toolId: "5-2", run: dashboardAdapter }),
  "5-21": Object.freeze({ toolId: "5-21", run: pvmAdapter }),
  "5-22": Object.freeze({ toolId: "5-22", run: saturationAdapter }),
  "5-3": Object.freeze({ toolId: "5-3", run: allocationAdapter }),
});

export function efficiencyAdapterFor(toolId) {
  return EFFICIENCY_ANALYSIS_ADAPTERS[toolId] || null;
}

export function runEfficiencyAnalysis({ toolId, ...input } = {}) {
  const adapter = efficiencyAdapterFor(toolId);
  if (!adapter) throw new Error(`No efficiency adapter registered for ${toolId}`);
  return adapter.run(input);
}

export { EFFICIENCY_TOOL_IDS };
