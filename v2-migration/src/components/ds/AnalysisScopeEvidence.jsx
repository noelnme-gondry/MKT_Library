import IssueMark from "@/components/ds/IssueMark";

// 결론에 쓰인 기간·분모. 예전에는 '실제 분석 범위·분모 확인' 블록으로 늘 펼쳐 두었는데,
// 문제가 없으면 읽을 이유가 없는 정보였다(2026-09-24 사용자 결정으로 제거). 이제 입력에
// 결측·비정상 셀이 있는 기간만 빨간 "!"로 알린다 — 어느 기간의 몇 칸인지까지. 전체 범위는
// 상세 워크북(XLSX)의 04_SCOPE에 그대로 남는다(`scopeEvidenceTable`).
export default function AnalysisScopeEvidence({ scope, locale = "ko" }) {
  if (!scope?.periods?.length) return null;
  const en = locale === "en";
  const lines = scope.periods
    .filter((period) => period.quality?.missing > 0)
    .map((period) => {
      const name = period.id === "before" ? (en ? "Before" : "이전") : (en ? "After" : "이후");
      const ratio = (period.quality.ratio * 100).toFixed(1);
      return en
        ? `${name} ${period.start} ~ ${period.end}: ${period.quality.missing} of ${period.quality.checked} input cells are missing or invalid (${ratio}%)`
        : `${name} ${period.start} ~ ${period.end}: 입력 ${period.quality.checked}칸 중 ${period.quality.missing}칸이 비었거나 읽을 수 없습니다 (${ratio}%)`;
    });
  return <IssueMark issues={lines} locale={locale} />;
}
