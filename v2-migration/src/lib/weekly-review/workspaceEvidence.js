import { deriveMetrics, sumRows } from "./snapshot";
import { LOWER_IS_BETTER } from "./significance";
import { csvBody } from "@/utils/download";

export function parseReviewTarget(value) {
  const raw = String(value ?? "").replaceAll(",", "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function targetGap(actual, target, direction) {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  const delta = actual - target;
  return { actual, target, delta, deltaPct: delta / target, met: direction === LOWER_IS_BETTER ? actual <= target : actual >= target };
}

const keyOf = row => JSON.stringify([row.channel || "", row.campaign]);
function values(row, basis) {
  if (!row) return null;
  const totals = sumRows([row]);
  return { ...deriveMetrics(totals, { basis }), cost: totals.cost, installs: totals.installs, revenue: totals.revenue };
}

// 스냅샷의 같은 캠페인끼리만 비교한다. 없던 캠페인의 과거 값을 0으로 보충하지 않는다.
export function buildWorkspaceEvidence(review, project) {
  if (!review?.ok) return null;
  const { metric, basis, direction } = project.kpi;
  const target = project.target?.value ?? null;
  const previous = new Map(review.previous.rows.map(row => [keyOf(row), row]));
  const current = new Map(review.current.rows.map(row => [keyOf(row), row]));
  const campaigns = [...new Set([...current.keys(), ...previous.keys()])].map(key => {
    const row = current.get(key) || previous.get(key);
    const now = values(current.get(key), basis);
    const before = values(previous.get(key), basis);
    const comparable = Number.isFinite(now?.[metric]) && Number.isFinite(before?.[metric]);
    const withoutResults = now?.cost > 0 && now.conversions === 0;
    return {
      key, label: row.channel ? `${row.channel} / ${row.campaign}` : row.campaign,
      current: now, previous: before,
      deltaPct: comparable && before[metric] !== 0 ? (now[metric] - before[metric]) / Math.abs(before[metric]) : null,
      status: !now ? "absent" : !before ? "new" : withoutResults ? "zero_results" : !comparable ? "unknown" : "comparable",
      withoutResults,
    };
  }).sort((a, b) => Number(b.withoutResults) - Number(a.withoutResults) || (b.current?.cost ?? -1) - (a.current?.cost ?? -1) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    metric, currency: project.currency, target,
    gap: targetGap(review.metrics.current[metric], target, direction),
    campaigns,
    currentCount: current.size, previousCount: previous.size,
    zeroResultSpend: campaigns.filter(row => row.withoutResults).reduce((sum, row) => sum + row.current.cost, 0),
    previousSource: review.previousSource,
  };
}

export function formatReviewMetric(value, metric, currency, locale = "ko") {
  if (!Number.isFinite(value)) return "—";
  if (metric === "roas") return `${(value * 100).toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 1 })}%`;
  const number = value.toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  if (["cpa", "cpi", "cost"].includes(metric)) return `${number}${currency ? ` ${currency}` : ""}`;
  return number;
}

export const CAMPAIGN_STATUS = {
  ko: { absent: "이번 기간 관측 없음", new: "이번 기간 첫 관측", zero_results: "지출 있으나 전환 0", unknown: "KPI 비교 불가", comparable: "전후 비교 가능" },
  en: { absent: "Not observed this period", new: "First observed this period", zero_results: "Spend with zero conversions", unknown: "KPI not comparable", comparable: "Comparable periods" },
};

export function campaignComparisonCsv(evidence, review, locale = "ko") {
  const en = locale === "en";
  // 사용자 캠페인명을 스프레드시트 수식으로 실행하지 않는다. 수치 셀은 보존한다.
  const campaignText = label => /^\s*[=+@-]/.test(label) ? `'${label}` : label;
  return csvBody(en
    ? ["Campaign", "Previous period", "Current period", "Currency", "KPI", "Previous spend", "Current spend", "Previous KPI", "Current KPI", "KPI change (ratio)", "Status"]
    : ["캠페인", "지난 기간", "이번 기간", "통화", "KPI", "지난 비용", "이번 비용", "지난 KPI", "이번 KPI", "KPI 변화율(배수)", "관측 상태"],
  evidence.campaigns.map(row => [campaignText(row.label), `${review.previous.period.start} ~ ${review.previous.period.end}`, `${review.current.period.start} ~ ${review.current.period.end}`, evidence.currency || "", evidence.metric.toUpperCase(), row.previous?.cost ?? "", row.current?.cost ?? "", row.previous?.[evidence.metric] ?? "", row.current?.[evidence.metric] ?? "", row.deltaPct ?? "", CAMPAIGN_STATUS[locale][row.status]]));
}

export function workspaceReportNotes(evidence, review, locale = "ko") {
  const en = locale === "en";
  const format = (value, metric = evidence.metric) => formatReviewMetric(value, metric, evidence.currency, locale);
  return [
    `${en ? "Review scope: campaigns (previous / current)" : "검토 범위: 캠페인 (지난 / 이번)"}: ${evidence.previousCount} / ${evidence.currentCount}`,
    `${en ? "Comparison data" : "비교 데이터"}: ${review.previousSource === "snapshot" ? (en ? "saved aggregate" : "저장 집계") : (en ? "both periods uploaded" : "두 기간 업로드")}`,
    evidence.gap ? `${en ? "KPI target / observed / gap" : "KPI 목표 / 관측 / 차이"}: ${format(evidence.gap.target)} / ${format(evidence.gap.actual)} / ${format(evidence.gap.delta)}` : "",
    en ? "Campaign observations (zero-conversion spend first, then current spend). This is a review order, not an allocation recommendation." : "캠페인 관측 (전환 없는 지출, 이번 지출 순). 검토 순서이며 예산 배분 추천이 아닙니다.",
    ...evidence.campaigns.map(row => `${row.label}: ${CAMPAIGN_STATUS[locale][row.status]}; ${en ? "spend" : "비용"} ${format(row.previous?.cost, "cost")} → ${format(row.current?.cost, "cost")}; ${evidence.metric.toUpperCase()} ${format(row.previous?.[evidence.metric])} → ${format(row.current?.[evidence.metric])}`),
  ].filter(Boolean);
}
