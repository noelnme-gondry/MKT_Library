import { buildOperationsDemo } from "./operationsDemo";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { prepareOperationsBrief, planOperationsBudget } from "./operationsBrief";

// 공개 미리보기는 사용자 상태를 읽지 않는다. 도구의 같은 가상 원본·기간·엔진으로 계산한다.
export function buildOperationsHomePreview(locale = "ko") {
  const data = buildOperationsDemo(locale);
  const periods = dashboardPeriods(data, {}, 7);
  const brief = prepareOperationsBrief({ rows: getMappedRows(data), periods, metric: "installs", mappedFields: Object.values(data.mapping) });
  const changeLimit = 0.2;
  const plan = planOperationsBudget(brief, { changeLimit, currency: data.currency });
  const byId = new Map(brief.campaigns.map(campaign => [campaign.id, campaign]));
  return {
    ...brief, dates: periods.dates, changeLimit, plan,
    historyDays: periods.dates.length,
    newCreatives: brief.creatives.filter(creative => creative.isNew),
    budgetMoves: plan.items.map(item => ({ id: item.id, name: byId.get(item.id).name, delta: item.budget - item.current })),
  };
}
