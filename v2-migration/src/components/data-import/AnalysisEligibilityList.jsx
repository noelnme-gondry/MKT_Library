"use client";
import { formatEligibilityBlocker } from "@/lib/analysis-router/evaluateEligibility";

const COPY = {
  ko: { ready: "바로 가능", caution: "주의해서 가능", blocked: "추가 데이터 필요", exploratory: "탐색용 MMM", decision: "의사결정용 MMM", open: "분석 시작", title: "이 데이터로 먼저 볼 분석", more: "다른 분석 가능성 보기", rows: "행", periods: "기간", recommended: "추천", clear: "필수 구조가 확인됐습니다.", detail: "판정 세부 정보" },
  en: { ready: "Ready", caution: "Use with caution", blocked: "Needs more data", exploratory: "Exploratory MMM", decision: "Decision-ready MMM", open: "Open analysis", title: "Best analyses for this data", more: "See other analysis options", rows: "rows", periods: "periods", recommended: "Recommended", clear: "Required structure detected.", detail: "Decision details" },
};

const OUTCOME = {
  "5-2": { ko: "이번 주 성과·예산 속도·이상 신호", en: "Weekly performance, pacing, and anomalies" },
  "5-21": { ko: "성과 변화의 최대 원인과 증감액", en: "Largest performance driver and its impact" },
  "5-22": { ko: "캠페인별 증액 여력과 한계 효율", en: "Scale headroom and marginal efficiency" },
  "5-3": { ko: "채널별 증액·감액 예산 시나리오", en: "Channel-level budget move scenarios" },
  "5-4": { ko: "A/B 차이·신뢰구간·다음 판정", en: "A/B difference, interval, and next decision" },
  "5-18": { ko: "채널 기여·회귀·미래 예산 시나리오", en: "Channel contribution, regression, and forecast" },
  "5-23": { ko: "광고가 실제로 추가 만든 순증분", en: "Outcomes advertising truly added" },
};

function EligibilityCard({ result, getTitle, onOpen, locale, isRecommended = false }) {
  const T = COPY[locale] || COPY.ko;
  const outcome = OUTCOME[result.toolId]?.[locale] || OUTCOME[result.toolId]?.ko || getTitle(result.toolId);
  const isBlocked = result.status === "blocked";
  const reason = isBlocked
    ? formatEligibilityBlocker(result, locale)
    : result.recommendationReason || T.clear;
  const confidenceLabel = result.confidenceTier && result.confidenceTier !== "standard" ? T[result.confidenceTier] : null;
  const detail = result.reasonDetails?.join(" ");
  return <article className={`eligibility-card ${result.status}`}>
    <div className="eligibility-card__top">
      <span>{isRecommended ? T.recommended : result.toolId}</span>
      <em>{confidenceLabel || T[result.status]}</em>
    </div>
    <h3>{getTitle(result.toolId)}</h3>
    <p className="eligibility-card__outcome"><b>{locale === "en" ? "Answer" : "얻게 되는 답"}</b>{outcome}</p>
    <div className="eligibility-card__facts"><span>{result.rowCount.toLocaleString()} {T.rows}</span><span>{result.periodCount.toLocaleString()} {T.periods}</span></div>
    <p className="eligibility-card__reason">
      {reason}
      {!isBlocked && detail && <span className="data-confidence-hint" role="img" tabIndex={0} aria-label={T.detail} data-tooltip={detail}>ⓘ</span>}
    </p>
    {!isBlocked && <button className="btn primary" type="button" onClick={() => onOpen(result.toolId)}>{T.open}<span aria-hidden>→</span></button>}
  </article>;
}

export default function AnalysisEligibilityList({ results = [], getTitle, onOpen, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const available = results.filter((result) => result.status !== "blocked");
  const recommended = (available.length ? available : results).slice(0, 3);
  const recommendedIds = new Set(recommended.map((result) => result.toolId));
  const remaining = results.filter((result) => !recommendedIds.has(result.toolId));
  return (
    <section className="analysis-recommendations">
      <div className="analysis-recommendations__head"><span>DATA ROUTER</span><h2>{T.title}</h2></div>
      <div className="analysis-recommendations__grid">
        {recommended.map((result) => <EligibilityCard key={result.toolId} result={result} getTitle={getTitle} onOpen={onOpen} locale={locale} isRecommended />)}
      </div>
      {remaining.length > 0 && <details className="analysis-recommendations__more"><summary>{T.more} <span>{remaining.length}</span></summary><div className="analysis-recommendations__grid">{remaining.map((result) => <EligibilityCard key={result.toolId} result={result} getTitle={getTitle} onOpen={onOpen} locale={locale} />)}</div></details>}
    </section>
  );
}
