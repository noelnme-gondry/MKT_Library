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
  return {
    toolId,
    mode,
    source,
    inputSignature,
    mappingSignature,
    filter: { ...filter },
    grain,
    metricDefinitions: [...metricDefinitions],
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
