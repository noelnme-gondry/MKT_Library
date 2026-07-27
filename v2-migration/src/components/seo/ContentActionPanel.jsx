import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { primaryToolForContent } from "@/lib/contentToolRegistry";

const TOOL_COPY = {
  "5-2": {
    ko: { label: "운영 대시보드", title: "읽은 내용을 이번 주 데이터에서 확인하세요", desc: "CPA·ROAS·예산 속도와 이상 신호를 한 화면에서 확인합니다.", cta: "내 데이터로 운영 점검" },
    en: { label: "Operations dashboard", title: "Check this in this week’s data", desc: "Review CPA, ROAS, budget pacing, and anomaly signals in one place.", cta: "Review my operations" },
  },
  "5-3": {
    ko: { label: "예산 배분", title: "다음 예산, 어디로 옮길지 계산하세요", desc: "현재 효율과 한계 CPA를 기준으로 증액·감액 후보를 시뮬레이션합니다.", cta: "예산 배분 계산하기" },
    en: { label: "Budget allocation", title: "Compare the next budget move with data", desc: "Simulate scale-up and pull-back candidates from current efficiency and marginal CPA.", cta: "Plan budget allocation" },
  },
  "5-21": {
    ko: { label: "성과 변동 분석", title: "CPA 변화가 어디서 시작됐는지 보세요", desc: "채널·캠페인·소재의 기여도를 나눠 먼저 볼 원인을 정리합니다.", cta: "성과 변동 분석하기" },
    en: { label: "Performance variance", title: "See where the CPA change started", desc: "Break down channel, campaign, and creative contributions to focus the investigation.", cta: "Analyze performance change" },
  },
  "5-18": {
    ko: { label: "마케팅 반응 분석", title: "광고가 오가닉을 잠식하는지 먼저 확인하세요", desc: "시계열 점검부터 네 가지 잠식 신호, 기여도, 예측까지 한 흐름에서 확인합니다.", cta: "잠식·기여도 분석 열기" },
    en: { label: "MMM, regression & forecast", title: "Model channel contribution and the next four weeks", desc: "Estimate spend response with multivariate regression and compare budget scenarios with a historical-residual reference range.", cta: "Open marketing response analysis" },
  },
  "5-22": {
    ko: { label: "캠페인 포화도", title: "예산을 더 쓰기 전에 한계 효율을 확인하세요", desc: "평균 효율이 아니라 추가 광고비의 한계 CPA·ROAS와 증액 여력을 진단합니다.", cta: "포화도 분석하기" },
    en: { label: "Campaign saturation", title: "Check marginal efficiency before scaling", desc: "Diagnose marginal CPA, ROAS, and budget headroom instead of relying on average efficiency.", cta: "Analyze saturation" },
  },
  "5-4": {
    ko: { label: "실험 분석", title: "두 안의 차이가 우연인지 확인하세요", desc: "표본수·신뢰구간·통계적 유의성을 확인하고 다음 실험 결정을 정리합니다.", cta: "A/B 테스트 판독하기" },
    en: { label: "Experiment analysis", title: "Check whether the difference is real", desc: "Review sample size, confidence intervals, and significance before the next experiment decision.", cta: "Read an A/B test" },
  },
  "5-23": {
    ko: { label: "증분 분석", title: "광고가 실제로 추가 만든 성과를 추정하세요", desc: "통제군 또는 캠페인 전후 데이터를 이용해 단순 전환이 아닌 순증분을 계산합니다.", cta: "증분 효과 분석하기" },
    en: { label: "Incrementality", title: "Estimate what advertising truly added", desc: "Use a control group or pre/post design to estimate incremental outcomes rather than attributed conversions.", cta: "Analyze incrementality" },
  },
  "5-20": {
    ko: { label: "핵심 가치 발굴", title: "리텐션을 예측하는 초기 행동을 찾으세요", desc: "초기 행동의 시점·횟수 조합을 비교해 장기 가치와 연결되는 Aha 후보를 좁힙니다.", cta: "Aha-moment 분석하기" },
    en: { label: "Aha-moment finder", title: "Find the early behavior that predicts retention", desc: "Compare timing and frequency patterns to narrow down early actions associated with long-term value.", cta: "Find an Aha moment" },
  },
  "9-6": {
    ko: { label: "소재 피로도", title: "교체할 소재와 다음 제작을 정리하세요", desc: "성과 하락과 노출 피로 신호를 함께 보고 교체 우선순위를 만듭니다.", cta: "소재 피로도 분석하기" },
    en: { label: "Creative fatigue", title: "Plan what to replace and produce next", desc: "Use performance decline and fatigue signals together to set replacement priority.", cta: "Analyze creative fatigue" },
  },
};

const RELATED_TOOL = {
  "5-18": {
    ko: { toolId: "5-3", cta: "예산 배분 시뮬레이션" },
    en: { toolId: "5-3", cta: "Plan budget allocation" },
  },
  "5-3": {
    ko: { toolId: "5-18", cta: "마케팅 반응 분석으로 점검" },
    en: { toolId: "5-18", cta: "Check ad cannibalization first" },
  },
};

export default function ContentActionPanel({ locale = "ko", toolId, term, post }) {
  const content = term || post;
  const contentType = term ? "glossary" : "blog";
  const candidate = toolId || content?.primaryTool || primaryToolForContent(content?.slug, contentType);
  const resolvedTool = TOOL_COPY[candidate] ? candidate : "5-2";
  const copy = TOOL_COPY[resolvedTool][locale === "en" ? "en" : "ko"];
  const related = RELATED_TOOL[resolvedTool]?.[locale === "en" ? "en" : "ko"];
  const href = `${locale === "en" ? "/en" : ""}${idToSlug[resolvedTool]}`;
  return <aside className="content-action-panel">
    <div>
      <span className="content-action-panel__eyebrow">{copy.label}</span>
      <h2>{copy.title}</h2>
      <p>{copy.desc}</p>
    </div>
    <div className="content-action-panel__links">
      <Link href={href} className="content-action-panel__cta">{copy.cta} <span aria-hidden>→</span></Link>
      {related && <Link href={`${locale === "en" ? "/en" : ""}${idToSlug[related.toolId]}`} className="content-action-panel__secondary">{related.cta} <span aria-hidden>→</span></Link>}
    </div>
  </aside>;
}
