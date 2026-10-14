// 관측 전환율의 산술 비교만 수행한다. 유의성·인과 효과 판정은 포함하지 않는다.
function participantCount(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function calculateObservedUplift(values = {}) {
  const treatmentUsers = participantCount(values.treatmentUsers);
  const treatmentConversions = participantCount(values.treatmentConversions);
  const controlUsers = participantCount(values.controlUsers);
  const controlConversions = participantCount(values.controlConversions);
  if ([treatmentUsers, treatmentConversions, controlUsers, controlConversions].some((value) => value === null)
    || treatmentUsers === 0 || controlUsers === 0
    || treatmentConversions > treatmentUsers || controlConversions > controlUsers) return null;

  const treatmentRate = treatmentConversions / treatmentUsers;
  const controlRate = controlConversions / controlUsers;
  const absoluteLift = treatmentRate - controlRate;
  return {
    treatmentRate,
    controlRate,
    absoluteLift,
    relativeLift: controlRate === 0 ? null : absoluteLift / controlRate,
  };
}
