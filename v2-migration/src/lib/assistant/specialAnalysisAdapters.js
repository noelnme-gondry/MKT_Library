import { getMappedRows } from "@/utils/dashboardAggregator";
import {
  classifyStoreShift,
  dailyConversionSeries,
  decomposeStoreConversion,
  storeFunnel,
} from "@/utils/asoStoreMath";
import { CREATIVE_FATIGUE, CREATIVE_STATS } from "@/utils/creativeMath";
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { buildCreativeQuickSummary } from "@/lib/analysis-results/creativeQuickSummary";

import { ANALYSIS_RESULT_STATUS, createAnalysisResult } from "./analysisResultContract";

const SPECIAL_TOOL_IDS = Object.freeze(["5-27", "9-6"]);

function tr(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function mappedKeys(csvData) {
  return new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__"));
}

function readInput(input = {}) {
  return {
    csvData: input.csvData,
    inputSignature: String(input.inputSignature || ""),
    mappingSignature: String(input.mappingSignature || ""),
    locale: input.locale === "en" ? "en" : "ko",
  };
}

function requireSignatures(input) {
  if (!input.inputSignature || !input.mappingSignature) {
    throw new Error("Dochi adapter requires inputSignature and mappingSignature");
  }
}

function unavailable({ toolId, inputSignature, mappingSignature, locale, status = ANALYSIS_RESULT_STATUS.NOT_COMPUTABLE, headline, caveats = [], manifest = {} }) {
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
      engine: "special-analysis-adapter-v1",
      status: status === ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED ? "NOT_IDENTIFIED" : "ABSTAIN",
      ...manifest,
    },
  });
}

function splitStorePeriods(rows) {
  const dates = [...new Set(rows.map((row) => String(row.date || "")).filter(Boolean))].sort();
  if (dates.length < 4) return null;
  const cut = dates[Math.floor(dates.length / 2)];
  return {
    cut,
    dateCount: dates.length,
    before: rows.filter((row) => String(row.date) < cut),
    after: rows.filter((row) => String(row.date) >= cut),
  };
}

function storeEngineRows(csvData) {
  return getMappedRows(csvData).map((row) => ({
    date: row.date,
    source: row.store_source,
    impressions: row.impressions,
    views: row.product_page_views,
    installs: row.installs,
  }));
}

function storeHeadline(locale, verdict) {
  if (verdict === "mix") return tr(locale, "트래픽 구성 변화가 주도 — 페이지가 아니라 유입 믹스", "Traffic mix drove it — not the page");
  if (verdict === "efficiency") return tr(locale, "소스별 전환율 변화가 주도 — 페이지·스토어 요소 점검", "Per-source conversion drove it — check the page");
  if (verdict === "mixed") return tr(locale, "구성과 효율이 함께 움직임", "Mix and efficiency moved together");
  return tr(locale, "의미 있는 변화 없음", "No meaningful change");
}

function asoStoreAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale } = readInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const required = ["date", "store_source", "product_page_views", "installs"];
  const fields = mappedKeys(csvData);
  const missing = required.filter((field) => !fields.has(field));
  if (missing.length) {
    return unavailable({
      toolId: "5-27", inputSignature, mappingSignature, locale,
      headline: tr(locale, "스토어 전환 분석에 필요한 날짜·유입 소스·제품 페이지 조회·설치 매핑이 부족합니다.", "Store conversion analysis needs date, source, product-page-view, and install mappings."),
      manifest: { engine: "asoStoreMath", missingFieldCount: missing.length },
    });
  }

  const rows = storeEngineRows(csvData);
  const periods = splitStorePeriods(rows);
  const overall = storeFunnel(rows);
  if (!periods) {
    return unavailable({
      toolId: "5-27", inputSignature, mappingSignature, locale,
      headline: tr(locale, "스토어 전환 변화를 분해하려면 서로 다른 날짜가 최소 4일 필요합니다.", "Store conversion decomposition needs at least four distinct dates."),
      manifest: { engine: "asoStoreMath", observedDateCount: new Set(rows.map((row) => String(row.date || "")).filter(Boolean)).size, overallViewToInstall: overall.viewToInstall },
    });
  }

  const decomposition = decomposeStoreConversion(periods.before, periods.after);
  if (!decomposition) {
    return unavailable({
      toolId: "5-27", inputSignature, mappingSignature, locale,
      headline: tr(locale, "앞뒤 기간 중 한쪽의 설치 또는 제품 페이지 조회가 부족해 전환 변화를 분해하지 않았습니다.", "Installs or product page views are insufficient in one period, so the conversion change was not decomposed."),
      manifest: { engine: "asoStoreMath", observedDateCount: periods.dateCount, splitDate: periods.cut },
    });
  }

  const classification = classifyStoreShift(decomposition);
  const series = dailyConversionSeries(rows);
  return createAnalysisResult({
    toolId: "5-27",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: storeHeadline(locale, classification.verdict),
      stats: [
        { id: "overall-view-to-install", label: tr(locale, "전체 조회→설치", "Overall view-to-install"), value: overall.viewToInstall, unit: "rate" },
        { id: "before-view-to-install", label: tr(locale, "앞 기간 조회→설치", "Earlier view-to-install"), value: decomposition.funnelBefore.viewToInstall, unit: "rate" },
        { id: "after-view-to-install", label: tr(locale, "뒤 기간 조회→설치", "Later view-to-install"), value: decomposition.funnelAfter.viewToInstall, unit: "rate" },
        { id: "mix-share", label: tr(locale, "믹스 기여 비중", "Mix contribution share"), value: classification.mixShare, unit: "rate" },
      ],
      action: classification.verdict === "mix"
        ? tr(locale, "광고 증액·피처링·시즌 등 유입 구성이 바뀐 이유를 먼저 확인합니다.", "First check why the traffic mix changed, including paid scaling, featuring, or seasonality.")
        : tr(locale, "소스별 전환 추이와 제품 페이지·스토어 변경 이력을 함께 확인합니다.", "Review per-source conversion trends alongside product-page and store changes."),
      caveats: [tr(locale, "분해는 관측된 변화의 구성요소를 설명할 뿐, 변화 원인을 인과적으로 식별하지 않습니다.", "The decomposition describes components of the observed change; it does not identify its causal cause.")],
    },
    visualizations: [{
      id: "store-conversion-trend",
      kind: "line",
      question: tr(locale, "전환율은 날짜와 유입 소스별로 어떻게 움직였는가?", "How did conversion move by date and traffic source?"),
      data: {
        dates: series.dates,
        overall: series.total,
        sources: series.sources.map((source) => ({ source: source.source, values: source.values })),
      },
      options: { x: "dates", y: "overall", unit: "rate", splitDate: periods.cut },
    }],
    manifest: {
      engine: "asoStoreMath+PVM_MATH",
      status: "COMPLETE",
      observedDateCount: periods.dateCount,
      sourceCount: series.sources.length,
      splitDate: periods.cut,
      verdict: classification.verdict,
      evidenceState: "descriptive",
    },
  });
}

function validCreativeRows(csvData) {
  return getMappedRows(csvData).filter((row) => (
    row.creative_id
    && row.date
    && Number(row.impressions) >= 0
    && Number(row.clicks) >= 0
  ));
}

function creativeAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale } = readInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const summary = buildCreativeQuickSummary(csvData);
  if (!summary.available) {
    return unavailable({
      toolId: "9-6", inputSignature, mappingSignature, locale,
      headline: tr(locale, "소재 피로도 분석에 필요한 소재 ID·날짜·노출·클릭 매핑 또는 유효 행이 부족합니다.", "Creative fatigue analysis needs creative ID, date, impression, click mappings, and valid rows."),
      manifest: { engine: "creativeMath", missingInputCount: summary.missing?.length || 0 },
    });
  }

  const fatigue = CREATIVE_STATS.fatigueDetect(validCreativeRows(csvData), "ctr", CREATIVE_CONFIG);
  const analyzable = fatigue.filter((item) => item.reason == null);
  if (!analyzable.length) {
    return unavailable({
      toolId: "9-6", inputSignature, mappingSignature, locale,
      status: ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED,
      headline: tr(locale, "소재별 추세가 짧아 피로도 여부를 판정하지 않았습니다.", "Creative histories are too short, so fatigue was not classified."),
      manifest: { engine: "creativeMath", creativeCount: summary.creativeCount, analyzableCreativeCount: 0 },
    });
  }

  const alerts = CREATIVE_FATIGUE.buildAlerts(validCreativeRows(csvData), CREATIVE_CONFIG.fatigueAlert);
  const alertNowCount = alerts.filter((item) => item.alert).length;
  const fatiguedCount = fatigue.filter((item) => item.fatigued).length;
  const alertingIds = new Set(alerts.filter((item) => item.alert).map((item) => item.creative_id));
  const fatiguedWithoutAlert = fatigue.filter((item) => item.fatigued && !alertingIds.has(item.creative_id)).length;
  const statusRows = [
    { status: tr(locale, "현재 알림", "Alerting now"), count: alertNowCount },
    { status: tr(locale, "피로 감지·알림 없음", "Fatigue detected, no alert"), count: fatiguedWithoutAlert },
    { status: tr(locale, "판정 가능·비피로", "Analyzable, not fatigued"), count: Math.max(0, analyzable.length - fatiguedCount) },
    { status: tr(locale, "기간 부족", "History too short"), count: fatigue.length - analyzable.length },
  ];
  const headline = alertNowCount
    ? tr(locale, `${alertNowCount}개 소재가 현재 교체 경보 기준에 도달했습니다.`, `${alertNowCount} creative(s) currently meet the replacement-alert threshold.`)
    : fatiguedCount
      ? tr(locale, `${fatiguedCount}개 소재에서 CTR 피로 신호가 관측됐습니다.`, `${fatiguedCount} creative(s) show observed CTR-fatigue signals.`)
      : tr(locale, "판정 가능한 소재에서 현재 CTR 피로 신호는 관측되지 않았습니다.", "No current CTR-fatigue signal was observed among analyzable creatives.");

  return createAnalysisResult({
    toolId: "9-6",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline,
      stats: [
        { id: "creative-count", label: tr(locale, "소재 수", "Creative count"), value: summary.creativeCount },
        { id: "fatigued-count", label: tr(locale, "피로 감지", "Fatigue detected"), value: fatiguedCount },
        { id: "alert-now-count", label: tr(locale, "현재 알림", "Alerting now"), value: alertNowCount },
        { id: "analyzable-count", label: tr(locale, "판정 가능", "Analyzable"), value: analyzable.length },
      ],
      action: alertNowCount
        ? tr(locale, "현재 경보 소재의 교체 우선순위와 신규 소재 공급량을 상세 화면에서 검토합니다.", "Review replacement priority and new-creative supply for alerting items in the detailed tool.")
        : tr(locale, "소재별 추이를 계속 관측하고 충분한 기간이 쌓이면 교체 기준을 다시 점검합니다.", "Keep observing per-creative trends and recheck replacement criteria after more history accumulates."),
      caveats: [tr(locale, "피로도는 관측된 CTR 추세 신호이며, 플랫폼 전달 변화나 소재 자체의 인과 효과를 분리하지 않습니다.", "Fatigue is an observed CTR-trend signal; it does not separate delivery changes from a creative's causal effect.")],
    },
    visualizations: [{
      id: "creative-fatigue-status",
      kind: "bar",
      question: tr(locale, "교체 검토가 필요한 소재는 몇 개인가?", "How many creatives need replacement review?"),
      data: statusRows,
      options: { x: "status", y: "count" },
    }],
    manifest: {
      engine: "creativeMath.fatigueDetect+buildAlerts",
      status: "COMPLETE",
      creativeCount: summary.creativeCount,
      analyzableCreativeCount: analyzable.length,
      fatigueSignalCount: fatiguedCount,
      alertNowCount,
      evidenceState: "descriptive",
    },
  });
}

export const SPECIAL_ANALYSIS_ADAPTERS = Object.freeze({
  "5-27": Object.freeze({ toolId: "5-27", run: asoStoreAdapter }),
  "9-6": Object.freeze({ toolId: "9-6", run: creativeAdapter }),
});

export function specialAdapterFor(toolId) {
  return SPECIAL_ANALYSIS_ADAPTERS[toolId] || null;
}

export function runSpecialAnalysis({ toolId, ...input } = {}) {
  const adapter = specialAdapterFor(toolId);
  if (!adapter) throw new Error(`No special analysis adapter registered for ${toolId}`);
  return adapter.run(input);
}

export { SPECIAL_TOOL_IDS };
