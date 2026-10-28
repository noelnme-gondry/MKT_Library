/* ============================================================
 * A/B 판독(5-4) 결론 문장 — product-ssot §1.1c "보고서 틀".
 *
 * 화면의 판정을 한 문장으로 옮긴다: 두 전환율, 상대 차이, 그리고 그 차이가 우연과
 * 구분되는가(p<0.05). 비유의는 "효과 없음"이 아니라 "지금 표본으로는 구분되지
 * 않는다"로 말한다(§8.6). 배정 비율 이상(SRM)이면 효과를 말하지 않는다.
 * variant가 여럿이면 합친 값이라는 사실을 문장 안에 둔다 — 실행 대상이 아니다.
 * ============================================================ */

const pct = (value, digits = 2) => `${Number(value).toFixed(digits)}%`;

export function abHeadline({ srmMismatch = false, significant = false, liftRel = 0, controlRate = 0, testRate = 0, testArmCount = 1, locale = "ko" } = {}) {
  const en = locale === "en";
  if (srmMismatch) {
    return en
      ? "Hold the decision: the groups were not split as planned, so the difference cannot be trusted."
      : "판단 보류: 그룹 배정 비율이 계획과 달라 차이를 믿을 수 없습니다.";
  }
  const lift = `${Math.abs(liftRel * 100).toFixed(1)}%`;
  const merged = testArmCount > 1;
  const subjectKo = merged ? `Test ${testArmCount}개를 합친 전환율(${pct(testRate)})` : `Test 전환율(${pct(testRate)})`;
  if (!significant) {
    return en
      ? `${merged ? `${testArmCount} test variants combined` : "Test"} (${pct(testRate)}) vs Control (${pct(controlRate)}): too close to call with this sample.`
      : `${subjectKo}과 Control(${pct(controlRate)})의 차이는 지금 표본으로는 우연과 구분되지 않습니다.`;
  }
  const higher = liftRel >= 0;
  if (en) {
    return `${merged ? `${testArmCount} test variants combined convert` : "Test converts"} at ${pct(testRate)}, ${lift} ${higher ? "above" : "below"} Control (${pct(controlRate)}); unlikely to be chance.`;
  }
  return `${subjectKo}이 Control(${pct(controlRate)})보다 ${lift} ${higher ? "높고" : "낮고"}, 우연으로 보기 어려운 차이입니다.`;
}
