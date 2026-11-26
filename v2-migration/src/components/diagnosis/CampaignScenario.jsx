"use client";

import { useMemo, useState } from "react";
import { diagnosisBudget } from "@/lib/campaignDiagnosisBudget";
import { diagnosisFormat } from "./diagnosisFormat";

export default function CampaignScenario({ meta, report, locale }) {
  const en = locale === "en";
  const [limit, setLimit] = useState(20);
  const fmt = diagnosisFormat(locale, meta.currency);
  const campaigns = useMemo(() => report.channels.flatMap(channel =>
    channel.campaigns.map(campaign => ({...campaign, name: channel.name + " / " + campaign.name}))
  ), [report.channels]);
  const complete = report.status === "ready" && Math.abs(campaigns.reduce((sum,c)=>sum+(c.current.cost ?? 0),0) - report.current.cost) < 1e-6;
  const plan = diagnosisBudget(campaigns, report.current, {
    grain:meta.grain, currency:meta.currency, days:report.periods.current.expectedDays,
    complete, changeLimit:limit/100,
  });
  return <section><h2>{en ? "Campaign budget scenario" : "캠페인별 예산 시나리오"}</h2>
    <p>{en ? "Outcome" : "선택한 성과"} · {meta.resultLabel}</p>
    <label>{en ? "Maximum change per campaign" : "캠페인별 예산 변경 한도"} <select value={limit} onChange={e=>setLimit(Number(e.target.value))}>
      {[0,10,20,30].map(n=><option key={n} value={n}>±{n}%</option>)}</select></label>
    {plan.status === "ready" ? <>
      <p>{plan.decision === "hold" ? (en ? "Keep the current allocation." : "현재 배분을 유지하세요.") : (en ? "Test the proposed split on a small scale." : "제안한 배분을 작은 규모에서 검증해 보세요.")}</p>
      <p>{en ? "Fixed budget" : "동일 총예산"} {fmt.money(plan.totalCost)} · {meta.resultLabel} {fmt.num(plan.currentResult)} → {fmt.num(plan.proposedResult)}</p>
      <div style={{overflowX:"auto"}}><table><thead><tr><th>{en?"Campaign":"캠페인"}</th><th>{en?"Current budget":"현재 예산"}</th><th>{en?"Scenario budget":"시나리오 예산"}</th><th>{en?"Expected change":"예상 성과 증감"}</th></tr></thead>
        <tbody>{plan.rows.map(r=><tr key={r.name}><th scope="row">{r.name}</th><td>{fmt.money(r.currentCost)}</td><td>{fmt.money(r.proposedCost)}</td><td>{fmt.delta(r.proposedResult-r.currentResult)}</td></tr>)}</tbody></table></div>
    </> : <p role="status">{en ? "Estimate withheld. A comparison needs two active campaigns, a consistent spend and outcome history, and sufficient variation to validate the response to spend." : "배분 추정을 보류합니다. 두 개 이상 캠페인의 비용과 성과를 같은 기간에 관측하고, 집행액을 바꿨을 때의 반응을 검증할 만큼 이력이 쌓여야 합니다."}</p>}
  </section>;
}
