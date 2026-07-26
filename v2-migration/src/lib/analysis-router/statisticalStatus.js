export const STATISTICAL_STATUS = Object.freeze({
  READY: "READY",
  CAUTION: "CAUTION",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  NOT_IDENTIFIED: "NOT_IDENTIFIED",
  ABSTAIN: "ABSTAIN",
  ENGINE_ERROR: "ENGINE_ERROR",
});

export function deriveStatisticalStatus({
  hasEstimate = true,
  rowCount = 0,
  requiredMissing = [],
  qualityGrade = "ready",
  warnings = [],
  notIdentified = false,
  abstain = false,
  engineError = null,
} = {}) {
  if (engineError) return STATISTICAL_STATUS.ENGINE_ERROR;
  if (abstain) return STATISTICAL_STATUS.ABSTAIN;
  if (notIdentified) return STATISTICAL_STATUS.NOT_IDENTIFIED;
  if (!hasEstimate || requiredMissing.length > 0 || rowCount === 0 || qualityGrade === "unfit") return STATISTICAL_STATUS.INSUFFICIENT_DATA;
  if (qualityGrade === "caution" || warnings.length > 0) return STATISTICAL_STATUS.CAUTION;
  return STATISTICAL_STATUS.READY;
}

export function statisticalStatusLabel(status, locale = "ko") {
  const labels = {
    READY: ["사용 가능", "Usable"],
    CAUTION: ["주의해서 해석", "Interpret with caution"],
    INSUFFICIENT_DATA: ["데이터 부족", "Insufficient data"],
    NOT_IDENTIFIED: ["식별 불가", "Not identified"],
    ABSTAIN: ["판정 보류", "Abstain"],
    ENGINE_ERROR: ["계산 오류", "Engine error"],
  };
  return labels[status]?.[locale === "en" ? 1 : 0] || status || "—";
}
