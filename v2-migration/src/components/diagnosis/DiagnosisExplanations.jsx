"use client";

import { useId, useState } from "react";
import s from "./DiagnosisWorkbench.module.css";

const labels = {
  ko: ["예산 배분", "CPA 분해", "소재", "오가닉"],
  en: ["Budget allocation", "CPA drivers", "Creative", "Organic"],
};
const budgetReasons = {
  coverage:["동일 기간의 매체별 비용과 성과가 필요합니다. 집계 단위를 맞추고 누락된 기간을 확인하세요.","The comparison needs spend and outcomes for each channel at a consistent reporting grain. Check for missing periods."],
  channels:["집행 중인 매체가 두 곳 이상이어야 같은 총액을 재배분할 수 있습니다.","A fixed-budget comparison needs at least two active channels."],
  validation:["지출 변동 폭, 관측 기간 또는 검증 오차가 배분안을 제시할 기준에 도달하지 않았습니다.","The observed spend range, history or holdout accuracy is insufficient to support an allocation."],
  constraints:["허용된 집행 범위 안에서 같은 총액의 배분안을 만들 수 없습니다.","The allocation cannot preserve total spend within the allowed ranges."],
  uncertain_gain:["예상 성과 증가가 검증 오차보다 작습니다. 현재 데이터만으로 배분 변경을 권하기 어렵습니다.","The estimated gain does not exceed validation error. This history gives no clear basis for reallocating spend."],
};
function Metrics({ items }) {
  return <dl className={s.metricList}>{items.map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
function ReadTable({ headers, rows, caption }) {
  return <div className={s.tableScroll}><table><caption className={s.tableCaption}>{caption}</caption><thead><tr>{headers.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(([name,...rest],index) => <tr key={index}><th scope="row">{name}</th>{rest.map((v,i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>;
}
function Budget({ report: {budget:b},fmt,en }) {
  if(b.status !== "ready") return <><h3>{en ? "Hold the current allocation for review" : "현재 배분은 변경 판단을 보류합니다"}</h3><p>{(budgetReasons[b.reasonCode || b.reason] || budgetReasons.validation)[en ? 1 : 0]}</p>
    {Number.isFinite(b.validationError) && <p>{en ? "Holdout error" : "검증 구간 오차"} · {fmt.percent(b.validationError)}</p>}</>;
  return <><h3>{en ? "What could the same budget deliver?" : "같은 예산으로 성과를 더 낼 수 있을까요?"}</h3>
    <p>{en ? "Compare both allocations using the same response model. These are estimates within the observed spending range." : "각 매체에서 실제로 집행해 본 범위 안에서 예산을 옮겼습니다. 현재 배분과 제안 배분 모두 같은 반응 모형으로 추정한 결과입니다."}</p>
    <Metrics items={[[en?"Fixed total spend":"두 안의 총예산",fmt.money(b.totalCost)],[en?"Expected results":"예상 성과",fmt.num(b.currentResult)+" → "+fmt.num(b.proposedResult)],[en?"Expected CPA":"예상 CPA",fmt.money(b.currentCpa)+" → "+fmt.money(b.proposedCpa)]]}/>
    {b.decision === "hold" && <p><strong>{en?"Keep the current allocation.":"현재 배분을 유지하세요."}</strong> {en?"The estimated gain is within one additional result or the holdout error.":"예상 증가분이 성과 한 건 또는 검증 오차 이내입니다."}</p>}
    <ReadTable caption={en?"Allocation scenario by channel":"매체별 예산 이동 시나리오"} headers={[en?"Channel":"매체",en?"Current → proposed spend":"현재 → 제안 예산",en?"Spend change":"예산 증감",en?"Expected result change":"예상 성과 증감",en?"Marginal CPA¹":"한계 CPA¹", en?"Allowed spend range":"허용 예산 범위"]}
      rows={b.rows.map(r => [r.name,fmt.money(r.currentCost)+" → "+fmt.money(r.proposedCost),fmt.moneyDelta(r.proposedCost-r.currentCost),fmt.delta(r.proposedResult-r.currentResult),fmt.money(r.marginalCpa),fmt.money(r.minSpend)+" – "+fmt.money(r.maxSpend)])}/>
    <p className={s.note}>{en?"¹ Spend difference divided by the modeled result difference over each proposed shift. Holdout error":"¹ 매체별 예산 변경액을 해당 구간의 예상 성과 변화로 나눈 값입니다. 검증 구간 오차"} · {fmt.percent(b.validationError)}</p></>;
}
function ContributionPlot({p,fmt,en}) {
  const rows = p.contributions || [];
  if(!rows.length) return null;
  const magnitude = rows.reduce((max,row) => Math.max(max, Math.abs(row.contribution)),0);
  return <figure className={s.contribution}><figcaption><strong>{en?"How much did each channel contribute?":"각 매체가 CPA 변화에 얼마나 기여했나요?"}</strong>
    <span>{p.scope === "subset" ? (en?"Included groups only":"분해 가능한 그룹 기준") : (en?"All included channels":"전체 매체 기준")} · {en?"Cost per result. Left lowers CPA, right raises CPA.":"성과 1건당 비용. 왼쪽은 CPA 하락, 오른쪽은 상승입니다."}</span></figcaption>
    <ul>{rows.map(row => <li key={row.name}><span>{row.name}</span>
      <div className={s.contribBar} aria-hidden="true"><i data-negative={row.contribution < 0} style={{width:(magnitude > 0 ? 50*Math.abs(row.contribution)/magnitude : 0)+"%"}}/></div><b>{fmt.moneyDelta(row.contribution)}</b>
    </li>)}</ul></figure>;
}
function Mix({ report:{pvm:p},fmt,en }) {
  return <><h3>{en?"Why did overall CPA change?":"전체 CPA는 왜 변했나요?"}</h3>
    {p.status !== "ready" ? <p>{en?"Comparable spend and positive results across both periods are required to decompose CPA.":"양쪽 기간의 비용과 비교 가능한 유효 성과가 있어야 CPA 변화를 분해할 수 있습니다."}</p> : <>
    <p>{en?"The mix component reflects which channels and campaigns supplied the results. The rate component reflects changes in cost per result inside those groups.":"성과 건수가 어느 매체·캠페인에 몰렸는지와, 같은 그룹 안에서 건당 단가가 어떻게 바뀌었는지를 나눠 봅니다."}</p>
    <Metrics items={[[en?"Mix · result shares":"구성 효과 · 성과 비중",fmt.moneyDelta(p.mix)],[en?"Rate · within-group CPA":"단가 효과 · 그룹 내 CPA",fmt.moneyDelta(p.rate)],[en?"Groups entering":"관측에 새로 들어온 그룹",fmt.moneyDelta(p.entry)],[en?"Groups exiting":"관측에서 빠진 그룹",fmt.moneyDelta(p.exit)]]}/>
    <ContributionPlot p={p} fmt={fmt} en={en}/>
    <p>{en?"CPA of included groups":"분해 대상의 CPA"} · {fmt.money(p.baselineCpa)} → {fmt.money(p.currentCpa)} ({fmt.moneyDelta(p.delta)})</p>
    {(p.excludedCost>0 || p.excludedPreviousCost>0) && <p className={s.note}>{en?"Excluded spend · previous / current":"분해 제외 지출 · 비교 기간 / 분석 기간"} {fmt.money(p.excludedPreviousCost)} / {fmt.money(p.excludedCost)}</p>}</>}</>;
}
function scopeInstruction(en) {
  return en ? "In Edit mapping, select one market and platform to compare a consistent population." : "열 연결 수정에서 시장과 플랫폼을 하나씩 고르면 같은 모집단의 수치를 비교할 수 있습니다.";
}
function Organic({ report:{organic:o},fmt,en,meta }) {
  return <><h3>{en?"Did paid and organic results move in opposite directions?":"유료 성과가 늘 때 오가닉은 줄었나요?"}</h3>
    {o.status !== "ready" ? <p>{(o.reason === "mixed_scope" || meta?.supplementalScopeHeld) ? scopeInstruction(en) : o.conflict ? (en?"Some market totals disagree for the same date. Reconcile those totals first.":"같은 날짜·시장의 오가닉 합계가 행마다 다릅니다. 합계를 먼저 대조해 주세요.") :
      (en?"Include a market-level organic total for each observation date using the same outcome definition as paid results.":"유료와 같은 성과 기준으로 날짜·시장별 오가닉 합계를 추가해 주세요.")}</p> :
    <><Metrics items={[[en?"Spend change":"집행액 증감",fmt.moneyDelta(o.costDelta)],[en?"Organic · previous → current":"오가닉 · 비교 기간 → 분석 기간",fmt.num(o.previous)+" → "+fmt.num(o.current)],[en?"Paid change":"유료 성과 증감",fmt.delta(o.paidDelta)],[en?"Paid + organic change":"유료 + 오가닉 순증감",fmt.delta(o.totalDelta)]]}/>
    {o.costUpOrganicDown && <p>{en?"Spend rose while organic results fell in this period.":"이번 주에는 집행액이 늘어난 동안 오가닉 성과가 줄었습니다."}</p>}
    {Number.isFinite(o.previousOrganicChange) && <p>{en?"Organic change · preceding week vs. current week":"오가닉 증감 · 앞선 주와 이번 주"} {fmt.delta(o.previousOrganicChange)} / {fmt.delta(o.organicDelta)}</p>}
    {o.lags?.length > 0 && <ReadTable caption={en?"Does the pattern persist with a delay? Correlation of week-over-week changes in spend and subsequent organic outcomes.":"지출 변화 뒤에도 같은 경향이 이어지나요? 집행액의 전주 대비 증감과 시차를 둔 오가닉 증감의 상관계수입니다."} headers={[en?"Delay":"시차",en?"Paired observations":"관측 쌍",en?"Correlation":"상관계수"]} rows={o.lags.map(r => [r.days+(en?" days":"일"),fmt.num(r.n),fmt.num(r.correlation)])}/>}
    <p>{o.exclusive ? (en?"Total change combines mutually exclusive paid and organic outcomes. Opposing trends alone cannot establish cannibalization; compare with a holdout or controlled market.":"유료와 오가닉의 귀속이 겹치지 않는다는 조건에서 총성과를 합산했습니다. 두 값이 반대로 움직였다면 통제 시장이나 홀드아웃의 변화를 비교해 잠식 가능성을 검토하세요.") :
      (en?"Confirm paid and organic attribution does not overlap before adding the two. Opposing changes can have other causes.":"유료·오가닉 귀속이 겹치지 않는지 확인해야 순증감을 계산할 수 있습니다. 두 값이 반대로 움직여도 원인은 따로 확인해야 합니다.")}</p></>}</>;
}
function Creative({ report:{creative:c},fmt,en }) {
  const groups = [[en?"Newly observed":"새로 관측",c.entered],[en?"No longer observed":"분석 기간 미관측",c.exited],[en?"Continuing":"계속 관측",c.continuing]];
  return <><h3>{en?"Which creatives changed or showed signs of fatigue?":"어떤 소재가 바뀌었고 피로 신호가 있었나요?"}</h3>
    {c.status !== "ready" ? <p>{en?"Add a creative ID to every campaign observation. Fatigue checks also require daily impressions and clicks.":"비교할 캠페인의 각 행에 소재 ID를 연결해 주세요. 피로 신호를 보려면 일별 노출과 클릭도 필요합니다."}</p> :
      <><ReadTable caption={en?"Creative changes across both periods":"두 기간의 소재별 관측 변화"} headers={[en?"Creative / channel":"소재 / 매체",en?"Status":"구분",en?"Spend · previous → current":"집행액 · 비교 기간 → 분석 기간",en?"Results · previous → current":"성과 · 비교 기간 → 분석 기간"]}
        rows={groups.flatMap(([status,rows]) => rows.map(r => [r.name + " / " + [r.channel,r.campaign].filter(Boolean).join(" · "),status,fmt.money(r.previous.cost)+" → "+fmt.money(r.current.cost),fmt.num(r.previous.result)+" → "+fmt.num(r.current.result)]))}/>
      <h4>{en?"Fatigue signals":"소재 피로 신호"}</h4>
      {c.fatigue.length ? <ReadTable caption={en?"Creatives with falling CTR and rising CPA at similar spend":"비슷한 집행액에서 CTR이 하락하고 CPA가 상승한 소재"} headers={[en?"Creative":"소재","CTR","CPA",en?"Frequency":"노출 빈도"]}
        rows={c.fatigue.map(r => [r.channel+" / "+r.name,fmt.percent(r.previousCtr)+" → "+fmt.percent(r.currentCtr),fmt.money(r.previous.cpa)+" → "+fmt.money(r.current.cpa),fmt.num(r.previousFrequency)+" → "+fmt.num(r.currentFrequency)])}/> :
        <p>{en?"No qualifying fatigue signal. Detection needs sufficient daily impressions, clicks and history at comparable spend.":"판정 조건을 충족한 소재 피로 신호가 없습니다. 비슷한 지출 수준에서 양쪽 기간의 일별 노출·클릭 이력이 충분해야 확인할 수 있습니다."}</p>}</>}</>;
}
const panels = [Budget,Mix,Creative,Organic];
export default function DiagnosisExplanations({ locale,track,...props }) {
  const [index,setIndex] = useState(0);
  const group = useId();
  const names = labels[locale] || labels.ko;
  const Panel = panels[index];
  const select = (n) => { setIndex(n); if(n !== index)track("evidence_open"); };
  return <section className={s.section}><header className={s.sectionHeader}><h2>{locale==="en"?"What explains the change?":"무엇이 달라졌는지 더 살펴보세요"}</h2></header>
    <div className={s.tabs} role="tablist" aria-label={locale==="en"?"Diagnostic breakdowns":"진단 항목"}>{names.map((name,i) =>
      <button type="button" key={name} role="tab" id={group+"-tab-"+i} aria-controls={group+"-panel-"+i} aria-selected={i===index} tabIndex={i===index?0:-1}
        onClick={() => select(i)} onKeyDown={(e) => {let next;if(e.key==="ArrowRight")next=(i+1)%names.length;else if(e.key==="ArrowLeft")next=(i+names.length-1)%names.length;else if(e.key==="Home")next=0;else if(e.key==="End")next=names.length-1;else return;e.preventDefault();select(next);e.currentTarget.parentElement.children[next].focus();}}>{name}</button>)}</div>
    {names.map((name,i) => <div key={name} role="tabpanel" hidden={i!==index} id={group+"-panel-"+i} aria-labelledby={group+"-tab-"+i} className={s.explain} tabIndex={0}>{i===index && <Panel {...props} en={locale==="en"}/>}</div>)}
  </section>;
}
