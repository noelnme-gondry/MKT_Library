"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { idToSlug } from "@/lib/routeMap";
import { primaryToolForContent } from "@/lib/contentToolRegistry";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

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
    ko: { label: "채널 기여도 (MMM)", title: "성과를 움직인 요인을 분해하세요", desc: "채널·기본 수요·이벤트의 기여를 MMM으로 나눠 봅니다.", cta: "MMM 기여 분해 열기" },
    en: { label: "Channel contribution (MMM)", title: "Decompose what moved performance", desc: "Use MMM to separate channel, base-demand, and event contribution.", cta: "Open MMM contribution" },
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
  "5-27": {
    ko: { label: "스토어 전환", title: "스토어 페이지에서 어디가 새는지 보세요", desc: "노출→제품 페이지→설치 퍼널을 나누고, 효율 변화인지 유입 믹스 변화인지 분해합니다.", cta: "스토어 전환 분해하기" },
    en: { label: "Store conversion", title: "See where the store page leaks", desc: "Split the impression → product page → install funnel and separate rate changes from traffic-mix changes.", cta: "Break down store conversion" },
  },
  "5-24": {
    ko: { label: "브랜드 증분", title: "브랜드 캠페인이 실제로 밀어올린 몫을 보세요", desc: "개입 시점 전후를 시계열로 나누고 대조군과 사전 추세로 인과 주장을 검증합니다.", cta: "브랜드 증분 분석하기" },
    en: { label: "Brand incrementality", title: "See what the brand campaign actually lifted", desc: "Model the intervention with interrupted time series, and test the claim against a control and pre-trend.", cta: "Analyze brand lift" },
  },
  "9-1": {
    ko: { label: "콘텐츠 요소 분석", title: "어떤 요소가 성과를 끌어올렸는지 보세요", desc: "제목·형식·소재 속성별 기여를 회귀로 나눠 다음 제작 우선순위를 정합니다.", cta: "콘텐츠 요소 분석하기" },
    en: { label: "Content element analysis", title: "See which element moved performance", desc: "Regress performance on title, format, and creative attributes to prioritize what to produce next.", cta: "Analyze content elements" },
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


// 도구별 행동 카피 조회 — 블로그 도치 브리지도 같은 문장을 쓴다. 카피가 두 벌이 되면
// 글에서 본 약속과 브리지의 약속이 갈린다.
export function actionCopyFor(toolId, locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const resolved = TOOL_COPY[toolId] ? toolId : "5-2";
  return { toolId: resolved, ...TOOL_COPY[resolved][lang] };
}

// 카피가 있는 도구 목록 — 가드가 "레지스트리가 지정한 도구는 전부 여기 있어야 한다"를
// 파생 검사한다(개수를 손으로 적으면 다음 도구에서 같은 폴백 사고가 재발한다).
export const ACTION_COPY_TOOL_IDS = Object.keys(TOOL_COPY);

export default function ContentActionPanel({ locale = "ko", toolId, term, post, placement = "article_post" }) {
  const content = term || post;
  const contentType = term ? "glossary" : "blog";
  const candidate = toolId || content?.primaryTool || primaryToolForContent(content?.slug, contentType);
  // TOOL_COPY에 없는 도구는 운영 대시보드로 폴백한다. 이 폴백은 오래 누락을 가리고
  // 있었다 — 레지스트리가 5-27·5-24·9-1을 지정한 글 7편과 용어 3편이 조용히 대시보드로
  // 떨어졌다. `contentActionPanel.test.js`가 매핑된 도구 전체를 파생 검사한다.
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
  // 노출 계측 — 클릭만 있으면 "안 눌렀다"와 "안 보였다"를 구분할 수 없다. 실제로 중간
  // 패널은 글 34편에서 렌더조차 되지 않고 있었고(마커 누락), 클릭 0만으로는 그 사실이
  // 보이지 않았다. 뷰포트에 실제로 들어온 순간 1회만 보낸다.
  const panelRef = useRef(null);
  const isPanel = placement !== "article_answer";
  useEffect(() => {
    if (!isPanel || !panelRef.current || typeof IntersectionObserver !== "function") return undefined;
    const target = panelRef.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey(content?.slug, placement, locale), {
        tool_id: resolvedTool,
        source: contentType,
        content_slug: content?.slug,
        content_type: contentType,
        placement,
        locale,
      });
      observer.disconnect();
    }, { threshold: [0, 0.1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [contentType, content?.slug, isPanel, locale, placement, resolvedTool]);

  const isInline = placement === "article_mid";
  // 상단 짧은 답(seoAnswer) 바로 밑의 한 줄 링크. 글 상단에서 이탈하는 독자에게도
  // 경로를 남기되, 박스를 하나 더 얹어 답을 밀어내지는 않는다(§12.24 마감 영역 원칙).
  const isAnswerLink = placement === "article_answer";
  if (isAnswerLink) {
    return <p className="content-answer__action">
      <Link href={href} onClick={() => trackClick(resolvedTool, placement)}>
        {lang === "en" ? "Check this with your own data" : "이 판단을 내 데이터로 확인하기"} · {copy.label} <span aria-hidden>→</span>
      </Link>
    </p>;
  }
  return <aside ref={panelRef} className={`content-action-panel${isInline ? " content-action-panel--inline" : ""}`}>
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
