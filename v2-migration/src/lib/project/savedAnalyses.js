import { validateProjectFile } from "./projectSchema";
import { headerFingerprint, serializeProject } from "./serializeProject";
import { TOOL_GROUP } from "@/lib/toolGroups";

export const MAX_SAVED_ANALYSES = 20;
export function validateSavedAnalyses(items = []) {
  if (!Array.isArray(items) || items.length > MAX_SAVED_ANALYSES) throw new Error("SAVED_ANALYSES_LIMIT");
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 80 || ids.has(item.id) || !TOOL_GROUP[item.toolId] || typeof item.name !== "string" || !item.name.trim() || item.name.length > 120) throw new Error("SAVED_ANALYSIS_INVALID");
    ids.add(item.id);
    const input = validateProjectFile(item.configuration);
    const configuration = { ...input, viewConfig: {}, customMetrics: {}, customCharts: {} };
    const group = TOOL_GROUP[item.toolId];
    if (!configuration.groups || Object.keys(configuration.groups).length !== 1 || !configuration.groups[group]) throw new Error("SAVED_ANALYSIS_SCOPE");
    const config = configuration.groups[group];
    if (!/^[a-f0-9]{64}$/.test(config.headerFingerprint) || !config.mapping || typeof config.mapping !== "object" || !config.filters || typeof config.filters !== "object") throw new Error("SAVED_ANALYSIS_CONFIG");
    return { id: item.id, toolId: item.toolId, name: item.name.trim(), configuration };
  });
}
export async function captureSavedAnalysis(state, toolId, name, locale) {
  const group = TOOL_GROUP[toolId];
  if (!group || !state.csvGroups[group]?.headers?.length) throw new Error("SAVED_ANALYSIS_NO_DATA");
  const configuration = await serializeProject(state, locale);
  configuration.groups = { [group]: configuration.groups[group] };
  for (const key of ["viewConfig", "customMetrics", "customCharts"]) configuration[key] = {};
  return validateSavedAnalyses([{ id: crypto.randomUUID(), name, toolId, configuration }])[0];
}
export async function compatibleSavedAnalysis(item, state) {
  const group = TOOL_GROUP[item.toolId];
  const headers = state.csvGroups[group]?.headers || [];
  return Boolean(headers.length && Object.keys(item.configuration.groups[group]?.mapping || {}).every(header => headers.includes(header)) && await headerFingerprint(headers) === item.configuration.groups[group]?.headerFingerprint);
}
// Keep other groups' views intact; applying settings closes the calculation gate.
export function savedAnalysisConfiguration(item, state, useCurrentPeriod = true) {
  const configuration = structuredClone(item.configuration);
  const group = TOOL_GROUP[item.toolId];
  if (useCurrentPeriod) {
    const current = state.dashboardFilterGroups[group] || {};
    for (const key of ["dateStart", "dateEnd", "comparisonStart", "comparisonEnd", "comparisonPreset", "compareEnabled"]) configuration.groups[group].filters[key] = current[key] ?? null;
  }
  for (const key of ["viewConfig", "customMetrics", "customCharts"]) configuration[key] = { ...state[key], ...configuration[key] };
  return configuration;
}
