import { CANONICAL_FIELDS } from "../schema/canonicalFields";
import { normalizeDateValue, normalizeNumericValue } from "../normalizeValues";

const isEmpty = (value) => value == null || String(value).trim() === "";

function normalizeValue(value, field) {
  if (isEmpty(value)) return null;
  if (field.valueType === "date") return normalizeDateValue(value);
  if (field.valueType === "number") {
    const numeric = normalizeNumericValue(value);
    if (!numeric) return null;
    return field.unitFamily === "rate" && numeric.isPercent ? numeric.value / 100 : numeric.value;
  }
  return String(value).trim();
}

// Canonical V2는 V1 canonicalData와 병행된다. repeatable metric은 항상 배열로
// 보존하므로 wide CSV의 Meta/Google spend가 서로 덮어쓰지 않는다.
export function buildCanonicalDatasetV2({ raw = [], headers = [], bindings = [], valueBindingRecipes = [], representation = "tabular" } = {}) {
  const bindingByHeader = Object.fromEntries(bindings.map((binding) => [binding.sourceColumn, binding]));
  const records = [];
  let invalidValueCount = 0;
  let emptyRowsRemoved = 0;

  raw.forEach((row, index) => {
    if (!row || headers.every((header) => isEmpty(row[header]))) {
      emptyRowsRemoved += 1;
      return;
    }
    const time = {};
    const dimensions = {};
    const measures = {};
    headers.forEach((header) => {
      const binding = bindingByHeader[header];
      const field = binding?.canonicalKey ? CANONICAL_FIELDS[binding.canonicalKey] : null;
      if (!field || binding.decision === "UNKNOWN") return;
      const value = normalizeValue(row[header], field);
      if (value == null && !isEmpty(row[header])) invalidValueCount += 1;
      if (field.family === "TIME") time[field.key] = value;
      else if (field.family === "DIMENSION" || field.family === "IDENTIFIER") dimensions[field.key] = value;
      else {
        if (!measures[field.key]) measures[field.key] = [];
        measures[field.key].push({ value, member: binding.member || null, window: binding.window || null, sourceColumn: header });
      }
    });
    valueBindingRecipes.forEach((recipe) => {
      if (String(row?.[recipe.metricColumn] || "").trim() !== recipe.when?.equals) return;
      const field = CANONICAL_FIELDS[recipe.canonicalKey];
      if (!field) return;
      const value = normalizeValue(row?.[recipe.valueColumn], field);
      if (value == null && !isEmpty(row?.[recipe.valueColumn])) invalidValueCount += 1;
      if (!measures[field.key]) measures[field.key] = [];
      measures[field.key].push({ value, member: null, window: null, sourceColumn: recipe.valueColumn });
    });
    records.push({ time, dimensions, measures, source: { rowNumber: index + 2 } });
  });

  return {
    schemaVersion: 2,
    representation,
    records,
    summary: { inputRows: raw.length, outputRows: records.length, emptyRowsRemoved, invalidValueCount },
  };
}
