import { ADVANCED_BY_ID } from "./registry";
// Project original cell values after the common uploader/PapaParse. Do not use
// date-only legacy normalization or replace missing numbers with zero. The pure
// engine owns strict unit validation and reports the original CSV row number.
export function projectAdvancedRows(csvData, toolId) {
  const spec = ADVANCED_BY_ID[toolId];
  if (!spec) return [];
  const allowed = new Set([...spec.required, ...spec.optional]);
  const mapping = Object.entries(csvData?.mapping || {}).filter(([, key]) => allowed.has(key));
  return (csvData?.raw || []).map((raw) => Object.fromEntries(mapping.map(([header, key]) => [key, raw[header]])));
}
