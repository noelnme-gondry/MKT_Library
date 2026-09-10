// Only user-entered options. Never persist results, signatures or approval flags.
export const TOOL_INPUT_KEYS = {
  "5-2": [],
  "5-3": ["planningBasis", "targetValue", "budgetPeriod", "budget", "recentDays", "allocMode", "holdLowConfidence", "trendType", "weightMode", "outlierMethod", "outlierStrength"],
  "5-21": ["metricOverride", "weekBasis", "lookback"],
  "5-22": ["satState"],
  "5-4": ["testType", "planBaseline", "planMde", "planMean", "planSigma", "planAlpha", "planPower", "planCprA", "planCprB", "sequentialLooks", "plannedShare", "equivalenceMargin"],
  "5-20": ["minSupport", "holdoutOn", "outcomeStartDay"],
  "5-23": ["method", "useDiD", "cutoff"],
  "5-24": ["dataPath"],
  "5-26": ["settings"],
  "5-28": ["draft"],
  "5-29": ["draft", "design"],
  "9-1": ["outcome", "features", "clusterColumn", "validationTimeColumn"],
};
const responseKeys = ["target", "bayesianUsePrior", "fcHorizon", "fcHorizonDraft", "fcBudget", "fcStepOff", "fcTotalBudget", "fcMinBudget", "fcMaxBudget", "fcEventPolicy", "fcEventPolicyDraft", "cannibQuestion", "platformFilter"];
for (const id of ["5-18", "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast"]) TOOL_INPUT_KEYS[id] = responseKeys;
export const inputScope = id => `analysis-inputs:${id}`;
function safe(value, depth = 0) {
  if (depth > 4) return false;
  if (value == null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 1000;
  if (Array.isArray(value)) return value.length <= 100 && value.every(child => safe(child, depth + 1));
  return typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length <= 100 && Object.entries(value).every(([key, child]) => !["__proto__", "constructor", "prototype"].includes(key) && safe(child, depth + 1));
}
export function cleanToolInputs(toolId, values = {}) {
  return Object.fromEntries((TOOL_INPUT_KEYS[toolId] || []).filter(key => Object.hasOwn(values, key) && safe(values[key])).map(key => [key, values[key]]));
}
export function sameInputShape(value, initial) {
  if (initial == null) return value == null || ["string", "number", "boolean"].includes(typeof value);
  if (Array.isArray(initial)) return Array.isArray(value);
  return typeof initial === typeof value && (typeof initial !== "object" || (value != null && !Array.isArray(value) && Object.keys(initial).every(key => Object.hasOwn(value, key) && sameInputShape(value[key], initial[key]))));
}
