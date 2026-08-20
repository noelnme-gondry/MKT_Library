import { buildMetricContracts } from "./metricContract";

// 분석 방법의 재현 계약만 보존한다. 원본 행·헤더·샘플값은 manifest에 넣지 않아
// 다운로드·결정 기록 경로가 CSV를 우회해 보존하는 통로가 되지 않게 한다.
function normalizeAnalysisContext(analysis = {}) {
  const outcome = analysis.outcome && typeof analysis.outcome === "object" ? analysis.outcome : {};
  const engine = analysis.engine && typeof analysis.engine === "object" ? analysis.engine : {};
  return {
    methodId: typeof analysis.methodId === "string" ? analysis.methodId : null,
    methodStatus: typeof analysis.methodStatus === "string" ? analysis.methodStatus : null,
    design: typeof analysis.design === "string" ? analysis.design : null,
    estimand: typeof analysis.estimand === "string" ? analysis.estimand : null,
    outcome: {
      key: typeof outcome.key === "string" ? outcome.key : null,
      kind: typeof outcome.kind === "string" ? outcome.kind : null,
      unit: typeof outcome.unit === "string" ? outcome.unit : null,
    },
    validN: Number.isFinite(analysis.validN) ? analysis.validN : null,
    exclusionCount: Number.isFinite(analysis.exclusionCount) ? analysis.exclusionCount : null,
    multiplicity: typeof analysis.multiplicity === "string" ? analysis.multiplicity : null,
    engine: {
      name: typeof engine.name === "string" ? engine.name : null,
      version: typeof engine.version === "string" ? engine.version : null,
      packages: Array.isArray(engine.packages) ? engine.packages.filter((value) => typeof value === "string") : [],
    },
  };
}

export function buildResultManifest({
  toolId = "",
  mode = "default",
  source = "csv",
  inputSignature = "",
  mappingSignature = "",
  filter = {},
  grain = "raw",
  metricDefinitions = [],
  engineVersion = "",
  seed = null,
  status = "COMPLETE",
  warnings = [],
  generatedAt = null,
  analysis = {},
} = {}) {
  const metricContract = buildMetricContracts(metricDefinitions);
  return {
    toolId,
    mode,
    source,
    inputSignature,
    mappingSignature,
    filter: { ...filter },
    grain,
    metricDefinitions: metricContract.contracts,
    metricContractValid: metricContract.valid,
    engineVersion,
    seed,
    status,
    warnings: [...warnings],
    generatedAt,
    analysis: normalizeAnalysisContext(analysis),
  };
}

export function serializeResultManifest(manifest = {}) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// 동일 지표·단위·분석창만 비교하도록 비교용 manifest를 정규화한다.
// 결과값 자체를 저장하지 않으므로 local-only 원칙과 캐시 정책을 해치지 않는다.
export function buildComparisonManifest(runs = []) {
  const normalized = (runs || []).map((run) => {
    const manifest = run.manifest || run;
    return {
      toolId: manifest.toolId || "",
      mode: manifest.mode || "default",
      metricDefinitions: manifest.metricDefinitions || [],
      filter: manifest.filter || {},
      grain: manifest.grain || "raw",
      engineVersion: manifest.engineVersion || "",
      status: manifest.status || "UNKNOWN",
    };
  });
  const comparable = normalized.length > 0 && normalized.every((item) => {
    const first = normalized[0];
    return JSON.stringify(item.metricDefinitions) === JSON.stringify(first.metricDefinitions)
      && JSON.stringify(item.filter) === JSON.stringify(first.filter)
      && item.grain === first.grain;
  });
  return {
    schemaVersion: "comparison-v1",
    comparable,
    reason: comparable ? null : "metric, filter, or grain mismatch",
    runs: normalized,
  };
}
