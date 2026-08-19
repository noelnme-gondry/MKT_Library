"use client";
import { formatEligibilityBlocker } from "@/lib/analysis-router/evaluateEligibility";

const COPY = {
  ko: { ready: "바로 가능", caution: "주의해서 가능", blocked: "추가 데이터 필요", exploratory: "탐색용 MMM", decision: "의사결정용 MMM", open: "분석 시작", title: "이 데이터로 먼저 확인할 분석", readyTitle: "바로 실행 가능한 분석", readyDeck: "아래 분석은 현재 매핑으로 바로 열 수 있습니다.", more: "추가 데이터가 있으면 가능한 분석", noneTitle: "지금 바로 실행할 분석은 없습니다", noneDeck: "필요한 컬럼과 기간을 아래에서 확인한 뒤 데이터를 보완하세요.", rows: "행", periods: "기간", recommended: "먼저 보기", available: "다른 분석", unlock: "추가 가능", reason: "추천 이유", clear: "현재 데이터 구조로 바로 시작할 수 있습니다.", detail: "판정 세부 정보", provisional: "자동 매핑을 마쳤습니다. 먼저 볼 분석과 바로 실행 가능한 분석을 나눠 보여드립니다." },
  en: { ready: "Ready", caution: "Use with caution", blocked: "Needs more data", exploratory: "Exploratory MMM", decision: "Decision-ready MMM", open: "Open analysis", title: "First analysis to check", readyTitle: "Analyses you can run now", readyDeck: "These analyses can open with your current mapping.", more: "Analyses unlocked by more data", noneTitle: "No analysis is ready yet", noneDeck: "Review the required columns and date coverage below, then add the missing data.", rows: "rows", periods: "periods", recommended: "Start here", available: "Another analysis", unlock: "Can unlock", reason: "Why this", clear: "Your current data structure can start this analysis.", detail: "Decision details", provisional: "Automatic mapping is complete. We separate the first analysis from other analyses you can run right away." },
};


const OUTCOME = {
  "5-2": { ko: "이번 주 성과·예산 속도·이상 신호", en: "Weekly performance, pacing, and anomalies" },
  "5-21": { ko: "성과 변화의 최대 원인과 증감액", en: "Largest performance driver and its impact" },
  "5-22": { ko: "캠페인별 증액 여력과 한계 효율", en: "Scale headroom and marginal efficiency" },
  "5-3": { ko: "채널별 증액·감액 예산 시나리오", en: "Channel-level budget move scenarios" },
  "5-4": { ko: "A/B 차이·신뢰구간·다음 판정", en: "A/B difference, interval, and next decision" },
  "5-18-mmm": { ko: "채널·기본 수요·이벤트의 성과 기여 분해", en: "Contribution split across channels, base demand, and events" },
  "5-23": { ko: "광고가 실제로 추가 만든 순증분", en: "Outcomes advertising truly added" },
  "5-24": { ko: "브랜드 캠페인이 추가 만든 검색·직접유입·가입", en: "Brand-campaign lift in search, direct traffic, or signups" },
  "5-25": { ko: "MMM 전 채널 지출의 중복 움직임과 최대 VIF", en: "Overlapping channel spend and maximum VIF before MMM" },
  "5-26": { ko: "Exact 승격·제외 검토·CPT 증감 후보", en: "Exact, negative-keyword, and CPT action candidates" },
  "9-6": { ko: "소재 피로도·교체 우선순위·다음 테스트 후보", en: "Creative fatigue, replacement priority, and next test candidates" },
};

function EligibilityCard({ result, getTitle, onOpen, locale, isRecommended = false }) {
  const T = COPY[locale] || COPY.ko;
  const outcome = OUTCOME[result.toolId]?.[locale] || OUTCOME[result.toolId]?.ko || getTitle(result.toolId);
  const isBlocked = result.status === "blocked";
  const reason = isBlocked
    ? formatEligibilityBlocker(result, locale)
    : result.recommendationReason || T.clear;
  const confidenceLabel = result.confidenceTier && result.confidenceTier !== "standard" ? T[result.confidenceTier] : null;
  const detail = locale === "en"
    ? (result.reasonDetails?.length ? "Review data coverage and model assumptions before using this result." : "")
    : result.reasonDetails?.join(" ");
  return <article className={`eligibility-card ${result.status}`}>
    <div className="eligibility-card__top">
      <span>{isRecommended ? T.recommended : isBlocked ? T.unlock : T.available}</span>
      <em>{confidenceLabel || T[result.status]}</em>
    </div>
    <h3>{getTitle(result.toolId)}</h3>
    <p className="eligibility-card__outcome"><b>{locale === "en" ? "Answer" : "얻게 되는 답"}</b>{outcome}</p>
    <div className="eligibility-card__facts"><span>{result.rowCount.toLocaleString()} {T.rows}</span><span>{result.periodCount.toLocaleString()} {T.periods}</span></div>
    <p className="eligibility-card__reason">
      {!isBlocked && <b>{T.reason}</b>}
      {reason}
      {!isBlocked && detail && <span className="data-confidence-hint" role="img" tabIndex={0} aria-label={T.detail} data-tooltip={detail}>ⓘ</span>}
    </p>
    {!isBlocked && <button className="btn primary" type="button" onClick={() => onOpen(result.toolId)}>{T.open}<span aria-hidden>→</span></button>}
  </article>;
}

export default function AnalysisEligibilityList({ results = [], getTitle, onOpen, locale = "ko", provisional = false }) {
  const T = COPY[locale] || COPY.ko;
  const available = results.filter((result) => result.status !== "blocked");
  const primary = available[0] || null;
  const readyToOpen = primary ? available.filter((result) => result.toolId !== primary.toolId) : [];
  const blocked = results.filter((result) => result.status === "blocked");
  return (
    <section className="analysis-recommendations">
      <div className="analysis-recommendations__head"><span>DATA ROUTER</span><h2>{T.title}</h2>{provisional && <p>{T.provisional}</p>}</div>
      {primary && <div className="analysis-recommendations__primary"><EligibilityCard result={primary} getTitle={getTitle} onOpen={onOpen} locale={locale} isRecommended /></div>}
      {!primary && <div className="analysis-recommendations__empty"><strong>{T.noneTitle}</strong><p>{T.noneDeck}</p></div>}
      {readyToOpen.length > 0 && <section className="analysis-recommendations__ready" aria-labelledby="ready-analyses-title"><h3 id="ready-analyses-title">{T.readyTitle}</h3><p>{T.readyDeck}</p><div className="analysis-recommendations__grid">{readyToOpen.map((result) => <EligibilityCard key={result.toolId} result={result} getTitle={getTitle} onOpen={onOpen} locale={locale} />)}</div></section>}
      {blocked.length > 0 && <details className="analysis-recommendations__more"><summary>{T.more} <span>{blocked.length}</span></summary><div className="analysis-recommendations__grid">{blocked.map((result) => <EligibilityCard key={result.toolId} result={result} getTitle={getTitle} onOpen={onOpen} locale={locale} />)}</div></details>}
    </section>
  );
}
