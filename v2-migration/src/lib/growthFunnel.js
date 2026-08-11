const FUNNEL_STAGES = [
  {
    id: "intent",
    events: ["landing_data_start_clicked", "blog_tool_cta_clicked", "landing_tool_pick", "diagnose_tool_opened"],
  },
  { id: "imported", events: ["data_import_success"] },
  { id: "completed", events: ["analysis_completed"] },
  { id: "decided", events: ["decision_record_added"] },
  { id: "reviewed", events: ["decision_review_completed"] },
];

const HEADER_ALIASES = {
  eventName: ["event_name", "event name", "이벤트 이름", "이벤트명"],
  eventCount: ["event_count", "event count", "이벤트 수", "이벤트수"],
  date: ["date", "event date", "event_date", "날짜"],
  source: ["source", "event source", "event_source", "소스"],
  resultState: ["result_state", "result state", "결과 상태"],
  toolId: ["tool_id", "tool id", "도구 id", "도구_id"],
  elapsedBucket: ["elapsed_bucket", "elapsed bucket", "첫 결과 소요시간 구간"],
};

function normalizeHeader(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

function findHeader(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header))) || "";
}

// event_count 컬럼이 아예 없으면 "행 1개 = 이벤트 1건"이 올바른 해석이다(row_event_volume).
// 그러나 컬럼이 있는데 셀이 비었거나 숫자가 아니면 실제 건수를 모르는 것이므로,
// 조용히 1로 채우면 없는 수치를 만들어내는 것이다(§8·§11 날조 금지) → null 반환.
function numericCount(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizedDate(value) {
  const text = String(value || "").trim();
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return "";
}

export function parseGrowthFunnelRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
  const headers = [...new Set(safeRows.flatMap((row) => Object.keys(row)))];
  const columns = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, findHeader(headers, aliases)]));
  if (!columns.eventName) return { ok: false, reason: "missing_event_name", events: [], columns };
  let unparsedCountRows = 0;
  const events = safeRows.map((row) => ({
    eventName: String(row[columns.eventName] || "").trim(),
    // 컬럼 부재 = 행당 1건(정상 해석). 컬럼 존재 + 파싱 실패 = 건수 불명 → 제외 대상.
    count: columns.eventCount ? numericCount(row[columns.eventCount]) : 1,
    date: columns.date ? normalizedDate(row[columns.date]) : "",
    source: columns.source ? String(row[columns.source] || "").trim().toLocaleLowerCase() : "",
    resultState: columns.resultState ? String(row[columns.resultState] || "").trim().toLocaleLowerCase() : "",
    toolId: columns.toolId ? String(row[columns.toolId] || "").trim() : "",
    elapsedBucket: columns.elapsedBucket ? String(row[columns.elapsedBucket] || "").trim() : "",
  })).filter((event) => {
    if (!event.eventName) return false;
    // 건수를 알 수 없는 행은 집계에서 빼고 그 사실을 노출한다(추정치로 채우지 않음).
    if (event.count == null) { unparsedCountRows += 1; return false; }
    return true;
  });
  return {
    ok: events.length > 0,
    reason: events.length ? "" : "empty_events",
    events,
    columns,
    unparsedCountRows,
    mode: columns.eventCount ? "aggregated_event_volume" : "row_event_volume",
  };
}

function isCompletedEventIncluded(event, hasSource, hasResultState) {
  if (event.eventName !== "analysis_completed") return true;
  if (hasSource && event.source === "demo") return false;
  if (hasResultState && event.resultState && event.resultState !== "ready") return false;
  return true;
}

export function buildGrowthFunnel(parsed) {
  if (!parsed?.ok) return { ok: false, reason: parsed?.reason || "invalid", stages: [] };
  const hasSource = Boolean(parsed.columns?.source);
  const hasResultState = Boolean(parsed.columns?.resultState);
  const includedEvents = parsed.events.filter((event) => isCompletedEventIncluded(event, hasSource, hasResultState));
  const stages = FUNNEL_STAGES.map((stage, index) => {
    const count = includedEvents
      .filter((event) => stage.events.includes(event.eventName))
      .reduce((sum, event) => sum + event.count, 0);
    const previousCount = index ? null : count;
    return { ...stage, count, previousCount };
  }).map((stage, index, all) => ({
    ...stage,
    previousCount: index ? all[index - 1].count : stage.count,
    rateFromPrevious: index === 0 || all[index - 1].count <= 0 ? null : stage.count / all[index - 1].count,
  }));
  const dateValues = includedEvents.map((event) => event.date).filter(Boolean).sort();
  const sourceCounts = new Map();
  const activationCounts = new Map();
  includedEvents.filter((event) => event.eventName === "analysis_completed" && event.source).forEach((event) => {
    sourceCounts.set(event.source, (sourceCounts.get(event.source) || 0) + event.count);
  });
  includedEvents.filter((event) => event.eventName === "analysis_completed" && event.elapsedBucket).forEach((event) => {
    activationCounts.set(event.elapsedBucket, (activationCounts.get(event.elapsedBucket) || 0) + event.count);
  });
  const decisionCount = stages.find((stage) => stage.id === "decided")?.count || 0;
  const reviewCount = stages.find((stage) => stage.id === "reviewed")?.count || 0;
  return {
    ok: true,
    mode: parsed.mode,
    stages,
    dateRange: dateValues.length ? { start: dateValues[0], end: dateValues.at(-1) } : null,
    sourceBreakdown: [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
    activationBuckets: ["under_1m", "1_3m", "3_10m", "10m_plus"].map((bucket) => ({ bucket, count: activationCounts.get(bucket) || 0 })).filter((item) => item.count > 0),
    newsletterAttempts: includedEvents.filter((event) => event.eventName === "newsletter_submit_attempt").reduce((sum, event) => sum + event.count, 0),
    decisionReviewRate: decisionCount > 0 ? reviewCount / decisionCount : null,
    warnings: [
      !hasSource ? "missing_source" : "",
      !hasResultState ? "missing_result_state" : "",
      parsed.mode === "aggregated_event_volume" ? "aggregate_not_cohort" : "rows_not_sessions",
    ].filter(Boolean),
  };
}

export { FUNNEL_STAGES };
