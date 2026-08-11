import { getResponseSubtoolContent } from "@/lib/responseSubtoolContent";

const INTRO = {
  "5-4": {
    ko: ["실험 분석", "두 안의 차이가 우연인지, 다음 실험 결정을 내려도 되는지 확인합니다."],
    en: ["Experiment analysis", "Check whether the difference is more than chance and whether the next experiment decision is justified."],
  },
  "5-18": {
    ko: ["마케팅 반응 분석", "CSV를 한 번 매핑한 뒤 추세·카니발·MMM 기여·회귀 예측 중 필요한 분석만 따로 실행합니다."],
    en: ["Marketing response analysis", "Map the CSV once, then run only the trend, cannibalization, MMM contribution, or regression forecast you need."],
  },
  "5-3": {
    ko: ["무료 마케팅 예산 배분 시뮬레이터", "총 예산이나 목표 CPI·CPA·ROAS를 정하면, 채널별 관측 최대 지출을 넘지 않도록 권장 예산을 자동으로 계산합니다."],
    en: ["Free marketing budget allocation simulator", "Set a total budget or target CPI, CPA, or ROAS to automatically calculate a channel-level plan without exceeding observed maximum spend."],
  },
  "5-20": {
    ko: ["핵심 가치 발굴", "어떤 초기 행동을 며칠 안에 몇 번 한 유저가 장기 가치로 이어지는지 찾습니다."],
    en: ["Aha-moment finder", "Find which early action, repeated how often and within how many days, predicts lasting value."],
  },
  "5-23": {
    ko: ["증분 분석", "광고가 없었어도 생겼을 성과를 빼고, 실제로 추가 만든 효과를 추정합니다."],
    en: ["Incrementality analysis", "Subtract what would have happened anyway to estimate the outcomes advertising truly added."],
  },
  "5-24": {
    ko: ["브랜드 캠페인 증분 분석", "브랜드 검색·직접 유입·가입의 변화에서 캠페인이 실제로 추가한 성과를 추정합니다."],
    en: ["Brand campaign incrementality", "Estimate the outcomes a brand campaign added in brand search, direct traffic, and signups."],
  },
  "5-25": {
    ko: ["VIF 다중공선성 점검", "MMM 전에 채널별 지출이 너무 같이 움직여 기여도를 나눌 수 없는지 확인합니다."],
    en: ["VIF multicollinearity check", "Before MMM, check whether channel spend moves too tightly together to separate contribution."],
  },
  "5-26": {
    ko: ["ASA 키워드 발굴 · CPT 조정", "검색어를 Exact로 승격할 후보와 예산 소진·성과에 맞춘 CPT 조치를 한 번에 정리합니다."],
    en: ["ASA keyword finder · CPT actions", "Find Exact-promotion candidates and CPT actions from search-term pacing and performance."],
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

const HEADER_COPY = { ko: { aria: "도구 안내" }, en: { aria: "About this tool" } };

export default function ToolIntro({ toolId, locale = "ko" }) {
  const localeKey = locale === "en" ? "en" : "ko";
  const searchContent = getResponseSubtoolContent(toolId, localeKey);
  const copy = INTRO[toolId]?.[localeKey] || (searchContent ? [searchContent.h1, searchContent.intro] : null);
  const T = HEADER_COPY[localeKey];
  if (!copy) return null;
  return <header className="tool-context-header tool-instrument-header" aria-label={T.aria} data-tool-id={toolId}>
    <div className="tool-instrument-header__copy">
      <h1 className="tool-context-header__title tool-instrument-header__title">{copy[0]}</h1>
      <p className="tool-instrument-header__description">{copy[1]}</p>
    </div>
  </header>;
}
