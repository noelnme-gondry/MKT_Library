/**
 * MMM 결과를 읽을 때 반드시 감안할 구조적 한계.
 *
 * 왜 코드에 두는가: 이 셋은 사용자가 **반드시** 오해하는 지점이라 화면에 붙어 있어야
 * 하고, 문장이 화면·문서에서 갈리면 안 된다. 브랜드 사실(`brandFacts.js`)과 달리
 * 도구 스코프라 `llms.txt`로 내보내지 않는다 — 문맥 없이 인용되면 오히려 틀린다.
 *
 * 근거: 사내 Meridian 기반 MMM 대시보드 운영 문서 검토(2026-08-19).
 * `docs/product-ssot.md` D-16.
 */
export const MMM_INTERPRETATION_LIMITS = [
  {
    id: "brand-undervalued",
    ko: {
      claim: "브랜드 채널은 구조적으로 과소평가됩니다.",
      detail: "브랜드의 장기 효과는 기본 수요(baseline)로 흘러 들어가므로, 이 화면의 기여도는 측정된 몫일 뿐 브랜드의 총가치가 아닙니다. 퍼포먼스가 몇 배 효율이라는 비교를 그대로 예산 결정에 쓰지 마세요.",
    },
    en: {
      claim: "Brand channels are structurally undervalued here.",
      detail: "Long-run brand effects flow into base demand, so the contribution shown is the measured share, not brand's total value. Do not turn a performance-vs-brand efficiency ratio directly into a budget decision.",
    },
  },
  {
    id: "large-baseline-is-normal",
    ko: {
      claim: "기본 수요가 크게 나오는 것은 정상입니다.",
      detail: "성숙한 서비스에서는 유료 기여가 전체의 10% 안팎인 경우가 흔합니다. 광고가 작동하지 않는다는 뜻이 아니라, 대부분의 수요가 광고 밖에서 온다는 뜻입니다.",
    },
    en: {
      claim: "A large base-demand share is normal.",
      detail: "In mature products, paid contribution is often around 10% of the total. That does not mean advertising is failing — it means most demand arrives outside of it.",
    },
  },
  {
    id: "two-time-axes",
    ko: {
      claim: "효율과 포화도는 서로 다른 기간을 봅니다.",
      detail: "CPA·ROAS 같은 효율은 선택한 기간 기준이고, 포화도와 반응곡선은 모델이 학습한 전체 구간 기준입니다. 한 화면에 있지만 같은 기간의 숫자가 아닙니다.",
    },
    en: {
      claim: "Efficiency and saturation are measured over different windows.",
      detail: "Efficiency figures such as CPA and ROAS follow the selected period, while saturation and response curves come from the model's full training window. They sit on one screen but do not share a period.",
    },
  },
];

export function getMmmInterpretationLimits(locale = "ko") {
  const key = locale === "en" ? "en" : "ko";
  return MMM_INTERPRETATION_LIMITS.map((limit) => ({ id: limit.id, ...limit[key] }));
}
