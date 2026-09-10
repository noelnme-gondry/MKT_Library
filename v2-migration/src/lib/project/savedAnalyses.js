import { cleanToolInputs, inputScope } from "@/lib/analysis-settings/toolInputs";
import { describeDataSeries } from "./dataSeries";
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
    const scope = inputScope(item.toolId);
    const inputs = cleanToolInputs(item.toolId, input.viewConfig?.[scope]);
    const configuration = { ...input, viewConfig: Object.keys(inputs).length ? { [scope]: inputs } : {}, customMetrics: {}, customCharts: {} };
    const group = TOOL_GROUP[item.toolId];
    if (!configuration.groups || Object.keys(configuration.groups).length !== 1 || !configuration.groups[group]) throw new Error("SAVED_ANALYSIS_SCOPE");
    const config = configuration.groups[group];
    if (!/^[a-f0-9]{64}$/.test(config.headerFingerprint) || !config.mapping || typeof config.mapping !== "object" || !config.filters || typeof config.filters !== "object") throw new Error("SAVED_ANALYSIS_CONFIG");
    return { id: item.id, toolId: item.toolId, name: item.name.trim(), configuration, hasCsv: item.hasCsv !== false, ...(item.dataContext ? { dataContext: { currency: ["USD", "KRW"].includes(item.dataContext.currency) ? item.dataContext.currency : null, basis: ["installs", "actions"].includes(item.dataContext.basis) ? item.dataContext.basis : null, start: /^\d{4}-\d{2}-\d{2}$/.test(item.dataContext.start) ? item.dataContext.start : null, end: /^\d{4}-\d{2}-\d{2}$/.test(item.dataContext.end) ? item.dataContext.end : null } } : {}) };
  });
}
export async function captureSavedAnalysis(state, toolId, name, locale) {
  const group = TOOL_GROUP[toolId];
  const hasCsv = Boolean(state.csvGroups[group]?.headers?.length);
  if (!group || (!hasCsv && !Object.keys(cleanToolInputs(toolId, state.viewConfig[inputScope(toolId)])).length)) throw new Error("SAVED_ANALYSIS_NO_DATA");
  const configuration = await serializeProject(state, locale);
  configuration.groups = { [group]: configuration.groups[group] || { headerFingerprint: await headerFingerprint([]), mapping: {}, filters: {} } };
  for (const key of ["viewConfig", "customMetrics", "customCharts"]) configuration[key] = {};
  const scope = inputScope(toolId);
  configuration.viewConfig[scope] = cleanToolInputs(toolId, state.viewConfig[scope]);
  const series = describeDataSeries(state.csvGroups[group] || {}, group);
  const dataContext = { currency: series.currency, basis: group === "efficiency" ? state.denomBasis : null, start: series.start, end: series.end };
  return validateSavedAnalyses([{ id: crypto.randomUUID(), name, toolId, configuration, dataContext, hasCsv }])[0];
}
export async function compatibleSavedAnalysis(item, state) {
  if (item.hasCsv === false) return true;
  const group = TOOL_GROUP[item.toolId];
  const headers = state.csvGroups[group]?.headers || [];
  return Boolean(headers.length && Object.keys(item.configuration.groups[group]?.mapping || {}).every(header => headers.includes(header)));
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

export function compareSavedInput(item, state) {
  const group = TOOL_GROUP[item.toolId];
  const csv = state.csvGroups[group] || {};
  const headers = csv.headers || [];
  const expected = Object.keys(item.configuration.groups[group].mapping || {});
  const series = describeDataSeries(csv, group);
  const currencyChanged = Boolean(item.dataContext?.currency && series.currency && item.dataContext.currency !== series.currency);
  const basisChanged = Boolean(group === "efficiency" && item.dataContext?.basis && state.denomBasis && item.dataContext.basis !== state.denomBasis);
  return { missing: expected.filter(header => !headers.includes(header)), added: headers.filter(header => !expected.includes(header)), previous: item.dataContext || {}, current: { ...series, basis: group === "efficiency" ? state.denomBasis : null }, currencyChanged, basisChanged };
}
