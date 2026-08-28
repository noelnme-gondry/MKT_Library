import { autoGuessColMap, buildPanelFromColMap, colMapMissing } from "@/components/tools/MmmColumnMapper";
import { MMM_METH_CONFIG, mmmDataQualityAudit, mmmTrendExistence, mmmValidate } from "@/utils/mmmMath";
import { buildPaidOrganicTrend, guessPaidOrganicColumns } from "@/utils/paidOrganicTrend";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";

import { ANALYSIS_RESULT_STATUS, createAnalysisResult } from "./analysisResultContract";

const RESPONSE_ANALYSIS_TOOL_IDS = Object.freeze(["5-18-trend", "5-18-paid-organic"]);
const TARGET_PRIORITY = Object.freeze(["Regs", "Traffic", "React", "Purchasers", "Revenue"]);

function tr(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function resultInput(input = {}) {
  return {
    csvData: input.csvData || {},
    inputSignature: String(input.inputSignature || ""),
    mappingSignature: String(input.mappingSignature || ""),
    locale: input.locale === "en" ? "en" : "ko",
    options: input.options || {},
  };
}

function requireSignatures({ inputSignature, mappingSignature }) {
  if (!inputSignature || !mappingSignature) {
    throw new Error("Dochi response adapter requires inputSignature and mappingSignature");
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
      engine: "response-adapter-v1",
      status: status === ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED ? "NOT_IDENTIFIED" : "ABSTAIN",
      ...manifest,
    },
  });
}

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function headersFor(csvData) {
  if (Array.isArray(csvData?.headers) && csvData.headers.length) return csvData.headers;
  return Object.keys(csvData?.raw?.[0] || {});
}

function mappedMmmRole(canonicalKey) {
  if (["week"].includes(canonicalKey)) return "week";
  if (["date", "iso_week_start"].includes(canonicalKey)) return "date";
  if (["mmm_reg", "org_reg", "paid_reg_w", "installs", "actions"].includes(canonicalKey)) return "reg";
  if (canonicalKey === "mmm_react") return "react";
  if (["revenue", "revenue_d0", "revenue_d7", "revenue_d14", "revenue_d30", "revenue_d90", "revenue_d180", "revenue_d360"].includes(canonicalKey)) return "revenue";
  if (["cost", "spend", "media_spend", "ch_google_roi", "ch_google_cbua", "ch_meta", "ch_tiktok", "ch_brand"].includes(canonicalKey)) return "channel";
  if (["platform", "mmm_platform"].includes(canonicalKey)) return "platform";
  return null;
}

// response 도구의 기존 매퍼를 재사용하되, StartGate의 표준 매핑이 이미 있다면
// 시간·성과·지출 역할을 우선한다. 이 함수는 사용자의 매핑을 저장하거나 바꾸지 않는다.
export function buildResponseAdapterColMap(csvData = {}) {
  const headers = headersFor(csvData);
  const colMap = autoGuessColMap(headers, csvData.raw || [], true);
  for (const header of headers) {
    const role = mappedMmmRole(csvData.mapping?.[header]);
    if (!role) continue;
    const previous = colMap[header] || {};
    colMap[header] = {
      ...previous,
      role,
      kind: previous.kind || (/brand|브랜드/i.test(header) ? "brand" : "perf"),
      plat: previous.plat || "common",
    };
  }
  return colMap;
}

function responsePanel(csvData, locale) {
  const headers = headersFor(csvData);
  const raw = Array.isArray(csvData?.raw) ? csvData.raw : [];
  if (!headers.length || !raw.length) return { reason: "no_rows" };
  const colMap = buildResponseAdapterColMap(csvData);
  const cadence = inferMappedDateCadence(csvData);
  const missing = colMapMissing(headers, colMap, locale);
  if (missing.length) return { reason: "mapping", missing };
  const built = buildPanelFromColMap(headers, raw, colMap, "all", locale, null, {
    weekStart: "monday",
    periodUnit: cadence.cadence === "monthly" ? "monthly" : "weekly",
  });
  if (built.missing?.length) return { reason: "mapping", missing: built.missing };
  const panel = built.panel;
  const target = TARGET_PRIORITY.find((name) => (
    Array.isArray(panel.targets?.[name]) && panel.targets[name].some((value) => Number.isFinite(Number(value)))
  ));
  if (!target) return { reason: "target" };
  const quality = mmmDataQualityAudit(panel);
  if (!quality.valid) return { reason: "quality", quality };
  const validation = mmmValidate(panel, locale, target);
  if (validation.issues?.length) return { reason: "validation", validation };
  return { panel, target, colMap, quality, validation, cadence: cadence.cadence };
}

// 월간 입력은 경계 달의 완결 여부를 데이터만으로 확인할 수 없다(MmmColumnMapper 참조).
// 진단만 만들어 두고 결과 카드가 말하지 않으면 사용자는 뒤집을 근거를 못 받는다.
function boundaryCaveats(prepared, locale) {
  if (!prepared?.panel?.timeDiagnostics?.monthlyBoundaryUnverified) return [];
  return [tr(
    locale,
    "월 단위 입력이라 첫·마지막 달이 완결된 달인지 확인할 수 없습니다. 진행 중인 달이 섞여 있으면 그 달만 낮게 집계돼 추세가 꺾인 것처럼 보입니다.",
    "Monthly-grain input cannot confirm whether the first and last months are complete. An in-progress month is under-counted and can look like a downturn.",
  )];
}

function trendHeadline(locale, verdict) {
  if (String(verdict).startsWith("NO robust trend")) {
    return tr(locale, "관측 기간에서 견고한 자연 추세 신호를 확인하지 못했습니다.", "No robust natural-trend signal was confirmed in the observed period.");
  }
  if (String(verdict).startsWith("Trend EXISTS") || String(verdict).startsWith("trend EXISTS")) {
    return tr(locale, "광고 변수와 별개로 남는 주간 추세 신호가 관측됩니다.", "A weekly trend signal remains after the model's media controls.");
  }
  return tr(locale, "주간 추세 신호가 있으나 계절성 또는 미디어와 분리해 단정할 수 없습니다.", "A weekly trend signal is present, but cannot be separated decisively from seasonality or media.");
}

function trendAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const prepared = responsePanel(csvData, locale);
  if (!prepared.panel) {
    const messages = {
      no_rows: tr(locale, "추세 분석을 위한 CSV 행이 없습니다.", "There are no CSV rows for trend analysis."),
      mapping: tr(locale, "추세 분석에는 주차·성과·채널 지출 매핑이 필요합니다.", "Trend analysis needs week, outcome, and channel-spend mappings."),
      target: tr(locale, "추세로 볼 수 있는 유효한 성과 시계열을 찾지 못했습니다.", "No valid outcome time series was found for trend analysis."),
      quality: tr(locale, "주간 패널에 결측 또는 중복이 있어 추세를 계산하지 않았습니다.", "The weekly panel has missing or duplicate values, so trend was not calculated."),
      validation: tr(locale, "주간 패널 검증을 통과하지 않아 추세를 계산하지 않았습니다.", "The weekly panel did not pass validation, so trend was not calculated."),
    };
    return noResult({
      toolId: "5-18-trend", inputSignature, mappingSignature, locale,
      headline: messages[prepared.reason] || messages.validation,
      caveats: prepared.missing || prepared.quality?.issues || prepared.validation?.issues || [],
      manifest: {
        engine: "mmmTrendExistence",
        reason: prepared.reason || "unknown",
        observedWeekCount: prepared.quality?.n || 0,
      },
    });
  }
  if (prepared.quality.n < 3) {
    return noResult({
      toolId: "5-18-trend", inputSignature, mappingSignature, locale,
      headline: tr(locale, "추세를 해석하려면 비교 가능한 주차가 최소 3개 필요합니다.", "At least three comparable weeks are needed to interpret a trend."),
      manifest: { engine: "mmmTrendExistence", reason: "insufficient_weeks", observedWeekCount: prepared.quality.n },
    });
  }
  let trend;
  try {
    trend = mmmTrendExistence(prepared.panel, {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: prepared.cadence === "monthly" ? [12] : MMM_METH_CONFIG.seasonalityPeriods,
      absorbed: new Set(),
    }, prepared.target, locale);
  } catch {
    return noResult({
      toolId: "5-18-trend", inputSignature, mappingSignature, locale,
      headline: tr(locale, "추세 검정 엔진이 현재 주간 패널을 계산하지 못했습니다.", "The trend-test engine could not calculate this weekly panel."),
      manifest: { engine: "mmmTrendExistence", reason: "engine_error", observedWeekCount: prepared.quality.n },
    });
  }
  const points = (trend.stl?.trend || []).map((value, index) => ({
    period: String(prepared.panel.weekLabel?.[index] || prepared.panel.week?.[index] || index + 1),
    trend: finite(value),
  })).filter((point) => point.trend != null);
  if (points.length < 2) {
    return noResult({
      toolId: "5-18-trend", inputSignature, mappingSignature, locale,
      headline: tr(locale, "계산 가능한 추세선이 충분하지 않아 결과를 보류했습니다.", "There are not enough computable trend points, so the result was withheld."),
      manifest: { engine: "mmmTrendExistence", reason: "insufficient_trend_points", observedWeekCount: prepared.quality.n },
    });
  }
  return createAnalysisResult({
    toolId: "5-18-trend",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: trendHeadline(locale, trend.verdict),
      stats: [
        { id: "trend-change-pct", label: tr(locale, "STL 추세 변화", "STL trend change"), value: finite(trend.stl_pct), unit: "%" },
        { id: "deseasonalized-mk-p", label: tr(locale, "계절 제거 MK p", "Deseasonalized MK p"), value: finite(trend.mk_deseason?.[1]) },
        { id: "observed-periods", label: tr(locale, prepared.cadence === "monthly" ? "관측 월" : "관측 주차", prepared.cadence === "monthly" ? "Observed months" : "Observed weeks"), value: prepared.quality.n },
      ],
      action: tr(locale, "계절·집행 변화와 함께 상세 추세 화면에서 기간을 확인합니다.", "Inspect the period with seasonality and spend changes in the detailed trend view."),
      caveats: [tr(locale, "이 결과는 관측된 시계열의 기술적 추세이며, 광고의 인과 효과나 자연 증분을 증명하지 않습니다.", "This is a descriptive time-series trend; it does not prove causal media impact or organic incrementality."), ...boundaryCaveats(prepared, locale)],
    },
    visualizations: [{
      id: "response-stl-trend",
      kind: "line",
      question: tr(locale, "관측 기간의 평활 추세는 어떻게 움직였는가?", "How did the smoothed trend move during the observed period?"),
      data: points,
      options: { x: "period", y: "trend" },
    }],
    manifest: {
      engine: "mmmTrendExistence",
      status: "COMPLETE",
      target: prepared.target,
      observedWeekCount: prepared.quality.n,
      sourceCadence: prepared.cadence,
      trendMethod: trend.stl?.method || null,
      evidenceState: "descriptive",
    },
  });
}

function paidOrganicHeadline(locale, verdict) {
  if (verdict === "watch") return tr(locale, "Paid 상승·Organic 하락 패턴이 반복되어 확인이 필요합니다.", "Paid-up and Organic-down movement repeats and needs follow-up." );
  if (verdict === "co-growth") return tr(locale, "최근에는 Paid와 Organic이 함께 움직인 주가 더 많습니다.", "Recent weeks more often show Paid and Organic moving together.");
  return tr(locale, "한 방향으로 반복되는 Paid·Organic 패턴은 아직 뚜렷하지 않습니다.", "No repeated one-direction Paid–Organic pattern is clear yet.");
}

function paidOrganicAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = resultInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const headers = headersFor(csvData);
  const raw = Array.isArray(csvData?.raw) ? csvData.raw : [];
  if (!headers.length || !raw.length) {
    return noResult({
      toolId: "5-18-paid-organic", inputSignature, mappingSignature, locale,
      headline: tr(locale, "Paid·Organic 변화맵을 위한 CSV 행이 없습니다.", "There are no CSV rows for the Paid–Organic movement map."),
      manifest: { engine: "buildPaidOrganicTrend", reason: "no_rows", observedWeekCount: 0 },
    });
  }
  const mapping = options.paidOrganicMapping || guessPaidOrganicColumns(headers);
  const result = buildPaidOrganicTrend(raw, mapping, { recentWeeks: options.recentWeeks || 12 });
  if (result.missing?.length) {
    return noResult({
      toolId: "5-18-paid-organic", inputSignature, mappingSignature, locale,
      headline: tr(locale, "변화맵에는 날짜·Paid 성과·Organic 또는 전체 성과 매핑이 필요합니다.", "The movement map needs date, Paid outcome, and Organic or Total outcome mappings."),
      caveats: result.missing,
      manifest: { engine: "buildPaidOrganicTrend", reason: "missing_mapping", observedWeekCount: result.levels?.length || 0 },
    });
  }
  if ((result.points || []).length < 1) {
    return noResult({
      toolId: "5-18-paid-organic", inputSignature, mappingSignature, locale,
      headline: tr(locale, "변화맵에는 비교 가능한 주차가 최소 2개 필요합니다.", "The movement map needs at least two comparable weeks."),
      manifest: { engine: "buildPaidOrganicTrend", reason: "insufficient_weeks", observedWeekCount: result.levels?.length || 0 },
    });
  }
  const points = result.recent.map((point) => ({
    period: point.week,
    organicChangePct: finite(point.x),
    paidChangePct: finite(point.y),
  })).filter((point) => point.organicChangePct != null && point.paidChangePct != null);
  return createAnalysisResult({
    toolId: "5-18-paid-organic",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: paidOrganicHeadline(locale, result.verdict),
      stats: [
        { id: "recent-organic-change", label: tr(locale, "최근 4주 Organic 변화", "Latest 4wk Organic change"), value: finite(result.recentOrganicChange), unit: "%" },
        { id: "recent-paid-change", label: tr(locale, "최근 4주 Paid 변화", "Latest 4wk Paid change"), value: finite(result.recentPaidChange), unit: "%" },
        { id: "opposite-direction-weeks", label: tr(locale, "반대 방향 주차", "Opposite-direction weeks"), value: result.oppositeCount },
      ],
      action: result.verdict === "watch"
        ? tr(locale, "지출·계절성·시차를 포함한 카니발 정밀 진단으로 확인합니다.", "Continue to detailed cannibalization diagnostics with spend, seasonality, and lag evidence.")
        : tr(locale, "더 많은 주차 또는 큰 집행 변화 뒤 같은 기준으로 다시 확인합니다.", "Recheck with the same definition after more weeks or a material spend change."),
      caveats: [tr(locale, "변화맵은 동시 움직임을 요약할 뿐 어트리뷰션 이동·잠식·증분 효과를 구분하거나 증명하지 않습니다.", "The movement map summarizes co-movement only; it cannot separate or prove attribution movement, cannibalization, or incremental effects.")],
    },
    visualizations: [{
      id: "paid-organic-movement-map",
      kind: "scatter",
      question: tr(locale, "최근 주차에서 Paid와 Organic은 어떤 방향으로 함께 움직였는가?", "How did Paid and Organic move together in recent weeks?"),
      data: points,
      options: { x: "organicChangePct", y: "paidChangePct", label: "period" },
    }],
    manifest: {
      engine: "buildPaidOrganicTrend",
      status: "COMPLETE",
      observedWeekCount: result.levels.length,
      comparableWeekCount: result.points.length,
      recentWindowWeeks: result.recent.length,
      verdict: result.verdict,
      organicSource: mapping.organic ? "direct_column" : "total_minus_paid",
      invalidRowCount: result.invalidRows,
      invalidWeekCount: result.invalidWeeks,
      evidenceState: "descriptive",
    },
  });
}

export const RESPONSE_ANALYSIS_ADAPTERS = Object.freeze({
  "5-18-trend": Object.freeze({ toolId: "5-18-trend", run: trendAdapter }),
  "5-18-paid-organic": Object.freeze({ toolId: "5-18-paid-organic", run: paidOrganicAdapter }),
});

export function responseAdapterFor(toolId) {
  return RESPONSE_ANALYSIS_ADAPTERS[toolId] || null;
}

export function runResponseAnalysis({ toolId, ...input } = {}) {
  const adapter = responseAdapterFor(toolId);
  if (!adapter) throw new Error(`No response analysis adapter registered for ${toolId}`);
  return adapter.run(input);
}

export { RESPONSE_ANALYSIS_TOOL_IDS };
