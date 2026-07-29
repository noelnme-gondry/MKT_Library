// 운영 대시보드의 "먼저 볼 3가지" 추천. 준비도/신뢰도는 자격 조건으로 먼저
// 확인하고, 통과한 뷰는 지금 실행할 수 있는 조치의 명확성(actionability) 순으로
// 정렬한다. 관측 요약을 인과 판정처럼 말하지 않으며, 동일 입력에는 동일 순서를 낸다.

const TAB_COPY = {
  viz: { ko: "시각화", en: "Visualization" },
  scorecard: { ko: "스코어카드", en: "Scorecard" },
  pacing: { ko: "페이싱", en: "Pacing" },
  anomaly: { ko: "이상탐지", en: "Anomaly detection" },
  seasonality: { ko: "시즈널리티", en: "Seasonality" },
  ltv: { ko: "LTV & ROAS", en: "LTV & ROAS" },
  cohort: { ko: "코호트 분석", en: "Cohort analysis" },
  funnel: { ko: "퍼널 진단", en: "Funnel diagnosis" },
  segment: { ko: "세그먼트", en: "Segment" },
};

const PERFORMANCE_TABS = ["viz", "scorecard", "pacing", "anomaly", "seasonality", "ltv", "cohort", "funnel", "segment"];
const CONTENT_TABS = ["viz", "scorecard", "anomaly"];
const STABLE_ORDER = ["funnel", "ltv", "cohort", "anomaly", "pacing", "segment", "seasonality", "scorecard", "viz"];
const SIG = 0.05;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deltaOf(metricRows, key) {
  return metricRows.find((item) => item.key === key)?.wow ?? null;
}

function pct(delta) {
  if (delta == null || !Number.isFinite(delta)) return null;
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${(Math.abs(delta) * 100).toFixed(1)}%`;
}

function confidenceForDays(days) {
  if (days >= 28) return "high";
  if (days >= 14) return "medium";
  return "low";
}

function confidenceCopy(confidence, locale) {
  const copy = {
    high: ["신뢰도 높음", "High confidence"],
    medium: ["신뢰도 보통", "Moderate confidence"],
    low: ["신뢰도 낮음", "Low confidence"],
  };
  return copy[confidence][locale === "en" ? 1 : 0];
}

function signalScore(delta, direction = "either") {
  if (delta == null) return 0;
  const isExpected = direction === "down" ? delta < -SIG : direction === "up" ? delta > SIG : Math.abs(delta) >= SIG;
  return isExpected ? clamp(Math.round(Math.abs(delta) * 180), 12, 70) : 0;
}

function reasonFor(tab, { locale, dCost, dEff, dConv, dRoas, dRet, days, snapshotConfidence }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (tab === "funnel") {
    if (dConv != null && dConv < -SIG) return tr(`전환량이 ${pct(dConv)} 변했습니다. 어느 단계가 약해졌는지 확인하세요.`, `Conversions changed ${pct(dConv)}. Check which stage weakened.`);
    if (dEff != null && dEff > SIG) return tr(`효율 비용이 ${pct(dEff)} 올랐습니다. 퍼널 단계별 이탈을 확인하세요.`, `Efficiency cost rose ${pct(dEff)}. Check drop-off by funnel stage.`);
    return tr("퍼널 단계별 전환율을 확인해 다음 개선 지점을 정하세요.", "Check conversion by funnel stage to choose the next improvement point.");
  }
  if (tab === "ltv") {
    if (dRoas != null && dRoas < -SIG) return tr(`ROAS가 ${pct(dRoas)} 변했습니다. 회수 속도와 LTV:CAC를 확인하세요.`, `ROAS changed ${pct(dRoas)}. Check payback speed and LTV:CAC.`);
    return tr("단기 매출과 장기 회수의 차이를 확인하세요.", "Compare short-term revenue with long-term payback.");
  }
  if (tab === "cohort") {
    if (dRet != null && dRet < -SIG) return tr(`D7 리텐션이 ${pct(dRet)} 변했습니다. 최근 코호트를 비교하세요.`, `D7 retention changed ${pct(dRet)}. Compare recent cohorts.`);
    return tr(`마감된 코호트만 사용합니다 · ${snapshotConfidence === "high" ? "기준일 확인됨" : "기준일 추정"}.`, `Uses matured cohorts only · snapshot ${snapshotConfidence === "high" ? "confirmed" : "estimated"}.`);
  }
  if (tab === "anomaly") {
    if (dEff != null && Math.abs(dEff) >= SIG) return tr(`효율 지표가 ${pct(dEff)} 변했습니다. 일자별 급변 여부를 확인하세요.`, `The efficiency metric changed ${pct(dEff)}. Check for day-level spikes.`);
    if (dCost != null && Math.abs(dCost) >= SIG) return tr(`지출이 ${pct(dCost)} 변했습니다. 일자별 급변 여부를 확인하세요.`, `Spend changed ${pct(dCost)}. Check for day-level spikes.`);
    return tr("일자별 급변을 먼저 확인해 운영 이슈를 빠르게 걸러내세요.", "Check day-level spikes first to rule out operating issues quickly.");
  }
  if (tab === "pacing") {
    if (dCost != null && Math.abs(dCost) >= SIG) return tr(`지출이 ${pct(dCost)} 변했습니다. 이번 달 소진 속도를 확인하세요.`, `Spend changed ${pct(dCost)}. Check this month’s pacing.`);
    return tr("이번 달 누적 소진과 월말 착지를 확인하세요.", "Check month-to-date spend and projected landing.");
  }
  if (tab === "segment") return tr("채널·국가·OS별로 차이를 나눠 다음 점검 대상을 좁히세요.", "Split results by channel, country, and OS to narrow the next check.");
  if (tab === "seasonality") return tr(`최소 1년 데이터(${days}일)를 바탕으로 계절성을 확인하세요.`, `Use at least one year of data (${days} days) to check seasonality.`);
  if (tab === "scorecard") return tr("핵심 지표를 한 화면에서 확인하고 기준선을 잡으세요.", "Review core metrics in one place to establish a baseline.");
  return tr("전체 추이를 먼저 확인한 뒤 필요한 진단으로 이동하세요.", "Review the overall trend, then move to the needed diagnostic.");
}

/**
 * @param {{ verdict?: object, mapping?: object, domain?: "performance"|"content", locale?: "ko"|"en" }} input
 * @returns {{recommendations: Array, additional: Array}}
 */
export function buildDashboardRecommendations({ verdict, mapping = {}, domain = "performance", locale = "ko" } = {}) {
  if (!verdict || verdict.insufficient) return { recommendations: [], additional: [] };
  const mapped = new Set(Object.values(mapping));
  const days = Number(verdict.days) || 0;
  const metricRows = verdict.metricRows || [];
  const dCost = deltaOf(metricRows, "cost");
  const dConv = deltaOf(metricRows, verdict.conversionKey || "inst");
  const dEff = deltaOf(metricRows, verdict.efficiencyKey || "cpi");
  const dRoas = deltaOf(metricRows, "roas");
  const dRet = deltaOf(metricRows, "ret");
  const dataConfidence = confidenceForDays(days);
  const snapshotConfidence = verdict.retentionSnapshot?.confidence || "low";
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const allowedTabs = domain === "content" ? CONTENT_TABS : PERFORMANCE_TABS;
  const candidates = [];
  const add = (tab, ready, confidence, actionability) => {
    if (!allowedTabs.includes(tab) || !ready || confidence === "low") return;
    candidates.push({
      tab,
      title: TAB_COPY[tab][locale === "en" ? "en" : "ko"],
      reason: reasonFor(tab, { locale, dCost, dEff, dConv, dRoas, dRet, days, snapshotConfidence }),
      confidence,
      confidenceLabel: confidenceCopy(confidence, locale),
      actionability,
      stableOrder: STABLE_ORDER.indexOf(tab),
    });
  };

  const hasDate = mapped.has("date") && days >= 2;
  const hasCoreMetric = ["cost", "impressions", "clicks", "installs", "actions"].some((key) => mapped.has(key));
  const hasEfficiency = mapped.has("cost") && (mapped.has("installs") || mapped.has("actions"));
  const hasFunnel = ["impressions", "clicks", "installs", "actions"].filter((key) => mapped.has(key)).length >= 3;
  const hasTrustedSnapshot = ["high", "medium"].includes(snapshotConfidence);
  const periodConfidence = confidenceForDays(days);
  const changeScore = Math.max(signalScore(dEff, "up"), signalScore(dConv, "down"));

  add("funnel", hasDate && hasFunnel && days >= 14, periodConfidence, 35 + changeScore);
  add("ltv", hasDate && mapped.has("cost") && mapped.has("revenue_d7") && days >= 14, periodConfidence, 28 + signalScore(dRoas, "down"));
  add("cohort", hasDate && mapped.has("ret_d7") && days >= 14 && hasTrustedSnapshot, snapshotConfidence === "high" && periodConfidence === "high" ? "high" : "medium", 26 + signalScore(dRet, "down"));
  add("anomaly", hasDate && hasCoreMetric && days >= 14, periodConfidence, 24 + Math.max(signalScore(dEff), signalScore(dCost), signalScore(dConv)));
  add("pacing", hasDate && mapped.has("cost") && days >= 7, periodConfidence, 20 + signalScore(dCost));
  add("segment", hasEfficiency && ["channel", "country", "platform"].some((key) => mapped.has(key)), dataConfidence, 18 + changeScore);
  add("seasonality", hasDate && days >= 365, "high", 16);
  add("scorecard", hasCoreMetric, dataConfidence, 10);
  add("viz", hasCoreMetric, dataConfidence, 8);

  // 신뢰도·준비도를 통과한 후보끼리만 행동 가능성을 우선한다. 동점일 때만
  // 신뢰도와 탭의 안정된 순서를 사용하여 같은 데이터에서 카드가 흔들리지 않게 한다.
  const confidenceRank = { high: 2, medium: 1, low: 0 };
  const ranked = candidates.sort((a, b) =>
    b.actionability - a.actionability ||
    confidenceRank[b.confidence] - confidenceRank[a.confidence] ||
    a.stableOrder - b.stableOrder
  );
  const recommendations = ranked.slice(0, 3).map((item, index) => ({ ...item, rank: index + 1 }));
  const recommendedTabs = new Set(recommendations.map((item) => item.tab));
  const additional = ranked.filter((item) => !recommendedTabs.has(item.tab));
  return { recommendations, additional, label: tr("데이터 준비도와 신뢰도를 통과한 뷰 중, 지금 할 행동이 가장 분명한 순서입니다.", "Among views that pass data readiness and confidence checks, these are ranked by the clearest action to take now.") };
}
