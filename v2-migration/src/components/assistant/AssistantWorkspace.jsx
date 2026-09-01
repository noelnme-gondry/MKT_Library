"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ANALYSIS_CATALOG, analysisCatalogEntry } from "@/lib/assistant/analysisCatalog";
import { evaluateAnalysisEligibility, rankRecommendedAnalyses } from "@/lib/assistant/evaluateAnalysisEligibility";
import { beginNextAnalysis, confirmAnalysis, createAnalysisQueue, markQueueStale, settleAnalysis } from "@/lib/assistant/analysisQueue";
import { buildNaturalExperimentHandoff, detectBudgetInterruptionCandidates } from "@/lib/assistant/detectBudgetInterruptionCandidates";
import { efficiencyAdapterFor, runEfficiencyAnalysis } from "@/lib/assistant/efficiencyAnalysisAdapters";
import { optimizationAdapterFor, runOptimizationAnalysis } from "@/lib/assistant/optimizationAnalysisAdapters";
import { responseAdapterFor, runResponseAnalysis } from "@/lib/assistant/responseAnalysisAdapters";
import { runSpecialAnalysis, specialAdapterFor } from "@/lib/assistant/specialAnalysisAdapters";
import { runSubscriptionAnalysis, subscriptionAdapterFor } from "@/lib/assistant/subscriptionAnalysisAdapters";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { prepareAnalysisHandoff } from "@/lib/assistant/prepareAnalysisHandoff";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";
import { useAppStore } from "@/store/useDataStore";
import { effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { sourceCurrencyOf } from "@/utils/format";

const COPY = {
  ko: {
    eyebrow: "DOCHI ANALYSIS MAP",
    title: "도치가 찾은 분석 지도",
    deck: "한 번 읽은 원본에서 가능한 분석과 연결된 요약을 정리합니다. 매핑을 수정하면 아래 판정과 실행 대기열은 오래된 상태가 됩니다.",
    scopeLabel: "이 화면의 범위",
    scopeNote: "연결된 분석은 여기서 안전하게 계산 가능한 요약·표·차트를 모두 가져옵니다. 고급 모형 설정과 추가 진단은 각 상세 분석에서 이어집니다.",
    empty: "파일을 읽으면 가능한 분석, 이 화면에서 계산할 요약, 상세 분석에서 확인할 항목을 나눠 보여드립니다.",
    source: "데이터",
    rows: "행",
    columns: "컬럼",
    mapped: "표준 역할 매핑",
    mappingReview: "바로 위 ‘CSV 컬럼 → 표준 필드 매핑’에서 자동 매핑을 검토하거나 수정할 수 있습니다.",
    recommended: "지금 가장 먼저 볼 분석",
    judgment: "현재 판단 상태",
    judgmentReady: "현재 데이터에서 바로 실행할 수 있는 분석을 먼저 정리했습니다.",
    judgmentReview: "이 추천은 현재 입력·매핑의 적합성 판단이며, 효과나 인과를 뜻하지 않습니다.",
    findingsTitle: (count) => `도치가 확인한 발견 ${count}건`,
    findingsDeck: "같은 원본에서 실제 계산을 마친 결론만 모았습니다. 각 항목의 근거와 해석 한계는 아래 결과에서 확인하세요.",
    reason: "추천 이유",
    baseline: "이 화면에서 계산 가능한 요약",
    baselineDeck: "현재 입력과 매핑으로 기본 실행 후보가 된 분석입니다. 연결된 결과와 차트는 여기서 가져오고, 고급 설정이 필요한 분석만 상세 화면으로 넘깁니다.",
    start: "요약 분석 실행",
    continue: "다음 요약 분석 준비",
    rerun: "현재 매핑으로 가능한 분석 전체 다시 실행",
    queueRunning: "요약 분석 실행 중",
    noBaseline: "현재 매핑에서 기본 실행 후보가 없습니다.",
    extra: "추가 모델 확인",
    design: "설계 확인 필요",
    blocked: "추가 데이터 필요",
    details: "추가 차트·상세 분석 열기",
    preparingDetails: "상세 분석 화면을 준비하고 있습니다.",
    adapterPending: "상세 분석에서 실행",
    adapterPendingDetail: "이 분석은 이 화면에서 실행하거나 결과를 만들지 않았습니다. 상세 분석에서 차트와 분석 조건을 확인해 주세요.",
    stale: "매핑 또는 입력이 바뀌어 이전 실행 대기열을 오래된 상태로 표시했습니다. 현재 매핑으로 다시 시작하세요.",
    queue: "기본 분석 대기열",
    queueEmpty: "아직 기본 실행을 시작하지 않았습니다.",
    queued: "대기",
    running: "준비 중",
    complete: "완료",
    failed: "상세 도구에서 확인",
    handoff: "승인됨 · 상세 도구",
    staleState: "오래됨",
    result: "이 화면에서 계산한 요약",
    resultSuccess: "분석 결과",
    resultNotComputable: "결과 보류",
    resultNotIdentified: "식별 불가",
    resultError: "분석 오류",
    decisionTape: "결정 테이프",
    keyConclusion: "핵심 결론",
    availableEvidence: "현재 근거",
    evidenceFigures: "확인 가능한 수치",
    primaryAction: "주 행동",
    noAction: "이 결과만으로 실행을 권하지 않습니다. 상세 조건을 먼저 확인하세요.",
    evidence: "근거 상태",
    evidenceState: { descriptive: "관측 요약", estimated: "추정 시나리오", not_identified: "식별 불가", not_computable: "계산 불가" },
    action: "다음 행동",
    caveats: "해석 한계",
    primaryView: "요약 결과",
    exactTable: "정확한 수치 표 보기",
    detailsView: "해석 한계 보기",
    resultToggle: "결과 펼치기/접기",
    embeddedRunning: "도치가 실제 데이터를 계산하고 있습니다.",
    staleResult: "이 결과는 이전 입력 또는 매핑에서 생성됐습니다. 현재 데이터의 결과로 표시하지 않습니다.",
    adapterError: "분석 실행 중 결과를 만들지 못했습니다. 상세 도구에서 조건을 확인해 주세요.",
    approve: "승인하고 상세 도구에서 계속",
    approvedHandoff: "승인됨 — 이 작업대에서는 이 분석의 숫자를 만들지 않습니다. 상세 도구에서 모델·설계를 계속 확인하세요.",
    approvedAnnouncement: "승인 기록을 현재 데이터와 매핑에 연결했습니다. 상세 도구에서 계속 확인하세요.",
    naturalCandidate: "자연실험 후보",
    naturalCandidateDeck: "지속적인 예산 하락은 관측 후보일 뿐 실험·홀드아웃을 뜻하지 않습니다. 사실 확인 후 기존 증분 분석 도구로만 넘깁니다.",
    naturalActual: "실제 운영 중단(또는 예산 중단)이었음을 확인합니다",
    naturalOutcome: "결과 지표 선택",
    naturalControl: "대조 단위(있으면 입력)",
    naturalContinue: "확인 후 상세 도구로 넘기기",
    naturalNeedsConfirmation: "실제 중단 여부와 결과 지표를 확인해야 합니다. 이 화면에서는 증분 수치를 만들지 않습니다.",
    naturalHandoff: "확인된 후보를 상세 도구로 넘깁니다. 대조 단위가 있으면 증분 분석, 없으면 관측 전후 분석으로 연결합니다.",
    requires: "확인 항목",
    status: { ready: "바로 가능", confirm_model: "모델 확인", confirm_design: "설계 확인", manual: "수동 설정", blocked: "데이터 필요" },
  },
  en: {
    eyebrow: "DOCHI ANALYSIS MAP",
    title: "The analysis map Dochi found",
    deck: "One read of the source organizes supported analyses and connected summaries. Changing a mapping marks the checks and run queue below as stale.",
    scopeLabel: "What this screen does",
    scopeNote: "Connected analyses bring every summary, table, and chart that can be computed safely onto this workspace. Advanced model settings and extra diagnostics continue in each detailed analysis.",
    empty: "After a file is read, this screen separates supported analyses, summaries available here, and checks that continue in detailed analyses.",
    source: "Data",
    rows: "rows",
    columns: "columns",
    mapped: "standard roles mapped",
    mappingReview: "Review or edit automatic mappings in the “CSV column → standard field mapping” section above.",
    recommended: "Best first analysis",
    judgment: "Current decision state",
    judgmentReady: "The analyses that can run from the current input are organized first.",
    judgmentReview: "This recommendation reflects fit for the current input and mapping; it does not imply an effect or causality.",
    findingsTitle: (count) => `${count} finding${count === 1 ? "" : "s"} verified by Dochi`,
    findingsDeck: "Only conclusions actually calculated from the same source appear here. Review each result below for evidence and interpretation limits.",
    reason: "Why this",
    baseline: "Summaries this screen can calculate",
    baselineDeck: "These are baseline candidates for the current input and mapping. Connected results and charts appear here; only analyses needing advanced settings continue in a detailed view.",
    start: "Run summary analyses",
    continue: "Prepare next summary",
    rerun: "Rerun every available analysis with this mapping",
    queueRunning: "Running summary analyses",
    noBaseline: "No baseline analysis is ready with the current mapping.",
    extra: "Additional model confirmation",
    design: "Design confirmation needed",
    blocked: "More data needed",
    details: "Open extra charts and details",
    preparingDetails: "Preparing the detailed analysis.",
    adapterPending: "Run in detailed analysis",
    adapterPendingDetail: "This screen did not run the analysis or create a result. Review its charts and analysis conditions in the detailed analysis.",
    stale: "A mapping or input changed, so the previous run queue is marked stale. Start again with the current mapping.",
    queue: "Baseline analysis queue",
    queueEmpty: "Baseline analysis has not started yet.",
    queued: "Queued",
    running: "Preparing",
    complete: "Complete",
    failed: "Review in detailed tool",
    handoff: "Approved · detailed tool",
    staleState: "Stale",
    result: "Summary calculated on this screen",
    resultSuccess: "Analysis result",
    resultNotComputable: "Result withheld",
    resultNotIdentified: "Not identified",
    resultError: "Analysis error",
    decisionTape: "Decision tape",
    keyConclusion: "Key conclusion",
    availableEvidence: "Current evidence",
    evidenceFigures: "Available figures",
    primaryAction: "Primary action",
    noAction: "Do not act on this result alone. Review the detailed conditions first.",
    evidence: "Evidence state",
    evidenceState: { descriptive: "Observed summary", estimated: "Estimated scenario", not_identified: "Not identified", not_computable: "Not computable" },
    action: "Next action",
    caveats: "Interpretation limits",
    primaryView: "Summary result",
    exactTable: "View exact values",
    detailsView: "Show interpretation limits",
    resultToggle: "Show or hide result",
    embeddedRunning: "Dochi is calculating your actual data.",
    staleResult: "This result was created from a previous input or mapping. It is not shown as a result for the current data.",
    adapterError: "The workspace could not produce a result. Review the conditions in the detailed tool.",
    approve: "Approve and continue in detailed tool",
    approvedHandoff: "Approved — this workspace does not produce numbers for this analysis. Continue model or design review in the detailed tool.",
    approvedAnnouncement: "The approval is bound to the current input and mapping. Continue in the detailed tool.",
    naturalCandidate: "Natural-experiment candidate",
    naturalCandidateDeck: "A sustained budget drop is only an observed candidate, not an experiment or holdout. After factual confirmation, it is handed off only to an existing incrementality tool.",
    naturalActual: "I confirm this was an actual operational or budget interruption",
    naturalOutcome: "Choose outcome metric",
    naturalControl: "Control unit (if available)",
    naturalContinue: "Confirm and hand off to detailed tool",
    naturalNeedsConfirmation: "Confirm the actual interruption and outcome metric first. This workspace does not create an incrementality number.",
    naturalHandoff: "The confirmed candidate is handed to a detailed tool. With a control unit it opens incrementality analysis; without one it opens observed pre/post analysis.",
    requires: "Confirm",
    status: { ready: "Ready", confirm_model: "Confirm model", confirm_design: "Confirm design", manual: "Manual setup", blocked: "Needs data" },
  },
};

function mappedKeys(mapping = {}) {
  return new Set(Object.values(mapping).filter((value) => value && value !== "__ignore__"));
}

function detectedGrain(entry, fields, cadence) {
  const has = (key) => fields.has(key);
  if (has("tenure_periods") && has("event_observed")) return "subscription_episode";
  if (has("search_term")) return "asa_keyword_daily";
  if (has("creative_id") && has("impressions")) return "creative_daily";
  if (has("store_source") && has("product_page_views")) return "store_funnel_daily";
  if (entry.supportedGrains.includes("weekly_panel")
    && (has("week") || has("date") || has("iso_week_start"))
    && ["daily", "weekly", "monthly"].includes(cadence)) return "weekly_panel";
  if (has("iso_week_start") || has("mmm_reg") || [...fields].some((key) => key.startsWith("ch_"))) return "weekly_panel";
  if (has("is_control") || has("arm_id")) return "experiment_aggregate";
  if (entry.toolId === "5-25" && has("date") && has("cost") && (has("channel") || has("campaign_name"))) return "channel_spend_timeseries";
  if (has("date") && (has("cost") || has("spend"))) return "campaign_daily";
  return "unknown";
}

function profileFor(entry, { raw = [], headers = [], mapping = {} } = {}) {
  const fields = mappedKeys(mapping);
  const cadence = inferMappedDateCadence({ raw, headers, mapping });
  const headerFor = (field) => headers.find((header) => mapping[header] === field);
  const tenureHeader = headerFor("tenure_periods");
  const periodCount = entry.supportedGrains.includes("weekly_panel") && cadence.cadence === "daily"
    ? cadence.weeklyPeriodCount
    : cadence.periodCount;
  return {
    rowCount: raw.length,
    periodCount,
    cadence: cadence.cadence,
    grain: detectedGrain(entry, fields, cadence.cadence),
    validEpisodeCount: entry.toolId === "5-28"
      ? raw.filter((row) => Number.isFinite(Number(row?.[tenureHeader]))).length
      : undefined,
  };
}

function mergedToolMapping(mappingContract, globalMapping = {}) {
  const mapping = { ...(mappingContract?.mapping || {}) };
  Object.entries(globalMapping).forEach(([header, field]) => {
    if (field && field !== "__ignore__") mapping[header] = field;
  });
  return mapping;
}

function fingerprintStep(hash, value) {
  const text = String(value ?? "");
  let next = hash;
  for (let index = 0; index < text.length; index += 1) {
    next ^= text.charCodeAt(index);
    next = Math.imul(next, 0x01000193);
  }
  return next;
}

// 원본 행을 브라우저 메모리 밖으로 내보내지 않는 화면 전용 서명이다. 값은 이 함수
// 안에서만 읽고 결과·큐에는 비가역 지문과 구조 크기만 남긴다. analytics나 persistence에
// 쓰이지 않으며 mapping/input 변경 뒤 stale 표시만 구분한다.
export function analysisInputSignature(csvData) {
  const headers = csvData.headers || [];
  let hash = 0x811c9dc5;
  for (const header of headers) hash = fingerprintStep(hash, header);
  for (const row of csvData.raw || []) {
    for (const header of headers) hash = fingerprintStep(hash, row?.[header]);
  }
  return `v1:${csvData.raw?.length || 0}:${headers.length}:${(hash >>> 0).toString(36)}`;
}

function blockersText(result, locale) {
  const first = result.blockers?.[0];
  if (!first) return locale === "en" ? "Review the detailed tool requirements." : "상세 도구의 데이터 조건을 확인해 주세요.";
  if (first.code === "missing_fields") return locale === "en"
    ? `Missing: ${(first.alternatives || []).flat().join(" / ")}`
    : `필요: ${(first.alternatives || []).flat().join(" / ")}`;
  if (first.code === "grain_mismatch") return locale === "en" ? "This file has a different data grain." : "이 파일은 다른 데이터 단위입니다.";
  if (first.code === "no_rows") return locale === "en" ? "No readable rows were found." : "읽을 수 있는 행이 없습니다.";
  if (first.code === "min_periods") return locale === "en" ? `Needs at least ${first.required} periods.` : `최소 ${first.required}개 기간이 필요합니다.`;
  return locale === "en" ? "This analysis needs additional data or review." : "이 분석에는 추가 데이터 또는 확인이 필요합니다.";
}

function titleFor(toolId, getTitle) {
  return getTitle?.(toolId) || analysisCatalogEntry(toolId)?.toolId || toolId;
}

function queueStateLabel(queueState, C, fallback) {
  if (!queueState) return fallback;
  return C[queueState === "stale" ? "staleState" : queueState] || fallback;
}

function resultLabel(result, C) {
  if (result.status === "success") return C.resultSuccess;
  if (result.status === "not_computable") return C.resultNotComputable;
  if (result.status === "not_identified") return C.resultNotIdentified;
  return C.resultError;
}

function formatResultValue(value, locale) {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function tableShape(visualization) {
  if (visualization.table?.columns?.length) return visualization.table;
  if (Array.isArray(visualization.data)) {
    const rows = visualization.data;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
    return { columns, rows };
  }
  // 시간 계열 명세는 line renderer가 준비되기 전에도 원본 배열을 결과 객체에
  // 노출하지 않고, 날짜별 접근 가능한 표로 투영한다.
  if (Array.isArray(visualization.data?.dates) && Array.isArray(visualization.data?.overall)) {
    const sourceSeries = visualization.data.sources || [];
    const columns = ["date", "overall", ...sourceSeries.map((series) => String(series.source || "source"))];
    const rows = visualization.data.dates.map((date, index) => Object.fromEntries([
      ["date", date],
      ["overall", visualization.data.overall[index] ?? null],
      ...sourceSeries.map((series) => [String(series.source || "source"), series.values?.[index] ?? null]),
    ]));
    return { columns, rows };
  }
  const rows = [];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  return { columns, rows };
}

function ResultTable({ visualization, locale, limit = null }) {
  const { columns, rows } = tableShape(visualization);
  const visibleRows = limit == null ? rows : rows.slice(0, limit);
  if (!columns.length || !visibleRows.length) return null;
  return <div className="dochi-workspace__result-table-wrap"><table className="dochi-workspace__result-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${visualization.id}-${index}`}>{columns.map((column) => <td key={column}>{formatResultValue(row?.[column], locale)}</td>)}</tr>)}</tbody></table></div>;
}

function ResultBars({ visualization, locale }) {
  const rows = visualization.data || [];
  const x = visualization.options?.x || "entity";
  const y = visualization.options?.y || "value";
  const numeric = rows.map((row) => Number(row?.[y])).filter(Number.isFinite);
  const max = Math.max(...numeric.map((value) => Math.abs(value)), 0);
  if (!rows.length) return null;
  if (!(max > 0)) return visualization.table?.rows?.length ? <ResultTable visualization={visualization} locale={locale} /> : null;
  const bars = <ul className="dochi-workspace__result-bars" aria-label={visualization.question}>{rows.slice(0, 8).map((row, index) => {
    const value = Number(row?.[y]);
    const width = Number.isFinite(value) ? Math.max(2, Math.round((Math.abs(value) / max) * 100)) : 0;
    return <li key={`${visualization.id}-${index}`}><span>{formatResultValue(row?.[x], locale)}</span><i className={value < 0 ? "is-negative" : ""} style={{ "--dochi-result-bar-size": `${width}%` }} /><b>{formatResultValue(row?.[y], locale)}</b></li>;
  })}</ul>;
  if (!visualization.table?.rows?.length) return bars;
  return <>{bars}<details className="dochi-workspace__exact-table"><summary>{(COPY[locale] || COPY.ko).exactTable}</summary><ResultTable visualization={visualization} locale={locale} /></details></>;
}

function ResultPeriodComparison({ visualization, locale }) {
  const rows = (visualization.data || visualization.table?.rows || [])
    .filter((row) => Number.isFinite(Number(row?.prior)) || Number.isFinite(Number(row?.recent)))
    .slice(0, 8);
  if (!rows.length) return <ResultTable visualization={visualization} locale={locale} />;
  return <>
    <figure className="dochi-workspace__period-comparison" role="img" aria-label={visualization.question}>
      <figcaption><i className="is-prior">{locale === "en" ? "Prior" : "직전"}</i><i className="is-recent">{locale === "en" ? "Recent" : "최근"}</i></figcaption>
      <ul>{rows.map((row, index) => {
        const prior = chartNumber(row.prior);
        const recent = chartNumber(row.recent);
        const max = Math.max(Math.abs(prior) || 0, Math.abs(recent) || 0, 1);
        const change = chartNumber(row.change);
        return <li key={`${visualization.id}-${row.metric || index}`}>
          <div><strong>{row.label || row.metric}</strong><em className={change < 0 ? "is-negative" : change > 0 ? "is-positive" : ""}>{Number.isFinite(change) ? `${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%` : "—"}</em></div>
          <span className="is-prior" style={{ "--dochi-period-size": `${Math.max(2, Math.abs(prior) / max * 100)}%` }}><b>{formatResultValue(row.prior, locale)}</b></span>
          <span className="is-recent" style={{ "--dochi-period-size": `${Math.max(2, Math.abs(recent) / max * 100)}%` }}><b>{formatResultValue(row.recent, locale)}</b></span>
        </li>;
      })}</ul>
    </figure>
    <details className="dochi-workspace__exact-table"><summary>{(COPY[locale] || COPY.ko).exactTable}</summary><ResultTable visualization={visualization} locale={locale} /></details>
  </>;
}

function numericDomain(values) {
  const numeric = values.filter(Number.isFinite);
  if (!numeric.length) return null;
  let min = Math.min(...numeric);
  let max = Math.max(...numeric);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  return { min, max, span: max - min };
}

function chartNumber(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return Number.NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function lineSeries(visualization) {
  if (Array.isArray(visualization.data)) {
    const x = visualization.options?.x || "period";
    const y = visualization.options?.y || "value";
    return [{ id: y, points: visualization.data.map((row, index) => ({ index, total: visualization.data.length, label: row?.[x] ?? index + 1, value: chartNumber(row?.[y]) })) }];
  }
  const dates = visualization.data?.dates || [];
  return [
    { id: "overall", points: dates.map((label, index) => ({ index, total: dates.length, label, value: chartNumber(visualization.data?.overall?.[index]) })) },
    ...(visualization.data?.sources || []).map((series) => ({ id: String(series.source || "source"), points: dates.map((label, index) => ({ index, total: dates.length, label, value: chartNumber(series.values?.[index]) })) })),
  ];
}

function contiguousLineSegments(points) {
  return points.reduce((segments, point) => {
    if (!Number.isFinite(point.value)) {
      if (segments.at(-1)?.length) segments.push([]);
      return segments;
    }
    if (!segments.length) segments.push([]);
    segments.at(-1).push(point);
    return segments;
  }, []).filter((segment) => segment.length > 1);
}

function ResultLineChart({ visualization, locale }) {
  const series = lineSeries(visualization).filter((item) => item.points.filter((point) => Number.isFinite(point.value)).length > 1);
  const validPoints = series.flatMap((item) => item.points.filter((point) => Number.isFinite(point.value)));
  const domain = numericDomain(validPoints.map((point) => point.value));
  const pointCount = Math.max(...series.map((item) => item.points.length), 0);
  if (!domain || pointCount < 2) return <ResultTable visualization={visualization} locale={locale} />;
  const xAt = (point) => 28 + (point.index / Math.max(1, point.total - 1)) * 584;
  const yAt = (value) => 212 - ((value - domain.min) / domain.span) * 184;
  return <figure className="dochi-workspace__chart"><svg viewBox="0 0 640 240" role="img" aria-label={visualization.question} preserveAspectRatio="xMidYMid meet">
    <line className="dochi-workspace__chart-axis" x1="28" y1="212" x2="612" y2="212" />
    <line className="dochi-workspace__chart-grid" x1="28" y1="120" x2="612" y2="120" />
    {series.map((item, seriesIndex) => <g className={`dochi-workspace__chart-series is-series-${seriesIndex % 5}`} key={item.id}>
      {contiguousLineSegments(item.points).map((segment, index) => <polyline key={`${item.id}-segment-${index}`} points={segment.map((point) => `${xAt(point)},${yAt(point.value)}`).join(" ")} />)}
      {item.points.filter((point) => Number.isFinite(point.value)).map((point) => <circle key={`${item.id}-${point.label}-${point.index}`} cx={xAt(point)} cy={yAt(point.value)} r="3"><title>{item.id}: {point.label} · {formatResultValue(point.value, locale)}</title></circle>)}
    </g>)}
  </svg><figcaption><span>{series[0].points[0].label}</span><span className="dochi-workspace__chart-legend">{series.map((item, index) => <i className={`is-series-${index % 5}`} key={item.id}>{item.id}</i>)}</span><span>{series[0].points.at(-1).label}</span></figcaption></figure>;
}

function ResultScatterChart({ visualization, locale }) {
  const xKey = visualization.options?.x || "x";
  const yKey = visualization.options?.y || "y";
  const labelKey = visualization.options?.label || "label";
  const points = (visualization.data || []).map((row) => ({ label: row?.[labelKey], x: chartNumber(row?.[xKey]), y: chartNumber(row?.[yKey]) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const xDomain = numericDomain([...points.map((point) => point.x), 0]);
  const yDomain = numericDomain([...points.map((point) => point.y), 0]);
  if (!xDomain || !yDomain || !points.length) return <ResultTable visualization={visualization} locale={locale} />;
  const xAt = (value) => 28 + ((value - xDomain.min) / xDomain.span) * 584;
  const yAt = (value) => 212 - ((value - yDomain.min) / yDomain.span) * 184;
  return <figure className="dochi-workspace__chart"><svg viewBox="0 0 640 240" role="img" aria-label={visualization.question} preserveAspectRatio="xMidYMid meet">
    <line className="dochi-workspace__chart-axis" x1="28" y1={yAt(0)} x2="612" y2={yAt(0)} />
    <line className="dochi-workspace__chart-axis" x1={xAt(0)} y1="28" x2={xAt(0)} y2="212" />
    {points.map((point, index) => <circle className={`dochi-workspace__chart-dot is-series-${index % 5}`} key={`${point.label}-${index}`} cx={xAt(point.x)} cy={yAt(point.y)} r="6"><title>{point.label}: {xKey} {formatResultValue(point.x, locale)} · {yKey} {formatResultValue(point.y, locale)}</title></circle>)}
  </svg><figcaption><span>{xKey} ←</span><span>{yKey} ↑</span></figcaption></figure>;
}

function ResultVisualization({ visualization, locale }) {
  if (visualization.kind === "bar" && visualization.options?.variant === "period-comparison") return <ResultPeriodComparison visualization={visualization} locale={locale} />;
  if (visualization.kind === "bar") return <ResultBars visualization={visualization} locale={locale} />;
  if (visualization.kind === "line") return <ResultLineChart visualization={visualization} locale={locale} />;
  if (visualization.kind === "scatter") return <ResultScatterChart visualization={visualization} locale={locale} />;
  return <ResultTable visualization={visualization} locale={locale} />;
}

function AnalysisResultOutput({ result, locale, isDecisionFocus = false }) {
  const C = COPY[locale] || COPY.ko;
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const visualizations = result.visualizations || [];
  const evidenceStats = result.verdict.stats?.slice(0, 5) || [];
  const hasDetails = result.verdict.caveats?.length > 0;
  return <section className={`dochi-workspace__result is-${result.status}${isDecisionFocus ? " is-decision-focus" : ""}`} aria-label={C.result}>
    <header className="dochi-workspace__result-status"><strong>{resultLabel(result, C)}</strong><span>{C.evidence}: {C.evidenceState[result.verdict.evidenceState] || result.verdict.evidenceState}</span></header>
    <section className="dochi-workspace__decision-tape" aria-label={C.decisionTape}>
      <span>{C.keyConclusion}</span>
      <h3>{result.verdict.headline}</h3>
    </section>
    {(evidenceStats.length > 0 || visualizations.length > 0) && <section className="dochi-workspace__result-evidence" aria-label={C.availableEvidence}>
      <header><h4>{C.availableEvidence}</h4>{evidenceStats.length > 0 && <span>{C.evidenceFigures}</span>}</header>
      {evidenceStats.length > 0 && <dl>{evidenceStats.map((stat) => <div key={stat.id}><dt>{stat.label}</dt><dd>{formatResultValue(stat.value, locale)}{stat.unit ? ` ${stat.unit}` : ""}</dd></div>)}</dl>}
      {visualizations.map((visualization) => <section className="dochi-workspace__result-primary" key={visualization.id}><p>{visualization.question}</p><ResultVisualization visualization={visualization} locale={locale} /></section>)}
    </section>}
    <section className="dochi-workspace__result-action" aria-label={C.primaryAction}><h4>{C.primaryAction}</h4><p>{result.verdict.action || C.noAction}</p></section>
    {hasDetails && <details className="dochi-workspace__result-details" open={isDetailsOpen} onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}><summary>{C.detailsView}</summary>{isDetailsOpen && <section><div className="dochi-workspace__result-caveats"><h4>{C.caveats}</h4><p>{result.verdict.caveats.join(" ")}</p></div></section>}</details>}
  </section>;
}

function NaturalExperimentCandidate({ candidate, locale, outcomeOptions, onHandoff }) {
  const C = COPY[locale] || COPY.ko;
  const [isActualInterruption, setIsActualInterruption] = useState(false);
  const [outcomeKey, setOutcomeKey] = useState("");
  const [controlUnit, setControlUnit] = useState("");
  const [notice, setNotice] = useState("");

  const continueHandoff = () => {
    const handoff = buildNaturalExperimentHandoff({
      candidate,
      confirmation: {
        actualInterruption: isActualInterruption,
        outcomeKey,
        treatmentUnit: candidate.unit,
        startDate: candidate.startDate,
        controlUnit: controlUnit.trim(),
      },
    });
    if (!handoff.targetToolId) {
      setNotice(C.naturalNeedsConfirmation);
      return;
    }
    setNotice(C.naturalHandoff);
    onHandoff(handoff);
  };

  return <article className="dochi-workspace__card is-confirm_design">
    <div className="dochi-workspace__card-top"><span>OBSERVED CANDIDATE</span><em>{C.status.confirm_design}</em></div>
    <h3>{candidate.unit}</h3>
    <p>{C.naturalCandidateDeck}</p>
    <label><input type="checkbox" checked={isActualInterruption} onChange={(event) => setIsActualInterruption(event.target.checked)} /> {C.naturalActual}</label>
    <label>{C.naturalOutcome}<select aria-label={C.naturalOutcome} value={outcomeKey} onChange={(event) => setOutcomeKey(event.target.value)}><option value="">—</option>{outcomeOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
    <label>{C.naturalControl}<input aria-label={C.naturalControl} value={controlUnit} onChange={(event) => setControlUnit(event.target.value)} /></label>
    <button type="button" className="ab-pill" onClick={continueHandoff}>{C.naturalContinue}<span aria-hidden="true"> →</span></button>
    {notice && <div className="dochi-workspace__adapter-note"><strong>{C.naturalCandidate}</strong><span>{notice}</span></div>}
  </article>;
}

function AnalysisCard({ result, locale, getTitle, onOpenTool, onConfirm, queueItem = null, inputSignature: currentInputSignature, mappingSignature: currentMappingSignature, isDecisionFocus = false, presentation = "full", defaultOpen = false }) {
  const C = COPY[locale] || COPY.ko;
  const isEmbedded = presentation === "embedded";
  const entry = analysisCatalogEntry(result.toolId);
  const isBlocked = result.status === "blocked";
  const queueState = queueItem?.state || null;
  const workspaceResult = queueItem?.result || null;
  const hasCurrentResult = queueState === "complete"
    && workspaceResult?.inputSignature === currentInputSignature
    && workspaceResult?.mappingSignature === currentMappingSignature;
  const hasStaleResult = Boolean(workspaceResult) && !hasCurrentResult;
  const needsApproval = ["confirm_model", "confirm_design", "manual"].includes(result.status);
  const isApprovedHandoff = queueState === "handoff";
  return (
    <article className={`dochi-workspace__card is-${result.status}${isDecisionFocus ? " is-focused" : ""}${hasCurrentResult ? " has-current-result" : ""}`}>
      {!isEmbedded && <div className="dochi-workspace__card-top">
        <span>{entry?.toolId}</span>
        <em>{queueStateLabel(queueState, C, C.status[result.status])}</em>
      </div>}
      <h3>{titleFor(result.toolId, getTitle)}</h3>
      {!isEmbedded && <>
        <p>{isBlocked ? blockersText(result, locale) : result.recommendationReason}</p>
        {!isBlocked && result.requiresConfirmation?.length > 0 && <small>{C.requires}: {result.requiresConfirmation.join(", ")}</small>}
      </>}
      {hasCurrentResult && !isDecisionFocus && (isEmbedded
        ? <details className="dochi-workspace__embedded-result" open={defaultOpen || result.toolId === "5-2"}><summary>{C.resultToggle}</summary><AnalysisResultOutput result={workspaceResult} locale={locale} /></details>
        : <AnalysisResultOutput result={workspaceResult} locale={locale} />)}
      {!isEmbedded && <>
        {hasStaleResult && <div className="dochi-workspace__adapter-note"><strong>{C.staleState}</strong><span>{C.staleResult}</span></div>}
        {queueState === "failed" && <div className="dochi-workspace__adapter-note"><strong>{queueItem?.error === "workspace_adapter_pending" ? C.adapterPending : C.resultError}</strong><span>{queueItem?.error === "workspace_adapter_pending" ? C.adapterPendingDetail : C.adapterError}</span></div>}
        {isApprovedHandoff && <div className="dochi-workspace__adapter-note"><strong>{C.handoff}</strong><span>{C.approvedHandoff}</span></div>}
        {needsApproval && !isApprovedHandoff && <button type="button" className="ab-button" onClick={() => onConfirm?.(result)}>{C.approve}<span aria-hidden="true"> →</span></button>}
        <button type="button" className="ab-pill" onClick={() => onOpenTool(result.toolId)}>{C.details}<span aria-hidden="true"> →</span></button>
      </>}
    </article>
  );
}

export default function AssistantWorkspace({ csvData, locale = "ko", getTitle, onOpenTool, onEligibilityChange, autoStart = false, presentation = "full", showContextHeader = true }) {
  const C = COPY[locale] || COPY.ko;
  const denomBasis = useAppStore((state) => state.denomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const dataCurrency = sourceCurrencyOf(csvData, displayCurrency);
  const [queue, setQueue] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [isPreparingHandoff, setIsPreparingHandoff] = useState(false);
  const currentInputSignature = useMemo(() => analysisInputSignature(csvData), [csvData]);
  const resolvedDenomBasis = useMemo(() => effectiveDenomBasis(csvData, denomBasis), [csvData, denomBasis]);
  const currentMappingSignature = useMemo(() => JSON.stringify({
    mapping: csvData.mapping || {},
    denomBasis: resolvedDenomBasis,
    displayCurrency: dataCurrency,
  }), [csvData.mapping, dataCurrency, resolvedDenomBasis]);
  const previousSignatureRef = useRef(`${currentInputSignature}:${currentMappingSignature}`);
  const autoStartedSignatureRef = useRef("");
  const handoffPreparationCacheRef = useRef(new Map());

  // 첫 렌더에서는 매핑 계약만으로 후보를 판정한다. 각 도구의 canonical/legacy 행
  // 재구성은 실제 상세 진입 시에만 만들며, 19개 카탈로그를 한꺼번에 순회하지 않는다.
  const mappingContracts = useMemo(() => Object.fromEntries(ANALYSIS_CATALOG.map((entry) => [entry.toolId,
    buildMappingContract({ toolId: entry.toolId, headers: csvData.headers, rows: csvData.raw, source: csvData.fileName || "dataset" }),
  ])), [csvData.fileName, csvData.headers, csvData.raw]);

  const mappingsByTool = useMemo(() => Object.fromEntries(ANALYSIS_CATALOG.map((entry) => [entry.toolId,
    mergedToolMapping(mappingContracts[entry.toolId], csvData.mapping),
  ])), [csvData.mapping, mappingContracts]);

  const eligibility = useMemo(() => rankRecommendedAnalyses(ANALYSIS_CATALOG.map((entry) => {
    const mappingContract = mappingContracts[entry.toolId];
    const mapping = mappingsByTool[entry.toolId];
    return evaluateAnalysisEligibility({
      toolId: entry.toolId,
      mapping,
      mappingContract,
      profile: profileFor(entry, { raw: csvData.raw, headers: csvData.headers, mapping }),
    });
  })), [csvData.headers, csvData.raw, mappingContracts, mappingsByTool]);

  const prepareHandoffForTool = useCallback((toolId) => {
    const cacheKey = `${currentInputSignature}:${currentMappingSignature}:${toolId}`;
    const cached = handoffPreparationCacheRef.current.get(cacheKey);
    if (cached) return cached;
    const prepared = prepareAnalysisHandoff(csvData, toolId);
    handoffPreparationCacheRef.current.clear();
    handoffPreparationCacheRef.current.set(cacheKey, prepared);
    return prepared;
  }, [csvData, currentInputSignature, currentMappingSignature]);

  useEffect(() => {
    onEligibilityChange?.(eligibility);
  }, [eligibility, onEligibilityChange]);

  useEffect(() => {
    const signature = `${currentInputSignature}:${currentMappingSignature}`;
    if (previousSignatureRef.current === signature) return;
    previousSignatureRef.current = signature;
    setQueue((previous) => markQueueStale(previous, { inputSignature: currentInputSignature, mappingSignature: currentMappingSignature }));
    setAnnouncement(C.stale);
  }, [C.stale, currentInputSignature, currentMappingSignature]);

  const baseline = eligibility.filter((result) => result.status === "ready" && result.runMode === "baseline" && result.executionCost === "light");
  const models = eligibility.filter((result) => result.status === "confirm_model");
  const designs = eligibility.filter((result) => result.status === "confirm_design" || result.status === "manual");
  const blocked = eligibility.filter((result) => result.status === "blocked");
  const recommended = eligibility.find((result) => result.status !== "blocked") || null;
  const mappedCount = [...mappedKeys(csvData.mapping)].length;
  const naturalCandidates = useMemo(() => detectBudgetInterruptionCandidates({
    // 업로드 직후에는 store가 이미 만든 canonical 레코드를 그대로 쓴다. 테스트나
    // 직접 진입처럼 그 슬라이스가 없는 경우에만 자연실험 후보 카드용으로 한 번 만든다.
    records: csvData.canonicalData?.records || buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping: csvData.mapping }).records,
    unitKeys: ["channel", "campaign_name", "country"],
  }).candidates, [csvData.canonicalData, csvData.headers, csvData.mapping, csvData.raw]);
  const naturalOutcomeOptions = ["installs", "actions", "revenue"]
    .filter((field) => mappedKeys(csvData.mapping).has(field));

  const queueItemFor = (toolId) => queue?.items.find((item) => item.toolId === toolId) || null;
  const currentResults = baseline.map((result) => ({ result, queueItem: queueItemFor(result.toolId) }))
    .filter(({ queueItem }) => queueItem?.state === "complete"
      && queueItem.result?.inputSignature === currentInputSignature
      && queueItem.result?.mappingSignature === currentMappingSignature);
  const successfulFindings = currentResults.filter(({ queueItem }) => queueItem.result.status === "success");
  const decisionFocus = [...currentResults].reverse().find(({ queueItem }) => queueItem.result.status === "success")
    || currentResults.at(-1)
    || null;
  const deferHandoff = useCallback((callback) => {
    setIsPreparingHandoff(true);
    let innerFrame = null;
    const frame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        try {
          callback();
        } finally {
          setIsPreparingHandoff(false);
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (innerFrame != null) window.cancelAnimationFrame(innerFrame);
    };
  }, []);
  const openTool = (toolId) => {
    if (!onOpenTool) return;
    deferHandoff(() => onOpenTool(toolId, prepareHandoffForTool(toolId)));
  };
  const openNaturalExperiment = (handoff) => {
    if (!onOpenTool) return;
    deferHandoff(() => onOpenTool(
      handoff.targetToolId,
      prepareHandoffForTool(handoff.targetToolId),
      { naturalExperiment: handoff },
    ));
  };
  const queueSignature = `${currentInputSignature}:${currentMappingSignature}`;
  const activeQueueItem = queue?.items.find((item) => item.state === "running") || null;

  // 한 분석을 끝낸 직후 다음 항목을 다음 task로 넘긴다. 동기 어댑터라도 결과
  // 카드가 먼저 commit될 기회를 주며, 입력·매핑이 바뀐 큐는 절대 이어서 실행하지 않는다.
  useEffect(() => {
    if (!queue || queue.signature !== queueSignature || activeQueueItem || !queue.items.some((item) => item.state === "queued")) return undefined;
    const timer = window.setTimeout(() => {
      setQueue((current) => current?.signature === queueSignature ? beginNextAnalysis(current) : current);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeQueueItem, queue, queueSignature]);

  useEffect(() => {
    if (!activeQueueItem || queue?.signature !== queueSignature) return undefined;
    let cancelled = false;
    const execute = () => {
      if (cancelled) return;
      const efficiencyAdapter = efficiencyAdapterFor(activeQueueItem.toolId);
      const optimizationAdapter = optimizationAdapterFor(activeQueueItem.toolId);
      const responseAdapter = responseAdapterFor(activeQueueItem.toolId);
      const specialAdapter = specialAdapterFor(activeQueueItem.toolId);
      const subscriptionAdapter = subscriptionAdapterFor(activeQueueItem.toolId);
      const adapter = efficiencyAdapter || optimizationAdapter || responseAdapter || specialAdapter || subscriptionAdapter;
      if (!adapter) {
        setQueue((current) => current?.signature === queueSignature
          ? settleAnalysis(current, { toolId: activeQueueItem.toolId, error: "workspace_adapter_pending" })
          : current);
        setAnnouncement(C.adapterPendingDetail);
        return;
      }
      try {
        const run = efficiencyAdapter
          ? runEfficiencyAnalysis
          : optimizationAdapter
            ? runOptimizationAnalysis
            : responseAdapter
              ? runResponseAnalysis
              : specialAdapter
                ? runSpecialAnalysis
                : runSubscriptionAnalysis;
        const result = run({
          toolId: activeQueueItem.toolId,
          csvData: { ...csvData, mapping: mappingsByTool[activeQueueItem.toolId] },
          inputSignature: currentInputSignature,
          mappingSignature: currentMappingSignature,
          locale,
          options: { denomBasis: resolvedDenomBasis, displayCurrency: dataCurrency },
        });
        setQueue((current) => current?.signature === queueSignature
          ? settleAnalysis(current, { toolId: activeQueueItem.toolId, result })
          : current);
        setAnnouncement(result.verdict.headline);
      } catch {
        setQueue((current) => current?.signature === queueSignature
          ? settleAnalysis(current, { toolId: activeQueueItem.toolId, error: "workspace_adapter_error" })
          : current);
        setAnnouncement(C.adapterError);
      }
    };
    let innerFrame = null;
    const frame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(() => { innerFrame = window.requestAnimationFrame(execute); })
      : window.setTimeout(() => { innerFrame = window.setTimeout(execute, 0); }, 0);
    return () => {
      cancelled = true;
      if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      else window.clearTimeout(frame);
      if (innerFrame != null) {
        if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(innerFrame);
        else window.clearTimeout(innerFrame);
      }
    };
  }, [C.adapterError, C.adapterPendingDetail, activeQueueItem, csvData, currentInputSignature, currentMappingSignature, dataCurrency, locale, mappingsByTool, queue?.signature, queueSignature, resolvedDenomBasis]);

  const startNext = useCallback(() => {
    const canContinue = queue
      && queue.signature === queueSignature
      && !queue.cancelled
      && queue.items.some((item) => item.state === "queued");
    const base = canContinue
      ? queue
      : createAnalysisQueue({ inputSignature: currentInputSignature, mappingSignature: currentMappingSignature, eligibility });
    const running = beginNextAnalysis(base);
    const active = running?.items.find((item) => item.state === "running");
    if (!active) {
      setQueue(base);
      setAnnouncement(C.noBaseline);
      return;
    }
    setQueue(running);
  }, [C.noBaseline, currentInputSignature, currentMappingSignature, eligibility, queue, queueSignature]);

  useEffect(() => {
    if (!autoStart || baseline.length === 0 || autoStartedSignatureRef.current === queueSignature) return undefined;
    const timer = window.setTimeout(() => {
      autoStartedSignatureRef.current = queueSignature;
      startNext();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart, baseline.length, queueSignature, startNext]);

  const approveAnalysis = (result) => {
    const base = queue && queue.signature === queueSignature
      ? queue
      : createAnalysisQueue({ inputSignature: currentInputSignature, mappingSignature: currentMappingSignature, eligibility });
    const next = confirmAnalysis({
      queue: base,
      toolId: result.toolId,
      inputSignature: currentInputSignature,
      mappingSignature: currentMappingSignature,
      eligibility: result,
    });
    setQueue(next);
    if (next !== base || next.items.some((item) => item.toolId === result.toolId && item.state === "handoff")) {
      setAnnouncement(C.approvedAnnouncement);
    }
  };

  if (!csvData.raw?.length || !csvData.headers?.length) {
    return <section className="dochi-workspace dochi-workspace--empty" aria-labelledby="dochi-workspace-title"><h2 id="dochi-workspace-title">{C.title}</h2><p>{C.empty}</p></section>;
  }

  if (presentation === "catalog") return null;

  if (presentation === "embedded") {
    return <section className="dochi-workspace dochi-workspace--embedded" aria-live="polite">
      {currentResults.length ? <div className="dochi-workspace__grid">
        {currentResults.map(({ result, queueItem }, index) => <AnalysisCard key={result.toolId} result={result} locale={locale} getTitle={getTitle} queueItem={queueItem} inputSignature={currentInputSignature} mappingSignature={currentMappingSignature} presentation="embedded" defaultOpen={index === 0} />)}
      </div> : <p className="dochi-workspace__embedded-loading">{baseline.length ? C.embeddedRunning : C.noBaseline}</p>}
    </section>;
  }

  return (
    <section className="dochi-workspace" aria-labelledby={showContextHeader ? "dochi-workspace-title" : undefined} aria-label={showContextHeader ? undefined : C.title}>
      {showContextHeader && <><header className="dochi-workspace__head">
        <div><span>{C.eyebrow}</span><h2 id="dochi-workspace-title">{C.title}</h2><p>{C.deck}</p></div>
        <dl className="dochi-workspace__data-lane"><div><dt>{C.source}</dt><dd>{csvData.fileName}</dd></div><div><dt>{C.rows}</dt><dd>{csvData.raw.length.toLocaleString()}</dd></div><div><dt>{C.columns}</dt><dd>{csvData.headers.length.toLocaleString()}</dd></div><div><dt>{C.mapped}</dt><dd>{mappedCount}/{csvData.headers.length}</dd></div></dl>
      </header>
      <p className="dochi-workspace__scope-note"><strong>{C.scopeLabel}</strong>{C.scopeNote}</p>
      <p className="dochi-workspace__mapping-note">{C.mappingReview}</p></>}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {isPreparingHandoff && <p className="dochi-workspace__handoff-loading" role="status">{C.preparingDetails}</p>}

      {recommended && <section className="dochi-workspace__judgment" aria-labelledby="dochi-recommended-title">
        <div className="dochi-workspace__judgment-copy"><span>{C.judgment}</span><h3 id="dochi-recommended-title">{titleFor(recommended.toolId, getTitle)}</h3><p><b>{C.reason}</b>{recommended.recommendationReason}</p><small>{C.judgmentReview}</small></div>
        <div className="dochi-workspace__judgment-action"><em>{C.status[recommended.status]}</em><p>{baseline.length > 0 ? C.judgmentReady : blockersText(recommended, locale)}</p>{baseline.length > 0 ? <button type="button" className="ab-button" onClick={startNext} disabled={Boolean(activeQueueItem)}>{activeQueueItem ? C.queueRunning : queue ? C.rerun : C.start}</button> : <button type="button" className="ab-button" onClick={() => openTool(recommended.toolId)}>{C.details}<span aria-hidden="true"> →</span></button>}</div>
      </section>}

      {successfulFindings.length > 0 && <section className="dochi-workspace__findings-summary" aria-labelledby="dochi-findings-title">
        <header><span>FINDINGS</span><h3 id="dochi-findings-title">{C.findingsTitle(successfulFindings.length)}</h3><p>{C.findingsDeck}</p></header>
        <ol>{successfulFindings.map(({ result, queueItem }) => <li key={result.toolId}><span>{titleFor(result.toolId, getTitle)}</span><strong>{queueItem.result.verdict.headline}</strong></li>)}</ol>
      </section>}

      {decisionFocus && <section className="dochi-workspace__decision-focus" aria-labelledby="dochi-decision-focus-title">
        <header><span>{C.decisionTape}</span><h3 id="dochi-decision-focus-title">{titleFor(decisionFocus.result.toolId, getTitle)}</h3></header>
        <AnalysisResultOutput result={decisionFocus.queueItem.result} locale={locale} isDecisionFocus />
        <button type="button" className="ab-pill" onClick={() => openTool(decisionFocus.result.toolId)}>{C.details}<span aria-hidden="true"> →</span></button>
      </section>}

      <section className="dochi-workspace__section" aria-labelledby="dochi-baseline-title">
        <header><div><h3 id="dochi-baseline-title">{C.baseline}</h3><p>{C.baselineDeck}</p></div></header>
        {baseline.length ? <div className="dochi-workspace__grid">{baseline.map((result) => <AnalysisCard key={result.toolId} result={result} locale={locale} getTitle={getTitle} onOpenTool={openTool} onConfirm={approveAnalysis} queueItem={queueItemFor(result.toolId)} inputSignature={currentInputSignature} mappingSignature={currentMappingSignature} isDecisionFocus={decisionFocus?.result.toolId === result.toolId} />)}</div> : <p className="muted">{C.noBaseline}</p>}
        <div className="dochi-workspace__queue" aria-label={C.queue}><strong>{C.queue}</strong><span>{queue?.items.length ? queue.items.map((item) => `${titleFor(item.toolId, getTitle)}: ${queueStateLabel(item.state, C, item.state)}`).join(" · ") : C.queueEmpty}</span></div>
      </section>

      <details className="dochi-workspace__section"><summary>{C.extra} <span>{models.length}</span></summary><div className="dochi-workspace__grid">{models.map((result) => <AnalysisCard key={result.toolId} result={result} locale={locale} getTitle={getTitle} onOpenTool={openTool} onConfirm={approveAnalysis} queueItem={queueItemFor(result.toolId)} inputSignature={currentInputSignature} mappingSignature={currentMappingSignature} />)}</div></details>
      <details className="dochi-workspace__section"><summary>{C.design} <span>{designs.length}</span></summary><div className="dochi-workspace__grid">{designs.map((result) => <AnalysisCard key={result.toolId} result={result} locale={locale} getTitle={getTitle} onOpenTool={openTool} onConfirm={approveAnalysis} queueItem={queueItemFor(result.toolId)} inputSignature={currentInputSignature} mappingSignature={currentMappingSignature} />)}</div></details>
      {naturalCandidates.length > 0 && <details className="dochi-workspace__section"><summary>{C.naturalCandidate} <span>{naturalCandidates.length}</span></summary><div className="dochi-workspace__grid">{naturalCandidates.map((candidate) => <NaturalExperimentCandidate key={`${candidate.unit}:${candidate.startDate}`} candidate={candidate} locale={locale} outcomeOptions={naturalOutcomeOptions} onHandoff={openNaturalExperiment} />)}</div></details>}
      <details className="dochi-workspace__section"><summary>{C.blocked} <span>{blocked.length}</span></summary><div className="dochi-workspace__grid">{blocked.map((result) => <AnalysisCard key={result.toolId} result={result} locale={locale} getTitle={getTitle} onOpenTool={openTool} />)}</div></details>
    </section>
  );
}
