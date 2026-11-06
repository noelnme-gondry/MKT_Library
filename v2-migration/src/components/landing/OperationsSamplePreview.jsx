"use client";
import { useId, useMemo, useRef, useState } from "react";
import { buildOperationsHomePreview } from "@/lib/operations/operationsHomePreview";
import Link from "next/link";
import { OPERATIONS_PATH } from "@/lib/operations/operationsDemo";
import { OPERATION_ACTION_KINDS } from "@/lib/operations/actionContract";
import OperationsHomeTrend from "./OperationsHomeTrend";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

export default function OperationsSamplePreview({ locale = "ko" }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const sample = useMemo(() => buildOperationsHomePreview(locale), [locale]);
  const [campaignId, setCampaignId] = useState(sample.campaigns[0].id);
  const [fullHistory, setFullHistory] = useState(false);
  const [probeDate, setProbeDate] = useState(sample.periods.current.end);
  const campaign = sample.campaigns.find(row => row.id === campaignId) || sample.campaigns[0];
  const trend = useMemo(() => fullHistory ? campaign.trend : campaign.trend.slice(-28), [campaign, fullHistory]);
  const [view, setView] = useState("budget");
  const id = useId(), tabsRef = useRef(null);
  const views = [
    { id: "budget", label: tr("예산 액션", "Budget actions") },
    { id: "campaigns", label: tr("캠페인 근거", "Campaigns") },
    { id: "creatives", label: tr("새 소재 확인", "New creatives") },
    { id: "actions", label: tr("실행과 검토", "Follow-up") },
  ];
  const handleTabKey = (event, index) => {
    let target;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) target = (index + 1) % views.length;
    else if (["ArrowLeft", "ArrowUp"].includes(event.key)) target = (index + views.length - 1) % views.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = views.length - 1;
    if (target == null) return;
    event.preventDefault();
    setView(views[target].id);
    tabsRef.current.querySelectorAll('[role="tab"]')[target].focus();
  };
  const money = value => fmtCurrency(value, { currency: "KRW", precise: true });
  const change = sample.current.cpr / sample.previous.cpr - 1;
  const budgetMax = Math.ceil(Math.max(1, ...sample.budgetMoves.map(row => Math.abs(row.delta))) / 10000) * 10000;
  const date = index => sample.dates.at(index).slice(5).replace("-", ".");
  const pct = value => `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmtPct(Math.abs(value))}`;
  const tone = value => value > 0 ? "bad" : value < 0 ? "good" : "neutral";
  const showBudget = () => {
    setView("budget");
    tabsRef.current.querySelectorAll('[role="tab"]')[views.findIndex(item => item.id === 'budget')].focus();
  };
  const creativeMax = Math.max(5, Math.ceil(Math.max(0, ...sample.newCreatives.map(row => Math.abs(row.vsEstablishedPct ?? 0))) / 5) * 5);
  const viewNote = {
    budget: tr(`${sample.historyDays}일 이력에 따른 모형 예상입니다. 앞으로의 성과를 보장하지 않습니다.`, `${sample.historyDays}-day model estimate. Actual results may differ.`),
    campaigns: tr("캠페인 이름을 눌러 추세를 바꿔 보세요. CPI는 낮을수록 효율적입니다.", "Select a campaign. Lower CPI is better."),
    creatives: tr("같은 캠페인의 기존 소재 대비입니다. 첫 관측일은 생성일과 다를 수 있습니다.", "Same-campaign comparison. First seen is not the creation date."),
    actions: tr("가상 데이터에서 계산한 제안입니다. 실행·검토 기록은 플래너에서 직접 남깁니다.", "Sample proposals. Record execution and reviews in the planner."),
  };
  return <aside className="home-result-preview home-result-preview--comparison operations-sample-preview" aria-label={tr("운영 플래너 데모 미리보기", "Operations planner demo preview")}>
    <h2>{tr("운영 플래너 미리보기", "Planner preview")}</h2>
    <p className="home-sample-context">{tr(`가상 데이터 · ${sample.historyDays}일`, `Fictional data · ${sample.historyDays} days`)} · {sample.dates[0]} – {sample.dates.at(-1).slice(5)}</p>
    <div className="operations-sample-tabs" role="tablist" aria-label={tr("데모 분석 보기", "Demo analysis views")} ref={tabsRef}>
      {views.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id)} onKeyDown={event => handleTabKey(event, index)}>{item.label}</button>)}
    </div>
    <div className="operations-sample-preview__body">
    <section className="home-action-preview" role="tabpanel" id={`${id}-panel-actions`} aria-labelledby={`${id}-tab-actions`} tabIndex={0} hidden={view !== "actions"}>
      <h3>{tr("제안에서 실행, 다음 검토까지", "Plan, execute, review")}</h3>
      <div className="home-action-preview__queue">{[...new Set(sample.recommendations.map(item => item.kind))].map(kind => {
        const items = sample.recommendations.filter(item => item.kind === kind);
        return <section key={kind}><h4><span>{OPERATION_ACTION_KINDS[kind][en ? 1 : 0]}</span><b>{tr(`${items.length}건 제안`, `${items.length} proposed`)}</b></h4>
          <p className="home-sample-context">{kind === "budget" ? tr("실행할 하루 예산 설정 · 현재 → 제안", "Daily budget setting to execute · current → proposed") : tr("성과·피로도 근거를 확인하고 액션 결정", "Review performance and fatigue evidence before acting")}</p>
          <ul className="home-action-preview__proposals">{items.map(item => <li key={item.id}><strong>{item.name}</strong><span>{kind === "budget" ? <>{money(item.beforeBudget)} → <b>{money(item.afterBudget)}</b></> : item.creative}</span></li>)}</ul>
        </section>;
      })}
      {!sample.recommendations.length && <p>{tr("이 예시에서는 새 액션 제안이 없습니다.", "No new actions are proposed for this example.")}</p>}
      </div>
      <ol className="home-action-preview__steps"><li>{tr("액션 정하기", "Choose actions")}</li><li>{tr("실행일 기록", "Record execution")}</li><li>{tr("결과 검토", "Review results")}</li></ol>
    </section>
    <section className="operations-sample-preview__campaigns" role="tabpanel" id={`${id}-panel-campaigns`} aria-labelledby={`${id}-tab-campaigns`} tabIndex={0} hidden={view !== "campaigns"}>
    <div className="home-preview-story">
    <div className="operations-sample-preview__metric"><span>{tr("전체 CPI", "Portfolio CPI")}</span>
      <strong>{money(sample.previous.cpr)} → {money(sample.current.cpr)}</strong><b data-tone={tone(change)}>{pct(change)}</b></div>
    </div>
    <div className="home-preview-evidence">
    <figure className="operations-sample-chart" aria-label={tr("캠페인 일별 CPI 추세와 직전·최근 비교", "Campaign daily CPI trend and period comparison")}>
      <figcaption className="home-trend-heading"><strong>{campaign.name}</strong>
        <select className="home-preview-campaign-select" aria-label={tr("비교할 캠페인", "Campaign to compare")} value={campaign.id} onChange={event => setCampaignId(event.target.value)}>{sample.campaigns.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <span className="home-trend-current" aria-live="polite" aria-atomic="true">{tr("최근 7일 CPI", "7-day CPI")} <b>{money(campaign.current.cpr)}</b> <b data-tone={tone(campaign.changePct)}>{pct(campaign.changePct / 100)}</b></span>
        <div className="home-trend-window" role="group" aria-label={tr("그래프 범위", "Chart window")}>
          <button type="button" aria-pressed={!fullHistory} onClick={() => setFullHistory(false)}>{tr("최근 28일", "Recent 28 days")}</button>
          <button type="button" aria-pressed={fullHistory} onClick={() => setFullHistory(true)}>{tr("전체 이력", "Full history")}</button>
        </div>
      </figcaption>
      <div className="operations-sample-chart__legend">
        <span><i className="operations-key operations-key--previous" aria-hidden="true" />{tr("직전", "Prior")} {date(-14)}–{date(-8)}</span>
        <span><i className="operations-key" aria-hidden="true" />{tr("최근", "Recent")} {date(-7)}–{date(-1)}</span>
        <span className="home-trend-reference">{tr("점선: 직전 CPI", "Dashed: prior CPI")} {money(campaign.previous.cpr)}</span>
      </div>
      <OperationsHomeTrend key={`${campaign.id}-${fullHistory}`} {...{ campaign, rows: trend, periods: sample.periods, probeDate, onProbeDate: setProbeDate, isVisible: view === "campaigns", locale }} />
      <ul className="operations-sample-campaigns">{sample.campaigns.map(row => <li key={row.id}>
        <button type="button" aria-pressed={campaign.id === row.id} onClick={() => setCampaignId(row.id)}><strong className="operations-sample-campaigns__name">{row.name}</strong>
        <span className="operations-sample-campaigns__comparison">
          <span>{money(row.previous.cpr)} → <strong>{money(row.current.cpr)}</strong></span>
          <b data-tone={tone(row.current.cpr / row.previous.cpr - 1)}>{pct(row.current.cpr / row.previous.cpr - 1)}</b>
        </span></button>
      </li>)}</ul>
    </figure>
    </div>
    </section>
    <section className="operations-sample-preview__budget" role="tabpanel" id={`${id}-panel-budget`} aria-labelledby={`${id}-tab-budget`} tabIndex={0} hidden={view !== "budget"}>
      <h3 id="home-budget-title">{tr("같은 예산을 다르게 나누면", "A new plan, the same budget")}</h3>
      {sample.plan.ok ? <>
        <dl className="operations-sample-budget__metrics">
          <div><dt>{tr(`다음 ${sample.planDays}일 예산`, `Next ${sample.planDays}-day budget`)}</dt><dd>{money(sample.plan.totalBudget * sample.planDays)}</dd></div>
          <div><dt>{tr(`예상 설치 · ${sample.planDays}일`, `Modeled installs · ${sample.planDays} days`)}</dt><dd>{fmtNum(sample.plan.baselineResults * sample.planDays, 0)} → {fmtNum(sample.plan.expectedResults * sample.planDays, 0)} <b>{pct(sample.plan.improvementPct / 100)}</b></dd></div>
        </dl>
        <dl className="operations-sample-budget__moves">{sample.budgetMoves.map(row => <div key={row.id}><dt>{row.name}</dt><dd>{row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}{money(Math.abs(row.delta))}</dd>
          <dd className="home-budget-delta" aria-hidden="true"><i data-direction={row.delta < 0 ? "decrease" : "increase"} style={{ left: `${row.delta < 0 ? 50 - Math.abs(row.delta) / budgetMax * 50 : 50}%`, width: `${Math.abs(row.delta) / budgetMax * 50}%` }} /></dd>
        </div>)}</dl>
        <div className="home-budget-axis" aria-hidden="true"><span>−{money(budgetMax)}</span><span>0</span><span>+{money(budgetMax)}</span></div>
        <p className="home-sample-context">{tr("← 감액 · 증액 →", "← Decrease · increase →")} · {tr("변경 한도", "Limit")} ±{fmtPct(sample.changeLimit, 0)}</p>
      </> : <p role="status">{tr("이 데이터에서는 예산 조정안을 추정할 수 없습니다.", "A budget plan cannot be estimated from this data.")}</p>}
    </section>
    <section className="operations-sample-preview__creatives" role="tabpanel" id={`${id}-panel-creatives`} aria-labelledby={`${id}-tab-creatives`} tabIndex={0} hidden={view !== "creatives"}>
      <h3 id="home-creative-title">{tr("새 소재의 설치 단가, 기존보다 나을까?", "New vs established creative CPI")}</h3>
      <p className="operations-sample-creative__summary">{tr(`최근 7일에 처음 나타난 ${sample.newCreatives.length}개 소재`, `${sample.newCreatives.length} first seen in the recent 7 days`)}</p>
      <ul className="operations-sample-creatives">{sample.newCreatives.map(row => <li key={row.id}>
        <div className="operations-sample-creative__name"><strong>{row.creative}</strong><small>{row.campaign} · {row.firstDate.slice(5).replace("-", ".")} {tr("첫 관측", "first seen")}</small></div>
        <div className="operations-sample-creative__result"><span><small>{tr("설치당 비용", "Cost per install")}</small><strong>{money(row.cpr)}</strong></span><span><small>{tr("기존 소재 대비", "vs established")}</small><strong data-tone={tone(row.vsEstablishedPct)}>{row.vsEstablishedPct == null ? tr("비교 불가", "Not comparable") : pct(row.vsEstablishedPct / 100)}</strong></span></div>
        {row.vsEstablishedPct != null && <div className="home-creative-delta" aria-hidden="true"><i data-tone={tone(row.vsEstablishedPct)} style={{ left: `${row.vsEstablishedPct < 0 ? 50 - Math.abs(row.vsEstablishedPct) / creativeMax * 50 : 50}%`, width: `${Math.abs(row.vsEstablishedPct) / creativeMax * 50}%` }} /></div>}
        <p className="operations-sample-creative__observations">{tr(`설치 ${fmtNum(row.results, 0)}건 · 최근 7일 중 ${row.days}일치 성과`, `${fmtNum(row.results, 0)} installs · ${row.days} of the recent 7 days`)}</p>
      </li>)}</ul>
      <p className="home-sample-context">{tr(`← 단가 하락 · 공통 축 ±${creativeMax}% · 상승 →`, `← Lower · shared scale ±${creativeMax}% · higher →`)}</p>
    </section>
    </div>
    <div className="operations-sample-preview__footer">
      <p className="operations-sample-preview__note">{viewNote[view]}</p>
      {view === "campaigns" ? <button type="button" className="home-preview-story__next" onClick={showBudget}>{tr("같은 예산으로 조정안 보기", "See this budget plan")} <span aria-hidden="true">→</span></button>
        : <Link className="btn secondary" href={`${en ? "/en" : ""}${OPERATIONS_PATH}?example=1`}>{tr("이 예산안 직접 조정하기", "Adjust this budget plan")} →</Link>}
    </div>
  </aside>;
}
