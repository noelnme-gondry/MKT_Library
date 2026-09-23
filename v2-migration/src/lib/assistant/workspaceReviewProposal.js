import { serializeDecisionPlan } from "@/lib/decisionPlan";

// Proposals reuse computed evidence. Targets are editable operating benchmarks,
// never an effect estimate or a statistical decision threshold.
export function workspaceReviewProposal(result, locale = "ko", currency = "") {
  if (result?.status !== "success" || !result.verdict?.action) return null;
  const en = locale === "en";
  const proposal = { conclusion: result.verdict.headline, action: result.verdict.action };
  if (!["5-2", "5-21"].includes(result.toolId)) return proposal;
  const stats = result.verdict.stats || [];
  const unitCost = result.visualizations?.find(item => item.id === "dashboard-period-comparison")?.data
    ?.find(row => /^(cpa|cpi)$/i.test(row.metric));
  const prior = result.toolId === "5-21" ? stats.find(stat => stat.id === "prior-unit-cost")?.value : unitCost?.prior;
  const recent = result.toolId === "5-21" ? stats.find(stat => stat.id === "recent-unit-cost")?.value : unitCost?.recent;
  if (!Number.isFinite(prior) || !Number.isFinite(recent) || prior <= 0 || recent <= 0) return proposal;
  const metric = result.toolId === "5-21" ? (result.manifest.resultField === "actions" ? "CPA" : "CPI") : unitCost.metric.toUpperCase();
  const driver = result.visualizations?.find(item => item.id === "pvm-channel-contributions")?.data
    ?.filter(row => Number.isFinite(row.contribution))
    .reduce((largest, row) => !largest || Math.abs(row.contribution) > Math.abs(largest.contribution) ? row : largest, null);
  const target = Math.min(prior, recent);
  const metricLabel = `${en ? "Overall" : "전체"} ${metric}`;
  const windowDays = result.manifest.periodDays || result.manifest.windowDays || 7;
  return {
    ...proposal,
    actionTarget: driver?.entity || (en ? "Current analysis scope" : "현재 분석 범위"),
    metric: metricLabel,
    goalMetric: metric.toLowerCase(),
    targetDirection: "lower",
    goalDirection: "down",
    baseline: String(recent),
    comparisonWindowDays: windowDays,
    reviewQuestion: en ? `After the action, did overall ${metric} stay at or below the observed benchmark? Check outcome volume alongside cost.` : `실행 후 전체 ${metric}가 관측 기준 이하로 유지됐나요? 성과 건수도 함께 비교하세요.`,
    reviewPlan: currency ? serializeDecisionPlan({ method: "observe", mode: "at_most", value: String(target), baseline: String(recent), unit: currency, target: en ? "Current analysis scope" : "현재 분석 범위", metric: metricLabel, window: en ? `Next ${windowDays} complete days` : `다음 ${windowDays}개 완결일` }) : "",
  };
}
