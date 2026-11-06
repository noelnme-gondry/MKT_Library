"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMappedRows, getMonFilteredRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { fmtCurrency, fmtNum, fmtPct, sourceCurrencyOf } from "@/utils/format";
import { useAppStore } from "@/store/useDataStore";
import ToolPageShell from "@/components/ToolPageShell";
import ModalDialog from "@/components/ds/ModalDialog";
import CsvUploader from "@/components/CsvUploader";
import DashboardFilterBar from "@/components/dashboard/DashboardFilterBar";
import DashboardComparisonPeriod from "@/components/dashboard/DashboardComparisonPeriod";
import { operationsSourceRows, operationsPeriods, prepareOperationsIntervals, operationsSourceGrain } from "@/lib/operations/operationsIntervals";
import { dateBounds } from "@/lib/analysisPeriod";
import { isDemoData } from "@/lib/dataOrigin";
import { buildToolDemo } from "@/lib/toolDemo";
import useExampleLink from "@/components/ds/useExampleLink";
import { csvBody, downloadCsv } from "@/utils/download";
import { OPERATIONS_TOOL_ID } from "@/lib/operations/operationsDemo";
import { comparisonWarnings } from "@/lib/analysisPeriod";
import { scopeFilters } from "@/lib/analysis-results/scopeEvidence";
import { OPERATIONS_HOLDS } from "@/lib/operations/operationsBrief";
import { operationsPlanRange, planOperationsScenario } from "@/lib/operations/operationsScenario";
import { buildOperationsHistory } from "@/lib/operations/changeHistory";
import { operationsCreativeSignals } from "@/lib/operations/operationLoop";
import OperationsActionLoop from "./OperationsActionLoop";
import { operationsInputEvidence } from "@/lib/operations/operationsEvidence";
import OperationsPlanBoard from "./OperationsPlanBoard";
import OperationsDecisionEvidence from "./OperationsDecisionEvidence";
import OperationsMetricEvidence from "./OperationsMetricEvidence";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import PvmEfficiencyStages from "@/components/tools/PvmEfficiencyStages";

const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

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

function OperationsResults({ csvData, sourceRows, grain, filter, periods, denomBasis, currency, locale = "ko", onInspectMapping, dataOpen, setDataOpen }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const metric = effectiveDenomBasis(csvData, denomBasis);
  const metricName = metric === "actions" ? "CPA" : "CPI";
  const outcomeName = metric === "actions" ? tr("가입", "sign-ups") : tr("설치", "installs");
  const input = useMemo(() => ({ csvData, sourceRows, grain, filter, periods, metric, currency }), [csvData, sourceRows, grain, filter, periods, metric, currency]);
  const [bundle, setBundle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("actions");
  const [creativeSelection, setCreativeSelection] = useState(null);
  const [replanning, setReplanning] = useState(false);
  const [failure, setFailure] = useState(null);
  const [options, setOptions] = useState({ mode: "maintain", horizon: "week", targetTotal: null, changeLimit: .2 });
  const optionsRef = useRef(options);
  const limit = options.changeLimit;
  // 매핑/기간 변경 때 이전 결과를 먼저 숨긴다. 계산은 분석 게이트 안에서만,
  // 두 번의 rAF 뒤에 실행해 로딩 상태를 실제로 페인트한다.
  useEffect(() => {
    let active = true, frame2;
    const frame1 = requestAnimationFrame(() => { frame2 = requestAnimationFrame(() => {
      if (!active) return;
      try {
        const rows = input.sourceRows;
        const brief = prepareOperationsIntervals({ rows, periods: input.periods, metric: input.metric, grain: input.grain,
          mappedFields: Object.values(input.csvData.mapping || {}) });
        const evidence = operationsInputEvidence({ rows: brief.currentAvailable ? rows : [], mapping: input.csvData.mapping, period: input.periods.current, metric: input.metric });
        setBundle({ input, brief, evidence, rows: operationsSourceRows(getMappedRows(input.csvData)), history: buildOperationsHistory(rows, input.metric), signals: brief.sourceGrain === "day" ? operationsCreativeSignals(rows, input.metric) : [], plan: planOperationsScenario(brief, { ...optionsRef.current, range: operationsPlanRange(input.periods.current.end, optionsRef.current.horizon), currency: input.currency }) });
        setFailure(null);
      } catch { setFailure(input); }
    }); });
    return () => { active = false; cancelAnimationFrame(frame1); cancelAnimationFrame(frame2); };
    // 변경 한도만 바뀔 때는 이력 모형을 다시 적합하지 않는다.
  }, [input]);

  const ready = bundle?.input === input;
  const brief = ready ? bundle.brief : null;
  const plan = ready ? bundle.plan : null;
  const changeOptions = patch => {
    if (!ready) return;
    const next = { ...optionsRef.current, ...patch };
    optionsRef.current = next;
    setOptions(next);
    setReplanning(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (optionsRef.current !== next) return;
      try {
        const nextPlan = planOperationsScenario(brief, { ...next, range: operationsPlanRange(periods.current.end, next.horizon), currency });
        setBundle(current => current?.input === input ? { ...current, plan: nextPlan } : current);
      } finally { setReplanning(false); }
    }));
  };
  if (failure === input) return <div className="callout" role="alert">{tr("운영 계획을 계산할 수 없습니다. 데이터·매핑을 확인해 주세요.", "The operations plan could not be calculated. Check your data and mappings.")}</div>;
  if (!ready) return <><p role="status">{tr("운영 계획을 계산하고 있습니다…", "Calculating your operations plan…")}</p><AnalyzingOverlay show title={tr("운영 계획 계산 중…", "Calculating operations plan…")} /></>;
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("계산 불가", "Unavailable");
  const number = value => Number.isFinite(value) ? fmtNum(value) : tr("계산 불가", "Unavailable");
  const pct = value => Number.isFinite(value) ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmtPct(Math.abs(value) / 100)}` : tr("비교 불가", "Not comparable");
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
  const holdCopy = { direction: tr("증액 총액은 현재 기준보다 크게, 감액 총액은 작게 입력하세요.", "Enter a higher total to increase, or a lower total to decrease."), interval: tr("서로 겹치지 않는 완전한 집계 기간을 선택하세요. 주·월 자료를 날짜별로 나눌 수 없습니다.", "Select complete, non-overlapping periods. Weekly/monthly rows cannot be split into days."), grain: tr("원본의 날짜 단위를 확인하세요. 원본보다 작은 단위로 나눌 수 없습니다.", "Check source date units. Observations cannot be split into smaller units.") };
  const holdMessages = [...new Set(plan.holds.map(hold => holdCopy[hold.reason] || OPERATIONS_HOLDS[hold.reason]?.[locale] || OPERATIONS_HOLDS.missing[locale]))];
  const campaignById = new Map(brief.campaigns.map(row => [row.id, row]));
  const budgetRows = plan.items.map(row => ({ ...row, name: entity(campaignById.get(row.id)), context: campaignById.get(row.id).context,
    observedCpr: campaignById.get(row.id).current.cpr, baselineCpr: row.current / row.currentResults }));
  const isDemo = isDemoData(csvData);
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
  ], method: { name: "operations-brief", version: "1", assumptions: [`Budget mode: ${plan.mode}; plan period: ${plan.planRange.start}–${plan.planRange.end}; source: ${brief.sourceGrain}; curve observations: ${brief.grain}. Historical curves with recent exponential weights (14-day half-life), automatic regime selection; changes capped within observed/safe spend range. Execution amounts are daily equivalents.`], limitations: [...notes, "Model predictions are conditional, not guaranteed or causal gains.", ...holdMessages] } });

  return <OperationsActionLoop brief={brief} plan={plan} history={bundle.history} signals={bundle.signals} rows={bundle.rows} {...{ metric, currency, locale, isDemo, view, setView }}
    overview={chooseReview => <><OperationsPlanBoard {...{ brief, plan, options, money, pct, outcomeName, metricName, locale, holdMessages, metric, currency, isDemo }} signals={bundle.signals} today={localToday()} sourceThrough={bundle.history.end || bundle.history.dates.at(-1) || ""} onChange={changeOptions} selected={campaign?.id} onSelect={setSelected} busy={replanning} />
      <OperationsDecisionEvidence {...{ brief, plan, campaign, creative, setSelected, setCreativeSelection, metricName, outcomeName, currency, locale, periods, isDemo, money, number, pct, chooseReview }} signals={bundle.signals} />
      <ModalDialog open={dataOpen} onClose={() => setDataOpen(false)} ariaLabel={tr("입력·상세 데이터", "Inputs and detailed data")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel"><h2>{tr("입력과 지표 계산", "Inputs and metric calculations")}</h2><OperationsMetricEvidence inDialog evidence={bundle.evidence} {...{ currency, locale }} onInspectMapping={() => { setDataOpen(false); onInspectMapping(); }} /><button type="button" className="btn ghost" onClick={() => setDataOpen(false)}>{tr("닫기", "Close")}</button></ModalDialog></>}
    evidence={() => <ResultActionCard title={tr("선택 기간의 성과와 원본 근거", "Performance and source evidence for the selected periods")} headline={headline} tone={deteriorated.length ? "bad" : "neutral"}
    locale={locale} toolId={OPERATIONS_TOOL_ID} analysisKey="operations" resultState={brief.recentObservations ? "ready" : "insufficient"} issues={notes}
    stats={[{ label: tr("최근 광고비", "Recent spend"), value: money(brief.current.cost), detail: `${tr("직전", "Prior")} ${money(brief.previous.cost)}` },
      { label: tr(`최근 ${outcomeName}`, `Recent ${outcomeName}`), value: number(brief.current.results), detail: `${tr("직전", "Prior")} ${number(brief.previous.results)}` },
      { label: tr(`최근 ${metricName}`, `Recent ${metricName}`), value: money(brief.current.cpr), detail: `${tr("직전", "Prior")} ${money(brief.previous.cpr)}` },
      { label: tr("이 예산안의 예상 성과 변화", "Expected outcome change with this plan"), value: plan.ok ? pct(plan.improvementPct) : tr("추정 보류", "Withheld"), detail: tr("유지안과 조정안의 예상 성과 비교", "Expected outcomes: maintenance vs revised") },
    ]}
    scopeEvidence={{ observationUnit: tr(`${noun} × ${brief.grain === "month" ? "월" : brief.grain === "week" ? "주" : "일"}`, `${noun} × ${brief.grain}`), denominatorKey: metric, currency, filters: scopeFilters(filter),
      periods: [{ id: "after", ...periods.current, observations: brief.recentObservations }, { id: "before", ...periods.previous, observations: brief.priorObservations }] }}
    workbookExport={workbookExport}
    decisionReview={false}
    analysisContent={<div className="operations-brief">
      <section className="operations-data">
        <h3>{tr("차트의 상세 데이터", "Data behind the charts")}</h3>
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
      </section>
      <AnalyzingOverlay show={replanning} title={tr("예산 조정안 계산 중…", "Calculating budget adjustment…")} />
    </div>} />} />;
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
  const channelOptions = useMemo(() => ready ? [...new Set(getMappedRows(csvData).map(row => String(row.channel || "").trim()).filter(Boolean))].sort() : [], [ready, csvData]);
  const sourceRows = useMemo(() => operationsSourceRows(getMonFilteredRows(ready ? csvData : null, { ...filter, dateStart: null, dateEnd: null })), [ready, csvData, filter]);
  const periods = useMemo(() => operationsPeriods(sourceRows, filter, windowDays), [sourceRows, filter, windowDays]);
  const bounds = useMemo(() => dateBounds(sourceRows.flatMap(row => [row.date, row.periodEnd])), [sourceRows]);
  const [grain, setGrain] = useState("auto");
  const [replaceSample, setReplaceSample] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  // 입력 검증은 분석 조건의 일부다 — 결과 사이에 혼자 떠 있던 버튼을 조건 줄로 옮겼다.
  const [dataOpen, setDataOpen] = useState(false);
  const settingsTitleRef = useRef(null);
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
  };
  return <ToolPageShell toolId={OPERATIONS_TOOL_ID} locale={locale} className="operations-planner" stickyHeader={false} showBrief={false} showJourney={false} chips={ready ? <button type="button" className="btn secondary" onClick={() => setConditionsOpen(true)}>{tr("파일·대상·지표 변경", "File, scope & metric")}</button> : null}>
    <section className="ops-analysis-context" aria-label={tr("분석 조건", "Analysis settings")}>
      <div id="ops-analysis-settings" tabIndex={-1} className="ops-section-heading">
        <span className="operations-planner__context">
          <strong>{ready ? tr("분석 조건", "Analysis settings") : tr("데이터 준비", "Prepare data")}</strong>
          {ready && <small>{isDemoData(csvData) ? tr("가상 예시", "Fictional sample") : csvData.fileName} · {tr(`${fmtNum(csvData.raw.length)}행`, `${fmtNum(csvData.raw.length)} source rows`)} · {metricName} · {sourceCurrencyOf(csvData)} · {appliedScope} · <button type="button" className="operations-planner__inputs" onClick={() => setDataOpen(true)}>{tr("입력·상세 데이터 확인", "Inspect inputs and detailed data")}</button></small>}
        </span>
      </div>
      {!ready && <div className="operations-planner__entry"><CsvUploader toolId={OPERATIONS_TOOL_ID} locale={locale} onLoadDemo={launchDemo} /></div>}
      {ready && <><DashboardComparisonPeriod compact {...bounds} periods={periods} windowDays={windowDays} locale={locale} showPresets={operationsSourceGrain(sourceRows) === "day"}
            onWindowChange={days => { setWindow(days); setFilter({ dateStart: null, dateEnd: null, compareEnabled: false, comparisonStart: null, comparisonEnd: null }); }}
            onPeriodChange={(current, previous) => setFilter({ dateStart: current.start, dateEnd: current.end, compareEnabled: true, comparisonStart: previous.start, comparisonEnd: previous.end, comparisonPreset: "custom" })} />
        <label className="ops-grain-control">{tr("차트 집계 단위", "Chart interval")} <select value={grain} onChange={event => setGrain(event.target.value)}><option value="auto">{tr("원본 날짜 형식에 맞춤", "Match source date format")}</option><option value="day">{tr("일별", "Daily")}</option><option value="week">{tr("주별", "Weekly")}</option><option value="month">{tr("월별", "Monthly")}</option></select></label></>}
      {ready && channelOptions.length > 1 && <div className="ops-scope-chips" role="group" aria-label={tr("분석에 포함할 매체", "Channels included in the analysis")}><span>{tr("포함할 매체", "Included channels")}</span>{channelOptions.map(channel => {
        const selected = filter.channels?.size ? channelOptions.filter(value => filter.channels.has(value)) : channelOptions;
        const included = selected.includes(channel);
        return <button type="button" key={channel} aria-pressed={included} disabled={included && selected.length === 1} onClick={() => {
          const next = new Set(included ? selected.filter(value => value !== channel) : [...selected, channel]);
          setFilter({ channels: next.size === channelOptions.length ? new Set() : next });
        }}>{included ? "✓ " : ""}{channel}</button>;
      })}{filter.channels?.size > 0 && <button type="button" className="btn ghost" onClick={() => setFilter({ channels: new Set() })}>{tr("전체 포함", "Include all")}</button>}</div>}
      <ModalDialog initialFocusRef={settingsTitleRef} open={ready && conditionsOpen} onClose={() => setConditionsOpen(false)} ariaLabel={tr("파일·분석 대상 설정", "File and analysis scope")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel"><h2 ref={settingsTitleRef} tabIndex={-1} id="ops-settings-dialog-title">{tr("파일·분석 대상 설정", "File and analysis scope")}</h2><div className="operations-planner__settings" data-currency-scope="declare">
        <CsvUploader toolId={OPERATIONS_TOOL_ID} locale={locale} onLoadDemo={launchDemo} />
        <DashboardFilterBar locale={locale} compact hideDate /><p>{tr("날짜가 2026-W40처럼 주차이거나 2026-10처럼 월이면 그 기간의 합계로 읽습니다. 주·월 합계를 하루 날짜로 적은 파일은 날짜 형식을 먼저 맞춰 주세요.", "Week labels such as 2026-W40 and month labels such as 2026-10 are treated as period totals. Relabel weekly/monthly totals recorded as individual dates before analysis.")}</p>
          {isDemoData(csvData) && <aside className="operations-planner__demo" aria-label={tr("가상 데이터 데모 안내", "Fictional demo data")}>
            <div><strong>{tr("가상 운영 데이터로 체험 중", "Exploring fictional operations data")}</strong>
              <p>{tr("98일 이력 · 4개 캠페인. 전체 이력의 변화와 액션을 함께 보고, 근거 보기에서 선택한 기간의 효율을 비교하세요.", "98 days · 4 campaigns. Inspect changes and actions across the full history, then compare selected periods in Evidence.")}</p></div>
            <button type="button" className="btn ghost" onClick={downloadDemo}>{tr("데모 원본 CSV", "Download demo CSV")}</button>
          </aside>}
        <button type="button" className="btn secondary" onClick={() => setConditionsOpen(false)}>{tr("결과로 돌아가기", "Back to results")}</button>
      </div></ModalDialog>
    </section>
    <ModalDialog open={replaceSample} onClose={() => setReplaceSample(false)} ariaLabel={tr("예시 데이터로 교체", "Replace with sample data")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <h2>{tr("현재 파일을 예시로 교체할까요?", "Replace the current file with the sample?")}</h2>
      <p>{tr("효율 도구에서 공유하는 현재 데이터가 바뀝니다. 내 파일을 다시 올리면 이어서 분석할 수 있습니다.", "This changes the dataset shared by efficiency tools. Upload your file again to continue its analysis.")}</p>
      <button className="btn primary" type="button" onClick={applyDemo}>{tr("예시로 교체", "Replace with sample")}</button>
      <button className="btn ghost" type="button" onClick={() => setReplaceSample(false)}>{tr("현재 파일 유지", "Keep current file")}</button>
    </ModalDialog>
    {ready && <OperationsResults {...{ csvData, sourceRows, grain, filter, periods, denomBasis, locale }} currency={sourceCurrencyOf(csvData)} onInspectMapping={inspectMapping} {...{ dataOpen, setDataOpen }} />}
  </ToolPageShell>;
}
