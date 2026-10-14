"use client";
import { useId, useMemo, useRef, useState } from "react";
import { buildOperationsHomePreview } from "@/lib/operations/operationsHomePreview";
import DataTable from "@/components/ds/DataTable";
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
  const [view, setView] = useState("campaigns");
  const id = useId(), tabsRef = useRef(null);
  const views = [
    { id: "campaigns", label: tr("캠페인", "Campaigns") },
    { id: "budget", label: tr("예산", "Budget") },
    { id: "creatives", label: tr("소재", "Creatives") },
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
  const pct = value => `${value > 0 ? "+" : ""}${fmtPct(value)}`;
  const tone = value => value > 0 ? "bad" : value < 0 ? "good" : "neutral";
  const showBudget = () => {
    setView("budget");
    tabsRef.current.querySelectorAll('[role="tab"]')[1].focus();
  };
  const creativeColumns = [
    { key: "creative", label: tr("소재", "Creative"), fmt: name => <span className="operations-sample-creative__name"><strong>{name}</strong></span> },
    { key: "cpr", label: tr("CPI · 기존 대비", "CPI · vs established"), align: "right", fmt: (value, row) => <span className="operations-sample-creative__result"><strong>{money(value)}</strong><small data-tone={tone(row.vsEstablishedPct)}>{row.vsEstablishedPct == null ? tr("비교 불가", "Not comparable") : pct(row.vsEstablishedPct / 100)}</small></span> },
    { key: "campaign", label: tr("캠페인", "Campaign") },
    { key: "firstDate", label: tr("첫 관측", "First seen"), fmt: (value, row) => <span className="operations-sample-creative__observations">{value.slice(5).replace("-", ".")}<small>{row.days}{tr("일 관측", " days observed")}</small></span> },
    { key: "results", label: tr("설치 수", "Installs"), align: "right", fmt: value => fmtNum(value, 0) },
  ];
  return <aside className="home-result-preview home-result-preview--comparison operations-sample-preview" aria-label={tr("운영 플래너 데모 미리보기", "Operations planner demo preview")}>
    <h2>{tr("운영 플래너 미리보기", "Operations planner preview")}</h2>
    <p className="home-sample-context">{tr("가상 데이터 · 최근 7일", "Fictional data · recent 7 days")} {sample.periods.current.start} – {sample.periods.current.end}</p>
    <div className="operations-sample-tabs" role="tablist" aria-label={tr("데모 분석 보기", "Demo analysis views")} ref={tabsRef}>
      {views.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id)} onKeyDown={event => handleTabKey(event, index)}>{item.label}</button>)}
    </div>
    <div className="operations-sample-preview__body">
    <section className="operations-sample-preview__campaigns" role="tabpanel" id={`${id}-panel-campaigns`} aria-labelledby={`${id}-tab-campaigns`} tabIndex={0} hidden={view !== "campaigns"}>
    <div className="home-preview-story">
    <h3 id="home-campaign-title">{tr("전체 평균 뒤의 캠페인 차이", "Look beyond the overall average")}</h3>
    <div className="operations-sample-preview__metric"><span>{tr("전체 CPI", "Portfolio CPI")}</span>
      <strong>{money(sample.previous.cpr)} → {money(sample.current.cpr)}</strong><b data-tone={tone(change)}>{pct(change)}</b></div>
    <p>{tr("캠페인을 선택하면 최근 7일의 변화와 일별 추세를 함께 볼 수 있습니다.", "Select a campaign to see its seven-day change alongside its daily trend.")}</p>
    <div className="home-preview-story__selection" aria-live="polite" aria-atomic="true">
      <h4>{campaign.name}</h4>
      <p>{tr("최근 CPI", "Recent CPI")} <strong>{money(campaign.current.cpr)}</strong></p>
      <p>{tr("직전 7일 대비", "Versus the prior seven days")} <strong data-tone={tone(campaign.changePct)}>{pct(campaign.changePct / 100)}</strong></p>
    </div>
    </div>
    <div className="home-preview-evidence">
    <figure className="operations-sample-chart" aria-label={tr("캠페인 일별 CPI 추세와 직전·최근 비교", "Campaign daily CPI trend and period comparison")}>
      <figcaption className="home-trend-heading"><strong>{campaign.name}</strong><b data-tone={tone(campaign.changePct)}>{tr("최근 7일", "Recent 7 days")} {pct(campaign.changePct / 100)}</b>
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
      <OperationsHomeTrend {...{ campaign, rows: trend, periods: sample.periods, probeDate, onProbeDate: setProbeDate, isVisible: view === "campaigns", locale }} />
      <dl className="operations-sample-campaigns">{sample.campaigns.map(row => <div key={row.id}>
        <dt><button type="button" aria-pressed={campaign.id === row.id} onClick={() => setCampaignId(row.id)}>{row.name}</button></dt>
        <dd className="operations-sample-campaigns__comparison">
          <span>{money(row.previous.cpr)} → <strong>{money(row.current.cpr)}</strong></span>
          <b data-tone={tone(row.current.cpr / row.previous.cpr - 1)}>{pct(row.current.cpr / row.previous.cpr - 1)}</b>
        </dd>
      </div>)}</dl>
    </figure>
    <p className="home-sample-context">{tr("캠페인 이름을 눌러 추세를 바꿔 보세요. CPI는 낮을수록 효율적입니다.", "Select a campaign name to explore its trend. Lower CPI is better.")}</p>
    </div>
    <button type="button" className="home-preview-story__next" onClick={showBudget}>{tr("같은 예산으로 조정안 보기", "Explore a plan for the same budget")}</button>
    </section>
    <section className="operations-sample-preview__budget" role="tabpanel" id={`${id}-panel-budget`} aria-labelledby={`${id}-tab-budget`} tabIndex={0} hidden={view !== "budget"}>
      <h3 id="home-budget-title">{tr("같은 예산을 다르게 나누면", "Put the same budget to a different plan")}</h3>
      {sample.plan.ok ? <>
        <dl className="operations-sample-budget__metrics">
          <div><dt>{tr("하루 총 예산", "Total daily budget")}</dt><dd>{money(sample.plan.totalBudget)}</dd></div>
          <div><dt>{tr("예상 설치 / 일 · 유지 → 조정", "Modeled installs / day · keep → revise")}</dt><dd>{fmtNum(sample.plan.baselineResults, 1)} → {fmtNum(sample.plan.expectedResults, 1)} <b>{pct(sample.plan.improvementPct / 100)}</b></dd></div>
        </dl>
        <dl className="operations-sample-budget__moves">{sample.budgetMoves.map(row => <div key={row.id}><dt>{row.name}</dt><dd>{row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}{money(Math.abs(row.delta))}</dd>
          <dd className="home-budget-delta" aria-hidden="true"><i data-direction={row.delta < 0 ? "decrease" : "increase"} style={{ left: `${row.delta < 0 ? 50 - Math.abs(row.delta) / budgetMax * 50 : 50}%`, width: `${Math.abs(row.delta) / budgetMax * 50}%` }} /></dd>
        </div>)}</dl>
        <div className="home-budget-axis" aria-hidden="true"><span>−{money(budgetMax)}</span><span>0</span><span>+{money(budgetMax)}</span></div>
        <p className="home-sample-context">{tr("왼쪽 감액 · 오른쪽 증액", "Left: decrease · right: increase")} · {tr("공통 축", "Shared scale")} ±{money(budgetMax)} · {tr("변경 한도", "Change limit")} ±{fmtPct(sample.changeLimit, 0)}</p>
        <p className="operations-sample-preview__note">{tr(`${sample.historyDays}일 이력에 따른 모형 예상입니다. 앞으로의 성과를 보장하지 않습니다.`, `Modeled from ${sample.historyDays} days of history. Future performance is not guaranteed.`)}</p>
      </> : <p role="status">{tr("이 데이터에서는 예산 조정안을 추정할 수 없습니다.", "A budget plan cannot be estimated from this data.")}</p>}
    </section>
    <section className="operations-sample-preview__creatives" role="tabpanel" id={`${id}-panel-creatives`} aria-labelledby={`${id}-tab-creatives`} tabIndex={0} hidden={view !== "creatives"}>
      <h3 id="home-creative-title">{tr("새 소재, 같은 캠페인의 기존 소재와 비교", "New creatives, compared within the same campaign")}</h3>
      <p className="operations-sample-creative__summary">{tr(`첫 관측 소재 ${sample.newCreatives.length}개`, `${sample.newCreatives.length} first-observed creatives`)}</p>
      <DataTable columns={creativeColumns} rows={sample.newCreatives} rowKey={row => row.id} ariaLabel={tr("첫 관측 소재의 설치 단가와 기존 소재 비교", "First-observed creative CPI versus established creatives")} />
      <p className="operations-sample-creative__scroll-hint">{tr("표를 옆으로 밀어 전체 항목을 확인하세요.", "Scroll the table sideways to see all columns.")}</p>
      <p className="operations-sample-preview__note">{tr("같은 캠페인의 기존 소재 대비입니다. 첫 관측일은 생성일과 다를 수 있습니다.", "Compared with established creatives in the same campaign. First observation may differ from creation date.")}</p>
    </section>
    </div>
  </aside>;
}
