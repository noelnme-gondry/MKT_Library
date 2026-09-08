export const EMPTY_COMPARISON_CONDITIONS = { tracking: "", seasonality: "", delivery: "" };

export function comparisonConditionsReady(values) {
  return values.tracking === "consistent" && values.seasonality === "reviewed" && values.delivery === "continuous";
}

export function comparisonConditionsTable(values) {
  return { name: "COMPARISON_CONDITIONS", title: "User declarations; not causal identification", rows: [
    ["condition", "declaration"], ...Object.entries(values), ["comparison_conditions_reviewed", comparisonConditionsReady(values)],
  ] };
}
