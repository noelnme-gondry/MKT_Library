// 예산 화면과 통합 운영 보기가 같은 기존 판정 기준을 사용한다.
export function allocConfidence(wrapper) {
  if (!wrapper || !wrapper.model) return null;
  const r2 = Number(wrapper.r2);
  const n = wrapper.kept ? wrapper.kept.length : 0;
  if (!isFinite(r2) || n < 3) return { level: "low", ko: "낮음", en: "Low", r2, n };
  if (r2 >= 0.7 && n >= 6) return { level: "high", ko: "높음", en: "High", r2, n };
  if (r2 >= 0.4) return { level: "med", ko: "보통", en: "Med", r2, n };
  return { level: "low", ko: "낮음", en: "Low", r2, n };
}
