import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { responseStageHref } from "@/lib/responseStage";
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
    ko: ["무료 마케팅 예산 배분 시뮬레이터", "채널별 한계 효율과 지출 여력으로 다음 예산을 어디에 늘리고 줄일지 시뮬레이션합니다."],
    en: ["Free marketing budget allocation simulator", "Use channel-level marginal efficiency and headroom to simulate where the next budget should increase or decrease."],
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

const TOOL_CROSS_LINK = {
  "5-18": {
    ko: { label: "다음 조치", toolId: "5-3", cta: "잠식 의심 채널 예산 시뮬레이션" },
    en: { label: "Next step", toolId: "5-3", cta: "Simulate suspect-channel budget moves" },
  },
  "5-3": {
    ko: { label: "예산 이동 전", toolId: "5-18", stage: "diagnose", cta: "광고 잠식 먼저 점검" },
    en: { label: "Before moving budget", toolId: "5-18", stage: "diagnose", cta: "Check ad cannibalization first" },
  },
};

const HEADER_COPY = {
  ko: { aria: "도구 안내", local: "브라우저 내 분석", mode: "의사결정 도구" },
  en: { aria: "About this tool", local: "BROWSER-ONLY ANALYSIS", mode: "DECISION TOOL" },
};

export default function ToolIntro({ toolId, locale = "ko" }) {
  const localeKey = locale === "en" ? "en" : "ko";
  const searchContent = getResponseSubtoolContent(toolId, localeKey);
  const copy = INTRO[toolId]?.[localeKey] || (searchContent ? [searchContent.h1, searchContent.intro] : null);
  const crossLink = TOOL_CROSS_LINK[toolId]?.[localeKey];
  const T = HEADER_COPY[localeKey];
  if (!copy) return null;
  return <header className="tool-context-header tool-instrument-header" aria-label={T.aria} data-tool-id={toolId}>
    <div className="tool-instrument-header__copy">
      <div className="tool-context-header__meta tool-instrument-header__meta">
        <em>{T.local}</em>
        <span>{T.mode}</span>
      </div>
      <h1 className="tool-context-header__title tool-instrument-header__title">{copy[0]}</h1>
      <p className="tool-instrument-header__description">{copy[1]}</p>
    </div>
    {crossLink && <div className="tool-context-header__next tool-instrument-header__next">
      <span>{crossLink.label}</span>
      <Link href={crossLink.toolId === "5-18" && crossLink.stage ? responseStageHref(crossLink.stage, locale) : `${locale === "en" ? "/en" : ""}${idToSlug[crossLink.toolId]}`}>{crossLink.cta} <b aria-hidden>→</b></Link>
    </div>}
  </header>;
}
