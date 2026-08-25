const VALID_CALCULATION_MODES = new Set([
  "exact_after_preprocessing",
  "hybrid_engine_output",
]);

function plain(value, fallback = "") {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function plainPoint(point) {
  if (!point || typeof point !== "object") return null;
  const label = plain(point.label);
  const text = plain(point.text);
  const detail = plain(point.detail);
  if (!label && !text && !detail) return null;
  return { label, text, detail, tone: plain(point.cls) };
}

function plainStat(stat) {
  if (!stat || typeof stat !== "object") return null;
  const label = plain(stat.label);
  const value = plain(stat.value);
  if (!label || !value) return null;
  return { label, value, detail: plain(stat.detail) };
}

function normalizeScope(scope = {}) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return {};
  return Object.fromEntries(Object.entries(scope).map(([key, value]) => {
    if (value instanceof Set) return [key, [...value].map(String).sort()];
    if (Array.isArray(value)) return [key, value.map((item) => plain(item)).filter(Boolean)];
    if (value == null) return [key, ""];
    return [key, plain(value)];
  }));
}

function normalizeRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.every((row) => row && typeof row === "object" && !Array.isArray(row))
    ? rows
    : rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function normalizeHeaders(headers = [], rows = []) {
  const seen = new Set();
  const resolved = [];
  const add = (value) => {
    const header = plain(value);
    if (!header || seen.has(header)) return;
    seen.add(header);
    resolved.push(header);
  };
  (Array.isArray(headers) ? headers : []).forEach(add);
  // CSV/XLSX 파서가 준 headers가 정본이다. 모든 행의 키를 다시 훑으면 대용량 파일에서
  // 다운로드 클릭 직후 메인 스레드가 멈춘다. 수동 입력의 누락 키만 첫 행에서 보완한다.
  Object.keys(rows[0] || {}).forEach(add);
  return resolved;
}

function normalizeTable(table, index) {
  if (!table || typeof table !== "object") return null;
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => Array.isArray(row) ? [...row] : [])
    : [];
  if (!rows.length) return null;
  return {
    name: plain(table.name, `CALC_${index + 1}`),
    title: plain(table.title),
    note: plain(table.note),
    rows,
    formulaRules: Array.isArray(table.formulaRules)
      ? table.formulaRules.map((rule) => ({
        whenColumn: Number.isInteger(rule?.whenColumn) ? rule.whenColumn : null,
        equals: plain(rule?.equals),
        columns: Array.isArray(rule?.columns) ? rule.columns.filter(Number.isInteger) : [],
      })).filter((rule) => rule.whenColumn != null && rule.equals && rule.columns.length)
      : [],
  };
}

function resolveAddon(addon) {
  const value = typeof addon === "function" ? addon() : addon;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

/**
 * ResultActionCard가 가진 표시 계약을 XLSX 워커에 넘길 수 있는 순수 데이터로 만든다.
 * 이 객체는 다운로드 클릭 순간에만 만들고 서버·스토리지·분석 이벤트에 넣지 않는다.
 */
export function buildAnalysisExportPayload({
  toolId,
  toolTitle,
  locale = "ko",
  headline,
  points = [],
  stats = [],
  resultState = "ready",
  analysisType = "default",
  inputSignature = "",
  source = {},
  scope = {},
  manifest = null,
  addon = null,
  generatedAt = null,
} = {}) {
  const resolvedAddon = resolveAddon(addon);
  const rawRows = normalizeRows(resolvedAddon.source?.rows ?? source.rows);
  const headers = normalizeHeaders(resolvedAddon.source?.headers ?? source.headers, rawRows);
  const mapping = resolvedAddon.source?.mapping ?? source.mapping;
  const calculationMode = VALID_CALCULATION_MODES.has(resolvedAddon.calculationMode)
    ? resolvedAddon.calculationMode
    : "hybrid_engine_output";
  return {
    schemaVersion: "analysis-workbook-v1",
    toolId: plain(resolvedAddon.toolId, plain(toolId)),
    toolTitle: plain(resolvedAddon.toolTitle, plain(toolTitle, plain(toolId))),
    locale: locale === "en" ? "en" : "ko",
    generatedAt: plain(generatedAt),
    resultState: plain(resultState, "ready"),
    analysisType: plain(analysisType, "default"),
    inputSignature: plain(inputSignature),
    source: {
      fileName: plain(resolvedAddon.source?.fileName ?? source.fileName),
      headers,
      rows: rawRows,
      mapping: mapping && typeof mapping === "object" && !Array.isArray(mapping) ? { ...mapping } : {},
    },
    scope: normalizeScope({ ...scope, ...(resolvedAddon.scope || {}) }),
    summary: {
      headline: plain(headline, "—"),
      points: points.map(plainPoint).filter(Boolean),
      stats: stats.map(plainStat).filter(Boolean),
    },
    calculationMode,
    calculationTables: (resolvedAddon.calculationTables || []).map(normalizeTable).filter(Boolean),
    method: {
      name: plain(resolvedAddon.method?.name || manifest?.analysis?.methodId || manifest?.mode || analysisType),
      version: plain(resolvedAddon.method?.version || manifest?.analysis?.engine?.version || manifest?.engineVersion),
      engine: plain(resolvedAddon.method?.engine || manifest?.analysis?.engine?.name || "browser"),
      assumptions: (resolvedAddon.method?.assumptions || []).map((item) => plain(item)).filter(Boolean),
      limitations: (resolvedAddon.method?.limitations || manifest?.warnings || []).map((item) => plain(item)).filter(Boolean),
    },
    manifest: manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest : null,
  };
}

export function workbookFileBase(toolId) {
  const safe = plain(toolId, "analysis").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${safe || "analysis"}_analysis_workbook`;
}
