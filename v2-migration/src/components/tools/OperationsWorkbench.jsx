"use client";
import Link from "next/link";
import { fmtPct } from "@/utils/format";
import { OperationsTrend, OperationsBudgetChart, OperationsCampaignChart, OperationsStageChart, OperationsMixChart, OperationsCreativeChart } from "./OperationsCharts";
import OperationsWeeklyReview from "./OperationsWeeklyReview";
import DataTable from "@/components/ds/DataTable";
import OperationsMetricEvidence from "./OperationsMetricEvidence";
import OperationsObservedQueue from "./OperationsObservedQueue";

export default function OperationsWorkbench({ brief, plan, budgetRows, campaign, creative, setSelected, setCreativeSelection,
  limit, replanning, changeLimit, holdMessages, metricName, outcomeName, currency, locale, periods, isDemo,
  money, number, pct, reviewCandidates, reviewSelection, chooseReview, reviewRef, evidence, onInspectMapping }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const showEvidence = id => requestAnimationFrame(() => {
    const heading = document.getElementById(id);
    heading?.scrollIntoView?.({ block: "start" });
    heading?.focus({ preventScroll: true });
  });
  const inspectObserved = id => {
    setSelected(id);
    showEvidence("ops-diagnosis-title");
  };
  const inspectCreative = id => {
    setCreativeSelection(id);
    showEvidence("ops-selected-creative-title");
  };
  return <>
    <div className="operations-workbench">
      <div className="operations-workbench__group operations-workbench__group--budget">
      <section className="operations-panel operations-panel--budget" aria-labelledby="ops-budget-title">
        <header className="operations-brief__heading"><div><h3 id="ops-budget-title" tabIndex={-1}>{tr("동일 예산 조정안", "Same-budget allocation plan")}</h3>
          <p>{tr("현재와 조정안의 하루 예산", "Current and revised daily budgets")}</p></div>
          <label className="operations-brief__control">{tr("변경 한도", "Change limit")}<select value={limit} disabled={replanning} onChange={event => changeLimit(Number(event.target.value))}>
            {[0, 0.1, 0.2, 0.3].map(value => <option key={value} value={value}>±{fmtPct(value, 0)}</option>)}
          </select></label></header>
        {!plan.ok ? <div className="callout" role="status"><strong>{tr("예산·개선치 추정 보류", "Budget and improvement estimates withheld")}</strong>
          {holdMessages.map(message => <p key={message}>{message}</p>)}
          <p>{plan.holds.filter(hold => hold.id).map(hold => brief.campaigns.find(row => row.id === hold.id)?.name).filter(Boolean).join(" · ")}</p>
        </div> : <>
          <dl className="operations-brief__forecast" data-design-exempt="nested: budget and modeled outcomes are separate comparisons inside the operating plan (product-ssot.md §5.6)">
            <div>
              <dt>{tr("같은 하루 예산", "Same daily budget")}</dt>
              <dd className="operations-brief__forecast-value"><strong>{money(plan.totalBudget)}</strong></dd>
              <dd className="operations-brief__forecast-context">{tr("유지안·조정안 동일", "Same for both plans")}</dd>
            </div>
            <div>
              <dt>{tr("모형 예상 성과 / 일", "Modeled outcomes / day")}</dt>
              <dd className="operations-brief__forecast-value"><strong><span>{number(plan.baselineResults)} </span><span className="operations-brief__forecast-arrow">→</span><span> {number(plan.expectedResults)}</span></strong></dd>
              <dd className="operations-brief__forecast-context"><b>{pct(plan.improvementPct)}</b>{tr("유지안 대비", "vs. keep plan")}</dd>
            </div>
          </dl>
        </>}
      </section>
      <div className={`operations-comparison${plan.ok ? "" : " operations-comparison--single"}`}>
        {plan.ok && <section className="operations-panel operations-panel--allocation" aria-label={tr("캠페인 예산 조정 근거", "Campaign budget evidence")}>
          <OperationsBudgetChart rows={budgetRows} currency={currency} locale={locale} periods={periods} isDemo={isDemo} />
          <div className="operations-budget-shifts">{budgetRows.map(row => <div key={row.id}><span>{row.name}<small>{tr(`예상 ${metricName}`, `Predicted ${metricName}`)} {money(row.baselineCpr)} → {money(row.expectedCpr)}</small></span><b data-tone={row.budget > row.current + 1e-6 ? "increase" : row.budget < row.current - 1e-6 ? "decrease" : "neutral"}>{row.budget > row.current + 1e-6 ? "+" : row.budget < row.current - 1e-6 ? "−" : ""}{money(Math.abs(row.budget - row.current))}<small> / {tr("일", "day")}</small></b></div>)}</div>
          <p className="operations-chart__caption">{tr(`유지안 → 조정안 예상 ${metricName}`, `Maintenance → revised predicted ${metricName}`)} {money(plan.baselineCpr)} → {money(plan.expectedCpr)}. {tr("같은 모형의 조건부 예측이며 개선은 보장되지 않습니다.", "Conditional predictions from the same model; improvement is not guaranteed.")}</p>
          <button className="btn primary" type="button" onClick={() => chooseReview("budget")}>{tr("이 예산안을 주간 리뷰로", "Review this budget plan next week")} →</button>
        </section>}

      <section className="operations-panel operations-panel--trend" aria-labelledby="ops-trend-title">
        <OperationsTrend rows={brief.trend} metricName={metricName} currency={currency} locale={locale} periods={periods} isDemo={isDemo} />
        <div className="operations-observed-comparison">
          <div><span>{tr(`직전 ${metricName}`, `Prior ${metricName}`)}</span><strong>{money(brief.previous.cpr)}</strong></div>
          <span aria-hidden="true">→</span><div><span>{tr(`최근 ${metricName}`, `Recent ${metricName}`)}</span><strong>{money(brief.current.cpr)}</strong></div>
          <b data-tone={brief.previous.cpr != null && brief.current.cpr > brief.previous.cpr ? "bad" : "neutral"}>{brief.previous.cpr > 0 && brief.current.cpr != null ? pct((brief.current.cpr / brief.previous.cpr - 1) * 100) : tr("비교 불가", "Not comparable")}</b>
        </div>
        <p className="operations-chart__caption">{tr("단가는 일별 광고비 합계 ÷ 성과 합계입니다. 이 추세는 모형 예측이 아닙니다.", "Daily unit cost is total spend ÷ total outcomes. This trend shows observations, not model predictions.")}</p>
      </section>
        </div>
        <Link className="operations-detail-link" href={locale === "en" ? "/en/tools/budget-allocation" : "/tools/budget-allocation"}>{tr("모형·예산 조건 자세히 조정", "Adjust model and budget settings")} →</Link>
      </div>

      <OperationsMetricEvidence {...{ evidence, currency, locale, onInspectMapping }} />

      <div className="operations-workbench__group operations-workbench__group--campaign">
      <section id="ops-campaign" tabIndex={-1} className="operations-panel operations-panel--campaign" aria-labelledby="ops-campaign-title">
        <OperationsCampaignChart rows={brief.campaigns} selected={campaign?.id} onSelect={setSelected} metricName={metricName} currency={currency} locale={locale} periods={periods} isDemo={isDemo} />
        <OperationsObservedQueue brief={brief} selected={campaign?.id} onSelect={inspectObserved} {...{ metricName, locale, money, pct }} />
      </section>

      <section className="operations-panel operations-panel--diagnosis operations-brief__diagnosis" aria-labelledby="ops-diagnosis-title">
        <header><h3 id="ops-diagnosis-title" tabIndex={-1}>{tr("선택한 캠페인의 변화 기여", "Contributions for the selected campaign")}</h3>
          {campaign && <h4>{campaign.name}<small>{campaign.context}</small></h4>}</header>
        {campaign ? <>
          <div className="operations-diagnosis-summary"><strong>{money(campaign.previous.cpr)} → {money(campaign.current.cpr)}</strong><b data-tone={campaign.changePct > 0 ? "bad" : "neutral"}>{pct(campaign.changePct)}</b></div>
          <div className={`operations-decomposition-grid${campaign.stages?.ok && campaign.pvm ? "" : " operations-decomposition-grid--single"}`}>
            <div><OperationsStageChart value={campaign.stages} metricName={metricName} currency={currency} locale={locale} periods={periods} isDemo={isDemo} scopeLabel={campaign.name} /></div>
            <div><OperationsMixChart value={campaign.pvm} metricName={metricName} currency={currency} locale={locale} periods={periods} isDemo={isDemo} scopeLabel={campaign.name} /></div>
          </div>
          <p className="operations-chart__caption">{tr("구성: 소재 간 성과 비중 변화 · 단가: 각 소재의 단가 변화. 단계별 분해와 같은 변화를 다른 기준으로 설명하며 서로 더하지 않습니다.", "Mix: outcome-share shifts between creatives. Unit cost: changes within creatives. This explains the same change as the stage breakdown from a different perspective; do not add the two.")}</p>
          {campaign.current.cpr != null && <button className="btn ghost" type="button" onClick={() => chooseReview(`campaign:${campaign.id}`)}>{tr("이 캠페인 점검을 주간 리뷰로", "Review this campaign next week")} →</button>}
        </> : <p>{tr("분석할 캠페인이 없습니다.", "No campaigns to analyze.")}</p>}
      </section>
      </div>

      <div className="operations-workbench__group operations-workbench__group--creative">
        <div className={`operations-comparison${creative?.cpr != null ? "" : " operations-comparison--single"}`}>
      <section className="operations-panel operations-panel--creative" aria-labelledby="ops-creative-title">
        <OperationsCreativeChart rows={brief.creatives} selected={creative?.id} onSelect={setCreativeSelection} metricName={metricName} currency={currency} locale={locale} periods={periods} isDemo={isDemo} />
      </section>

      {creative && <section className="operations-panel operations-panel--selected-creative" aria-labelledby="ops-selected-creative-title">
        <header><h3 id="ops-selected-creative-title" tabIndex={-1}>{tr("선택한 소재", "Selected creative")}</h3></header>
        <div className="operations-creative-detail">
          <h4>{creative.creative}</h4><p>{creative.campaign} · {creative.context}</p>
          <dl><div><dt>{tr("최근 비용", "Recent spend")}</dt><dd>{money(creative.cost)}</dd></div><div><dt>{outcomeName}</dt><dd>{number(creative.results)}</dd></div>
            <div><dt>{metricName}</dt><dd>{money(creative.cpr)}</dd></div><div><dt>{tr("관측일", "Observed days")}</dt><dd>{creative.days}{tr("일", " days")}</dd></div>
            <div><dt>{tr("업로드 이력의 첫 관측일", "First observed in uploaded history")}</dt><dd>{creative.firstDate}</dd></div>
            {creative.isNew && <div><dt>{tr("기존 소재 대비", "vs established creatives")}</dt><dd>{creative.vsEstablishedPct == null ? tr("비교 불가", "Not comparable") : pct(creative.vsEstablishedPct)}</dd></div>}</dl>
          {creative.isNew && creative.cpr != null && <button className="btn ghost" type="button" onClick={() => chooseReview(`creative:${creative.id}`)}>{tr("이 소재를 다음 주에도 확인", "Follow up on this creative next week")} →</button>}
        </div>
        <p className="operations-chart__caption">{tr("첫 관측은 업로드 이력 기준입니다. 실제 생성일은 미확인입니다. 기존 대비는 같은 캠페인·같은 기간의 비용 합계 ÷ 성과 합계이며 소재 효과를 확정하지 않습니다.", "First observed in uploaded history; creation dates are unverified. The established comparison is total spend ÷ outcomes for the same campaign and period, not a causal creative effect.")}</p>
      </section>}
        </div>
      <section className="operations-panel operations-panel--new" aria-labelledby="ops-new-title">
        <header><h3 id="ops-new-title" tabIndex={-1}>{tr("이번 기간 첫 관측 소재", "Creatives first observed this period")}</h3>
          <p>{tr("같은 캠페인의 기존 소재와 비교", "Compare with established creatives in the same campaign")}</p></header>
        <div className="operations-new-creatives">
          {brief.creatives.some(row => row.isNew) && <DataTable ariaLabel={tr("신규 소재 비교", "New creative comparison")} rows={brief.creatives.filter(row => row.isNew)} rowKey={row => row.id} columns={[
            { key: "creative", label: tr("소재", "Creative"), fmt: (value, row) => <span className="operations-brief__entity"><strong>{value}</strong><small>{row.campaign}</small></span> },
            { key: "firstDate", label: tr("첫 관측일", "First observed"), fmt: (value, row) => <span className="operations-brief__entity"><span>{value}</span><small>{row.days}{tr("일 관측", " observed days")}</small></span> },
            { key: "cpr", label: metricName, align: "right", fmt: money },
            { key: "vsEstablishedPct", label: tr("기존 대비", "vs established"), align: "right", fmt: pct },
            { key: "id", label: tr("보기", "View"), align: "right", fmt: (value, row) => <button className="btn ghost" type="button" aria-label={tr(`${row.creative} 선택`, `Select ${row.creative}`)} onClick={() => inspectCreative(value)}>{tr("선택", "Select")}</button> },
          ]} />}
          {!brief.creatives.some(row => row.isNew) && <p>{tr("이번 기간 첫 관측 소재가 없거나 소재 ID가 부족합니다.", "No first-observed creatives, or creative IDs are insufficient.")}</p>}
        </div>
      </section>
      </div>
    </div>
    <div ref={reviewRef}><OperationsWeeklyReview candidates={reviewCandidates} selected={reviewSelection} onSelect={chooseReview} isDemo={isDemo} locale={locale} currency={currency} periods={periods} /></div>
  </>;
}
