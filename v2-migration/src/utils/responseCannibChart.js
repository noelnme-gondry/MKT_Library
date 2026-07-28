export function buildLowSpendOutcomeSeries(outcome, spend, p25) {
  const threshold = Number(p25);
  return (outcome || []).map((value, index) => {
    const spendValue = Number(spend?.[index]);
    return Number.isFinite(threshold)
      && Number.isFinite(spendValue)
      && spendValue <= threshold
      ? value
      : null;
  });
}

export function lowSpendPointIndices(outcome, spend, p25) {
  return buildLowSpendOutcomeSeries(outcome, spend, p25)
    .map((value, index) => value == null ? -1 : index)
    .filter((index) => index >= 0);
}
