"use client";

import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { primaryToolForContent } from "@/lib/contentToolRegistry";
import { trackProductEvent } from "@/lib/analytics";

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
  "5-18-trend": {
    ko: { label: "추세 분석", title: "광고 판단 전 자연 추세부터 분리하세요", desc: "계절성·추세·이상 주차를 먼저 구분해 광고 효과를 과대해석하지 않습니다.", cta: "추세 분석 열기" },
    en: { label: "Trend analysis", title: "Separate the natural trend before judging ads", desc: "Review trend, seasonality, and irregular weeks before interpreting marketing effects.", cta: "Open trend analysis" },
  },
  "5-18-paid-organic": {
    ko: { label: "유입 변화맵", title: "Paid와 Organic이 반대로 움직이는지 보세요", desc: "주별 WoW 궤적으로 반대 움직임이 반복되는지 먼저 확인합니다.", cta: "변화맵 열기" },
    en: { label: "Paid vs Organic map", title: "See whether Paid and Organic move in opposite directions", desc: "Check on a weekly WoW path whether the opposite movement repeats.", cta: "Open the movement map" },
  },
  "5-18-cannibal": {
    ko: { label: "잠식 진단", title: "광고가 오가닉을 잠식하는지 확인하세요", desc: "채널별 네 가지 신호로 잠식 가능성을 점검합니다.", cta: "잠식 진단 열기" },
    en: { label: "Cannibalization diagnosis", title: "Check whether paid ads displace organic outcomes", desc: "Review four signals of possible cannibalization by channel.", cta: "Open cannibalization diagnosis" },
  },
  "5-18-mmm": {
    ko: { label: "채널 기여도", title: "성과를 움직인 요인을 분해하세요", desc: "채널·기본 수요·이벤트의 기여를 MMM으로 나눠 봅니다.", cta: "MMM 기여 분해 열기" },
    en: { label: "Channel contribution", title: "Decompose what moved performance", desc: "Use MMM to separate channel, base-demand, and event contribution.", cta: "Open MMM contribution" },
  },
  "5-18-forecast": {
    ko: { label: "미래 예측", title: "다음 기간 예측을 검증하세요", desc: "예측 전용 회귀와 봉인 OOS 검증으로 다음 기간을 점검합니다.", cta: "회귀 · 미래 예측 열기" },
    en: { label: "Forecast", title: "Validate the next-period forecast", desc: "Run forecast-only regression with sealed out-of-sample validation.", cta: "Open regression and forecast" },
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
  "5-25": {
    ko: { label: "VIF 다중공선성 점검", title: "MMM 전에 채널 지출의 겹침부터 확인하세요", desc: "날짜·채널·비용으로 VIF와 상관을 확인해 분리 추정이 어려운 채널을 찾습니다.", cta: "VIF 점검하기" },
    en: { label: "VIF multicollinearity check", title: "Check overlapping channel spend before MMM", desc: "Use date, channel, and cost to review VIF and correlation before asking the model to separate channel effects.", cta: "Check VIF" },
  },
  "5-26": {
    ko: { label: "ASA 키워드 발굴", title: "검색어를 Exact 승격과 CPT 조정 후보로 바꾸세요", desc: "Search Match·Broad·Exact 성과를 나눠 Exact 승격, 제외 검토, CPT 증감 후보를 정리합니다.", cta: "ASA 키워드 후보 정리하기" },
    en: { label: "ASA keyword finder", title: "Turn search terms into Exact and CPT actions", desc: "Split Search Match, Broad, and Exact performance to review Exact promotions, negatives, and CPT bid changes.", cta: "Review ASA keyword actions" },
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
  "5-18-mmm": {
    ko: { toolId: "5-3", cta: "예산 배분 시뮬레이션" },
    en: { toolId: "5-3", cta: "Plan budget allocation" },
  },
  "5-3": {
    ko: { toolId: "5-18-cannibal", cta: "잠식 진단 바로 열기" },
    en: { toolId: "5-18-cannibal", cta: "Open cannibalization diagnosis" },
  },
};


export default function ContentActionPanel({ locale = "ko", toolId, term, post, placement = "article_post" }) {
  const content = term || post;
  const contentType = term ? "glossary" : "blog";
  const candidate = toolId || content?.primaryTool || primaryToolForContent(content?.slug, contentType);
  const resolvedTool = TOOL_COPY[candidate] ? candidate : "5-2";
  const lang = locale === "en" ? "en" : "ko";
  const copy = TOOL_COPY[resolvedTool][lang];
  const related = RELATED_TOOL[resolvedTool]?.[locale === "en" ? "en" : "ko"];
  const href = `${locale === "en" ? "/en" : ""}${idToSlug[resolvedTool]}`;
  const trackClick = (targetToolId, targetPlacement) => {
    trackProductEvent("blog_tool_cta_clicked", {
      tool_id: targetToolId,
      source: contentType,
      locale,
      placement: targetPlacement,
      content_slug: content?.slug,
      content_type: contentType,
    });
  };
  const isInline = placement === "article_mid";
  return <aside className={`content-action-panel${isInline ? " content-action-panel--inline" : ""}`}>
    <div>
      <span className="content-action-panel__eyebrow">{isInline ? (locale === "en" ? "READY TO CHECK" : "바로 확인하기") : copy.label}</span>
      <h2>{copy.title}</h2>
      <p>{copy.desc}</p>
    </div>
    <div className="content-action-panel__links">
      <Link href={href} className="content-action-panel__cta" onClick={() => trackClick(resolvedTool, placement)}>{copy.cta} <span aria-hidden>→</span></Link>
      {!isInline && related && <Link href={`${locale === "en" ? "/en" : ""}${idToSlug[related.toolId]}`} className="content-action-panel__secondary" onClick={() => trackClick(related.toolId, `${placement}_secondary`)}>{related.cta} <span aria-hidden>→</span></Link>}
    </div>
  </aside>;
}
