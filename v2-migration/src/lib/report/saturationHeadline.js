import { subjectParticle } from "@/lib/vocabulary/hangulMatch";

/* ============================================================
 * 증액 여력 진단(5-22) 결론 문장 — product-ssot §1.1c "보고서 틀".
 *
 * 화면이 이미 판정한 것만 말한다: 대상마다 "더 쓰면 효율이 지금 평균보다 나빠지는가
 * (포화)" / "더 써도 평균보다 좋은가(여유)" / 그 사이(적정). 판정 기준은 엔진(satMath)과
 * satActiveVerdict가 소유하고, 이 함수는 개수와 이름을 문장으로 옮길 뿐이다.
 * 관측 지출 범위 안의 모형 판단이므로 "~하면 좋아진다"고 약속하지 않는다.
 * ============================================================ */

// 이름은 둘까지만 — 더 있으면 "등"으로 남은 것이 있음을 밝힌다.
const join = (names, en) => `${names.slice(0, 2).join(", ")}${names.length > 2 ? (en ? " and others" : " 등") : ""}`;

export function saturationHeadline({ total = 0, saturated = [], headroom = [], grain = "", locale = "ko" }) {
  const en = locale === "en";
  const unit = String(grain || (en ? "channel" : "채널")).trim();
  if (!total) {
    return en
      ? `On hold: no ${unit.toLowerCase()} has enough daily data to judge.`
      : `판단 보류: 판단할 만큼 일별 데이터가 쌓인 ${unit}${subjectParticle(unit)} 없습니다.`;
  }
  const s = saturated.length;
  const h = headroom.length;
  if (s && h) {
    return en
      ? `Of ${total} ${unit.toLowerCase()}s, hold increases on ${s} and test a small increase on ${h} (${join(headroom, en)}).`
      : `${total}개 ${unit} 중 ${s}곳은 증액을 멈추고, ${h}곳(${join(headroom, en)})은 소폭 증액을 시험해 볼 만합니다.`;
  }
  if (s && s === total) {
    return en
      ? `All ${total} ${unit.toLowerCase()}s get less efficient than their current average if you spend more. Hold increases.`
      : `${total}개 ${unit} 모두 더 쓰면 효율이 지금 평균보다 나빠집니다. 증액을 멈추세요.`;
  }
  if (h && h === total) {
    return en
      ? `All ${total} ${unit.toLowerCase()}s stay more efficient than their current average even with more spend. A small test increase is worth trying.`
      : `${total}개 ${unit} 모두 더 써도 효율이 지금 평균보다 좋습니다. 소폭 증액을 시험해 볼 만합니다.`;
  }
  if (s) {
    return en
      ? `Of ${total} ${unit.toLowerCase()}s, ${s} get less efficient than their current average if you spend more (${join(saturated, en)}). Hold increases.`
      : `${total}개 ${unit} 중 ${s}곳(${join(saturated, en)})은 더 쓰면 효율이 지금 평균보다 나빠집니다. 증액을 멈추세요.`;
  }
  if (h) {
    return en
      ? `Of ${total} ${unit.toLowerCase()}s, ${h} stay more efficient than their current average even with more spend (${join(headroom, en)}).`
      : `${total}개 ${unit} 중 ${h}곳(${join(headroom, en)})은 더 써도 효율이 지금 평균보다 좋습니다. 소폭 증액을 시험해 볼 만합니다.`;
  }
  return en
    ? `All ${total} ${unit.toLowerCase()}s are in a steady range. There is little evidence for a major reallocation.`
    : `${total}개 ${unit} 모두 효율이 유지되는 구간입니다. 배분을 크게 바꿀 근거는 약합니다.`;
}
