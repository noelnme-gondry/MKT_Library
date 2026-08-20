export function scoreValueFeatures(profile, field) {
  if (!profile || !field) return { score: 0, evidence: [] };
  if (field.valueType === "date" && profile.rates.date >= 0.8) return { score: 0.28, evidence: ["DATE_VALUE_SHAPE"] };
  if (field.valueType === "string" && profile.rates.numeric < 0.2 && profile.rates.date < 0.2) return { score: 0.08, evidence: ["TEXT_VALUE_SHAPE"] };
  if (field.valueType !== "number" || profile.rates.numeric < 0.8) return { score: 0, evidence: [] };
  if (field.unitFamily === "currency" && profile.rates.currencyLike >= 0.5) return { score: 0.16, evidence: ["CURRENCY_LIKE"] };
  if (field.unitFamily === "rate" && profile.rates.percentLike >= 0.5) return { score: 0.16, evidence: ["PERCENT_LIKE"] };
  if (profile.rates.nonNegative >= 0.98 && profile.rates.integer >= 0.8) return { score: 0.08, evidence: ["NON_NEGATIVE_INTEGER"] };
  return { score: 0.04, evidence: ["NUMERIC_VALUE_SHAPE"] };
}
