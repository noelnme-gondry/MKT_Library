import { buildMetricContracts } from "./metricContract";

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
