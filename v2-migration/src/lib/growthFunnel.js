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

// Weekly calculation, decision save and report save can happen independently.
// Do not add these to analysis_completed or present them as sequential conversion.
const WEEKLY_STAGES = [
  { id: "weeklyCalculated", events: ["weekly_review_completed"] },
  { id: "weeklyDecided", events: ["weekly_decision_saved"] },
  { id: "weeklyReported", events: ["weekly_report_saved"] },
];
const COMMERCE_STAGES = [
  { id: "gate", events: ["subscription_gate_viewed"] },
  { id: "trial", events: ["trial_started"] },
  { id: "checkout", events: ["begin_checkout"] },
  { id: "purchased", events: ["purchase"] },
];

function countStages(definitions, events, sequential = false) {
  return definitions.map(stage => ({ ...stage, count: events.filter(event => stage.events.includes(event.eventName)).reduce((sum, event) => sum + event.count, 0) }))
    .map((stage, index, all) => ({ ...stage, rateFromPrevious: sequential && index && all[index - 1].count > 0 ? stage.count / all[index - 1].count : null }));
}

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
  if (event.eventName === "weekly_review_completed") return !(hasSource && event.source === "demo");
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
    weeklyStages: countStages(WEEKLY_STAGES, includedEvents),
    // Trial is optional. Only checkout → purchase has a meaningful adjacent ratio.
    commerceStages: countStages(COMMERCE_STAGES, includedEvents, true).map(stage => ({ ...stage, rateFromPrevious: stage.id === "purchased" ? stage.rateFromPrevious : null })),
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
/* ============================================================
 * 도구별 분석 퍼널 — "어떤 도구를 써서 어디까지 갔나".
 *
 * 왜 따로 두나: 위 FUNNEL_STAGES는 사이트 전체의 한 줄기(유입 의도 → 임포트 →
 * 완료 → 결정 → 검토)라 도구를 구분하지 않는다. 그런데 `tool_id`는 파싱만
 * 되고 소비처가 0곳이었다 — 이벤트는 다 찍히는데 도구별로 볼 수단이 없었다
 * (§16 신호 미배선).
 *
 * 단계는 사용자가 실제로 지나는 순서다.
 *   viewed   `tool_view`        도구 화면 진입(라우트 단위)
 *   imported `data_import_*`    CSV·시트를 실제로 올린 것
 *   mapped   `mapping_confirmed` 컬럼 확정 = 분석하기를 누른 순간
 *   completed`analysis_completed` 결과가 나온 것
 *
 * 인접 비율만 쓴다. 전체 대비로 적으면 한 도구를 여러 번 쓴 사람이 분모를
 * 부풀려 "진입 대비 완료 120%"가 나온다.
 * ============================================================ */
const TOOL_FUNNEL_STAGES = [
  { id: "viewed", events: ["tool_view"] },
  // 임포트 시작이 아니라 성공만 센다 — 실패·취소를 진행으로 세면 다음 단계
  // 이탈률이 실제보다 나쁘게 보인다. 실패는 따로 돌려준다.
  { id: "imported", events: ["data_import_success"] },
  { id: "mapped", events: ["mapping_confirmed"] },
  { id: "completed", events: ["analysis_completed"] },
];

export { TOOL_FUNNEL_STAGES };

/**
 * 도구별 퍼널. 같은 파싱 결과를 받아 `tool_id`로 나눈다.
 * `tool_id` 컬럼이 없으면 나눌 수 없다고 말한다 — 전체를 한 도구로 뭉치면
 * 없는 도구의 성과를 만들어내는 셈이다(§8).
 */
export function buildToolFunnels(parsed) {
  if (!parsed?.ok) return { ok: false, reason: parsed?.reason || "invalid", tools: [] };
  if (!parsed.columns?.toolId) return { ok: false, reason: "missing_tool_id", tools: [] };

  const hasSource = Boolean(parsed.columns?.source);
  const hasResultState = Boolean(parsed.columns?.resultState);
  const stageEvents = new Set(TOOL_FUNNEL_STAGES.flatMap((stage) => stage.events));

  const byTool = new Map();
  for (const event of parsed.events) {
    if (!event.toolId || !stageEvents.has(event.eventName)) continue;
    // 데모 데이터와 미완성 결과는 완료로 세지 않는다(위 퍼널과 같은 규칙).
    if (!isCompletedEventIncluded(event, hasSource, hasResultState)) continue;
    if (!byTool.has(event.toolId)) byTool.set(event.toolId, []);
    byTool.get(event.toolId).push(event);
  }

  const failuresByTool = new Map();
  for (const event of parsed.events) {
    if (event.eventName !== "data_import_failed" || !event.toolId) continue;
    failuresByTool.set(event.toolId, (failuresByTool.get(event.toolId) || 0) + event.count);
  }

  const tools = [...byTool.entries()].map(([toolId, events]) => {
    const stages = countStages(TOOL_FUNNEL_STAGES, events, true);
    const viewed = stages.find((stage) => stage.id === "viewed")?.count || 0;
    const completed = stages.find((stage) => stage.id === "completed")?.count || 0;
    return {
      toolId,
      stages,
      importFailures: failuresByTool.get(toolId) || 0,
      // 진입이 0이면 비율을 만들지 않는다. 0으로 나눈 자리를 0%로 적으면
      // "아무도 완료하지 않았다"로 읽힌다 — 실제로는 모르는 것이다.
      completionRate: viewed > 0 ? completed / viewed : null,
    };
  });

  // 완료 많은 순, 동률이면 진입 순, 그 다음 id — 결정론적으로 정렬한다.
  tools.sort((a, b) => {
    const done = (t) => t.stages.find((stage) => stage.id === "completed")?.count || 0;
    const seen = (t) => t.stages.find((stage) => stage.id === "viewed")?.count || 0;
    return done(b) - done(a) || seen(b) - seen(a) || a.toolId.localeCompare(b.toolId);
  });

  return {
    ok: tools.length > 0,
    reason: tools.length ? "" : "no_tool_events",
    mode: parsed.mode,
    tools,
    warnings: [
      !hasSource ? "missing_source" : "",
      !hasResultState ? "missing_result_state" : "",
      parsed.mode === "aggregated_event_volume" ? "aggregate_not_cohort" : "rows_not_sessions",
    ].filter(Boolean),
  };
}

