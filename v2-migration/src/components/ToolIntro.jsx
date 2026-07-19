const INTRO = {
  "5-4": {
    ko: ["실험 분석", "두 안의 차이가 우연인지, 다음 실험 결정을 내려도 되는지 확인합니다."],
    en: ["Experiment analysis", "Check whether the difference is more than chance and whether the next experiment decision is justified."],
  },
  "5-18": {
    ko: ["마케팅 반응 분석", "잠식 진단에서 채널 기여도, 다변량 회귀와 예산 시나리오 예측까지 한 흐름으로 봅니다."],
    en: ["Marketing response analysis", "Move from cannibalization diagnosis to channel contribution, multivariate regression, and budget-scenario forecasting."],
  },
  "5-20": {
    ko: ["핵심 가치 발굴", "어떤 초기 행동을 며칠 안에 몇 번 한 유저가 장기 가치로 이어지는지 찾습니다."],
    en: ["Aha-moment finder", "Find which early action, repeated how often and within how many days, predicts lasting value."],
  },
  "5-23": {
    ko: ["증분 분석", "광고가 없었어도 생겼을 성과를 빼고, 실제로 추가 만든 효과를 추정합니다."],
    en: ["Incrementality analysis", "Subtract what would have happened anyway to estimate the outcomes advertising truly added."],
  },
  "9-1": {
    ko: ["콘텐츠 요소 분석", "후킹·형식·길이·메시지 중 어떤 요소가 성과와 연결되는지 통제변수와 함께 봅니다."],
    en: ["Content element analysis", "Estimate how hooks, formats, length, and message angles relate to results while controlling for other factors."],
  },
  "9-6": {
    ko: ["소재 분석", "지금 교체할 소재, 피로 신호와 다음 제작 우선순위를 한 번에 정리합니다."],
    en: ["Creative analysis", "Prioritize what to replace now, the fatigue signals behind it, and what to produce next."],
  },
};

export default function ToolIntro({ toolId, locale = "ko" }) {
  const copy = INTRO[toolId]?.[locale === "en" ? "en" : "ko"];
  if (!copy) return null;
  return <header className="tool-context-header">
    <div className="tool-context-header__meta"><span>ANALYSIS / {toolId}</span><em>{locale === "en" ? "LOCAL DATA" : "브라우저 내 분석"}</em></div>
    <h1>{copy[0]}</h1>
    <p>{copy[1]}</p>
    <div className="tool-context-header__flow" aria-label={locale === "en" ? "Analysis flow" : "분석 흐름"}>
      <span>01 {locale === "en" ? "Prepare" : "데이터 준비"}</span>
      <i aria-hidden>→</i>
      <span>02 {locale === "en" ? "Read evidence" : "근거 확인"}</span>
      <i aria-hidden>→</i>
      <span>03 {locale === "en" ? "Decide" : "다음 조치"}</span>
    </div>
  </header>;
}
