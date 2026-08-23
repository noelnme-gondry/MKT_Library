const RESULT_STATUSES = new Set(["success", "not_computable", "not_identified", "error"]);
const EVIDENCE_STATES = new Set(["descriptive", "estimated", "not_identified", "not_computable"]);
const VISUALIZATION_KINDS = new Set(["line", "bar", "scatter", "table", "metric", "distribution"]);

function serializable(value) {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

function safeStats(stats = []) {
  return stats.map((stat) => ({
    id: String(stat.id || ""),
    label: String(stat.label || ""),
    value: stat.value ?? null,
    unit: stat.unit == null ? null : String(stat.unit),
  }));
}

// 어댑터는 React node·Chart 인스턴스·원본 행을 반환하지 않는다. 공용 작업대는 이
// 직렬화 가능한 명세만 받아 늦게 렌더한다.
export function createAnalysisResult({
  toolId,
  status,
  inputSignature,
  mappingSignature,
  verdict = {},
  visualizations = [],
  manifest = {},
} = {}) {
  const result = {
    toolId: String(toolId || ""),
    status,
    inputSignature: String(inputSignature || ""),
    mappingSignature: String(mappingSignature || ""),
    verdict: {
      evidenceState: verdict.evidenceState,
      headline: String(verdict.headline || ""),
      stats: safeStats(verdict.stats || []),
      action: verdict.action == null ? null : String(verdict.action),
      reviewCondition: verdict.reviewCondition == null ? null : String(verdict.reviewCondition),
      caveats: (verdict.caveats || []).map(String),
    },
    visualizations: visualizations.map((visualization) => ({
      id: String(visualization.id || ""),
      kind: visualization.kind,
      question: String(visualization.question || ""),
      data: visualization.data ?? null,
      table: visualization.table ?? null,
      options: visualization.options ?? {},
    })),
    manifest: { ...manifest },
  };
  const validation = validateAnalysisResult(result);
  if (!validation.valid) throw new Error(`Invalid Dochi analysis result: ${validation.errors.join(", ")}`);
  return Object.freeze(result);
}

export function validateAnalysisResult(result = {}) {
  const errors = [];
  if (!result.toolId) errors.push("toolId");
  if (!RESULT_STATUSES.has(result.status)) errors.push("status");
  if (!result.inputSignature) errors.push("inputSignature");
  if (!result.mappingSignature) errors.push("mappingSignature");
  if (!EVIDENCE_STATES.has(result.verdict?.evidenceState)) errors.push("verdict.evidenceState");
  if (!result.verdict?.headline) errors.push("verdict.headline");
  if (!Array.isArray(result.visualizations)) errors.push("visualizations");
  for (const visualization of result.visualizations || []) {
    if (!visualization.id || !VISUALIZATION_KINDS.has(visualization.kind) || !visualization.question || !serializable(visualization)) {
      errors.push(`visualization:${visualization.id || "unknown"}`);
    }
  }
  if (!serializable(result.manifest)) errors.push("manifest");
  // 안전장치: manifest가 raw/header/row을 복사하는 비공개 데이터 우회로가 되지 않게
  // 키 이름 자체를 거부한다. 값 검사로 원본 CSV를 식별하려 들지 않는다.
  const forbiddenManifestKeys = ["raw", "rows", "headers", "samples", "canonicalData"];
  if (forbiddenManifestKeys.some((key) => Object.hasOwn(result.manifest || {}, key))) errors.push("manifest.private_data");
  return { valid: errors.length === 0, errors };
}

export const ANALYSIS_RESULT_STATUS = Object.freeze({
  SUCCESS: "success",
  NOT_COMPUTABLE: "not_computable",
  NOT_IDENTIFIED: "not_identified",
  ERROR: "error",
});
