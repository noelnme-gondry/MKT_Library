"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { analyzeDiagnosis } from "@/lib/campaignDiagnosis";
import { loadDiagnosisExample } from "@/lib/diagnosisImport";
import { useAppStore } from "@/store/useDataStore";
import { trackDiagnosis } from "@/lib/trackDiagnosis";
import DiagnosisImport from "./DiagnosisImport";
import PlannerViews from "./PlannerViews";
import dynamic from "next/dynamic";
import CostScatter from "./CostScatter";
import ChannelPerformance from "./ChannelPerformance";
import DiagnosisExplanations from "./DiagnosisExplanations";
import { diagnosisFormat } from "./diagnosisFormat";
import s from "./DiagnosisWorkbench.module.css";

const Execution = dynamic(() => import("./PlannerExecution"));

function ExamplePreview({ locale }) {
  const [sample, setSample] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadDiagnosisExample(locale).then(({ rows, meta }) => {
      const report = analyzeDiagnosis(rows, meta);
      if (active) setSample({ report, meta });
    }).catch(() => { if(active) setFailed(true); });
    return () => { active = false; };
  }, [locale]);
  const en = locale === "en";
  const meta = sample?.meta;
  const scope = sample?.report.channels?.find((x) => x.name === "Meta");
  const fmt = diagnosisFormat(locale, meta?.currency);
  if (!scope || !scope.previous?.cost || !scope.previous?.result) return <aside className={s.preview} aria-label={en ? "Sample chart" : "예시 차트"}>
    <div className={s.previewTop}>{en ? "Example diagnosis" : "예시 진단"}</div>
    <h2>{en ? "Did the extra spend pay off?" : "더 쓴 광고비만큼 성과도 늘었을까요?"}</h2>
    <p className={s.previewState} role="status">{failed || sample ? (en ? "The sample chart is unavailable. Choose a CSV to see your own results." : "예시 차트를 표시할 수 없습니다. 내 CSV를 선택하면 진단을 진행할 수 있습니다.") : (en ? "Loading the example chart…" : "예시 차트를 불러오는 중입니다…")}</p>
  </aside>;
  const metrics = [
    { label: en ? "Spend" : "집행액", curr: scope.current.cost, prev: scope.previous.cost, format: fmt.money },
    { label: meta.resultLabel, curr: scope.current.result, prev: scope.previous.result, format: fmt.num },
  ];
  const max = Math.max(1, ...metrics.map((m) => m.curr/m.prev));
  return <aside className={s.preview} aria-label={en ? "Example diagnosis" : "예시 진단"}>
    <div className={s.previewTop}><span>{en ? "Example diagnosis" : "예시 진단"}</span><span>{scope.name} · {meta.currency}</span></div>
    <h2>{en ? "Did the extra spend pay off?" : "더 쓴 광고비만큼 성과도 늘었을까요?"}</h2>
    <div className={s.previewBars}>{metrics.map((m) => <div key={m.label}>
      <div className={s.barTitle}><span>{m.label}</span><strong>{m.curr >= m.prev ? "+" : ""}{fmt.percent(m.curr/m.prev-1)}</strong></div>
      <div className={s.barPair} role="img" aria-label={m.label+" "+m.format(m.prev)+" → "+m.format(m.curr)}>
        <i style={{width: (100/max)+"%"}} /><b style={{width:(100*m.curr/m.prev/max)+"%"}} /></div></div>)}</div>
    <div className={s.previewLegend}><span><i />{en ? "Previous week = 100" : "전주 = 100"}</span><span><b />{en ? "Current week" : "이번 주"}</span></div>
    <div className={s.previewBottom}><span>{en ? "Observed cost per additional result" : "추가 성과 1건당 관측 비용"}</span><strong>{fmt.money(scope.incrementalCpa)}</strong></div>
  </aside>;
}

export function hasComparableTotals(report) {
  return report.status === "ready" && [report.previous, report.current].every(
    period => Number.isFinite(period?.cost) && Number.isFinite(period?.result)
  );
}

function comparisonHeadline(report, en, fmt) {
  const curr = report.current?.cpa;
  const prev = report.previous?.cpa;
  if (!(prev > 0) || !Number.isFinite(curr)) return en ? "Compare campaign performance" : "두 기간의 광고 성과를 비교해 보세요";
  const change = (curr - prev) / prev;
  if (Math.abs(change) < .0001) return en ? "Overall CPA held steady" : "전체 CPA가 비교 기간과 같은 수준입니다";
  const direction = change > 0;
  return en ? "Overall CPA " + (direction ? "rose " : "fell ") + fmt.percent(Math.abs(change))
    : "전체 CPA가 비교 기간보다 " + fmt.percent(Math.abs(change)) + (direction ? " 올랐습니다" : " 낮아졌습니다");
}

function Evidence({ report, meta, locale, fmt, track, channelName, setChannelName, campaignName, setCampaignName }) {
  const en = locale === "en";
  const channels = [...report.channels].sort((a,b) => (Math.abs(b.deltaCost || 0) - Math.abs(a.deltaCost || 0)));
  const channel = channels.find((x) => x.name === channelName) || channels[0];
  const campaign = channel?.campaigns?.find((x) => x.name === campaignName);
  const entity = campaign || channel;
  if (!entity) return null;
  const resultLabel = meta.resultLabel || (en ? "Results" : "성과");
  const select = (c, item) => {
    setChannelName(c.name);
    setCampaignName(item?.name || null);
    track("evidence_open");
    if (window.matchMedia?.("(max-width: 900px)").matches) {
      requestAnimationFrame(() => document.getElementById("diagnosis-selected")?.focus());
    }
  };
  const hasCampaigns = (channel.campaigns || []).length > 0;
  return <section className={s.section} aria-labelledby="diagnosis-evidence">
    <header className={s.sectionHeader}><h2 id="diagnosis-evidence" tabIndex={-1}>{en ? "Where did the spend change?" : "어느 매체의 집행액이 달라졌나요?"}</h2>
      <p>{en ? "Select a channel or campaign to inspect its spend and outcomes." : "매체나 캠페인을 선택해 해당 집행액과 성과를 그래프에서 확인하세요."}</p></header>
    <div className={s.evidence}>
      <div className={s.entityList}><div className={s.tableScroll}><table><thead><tr><th scope="col">{en ? "Channel" : "매체"}</th><th scope="col">{en ? "Spend change" : "집행액 증감"}</th><th scope="col">{resultLabel} Δ</th></tr></thead>
        <tbody>{channels.map((c) => <tr key={c.name} data-picked={c.name === channel.name} onClick={() => select(c,null)}><th scope="row"><button type="button" aria-pressed={c.name === channel.name && !campaign} onClick={(e) => {e.stopPropagation(); select(c,null);}}>{c.name}<ChevronRight aria-hidden="true" size={14}/></button></th><td>{fmt.moneyDelta(c.deltaCost)}</td><td>{fmt.delta(c.deltaResult)}</td></tr>)}</tbody></table></div>
        {hasCampaigns && <div className={s.campaignList}><h3>{channel.name} · {en ? "Campaigns" : "캠페인"}</h3><div className={s.tableScroll}><table>
          <thead><tr><th scope="col">{en ? "Campaign" : "캠페인"}</th><th scope="col">{en ? "Spend change" : "집행액 증감"}</th><th scope="col">{resultLabel} Δ</th></tr></thead>
          <tbody>{channel.campaigns.map((c) => <tr key={c.name} data-picked={campaign?.name === c.name} onClick={() => select(channel,c)}>
          <th scope="row"><button type="button" aria-pressed={campaign?.name === c.name} onClick={(e) => {e.stopPropagation();select(channel,c);}}>{c.name}<ChevronRight aria-hidden="true" size={14}/></button></th><td>{fmt.moneyDelta(c.deltaCost)}</td><td>{fmt.delta(c.deltaResult)}</td></tr>)}</tbody></table></div></div>}
      </div>
      <div className={s.detail} id="diagnosis-chart"><button type="button" className={s.returnToRows} onClick={() => document.getElementById("diagnosis-evidence")?.focus()}>{en ? "Choose another channel or campaign" : "다른 매체·캠페인 선택"}</button><h3 id="diagnosis-selected" tabIndex={-1}>{campaign ? channel.name+" / " : ""}{entity.name}</h3>
        <div className={s.metricPair}><div><span>{en ? "Average CPA in this period" : "분석 기간 평균 CPA"}</span><strong>{fmt.money(entity.current?.cpa)}</strong></div>
          <div><span>{en ? "Observed cost per extra result" : "추가 성과 1건당 관측 비용"}</span><strong>{fmt.money(entity.incrementalCpa)}</strong></div></div>
        {entity.effect === "no_result_gain" && <p>{en ? "Spend increased without additional results." : "집행액은 늘었지만 성과 건수는 늘지 않았습니다."}</p>}
        {entity.changes?.length > 0 && <p>{en ? "Recorded changes" : "기록한 변경"} · {entity.changes.join(" · ")}</p>}
        {entity.budgetChanges?.length > 0 && <ul className={s.warnings}>{entity.budgetChanges.map((a,i) => <li key={i}>{a.date} · {a.campaign} · {en?"Configured budget":"설정 예산"} {fmt.money(a.from)} → {fmt.money(a.to)}</li>)}</ul>}
        {entity.changeReviews?.length > 0 && <div className={s.changeReviews}><h4>{en?"Observed before and after a change":"변경 전후에 관측한 성과"}</h4>{entity.changeReviews.map((a,i) => <p key={i}><strong>{a.date} · {a.campaign}</strong><br/>{fmt.range(a.before)} → {fmt.range(a.after)}<br/>{en?"Spend":"집행액"} {fmt.moneyDelta(a.deltaCost)} · {resultLabel} {fmt.delta(a.deltaResult)} · CPA {fmt.money(a.before?.cpa)} → {fmt.money(a.after?.cpa)}{a.coincidesWithCreativeChange && <><br/>{en?"A creative change overlaps this window.":"같은 기간에 소재 변경이 관측됐습니다."}</>}</p>)}</div>}
        <CostScatter key={JSON.stringify([channel.name,campaign?.name])} entity={entity} locale={locale} fmt={fmt} currency={report.currency} target={meta.targetCpa} grain={meta.grain} resultLabel={resultLabel}/>
        <p className={s.note}>{en ? "When spend and results both rise, the increase in spend divided by the additional results gives the observed cost per extra result. Other changes that week can affect it." : "집행액과 성과가 함께 늘었을 때 늘어난 지출을 추가 성과로 나눴습니다. 같은 주에 바뀐 소재나 타기팅도 이 값에 영향을 줄 수 있습니다."}</p>
      </div>
    </div>
  </section>;
}

export function DiagnosisReport({ report, meta, locale, track }) {
  const en = locale === "en";
  const fmt = diagnosisFormat(locale, report.currency || meta.currency);
  const [openAction, setOpenAction] = useState(false);
  const [channelName,setChannelName] = useState(null);
  const [campaignName,setCampaignName] = useState(null);
  const current = report.current || {};
  const previous = report.previous || {};
  const ready = hasComparableTotals(report);
  const observed = report.status === "ready" || report.status === "insufficient";
  const target = meta.targetCpa;
  const driver = ready && Number.isFinite(previous.cpa) && Number.isFinite(current.cpa) && current.cpa > previous.cpa && report.pvm?.status === "ready" ? report.pvm.drivers?.[0] : null;
  const scope = [...(report.channels || [])].filter((x) => x.deltaCost > 0 && ((Number.isFinite(x.deltaResult) && x.deltaResult <= 0) || (target > 0 && x.incrementalCpa > target)))
    .sort((a,b) => b.deltaCost - a.deltaCost)[0];
  const deltaText = (a,b, f) => Number.isFinite(a) && Number.isFinite(b) ? f(b-a) : "—";
  const [pPrev,pCurr] = [report.periods?.previous,report.periods?.current];
  const metrics = [
    [en ? "Spend" : "총 집행액", fmt.money, previous.cost,current.cost,fmt.moneyDelta],
    [meta.resultLabel || (en ? "Results" : "성과"),fmt.num,previous.result,current.result,fmt.delta],
    [en ? "Average CPA" : "평균 CPA",fmt.money,previous.cpa,current.cpa,fmt.moneyDelta],
  ];
  return <div className={s.report}>
    <header className={s.summaryHeading}><h2 id="diagnosis-summary">{ready ? comparisonHeadline(report,en,fmt) : (en ? "Comparison on hold" : "비교에 필요한 정보를 확인해 주세요")}</h2>
      {pCurr?.start && <p>{en ? "Current" : "분석 기간"} {fmt.range(pCurr)}<br/>{en ? "Previous" : "비교 기간"} {fmt.range(pPrev)}</p>}</header>
    {observed && <div className={s.kpis}>{metrics.map(([label,f,prev,curr,sign]) => <div key={label}><h3>{label}</h3><strong>{f(curr)}</strong><span>{en ? "Previous" : "비교 기간"} {f(prev)} <b>{ready ? deltaText(prev,curr,sign) : ""}</b></span></div>)}</div>}
    {observed && <ChannelPerformance report={report} meta={meta} fmt={fmt} en={en} track={track}/>}
    {driver && <p className={s.driver}><span>{report.pvm.scope === "subset" ? (en ? "Included groups · largest upward contribution" : "분해 가능한 그룹 중 CPA 상승 기여 1위") : (en ? "Largest contribution to the CPA increase" : "전체 CPA 상승에 가장 크게 기여한 매체")}</span> <strong>{driver.name} · {fmt.moneyDelta(driver.contribution)}{en ? " per result" : "/건"}</strong>
      <button type="button" onClick={() => {setChannelName(driver.name);setCampaignName(null);track("evidence_open");requestAnimationFrame(() => document.getElementById("diagnosis-selected")?.focus());}}>{en?"Inspect observations":"관측 근거 보기"}<ArrowRight size={14} aria-hidden="true"/></button></p>}
    {!ready && <p>{report.status === "mixed" ? (en ? "Choose one currency, market and result definition for the comparison." : "하나의 통화·시장·성과 정의로 범위를 맞춘 파일을 선택해 주세요.") :
      (en ? "Check your dates and fields. A weekly comparison needs observations for both periods." : "날짜와 필드 매핑을 확인해 주세요. 비교 기간 비교에는 두 기간의 관측값이 필요합니다.")}</p>}
    {pCurr?.start && <p className={s.note}>{en ? "Observations · previous / current" : "실제 관측 수 · 비교 기간 / 분석 기간"} {pPrev.observedDays}/{pPrev.expectedDays} · {pCurr.observedDays}/{pCurr.expectedDays} {meta.grain==="weekly" ? (en?"weekly records":"주간 집계") : (en?"days":"일")}</p>}
    {(current.zeroCost > 0 || previous.zeroCost > 0) && <p className={s.note}>{en ? "Spend on zero-result records · previous / current" : "성과 0건인 행의 지출 · 비교 기간 / 분석 기간"} {fmt.money(previous.zeroCost)} / {fmt.money(current.zeroCost)}</p>}
    {[previous,current].some(period => Number.isFinite(period.coverage) && period.coverage < 1) && <p className={s.note}>{en?"Spend with a recorded outcome · previous / current":"성과가 기록된 행의 지출 비중 · 비교 기간 / 분석 기간"} {fmt.percent(previous.coverage)} / {fmt.percent(current.coverage)}</p>}
    {report.warnings?.length > 0 && <ul className={s.warnings}>{report.warnings.map((w) => <li key={w}>{diagnosisMessage(w,locale)}</li>)}</ul>}
    {observed && <Evidence channelName={channelName} setChannelName={setChannelName} campaignName={campaignName} setCampaignName={setCampaignName} report={report} meta={meta} fmt={fmt} locale={locale} track={track}/>}
    {report.status === "ready" && <>
      <DiagnosisExplanations report={report} fmt={fmt} locale={locale} meta={meta} track={track} />
      <section className={s.actions}><div><h2>{en ? "What should you check next?" : "다음 집행 전에 무엇부터 확인할까요?"}</h2>
        <p>{scope ? (en ? "Review the spend increase in " + scope.name + " first." : scope.name + "의 증액 결과부터 다시 보세요.") :
          report.budget?.decision === "hold" ? (en ? "Retain the current allocation and review it after more observations." : "현재 예산 배분을 유지하고 관측이 쌓인 뒤 다시 비교해 보세요.") : report.budget?.status === "ready" ? (en ? "Review the proposed shifts against your campaign constraints." : "예산 이동안을 실제 캠페인의 집행 제약과 대조해 보세요.") :
          (en ? "Compare the next week with the same result definition." : "다음 주에도 같은 성과 기준으로 비교해 보세요.")}</p></div>
        <button type="button" aria-expanded={openAction} aria-controls="diagnosis-action-note" onClick={() => {if(!openAction)track("action_open");setOpenAction(!openAction);}}>{en ? "Review next steps" : "검토할 액션 보기"}<ArrowRight size={16} aria-hidden="true"/></button>
        {openAction && <div id="diagnosis-action-note" className={s.actionNote}>
          {scope && <><p><strong>{scope.name}</strong> · {en?"Spend":"집행액"} {fmt.moneyDelta(scope.deltaCost)} · {meta.resultLabel} {fmt.delta(scope.deltaResult)}{Number.isFinite(scope.incrementalCpa) && <> · {en?"Observed extra cost per result":"추가 성과당 관측 비용"} {fmt.money(scope.incrementalCpa)}</>}{target > 0 && <> · {en?"Target CPA":"목표 CPA"} {fmt.money(target)}</>}</p>
            <button className={s.evidenceLink} type="button" onClick={() => {
              setChannelName(scope.name);setCampaignName(null);track("evidence_open");document.getElementById("diagnosis-selected")?.focus();
            }}>{en ? "Inspect "+scope.name+" observations" : scope.name+" 관측값 확인"}<ArrowRight size={15} aria-hidden="true"/></button></>}
          <p>{scope ? (en ? "Check for attribution lag and creative or targeting changes in this channel. If these are stable, test the next budget change on a limited group and compare results after the same reporting delay." : "이 매체에서 전환 집계가 늦어졌거나 소재·타기팅을 함께 바꿨는지 확인하세요. 조건이 비슷하다면 일부 캠페인에서 예산 조정을 시험하고, 같은 집계 지연 기간을 둔 뒤 성과를 비교하세요.") :
          (en ? "Record the campaign, date, change and expected result before adjusting spend. Compare observed CPA and total results after a full comparable period." : "예산을 바꾸기 전에 대상 캠페인, 변경일, 변경 내용과 기대 성과를 기록하세요. 같은 길이의 집행 기간이 지나면 실제 CPA와 총성과가 어떻게 달라졌는지 비교할 수 있습니다.")}</p></div>}</section>
    </>}
  </div>;
}

const warningText = {
  invalid_input:["날짜 형식, 집계 단위와 음수 입력을 확인하세요.","Check the date format, reporting grain and negative values."],
  mixed_currency:["서로 다른 통화가 한 파일에 포함돼 있습니다.","This file contains more than one currency."],
  incomplete_period:["두 비교 기간의 관측일이 완전하지 않습니다. 관측한 값만 표시합니다.","Some observation dates are missing; only available values are shown."],
  missing_metrics:["비용 또는 성과가 비어 있는 집계는 대시로 표시했습니다.","Totals with missing spend or results appear as a dash."],
};
function diagnosisMessage(message, locale) {
  if (warningText[message]) return warningText[message][locale === "en" ? 1 : 0];
  return typeof message === "object" ? message?.[locale] || message?.message || "" : String(message || "");
}

export default function DiagnosisWorkbench({ locale = "ko", initialExample = false, shared = false, onEdit }) {
  const en = locale === "en";
  const [local, setLocal] = useState(null);
  const session = useAppStore(s => shared ? s.plannerSession : null);
  const generation = useAppStore(s => shared ? s.plannerGeneration : 0);
  const dataset = shared ? session : local;
  const update = useCallback(next => {
    if (shared) useAppStore.setState({plannerSession:next});
    else setLocal(next);
  },[shared]);
  const revision = dataset?.revision ?? 0;
  const onData = useCallback((rows,meta,form) => {
    const report = analyzeDiagnosis(rows,meta);
    update({rows,report,meta,form,revision:revision+1});
    trackDiagnosis(hasComparableTotals(report) ? "result_view" : "result_blocked",meta.source === "example" ? "demo" : "upload",locale);
  }, [locale, update, revision]);
  const onReset = useCallback(() => { onEdit?.(); update(null); },[update,onEdit]);
  const track = (step) => trackDiagnosis(step,dataset.meta.source === "example" ? "demo" : "upload",locale);
  return <div className={s.workbench}>
    <div className={dataset ? s.activeHead : s.intro}>
      <div className={s.introCopy}>{!dataset && <strong>{en ? "Operations planner" : "운영 플래너"}</strong>}<h1>{dataset ? (en ? "Operations planner" : "운영 플래너") :
        (en ? <>Find where your<br/>ad spend loses efficiency.</> : <>광고비, 어디에서<br/>비효율이 생겼을까요?</>)}</h1>
        {!dataset && <p>{en ? "Compare last week with this week in one CSV. See which channels spent more, what changed your CPA and where to test a budget shift." : "광고 데이터 CSV 한 장으로 지난주와 이번 주를 비교하세요. 어느 매체에서 광고비가 늘었고, 그만큼 성과가 따라왔는지 살펴볼 수 있습니다."}</p>}
        <DiagnosisImport key={generation} restored={dataset?.form} locale={locale} initialExample={initialExample} onData={onData} onReset={onReset}/>
        {!dataset && <p className={s.requirements}>{en ? "Prepare dates, channel or campaign, spend and a count of one outcome. Include last week and this week." : "지난주와 이번 주의 날짜, 매체나 캠페인, 집행액, 비교할 성과 건수를 준비해 주세요."}</p>}
      </div>
      {!dataset && <ExamplePreview locale={locale}/>}
    </div>
    {dataset && <PlannerViews key={dataset.revision} locale={locale}
      diagnosis={<DiagnosisReport report={dataset.report} meta={dataset.meta} locale={locale} track={track}/>}
      execution={<Execution {...dataset} locale={locale} />} />}
  </div>;
}
