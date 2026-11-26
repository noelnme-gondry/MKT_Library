"use client";

import { useMemo, useState } from "react";
import CampaignScenario from "./CampaignScenario";
import PerformanceAlerts from "@/components/performance-alerts/PerformanceAlerts";
import { OperationsResults } from "@/components/tools/OperationsPlanner";
import { campaignExecutionInput } from "@/lib/operations/diagnosisBridge";

const filters = {};
export default function PlannerExecution({ rows, meta, report, locale }) {
  const input = useMemo(() => campaignExecutionInput(rows,meta),[rows,meta]);
  const [open,setOpen] = useState(false);
  const en = locale === "en";
  if (!input || report.status !== "ready") return <CampaignScenario {...{meta, report, locale}} />;
  return <section className="operations-planner">
    <h2>{en ? "Plan by campaign" : "캠페인별 집행 계획"}</h2>
    <p>{en ? "These estimates use campaign-level spend histories for the selected outcome. The diagnosis compares allocations across channels." : "선택한 성과를 기준으로 각 캠페인의 지출 이력에서 집행안을 계산합니다. 효율 진단의 예산 배분에서는 매체 사이에서 예산을 옮겼을 때를 비교할 수 있습니다."}</p>
    <button type="button" className="btn ghost" onClick={()=>setOpen(true)}>{en ? "Inspect inputs" : "계산 입력 확인"}</button>
    {report.budget.decision === "hold" && <p role="note">{en ? "The channel model supports keeping the current split. Campaign planning starts at a 0% change limit. Raise the limit to test a different scenario." : "매체별 예측 차이가 작아 현재 배분을 유지하는 안에서 시작합니다. 캠페인별 변경 한도를 높이면 다른 집행안을 비교할 수 있습니다."}</p>}
    <OperationsResults initialChangeLimit={report.budget.decision === "hold" ? 0 : .2} csvData={input.csv} sourceRows={input.rows} periods={report.periods} filter={filters} grain="auto"
      denomBasis={input.metric} currency={meta.currency} locale={locale} dataOpen={open} setDataOpen={setOpen} />
    <PerformanceAlerts locale={locale} plannerData={input.csv} />
  </section>;
}
