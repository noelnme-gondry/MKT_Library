"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getMappedRows, getMonFilteredRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { fmtCurrency, fmtNum, fmtPct, sourceCurrencyOf } from "@/utils/format";
import { useAppStore } from "@/store/useDataStore";
import ToolPageShell from "@/components/ToolPageShell";
import ModalDialog from "@/components/ds/ModalDialog";
import CsvUploader from "@/components/CsvUploader";
import DashboardFilterBar from "@/components/dashboard/DashboardFilterBar";
import DashboardComparisonPeriod from "@/components/dashboard/DashboardComparisonPeriod";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { dateBounds } from "@/lib/analysisPeriod";
import { isDemoData } from "@/lib/dataOrigin";
import { buildToolDemo } from "@/lib/toolDemo";
import useExampleLink from "@/components/ds/useExampleLink";
import { csvBody, downloadCsv } from "@/utils/download";
import { OPERATIONS_TOOL_ID } from "@/lib/operations/operationsDemo";
import { comparisonWarnings } from "@/lib/analysisPeriod";
import { scopeFilters } from "@/lib/analysis-results/scopeEvidence";
import { prepareOperationsBrief, planOperationsBudget, OPERATIONS_HOLDS } from "@/lib/operations/operationsBrief";
import { operationsReviewCandidates } from "@/lib/operations/operationsReview";
import { operationsInputEvidence } from "@/lib/operations/operationsEvidence";
import OperationsWorkbench from "./OperationsWorkbench";
import { confirmReviewExit } from "@/lib/project/reviewDraftGuard";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import PvmEfficiencyStages from "@/components/tools/PvmEfficiencyStages";

function EvidenceTable({ title, columns, rows, locale, emptyText }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="operations-data__section">
    <h4>{title}</h4>
    <DataTable columns={columns} rows={expanded ? rows : rows.slice(0, 10)} rowKey={row => row.id} ariaLabel={title} emptyText={emptyText} />
    {rows.length > 10 && <button className="btn ghost" type="button" onClick={() => setExpanded(value => !value)}>
      {locale === "en" ? expanded ? "Show first 10" : `Show all ${rows.length}` : expanded ? "10개만 보기" : `${rows.length}개 모두 보기`}
    </button>}
  </div>;
}

function OperationsResults({ csvData, filter, periods, denomBasis, currency, locale = "ko", onInspectMapping }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const metric = effectiveDenomBasis(csvData, denomBasis);
  const metricName = metric === "actions" ? "CPA" : "CPI";
  const outcomeName = metric === "actions" ? tr("가입", "sign-ups") : tr("설치", "installs");
  const input = useMemo(() => ({ csvData, filter, periods, metric, currency }), [csvData, filter, periods, metric, currency]);
  const [bundle, setBundle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creativeSelection, setCreativeSelection] = useState(null);
  const [reviewSelection, setReviewSelection] = useState(null);
  const reviewRef = useRef(null);
  const [replanning, setReplanning] = useState(false);
  const [failure, setFailure] = useState(null);
  const [limit, setLimit] = useState(0.2);
  const limitRef = useRef(0.2);
  // 매핑/기간 변경 때 이전 결과를 먼저 숨긴다. 계산은 분석 게이트 안에서만,
  // 두 번의 rAF 뒤에 실행해 로딩 상태를 실제로 페인트한다.
  useEffect(() => {
    let active = true, frame2;
    const frame1 = requestAnimationFrame(() => { frame2 = requestAnimationFrame(() => {
      if (!active) return;
      try {
        const rows = getMonFilteredRows(input.csvData, { ...input.filter, dateStart: null, dateEnd: null });
        const brief = prepareOperationsBrief({ rows, periods: input.periods, metric: input.metric,
          mappedFields: Object.values(input.csvData.mapping || {}) });
        const evidence = operationsInputEvidence({ rows, mapping: input.csvData.mapping, period: input.periods.current, metric: input.metric });
        setBundle({ input, brief, evidence, plan: planOperationsBudget(brief, { changeLimit: limitRef.current, currency: input.currency }) });
        setFailure(null);
      } catch { setFailure(input); }
    }); });
    return () => { active = false; cancelAnimationFrame(frame1); cancelAnimationFrame(frame2); };
    // 변경 한도만 바뀔 때는 이력 모형을 다시 적합하지 않는다.
  }, [input]);

  const ready = bundle?.input === input;
  const brief = ready ? bundle.brief : null;
  const plan = ready ? bundle.plan : null;
  const changeLimit = next => {
    if (!ready || replanning) return;
    setReplanning(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const nextPlan = planOperationsBudget(brief, { changeLimit: next, currency });
        setBundle(current => current?.input === input ? { ...current, plan: nextPlan } : current);
        setLimit(next);
        limitRef.current = next;
      } finally { setReplanning(false); }
    }));
  };
  if (failure === input) return <div className="callout" role="alert">{tr("운영 계획을 계산할 수 없습니다. 데이터·매핑을 확인해 주세요.", "The operations plan could not be calculated. Check your data and mappings.")}</div>;
  if (!ready) return <><p role="status">{tr("운영 계획을 계산하고 있습니다…", "Calculating your operations plan…")}</p><AnalyzingOverlay show title={tr("운영 계획 계산 중…", "Calculating operations plan…")} /></>;
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("계산 불가", "Unavailable");
  const number = value => Number.isFinite(value) ? fmtNum(value, 1) : tr("계산 불가", "Unavailable");
  const pct = value => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${fmtPct(value / 100)}` : tr("비교 불가", "Not comparable");
  const entity = row => row.name || tr("대상 미지정", "Unspecified entity");
  const noun = brief.unit === "campaign" ? tr("캠페인", "campaigns") : tr("채널", "channels");
  const deteriorated = brief.campaigns.filter(row => row.changePct > 1e-8);
  const comparable = brief.campaigns.filter(row => row.changePct != null).length;
  const campaign = brief.campaigns.find(row => row.id === selected) || brief.campaigns[0];
  const creative = brief.creatives.find(row => row.id === creativeSelection) || brief.creatives[0];
  const headline = brief.current.cpr == null ? tr("최근 성과 단가를 계산할 수 없습니다.", "Recent unit cost cannot be calculated.")
    : !comparable ? tr("최근 실적은 확인되지만 비교할 이전 실적이 부족합니다.", "Recent performance is available, but prior observations are insufficient for comparison.")
      : deteriorated.length ? tr(`${entity(deteriorated[0])}의 ${metricName}가 ${pct(deteriorated[0].changePct)} 올랐습니다.`, `${entity(deteriorated[0])} ${metricName} rose ${pct(deteriorated[0].changePct)}.`)
        : tr(`비교 가능한 ${noun} ${comparable}개의 단가 상승은 관측되지 않았습니다.`, `No unit-cost increase was observed among ${comparable} comparable ${noun}.`);
  const holdMessages = [...new Set(plan.holds.map(hold => OPERATIONS_HOLDS[hold.reason]?.[locale] || OPERATIONS_HOLDS.missing[locale]))];
  const campaignById = new Map(brief.campaigns.map(row => [row.id, row]));
  const budgetRows = plan.items.map(row => ({ ...row, name: entity(campaignById.get(row.id)), context: campaignById.get(row.id).context,
    observedCpr: campaignById.get(row.id).current.cpr, baselineCpr: row.current / row.currentResults }));
  const isDemo = isDemoData(csvData);
  const reviewCandidates = operationsReviewCandidates({ brief, plan, currency, locale });
  const chooseReview = (id, { reveal = true } = {}) => {
    const current = reviewCandidates.find(row => row.id === reviewSelection) || reviewCandidates[0];
    if (id !== current?.id && !confirmReviewExit(useAppStore.getState().activeProjectId, locale)) return;
    setReviewSelection(id);
    if (!reveal) return;
    requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      reviewRef.current?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      reviewRef.current?.querySelector("h3")?.focus({ preventScroll: true });
    });
  };
  const notes = [tr("단가 상승과 단계별 기여는 관측 비교이며, 원인을 증명하지 않습니다.", "Unit-cost changes and stage contributions compare observations; they do not prove causation."),
    ...comparisonWarnings(periods.current, periods.previous, locale)];
  if (brief.missingCreativeRows) notes.push(tr(`최근 ${brief.missingCreativeRows}행에 소재 ID가 없어 소재별 목록에 포함되지 않았습니다.`, `${brief.missingCreativeRows} recent rows have no creative ID and are excluded from the creative list.`));
  const workbookExport = () => ({ calculationMode: "hybrid_engine_output", calculationTables: [
    { name: "OPS_CAMPAIGNS", title: tr("대상별 기간 실적", "Performance by entity and period"), rows: [
      ["entity", "context", "previous_spend", "previous_outcomes", "previous_unit_cost", "recent_spend", "recent_outcomes", "recent_unit_cost"],
      ...brief.campaigns.map((row, index) => [entity(row), row.context, row.previous.cost ?? "", row.previous.results ?? "",
        { formula: `=IFERROR(C${index + 2}/D${index + 2},"")` }, row.current.cost ?? "", row.current.results ?? "",
        { formula: `=IFERROR(F${index + 2}/G${index + 2},"")` }]) ] },
    { name: "OPS_CREATIVES", title: tr("소재별 관측", "Creative observations"), rows: [
      ["creative", "campaign", "context", "first_observed", "new_in_period", "observed_days", "spend", "outcomes", "unit_cost"],
      ...brief.creatives.map((row, index) => [row.creative, row.campaign, row.context, row.firstDate, row.isNew, row.days, row.cost ?? "", row.results ?? "", { formula: `=IFERROR(G${index + 2}/H${index + 2},"")` }]) ] },
    { name: "OPS_BUDGET", title: tr("예산 조정 모형 출력", "Budget plan model outputs"), note: holdMessages.join(" "), rows: [
      ["entity", "context", "current_daily_spend", "planned_daily_spend", "maintenance_outcomes_engine", "planned_outcomes_engine", "min_spend", "max_spend", "change_limit"],
      ...budgetRows.map(row => [row.name, row.context, row.current, row.budget, row.currentResults, row.expectedResults, row.min, row.max, limit]) ] },
    { name: "OPS_DECOMPOSITION", title: tr("단가 분해 엔진 출력", "Unit-cost decomposition engine outputs"), rows: [
      ["entity", "context", "creative", "mix_engine", "rate_engine", "total_contribution_engine"],
      ...brief.campaigns.flatMap(row => (row.pvm?.finest || []).map(item => [entity(row), row.context, item.crKey || "", item.mix, item.rate, item.contribution])) ] },
    { name: "OPS_METRIC_INPUTS", title: tr("지표에 사용한 실제 입력", "Actual inputs behind metrics"), rows: [
      ["field", "source_columns", "period_start", "period_end", "observations", "complete_total", "invalid_rows", "unavailable_reason"],
      ...bundle.evidence.inputs.map(row => [row.key, row.headers.join(" · "), periods.current.start, periods.current.end,
        bundle.evidence.observations, row.total ?? "", row.invalidCount, row.reason || ""]) ] },
    { name: "OPS_METRICS", title: tr("기존 지표 정의의 계산값", "Values from existing metric definitions"), rows: [
      ["metric", "outcome_basis", "unit", "value_registry", "input_fields", "unavailable_reason"],
      ...bundle.evidence.metrics.map(row => [row.id, metric, row.unit, row.value ?? "", row.dependencies.map(input => input.key).join(" · "), row.reason || ""]) ] },
  ], method: { name: "operations-brief", version: "1", assumptions: ["Same daily budget; observed daily coverage; historical curves, recent exponential weights (14-day half-life), automatic regime selection; changes capped within observed/safe spend range."], limitations: [...notes, "Model predictions are conditional, not guaranteed or causal gains.", ...holdMessages] } });

  return <ResultActionCard title={tr("이번 운영에서 확인할 일", "Checks for your next operating plan")} headline={headline} tone={deteriorated.length ? "bad" : "neutral"}
    locale={locale} toolId={OPERATIONS_TOOL_ID} analysisKey="operations" resultState={brief.recentObservations ? "ready" : "insufficient"} issues={notes}
    stats={[{ label: tr("최근 광고비", "Recent spend"), value: money(brief.current.cost), detail: `${tr("직전", "Prior")} ${money(brief.previous.cost)}` },
      { label: tr(`최근 ${outcomeName}`, `Recent ${outcomeName}`), value: number(brief.current.results), detail: `${tr("직전", "Prior")} ${number(brief.previous.results)}` },
      { label: tr(`최근 ${metricName}`, `Recent ${metricName}`), value: money(brief.current.cpr), detail: `${tr("직전", "Prior")} ${money(brief.previous.cpr)}` },
      { label: tr("동일 예산의 모형 예상 개선", "Modeled same-budget improvement"), value: plan.ok ? pct(plan.improvementPct) : tr("추정 보류", "Withheld"), detail: tr("유지안과 조정안의 예상 성과 비교", "Expected outcomes: maintenance vs revised") },
    ]}
    scopeEvidence={{ observationUnit: tr(`${noun} × 일`, `${noun} × day`), denominatorKey: metric, currency, filters: scopeFilters(filter),
      periods: [{ id: "after", ...periods.current, observations: brief.recentObservations }, { id: "before", ...periods.previous, observations: brief.priorObservations }] }}
    workbookExport={workbookExport}
    decisionReview={false}
    coreFigure={<nav className="operations-result-actions" aria-label={tr("결과와 다음 행동", "Results and next actions")}>
      <a href="#ops-budget-title">{tr("예산안 확인", "Inspect budget plan")}<span>{plan.ok ? tr(`${pct(plan.improvementPct)} 모형 예상`, `${pct(plan.improvementPct)} modeled`) : tr("추정 보류", "Estimate withheld")} →</span></a>
      <a href="#ops-campaign">{tr("캠페인 변화 확인", "Inspect campaign changes")}<span>{comparable ? tr(`단가 상승 ${deteriorated.length}개`, `${deteriorated.length} with rising unit cost`) : tr("비교 불가", "Not comparable")} →</span></a>
      <a href="#ops-new-title">{tr("새 소재 비교", "Compare new creatives")}<span>{brief.creatives.length ? tr(`첫 관측 ${brief.creatives.filter(row => row.isNew).length}개`, `${brief.creatives.filter(row => row.isNew).length} first observed`) : tr("소재 식별 부족", "Insufficient creative IDs")} →</span></a>
      <a href="#ops-review-title">{tr("주간 리뷰 준비", "Prepare weekly review")}<span>{tr("다음 검토로 연결", "Plan a follow-up")} →</span></a>
    </nav>}
    analysisContent={<div className="operations-brief">
      <OperationsWorkbench {...{ brief, plan, budgetRows, campaign, creative, setSelected, setCreativeSelection,
        limit, replanning, changeLimit, holdMessages, metricName, outcomeName, currency, locale, periods, isDemo,
        money, number, pct, reviewCandidates, reviewSelection, chooseReview, reviewRef, onInspectMapping }} evidence={bundle.evidence} />
      <details className="operations-data">
        <summary>{tr("차트의 상세 데이터", "Data behind the charts")}<span>{tr("예산·캠페인·소재·단계별 지표", "Budget, campaigns, creatives and stage metrics")}</span></summary>
        <div className="operations-data__body">
        {plan.ok && <EvidenceTable title={tr("대상별 예산과 효율", "Budget and efficiency by entity")} locale={locale} rows={budgetRows} columns={[
            { key: "name", label: tr("대상", "Entity"), fmt: (value, row) => <span className="operations-brief__entity"><strong>{value}</strong><small>{row.context}</small></span> },
            { key: "current", label: tr("현재 / 일", "Current / day"), align: "right", fmt: money },
            { key: "budget", label: tr("조정안 / 일", "Planned / day"), align: "right", fmt: money },
            { key: "observedCpr", label: tr(`관측 ${metricName}`, `Observed ${metricName}`), align: "right", fmt: money },
            { key: "baselineCpr", label: tr(`유지안 예상 ${metricName}`, `Maintenance predicted ${metricName}`), align: "right", fmt: money },
            { key: "expectedCpr", label: tr(`조정안 예상 ${metricName}`, `Revised predicted ${metricName}`), align: "right", fmt: money },
          ]} />}
        <EvidenceTable title={tr("대상별 최근 효율", "Recent efficiency by entity")} locale={locale} rows={brief.campaigns} emptyText={tr("분석할 대상이 없습니다.", "No entities to analyze.")} columns={[
          { key: "name", label: tr("대상", "Entity"), fmt: (value, row) => <span className="operations-brief__entity"><strong>{entity(row)}</strong><small>{row.context}</small></span> },
          { key: "previous", label: tr(`직전 ${metricName}`, `Previous ${metricName}`), align: "right", fmt: value => money(value.cpr) },
          { key: "current", label: tr(`최근 ${metricName}`, `Recent ${metricName}`), align: "right", fmt: value => money(value.cpr) },
          { key: "changePct", label: tr("단가 변화", "Unit-cost change"), align: "right", fmt: pct },
          { key: "id", label: tr("보기", "View"), align: "right", fmt: (value, row) => <button className="btn ghost" type="button" aria-label={tr(`${entity(row)} 분석 선택`, `Analyze ${entity(row)}`)} onClick={() => setSelected(value)}>{tr("분석", "Analyze")}</button> },
        ]} />

        <EvidenceTable title={tr("소재별 최근 효율", "Recent efficiency by creative")} locale={locale} rows={brief.creatives} emptyText={tr("소재 ID가 매핑된 데이터가 없습니다.", "No mapped creative IDs are available.")} columns={[
          { key: "creative", label: tr("소재 · 캠페인", "Creative · campaign"), fmt: (value, row) => <span className="operations-brief__entity"><strong>{value}</strong><small>{row.campaign} · {row.context}</small></span> },
          { key: "firstDate", label: tr("첫 관측일", "First observed"), fmt: (value, row) => <span className="operations-brief__entity"><span>{value}</span>{row.isNew && <small>{tr("이번 기간 첫 관측", "First seen this period")}</small>}</span> },
          { key: "days", label: tr("관측일", "Observed days"), align: "right", fmt: value => fmtNum(value) },
          { key: "cost", label: tr("최근 비용", "Recent spend"), align: "right", fmt: money },
          { key: "results", label: tr("최근 성과", "Recent outcomes"), align: "right", fmt: number },
          { key: "cpr", label: metricName, align: "right", fmt: money },
          { key: "vsEstablishedPct", label: tr("기존 소재 대비 단가", "Unit cost vs established"), align: "right", fmt: pct },
        ]} />

        {campaign && <section className="operations-data__section" aria-label={tr("선택 캠페인의 단계별 지표", "Selected campaign stage metrics")}>
          <PvmEfficiencyStages value={campaign.stages} metric={metricName} currency={currency} locale={locale} headingLevel={4} title={`${tr("단계별 지표", "Stage metrics")} · ${campaign.name}`} />
        </section>}
        </div>
      </details>
      <AnalyzingOverlay show={replanning} title={tr("예산 조정안 계산 중…", "Calculating budget adjustment…")} />
    </div>} />;
}


export default function OperationsPlanner({ locale = "ko" }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const csvData = useAppStore(state => state.csvData);
  const filter = useAppStore(state => state.dashboardFilter);
  const denomBasis = useAppStore(state => state.denomBasis);
  const analyzed = useAppStore(state => state.isGroupAnalyzed(OPERATIONS_TOOL_ID));
  const windowDays = useAppStore(state => state.dashWindowDays);
  const setWindow = useAppStore(state => state.setDashWindowDays);
  const setFilter = useAppStore(state => state.setDashboardFilter);
  const ready = Boolean(csvData.raw?.length && analyzed);
  const periods = useMemo(() => dashboardPeriods(ready ? csvData : null, filter, windowDays), [ready, csvData, filter, windowDays]);
  const bounds = useMemo(() => dateBounds(getMappedRows(ready ? csvData : null).map(row => row.date)), [ready, csvData]);
  const [replaceSample, setReplaceSample] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const filterNames = { countries: tr("국가", "Country"), platforms: tr("플랫폼", "Platform"), channels: tr("채널", "Channel"), sources: tr("유입", "Source") };
  const appliedScope = Object.entries(scopeFilters(filter)).filter(([, values]) => values.length).map(([key, values]) => `${filterNames[key]} ${values.join(", ")}`).join(" · ") || tr("전체 대상", "All entities");
  const metricName = effectiveDenomBasis(csvData, denomBasis) === "actions" ? "CPA" : "CPI";
  const applyDemo = () => {
    setReplaceSample(false);
    const state = useAppStore.getState();
    state.setDemoDisabled(false);
    state.setDenomBasis("installs");
    state.setDashWindowDays(7);
    const demo = buildToolDemo(OPERATIONS_TOOL_ID, locale);
    state.setCsvData(demo);
    state.setDisplayCurrency(demo.currency);
    state.setGroupAnalyzed(OPERATIONS_TOOL_ID);
    state.setDashboardFilter({ dateStart: null, dateEnd: null, compareEnabled: false, comparisonStart: null, comparisonEnd: null,
      platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set() });
  };
  const launchDemo = () => {
    if (csvData.raw?.length && !isDemoData(csvData)) setReplaceSample(true);
    else applyDemo();
  };
  // 공용 업로더가 접힌 상태로 재진입해도 명시적으로 선택한 예시 링크는 작동한다.
  useExampleLink(launchDemo);
  const downloadDemo = () => {
    const data = buildToolDemo(OPERATIONS_TOOL_ID, locale);
    downloadCsv(csvBody(data.headers, data.raw.map(row => data.headers.map(header => row[header]))), "fictional_operations_98days");
  };
  const inspectMapping = () => {
    setConditionsOpen(true);
    requestAnimationFrame(() => document.getElementById("ops-analysis-settings")?.focus());
  };
  return <ToolPageShell toolId={OPERATIONS_TOOL_ID} locale={locale} className="operations-planner" stickyHeader={false}>
    <details className={`operations-planner__conditions${ready ? " has-results" : ""}`} open={!ready || conditionsOpen}
      onToggle={event => { if (ready) setConditionsOpen(event.currentTarget.open); }}>
      <summary id="ops-analysis-settings">
        <span className="operations-planner__context">
          <strong>{ready ? tr("분석 조건", "Analysis settings") : tr("데이터 준비", "Prepare data")}</strong>
          {ready && <><span>{tr("최근", "Recent")} {periods.current.start} – {periods.current.end}<span className="operations-planner__prior"> · {tr("직전", "Prior")} {periods.previous.start} – {periods.previous.end}</span></span>
            <small>{isDemoData(csvData) ? tr("가상 예시", "Fictional sample") : csvData.fileName} · {tr(`${fmtNum(csvData.raw.length)}행`, `${fmtNum(csvData.raw.length)} source rows`)} · {metricName} · {sourceCurrencyOf(csvData)} · {appliedScope}</small></>}
        </span>
        <span className="operations-planner__conditions-action">{ready ? conditionsOpen ? tr("닫기", "Close") : tr("변경", "Edit") : tr("파일·예시", "File or sample")}</span>
      </summary>
      <div className={ready ? "tool-instrument-header tool-instrument-header--static tool-instrument-header--surface operations-planner__settings" : "operations-planner__entry"} data-currency-scope="declare">
        <CsvUploader toolId={OPERATIONS_TOOL_ID} locale={locale} onLoadDemo={launchDemo} />
        {ready && <>
          <DashboardFilterBar locale={locale} compact hideDate />
          <DashboardComparisonPeriod {...bounds} periods={periods} windowDays={windowDays} locale={locale}
            onWindowChange={days => { setWindow(days); setFilter({ dateStart: null, dateEnd: null, compareEnabled: false, comparisonStart: null, comparisonEnd: null }); }}
            onPeriodChange={(current, previous) => setFilter({ dateStart: current.start, dateEnd: current.end, compareEnabled: true, comparisonStart: previous.start, comparisonEnd: previous.end, comparisonPreset: "custom" })} />
          {isDemoData(csvData) && <aside className="operations-planner__demo" aria-label={tr("가상 데이터 데모 안내", "Fictional demo data")}>
            <div><strong>{tr("가상 운영 데이터로 체험 중", "Exploring fictional operations data")}</strong>
              <p>{tr("98일 이력 · 4개 캠페인. 기본은 최근 7일과 직전 7일 비교입니다. 후기 영상·기능 비교 이미지의 첫 관측과 캠페인 효율 변화를 확인하세요.", "98 days · 4 campaigns. Defaults to recent versus prior 7 days. Inspect first observations of new creatives and changing campaign efficiency.")}</p></div>
            <button type="button" className="btn ghost" onClick={downloadDemo}>{tr("데모 원본 CSV", "Download demo CSV")}</button>
          </aside>}
        </>}
      </div>
    </details>
    <ModalDialog open={replaceSample} onClose={() => setReplaceSample(false)} ariaLabel={tr("예시 데이터로 교체", "Replace with sample data")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <h2>{tr("현재 파일을 예시로 교체할까요?", "Replace the current file with the sample?")}</h2>
      <p>{tr("효율 도구에서 공유하는 현재 데이터가 바뀝니다. 내 파일을 다시 올리면 이어서 분석할 수 있습니다.", "This changes the dataset shared by efficiency tools. Upload your file again to continue its analysis.")}</p>
      <button className="btn primary" type="button" onClick={applyDemo}>{tr("예시로 교체", "Replace with sample")}</button>
      <button className="btn ghost" type="button" onClick={() => setReplaceSample(false)}>{tr("현재 파일 유지", "Keep current file")}</button>
    </ModalDialog>
    {ready && <OperationsResults csvData={csvData} filter={filter} periods={periods} denomBasis={denomBasis} currency={sourceCurrencyOf(csvData)} locale={locale} onInspectMapping={inspectMapping} />}
  </ToolPageShell>;
}
