"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { fmtCurrency, fmtNum } from "@/utils/format";
import { FigureHead } from "@/components/ds/FigurePngButton";
import PillGroup from "@/components/ds/PillGroup";
import { figureExportContext } from "@/utils/figureExportContext";
import { stageWaterfall } from "@/lib/operations/operationsReview";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { operationContributionLabels, operationsScatterEvidence } from "@/lib/operations/operationsPresentation";

const money = (value, currency) => fmtCurrency(value, { currency, precise: true });
const shortDate = date => date.slice(5);
const operationsChartOptions = () => {
  const options = chartCommonOpts();
  return { ...options, animation: { ...options.animation, duration: Math.min(options.animation.duration, 280) } };
};
const nameLines = name => {
  const words = String(name).split(" ");
  const lines = [""];
  for (const word of words) {
    if ((lines.at(-1) + word).length > 17 && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] += (lines.at(-1) ? " " : "") + word;
  }
  return lines;
};

function ChartCanvas({ config, label, title = label, description, headingId, scopeLabel, fileName, locale, currency, periods, isDemo, className = "", height, controls }) {
  const canvas = useRef(null);
  useEffect(() => {
    if (!canvas.current) return undefined;
    const chart = new Chart(canvas.current.getContext("2d"), config);
    const frame = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(frame); chart.destroy(); };
  }, [config]);
  const comparison = periods?.previous ? `${locale === "en" ? "Comparison" : "비교"}: ${periods.previous.start} – ${periods.previous.end}` : null;
  return <figure className={`operations-chart ${className}`}>
    <FigureHead level={3} id={headingId} title={title} description={description} target={canvas} locale={locale} fileName={fileName}
      exportTitle={[title, scopeLabel].filter(Boolean).join(" · ")}
      context={figureExportContext({ title: label, locale, scope: { dateStart: periods?.current.start, dateEnd: periods?.current.end, caption: [currency, scopeLabel, comparison].filter(Boolean).join(" · ") }, source: { importSource: isDemo ? "demo" : "csv" } })} />
    {controls}
    <div className="chart-container" style={height ? { height } : undefined}><canvas ref={canvas} role="img" aria-label={label} /></div>
  </figure>;
}

export function OperationsCprScatter({ campaign, model, metricName, currency, locale, isDemo, currentSpend, plannedSpend }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const scale = campaign.displayDays || 1;
  const unit = campaign.grain === "week" ? tr("주", "week") : campaign.grain === "month" ? tr("30일 환산", "30-day equivalent") : tr("일", "day");
  const title = tr(`지출과 ${metricName}의 관측 관계`, `Observed relationship between spend and ${metricName}`);
  const [showEarlier, setShowEarlier] = useState(false), [spend, setSpend] = useState(null);
  const evidence = useMemo(() => operationsScatterEvidence(campaign, model), [campaign, model]);
  const x = model ? Math.max(model.xMin, Math.min(model.xMax, spend ?? currentSpend ?? (model.xMin + model.xMax) / 2)) : null;
  const prediction = x != null && evidence.fitted.length ? model.model.predict(x) : null;
  const budgetPrediction = x != null ? ALLOC_MATH.predictSafeCpr(model, x) : null;
  const config = useMemo(() => {
    const opts = operationsChartOptions();
    const displayPoints = points => points.map(point => ({ ...point, x: point.x * scale }));
    const datasets = [
      { label: evidence.fitted.length ? tr("추세에 사용한 관측", "Observations used in fit") : tr("실제 관측", "Observed data"), data: displayPoints(evidence.used), backgroundColor: CHART_THEME.primary, pointRadius: 4 },
    ];
    if (evidence.fitted.length) datasets.push({ label: tr("관측 추세", "Observed trend"), data: displayPoints(evidence.fitted), showLine: true, borderColor: CHART_THEME.primary, pointRadius: 0, borderWidth: 2 });
    if (evidence.excluded.length) datasets.push({ label: tr("해당 기간의 제외 관측", "Excluded observations in fit period"), data: displayPoints(evidence.excluded), pointStyle: "crossRot", pointRadius: 6, borderWidth: 2, borderColor: CHART_THEME.comparison });
    if (showEarlier && evidence.earlier.length) datasets.push({ label: tr("이전 기간 관측", "Earlier observations"), data: displayPoints(evidence.earlier), backgroundColor: "transparent", borderColor: CHART_THEME.comparison, pointRadius: 3 });
    if (Number.isFinite(prediction) && prediction > 0) datasets.push({ label: tr("선택한 지출의 추세값", "Trend at selected spend"), data: [{ x: x * scale, y: prediction }], backgroundColor: CHART_THEME.surface, borderColor: CHART_THEME.primary, borderWidth: 3, pointRadius: 6 });
    return { type: "scatter", data: { datasets }, plugins: [{ id: "operations-budget-markers", afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const markers = [[currentSpend, tr("현재", "Current"), CHART_THEME.comparison], [plannedSpend, tr("조정안", "Plan"), CHART_THEME.primary]].filter(([value]) => Number.isFinite(value) && value * scale >= scales.x.min && value * scale <= scales.x.max).map(([value, label, color]) => ({ x: scales.x.getPixelForValue(value * scale), label, color }));
      ctx.save(); ctx.font = `600 ${Chart.defaults.font.size}px ${Chart.defaults.font.family}`; ctx.textAlign = "center";
      const close = markers.length === 2 && Math.abs(markers[0].x - markers[1].x) < 90;
      const center = close ? Math.max(chartArea.left + 50, Math.min(chartArea.right - 50, (markers[0].x + markers[1].x) / 2)) : 0;
      markers.forEach((marker, index) => {
        const labelX = close ? center + (index ? 38 : -38) : Math.max(chartArea.left + 30, Math.min(chartArea.right - 30, marker.x));
        ctx.strokeStyle = marker.color; ctx.fillStyle = marker.color; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(marker.x, chartArea.top); ctx.lineTo(marker.x, chartArea.bottom); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(labelX, chartArea.top - 6); ctx.lineTo(marker.x, chartArea.top); ctx.stroke(); ctx.fillText(marker.label, labelX, chartArea.top - 12);
      }); ctx.restore();
    } }], options: { ...opts, layout: { ...opts.layout, padding: { top: 28 } }, responsive: true, maintainAspectRatio: false, interaction: { mode: "nearest", intersect: false },
      scales: { ...opts.scales, x: { ...opts.scales?.x, type: "linear", title: { display: true, text: tr(`${unit} 지출 (${currency})`, `Spend per ${unit} (${currency})`), color: CHART_THEME.text } },
        y: { ...opts.scales?.y, title: { display: true, text: `${metricName} (${currency})`, color: CHART_THEME.text } } },
      plugins: { ...opts.plugins, legend: { ...opts.plugins.legend, position: "bottom" }, tooltip: { mode: "nearest", intersect: false, callbacks: { label: context => `${context.raw.date || context.dataset.label}: ${money(context.raw.x, currency)} / ${money(context.raw.y, currency)}` } } },
    } };
  // Locale is the sole dependency of the text selector.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence, showEarlier, metricName, currency, locale, x, prediction, scale, unit, currentSpend, plannedSpend]);
  const fitted = evidence.fitted.length > 0;
  return <div className="operations-scatter">
    <ChartCanvas config={config} title={title} label={`${campaign.name} · ${title}`} scopeLabel={campaign.name}
      description={fitted ? tr(`${evidence.start}–${evidence.end} · 모형에 사용한 관측 ${evidence.used.length}개 · 제외 ${evidence.excluded.length}개`, `${evidence.start}–${evidence.end} · ${evidence.used.length} observations used · ${evidence.excluded.length} excluded`)
        : tr("모형 근거가 부족해 추세 예측을 보류합니다. 실제 관측점만 표시합니다.", "Trend prediction withheld: insufficient model evidence. Observed points remain visible.")}
      controls={evidence.earlier.length > 0 && <label className="operations-scatter__toggle"><input type="checkbox" checked={showEarlier} onChange={event => setShowEarlier(event.target.checked)} />{tr(`이전 기간 관측 ${evidence.earlier.length}개 함께 보기`, `Show ${evidence.earlier.length} earlier observations`)}</label>}
      fileName="operations-spend-cpr-trend" {...{ locale, currency, isDemo }} periods={{ current: { start: showEarlier ? campaign.trend[0]?.date : evidence.start, end: evidence.end } }} />
    <div className="ops-spend-range"><span>{tr("실제 지출 범위 · 전체 자료", "Observed spending range · all data")} · {campaign.grain === "month" ? tr("월 합계", "monthly totals") : campaign.grain === "week" ? tr("주 합계", "weekly totals") : tr("일 합계", "daily totals")}</span><span>{tr("최소", "Min")} {money(Math.min(...campaign.trend.map(row => row.rawCost ?? row.cost)), currency)} · {tr("최대", "Max")} {money(Math.max(...campaign.trend.map(row => row.rawCost ?? row.cost)), currency)}</span></div>
    {campaign.grain === "month" && <p className="operations-chart__caption">{tr("월별 관측점을 30일 기준으로 환산한 추세입니다. 위 최소·최대는 실제 월 합계입니다.", "Monthly observations are normalized to 30 days in the trend. Min/max above are actual monthly totals.")}</p>}
    {campaign.incompleteIntervals > 0 && <p className="operations-chart__caption">{tr(`집계 기간이 완전하지 않은 ${campaign.incompleteIntervals}개 구간은 추세에서 제외했습니다.`, `${campaign.incompleteIntervals} incomplete intervals are excluded from the trend.`)}</p>}
    {fitted && <div className="operations-scatter__prediction"><label>{tr("비교할 지출", "Spend to compare")} · {unit} <strong>{money(x * scale, currency)}</strong><input type="range" min={model.xMin * scale} max={model.xMax * scale} step="any" value={x * scale} onChange={event => setSpend(Number(event.target.value) / scale)} /></label>
      <p>{tr(`같은 추세가 이어질 때 예상 ${metricName}`, `Predicted ${metricName} if the trend continues`)} <strong>{Number.isFinite(prediction) && prediction > 0 ? money(prediction, currency) : tr("추정 불가", "Unavailable")}</strong></p>
      {Number.isFinite(prediction) && Number.isFinite(budgetPrediction) && Math.abs(prediction - budgetPrediction) > 0.01 && <p className="operations-chart__caption">{tr(`예산 계산에는 보정된 ${metricName} ${money(budgetPrediction, currency)}를 씁니다. 곡선이 꺾이는 구간을 그 경계값으로 고정한 값이며, 위 추세선과 구분합니다.`, `Budget calculations use adjusted ${metricName} ${money(budgetPrediction, currency)}. Values beyond a turning point are held at that boundary, separately from the fitted trend above.`)}</p>}
      <p className="operations-chart__caption">{tr("소재 투입·종료·교체의 성과 효과는 예측하지 않습니다.", "Performance effects of creative launches, removals or replacements are not predicted.")}</p>
    </div>}
  </div>;
}

export function OperationsTrend({ rows, metricName, currency, locale, periods, isDemo, grain = "day" }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const [view, setView] = useState("cpr");
  const views = { cpr: metricName, cost: tr("광고비", "Spend"), results: tr("성과수", "Outcomes") };
  const config = useMemo(() => {
    const opts = operationsChartOptions();
    const label = view === "cpr" ? metricName : view === "cost" ? (locale === "en" ? "Spend" : "광고비") : (locale === "en" ? "Outcomes" : "성과수");
    const format = value => view === "results" ? fmtNum(value) : money(value, currency);
    return { type: "line", data: { labels: rows.map(row => row.date), datasets: [{ label, data: rows.map(row => row[view]),
      borderColor: CHART_THEME.primary, backgroundColor: CHART_THEME.primary, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, spanGaps: false }] },
      plugins: [{ id: "operations-periods", beforeDatasetsDraw(chart) {
        const { ctx, scales: { x }, chartArea } = chart;
        for (const [range, recent] of [[periods.previous, false], [periods.current, true]]) {
          const first = rows.findIndex(row => row.date >= range.start && row.date <= range.end);
          const last = rows.findLastIndex(row => row.date >= range.start && row.date <= range.end);
          if (first < 0) continue;
          const half = rows.length > 1 ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) / 2 : 0;
          const left = Math.max(chartArea.left, x.getPixelForValue(first) - half);
          const right = Math.min(chartArea.right, x.getPixelForValue(last) + half), height = chartArea.bottom - chartArea.top;
          ctx.save(); ctx.beginPath(); ctx.rect(left, chartArea.top, right - left, height); ctx.clip();
          if (recent) {
            ctx.globalAlpha = 0.07; ctx.fillStyle = CHART_THEME.primary;
            ctx.fillRect(left, chartArea.top, right - left, height);
          } else {
            ctx.globalAlpha = 0.2; ctx.strokeStyle = CHART_THEME.comparison; ctx.lineWidth = 1;
            for (let diagonal = left - height; diagonal < right; diagonal += 8) {
              ctx.beginPath(); ctx.moveTo(diagonal, chartArea.bottom); ctx.lineTo(diagonal + height, chartArea.top); ctx.stroke();
            }
          }
          ctx.restore(); ctx.save(); ctx.strokeStyle = recent ? CHART_THEME.primary : CHART_THEME.comparison;
          ctx.lineWidth = 1; ctx.setLineDash(recent ? [] : [4, 3]);
          ctx.strokeRect(left, chartArea.top, right - left, height); ctx.restore();
        }
      } }],
      options: { ...opts, plugins: { ...opts.plugins, legend: { display: false }, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${label} ${format(context.parsed.y)}` } } },
        scales: { x: { ...opts.scales.x, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 6, maxRotation: 0, callback: (_, index) => shortDate(rows[index].date) } },
          y: { ...opts.scales.y, beginAtZero: true, ticks: { ...opts.scales.y.ticks, callback: format }, title: { display: true, text: view === "results" ? label : `${label} · ${currency}`, color: CHART_THEME.muted } } } } };
  }, [rows, view, metricName, currency, locale, periods]);
  if (!rows.length) return <><h3 id="ops-trend-title">{tr("전체 실적 추이", "Portfolio performance trend")}</h3><p>{tr("추세를 계산할 관측이 없습니다.", "No observations are available for a trend.")}</p></>;
  return <div className="operations-trend">
    <ChartCanvas config={config} headingId="ops-trend-title" title={tr(`${grain === "month" ? "월별" : grain === "week" ? "주별" : "일별"} ${views[view]} 추이`, `${grain === "month" ? "Monthly" : grain === "week" ? "Weekly" : "Daily"} ${views[view]} trend`)} description={tr("각 집계 기간에 실제 관측한 값", "Actual observations for each interval")} label={tr(`기간별 실측 ${views[view]}`, `Observed ${views[view]} by interval`)} fileName="operations_daily_unit_cost" locale={locale} currency={currency} periods={{ current: { start: rows[0].date, end: rows.at(-1).end || rows.at(-1).date } }} isDemo={isDemo} controls={<div className="operations-chart__toolbar">
      <PillGroup ariaLabel={tr("추세 지표", "Trend metric")} options={Object.entries(views).map(([value, label]) => ({ value, label }))} value={view} onChange={setView} />
      <span>{rows[0].date} – {rows.at(-1).date}</span>
    </div>} />
    <p className="operations-chart__caption"><span><i className="operations-key operations-key--previous" aria-hidden="true" />{tr("직전 · 사선", "Prior · hatched")} {periods.previous.start} – {periods.previous.end}</span><span><i className="operations-key" aria-hidden="true" />{tr("최근 · 채움", "Recent · filled")} {periods.current.start} – {periods.current.end}</span>
      <span>{tr("실측 집계 · 결측은 연결하지 않음", "Observed aggregates · gaps stay disconnected")}</span></p>
  </div>;
}

export function OperationsBudgetChart({ rows, currency, locale, periods, isDemo }) {
  const shown = rows.slice(0, 12);
  const config = useMemo(() => {
    const opts = operationsChartOptions();
    return { type: "bar", data: { labels: rows.slice(0, 12).map(row => nameLines(row.name)), datasets: [
      { label: locale === "en" ? "Current / day" : "현재 / 일", data: rows.slice(0, 12).map(row => row.current), backgroundColor: CHART_THEME.comparison, maxBarThickness: 10, borderRadius: 3 },
      { label: locale === "en" ? "Revised / day" : "조정안 / 일", data: rows.slice(0, 12).map(row => row.budget), backgroundColor: CHART_THEME.primary, maxBarThickness: 14, borderRadius: 3 }] },
      plugins: [{ id: "operations-budget-labels", afterDatasetsDraw(chart) {
        const { ctx } = chart, font = opts.plugins.legend.labels.font;
        ctx.save(); ctx.fillStyle = CHART_THEME.textPrimary; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = `${font.size}px ${font.family}`;
        for (const [datasetIndex, dataset] of chart.data.datasets.entries()) {
          for (const [index, element] of chart.getDatasetMeta(datasetIndex).data.entries()) ctx.fillText(money(dataset.data[index], currency), element.x + 6, element.y);
        }
        ctx.restore();
      } }],
      options: { ...opts, indexAxis: "y", layout: { padding: { right: 8 } }, plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${context.dataset.label} ${money(context.parsed.x, currency)}` } } },
        scales: { x: { ...opts.scales.x, beginAtZero: true, grace: "45%", title: { display: true, text: `${locale === "en" ? "Daily budget" : "하루 예산"} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 4, callback: value => money(value, currency) } }, y: { ...opts.scales.y, grid: { display: false } } } } };
  }, [rows, currency, locale]);
  return <><ChartCanvas config={config} title={locale === "en" ? "Campaign daily budgets" : "캠페인별 하루 예산"} label={locale === "en" ? "Daily budget: current versus revised" : "하루 예산: 현재와 조정안 비교"} fileName="operations_budget" locale={locale} currency={currency} periods={periods} isDemo={isDemo} height={Math.max(280, shown.length * 58 + 55)} />
    {shown.length < rows.length && <p className="operations-chart__caption">{locale === "en" ? `${shown.length} of ${rows.length} shown. Totals cover all entities; complete values are below.` : `${rows.length}개 중 ${shown.length}개 표시. 합계는 전체 대상 기준이며 아래에서 전체 수치를 확인할 수 있습니다.`}</p>}</>;
}

export function OperationsCampaignChart({ rows, selected, onSelect, metricName, currency, locale, periods, isDemo }) {
  const shown = rows.slice(0, 12);
  const config = useMemo(() => {
    const opts = operationsChartOptions(), data = rows.slice(0, 12);
    return { type: "scatter", data: { datasets: [
      { label: locale === "en" ? "Prior (upper)" : "직전 (위)", data: data.flatMap((row, index) => row.previous.cpr == null ? [] : [{ x: row.previous.cpr, y: index - 0.18, id: row.id }]), pointStyle: "circle", pointRadius: 5, backgroundColor: CHART_THEME.comparison },
      { label: locale === "en" ? "Recent (lower)" : "최근 (아래)", data: data.flatMap((row, index) => row.current.cpr == null ? [] : [{ x: row.current.cpr, y: index + 0.18, id: row.id }]), pointStyle: "triangle", pointRadius: context => context.raw?.id === selected ? 8 : 6, pointBorderColor: CHART_THEME.textPrimary, pointBorderWidth: context => context.raw?.id === selected ? 2 : 0, backgroundColor: CHART_THEME.primary }] },
      plugins: [{ id: "operations-cost-connectors", beforeDatasetsDraw(chart) {
        const { ctx, scales: { x, y } } = chart; ctx.save(); ctx.strokeStyle = CHART_THEME.comparison; ctx.lineWidth = 1.5;
        for (const [index, row] of data.entries()) if (row.previous.cpr != null && row.current.cpr != null) {
          ctx.beginPath(); ctx.moveTo(x.getPixelForValue(row.previous.cpr), y.getPixelForValue(index - 0.18)); ctx.lineTo(x.getPixelForValue(row.current.cpr), y.getPixelForValue(index + 0.18)); ctx.stroke();
        }
        ctx.restore();
      }, afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save(); ctx.fillStyle = CHART_THEME.textPrimary;
        const font = opts.plugins.legend.labels.font;
        ctx.font = `600 ${font.size}px ${font.family}`;
        for (const [datasetIndex, dataset] of chart.data.datasets.entries()) {
          for (const [index, element] of chart.getDatasetMeta(datasetIndex).data.entries()) {
            const point = dataset.data[index], text = money(point.x, currency), width = ctx.measureText(text).width;
            const x = Math.max(chartArea.left + width / 2, Math.min(chartArea.right - width / 2, element.x));
            ctx.textAlign = "center";
            ctx.fillText(text, x, element.y + (datasetIndex ? 24 : -12));
          }
        }
        ctx.restore();
      } }],
      options: { ...opts, onClick: (_, elements, chart) => { const point = elements[0]; if (point) onSelect(chart.data.datasets[point.datasetIndex].data[point.index].id); },
        plugins: { ...opts.plugins, legend: { ...opts.plugins.legend, labels: { ...opts.plugins.legend.labels, pointStyle: undefined } }, tooltip: { ...opts.plugins.tooltip, callbacks: { title: contexts => data.find(row => row.id === contexts[0].raw.id).name, label: context => `${context.dataset.label} ${metricName} ${money(context.parsed.x, currency)}` } } },
        scales: { x: { ...opts.scales.x, type: "linear", beginAtZero: true, title: { display: true, text: `${metricName} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 4, callback: value => money(value, currency) } },
          y: { ...opts.scales.y, type: "linear", reverse: true, min: -0.5, max: data.length - 0.5, grid: { display: false },
            afterBuildTicks: axis => { axis.ticks = data.map((_, value) => ({ value })); },
            ticks: { ...opts.scales.y.ticks, stepSize: 1, callback: value => {
              const row = data[value];
              if (!row) return "";
              const change = row.changePct == null ? (locale === "en" ? "No prior comparison" : "직전 비교 불가") : `${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(1)}%`;
              return [...nameLines(row.name), change];
            } } } } } };
  }, [rows, metricName, currency, locale, onSelect, selected]);
  return <>
    <ChartCanvas config={config} headingId="ops-campaign-title" title={locale === "en" ? `Campaign ${metricName} changes` : `캠페인 ${metricName} 변동`} label={locale === "en" ? `Campaign ${metricName}: prior and recent` : `캠페인별 직전·최근 ${metricName}`} fileName="operations_campaign_cost" locale={locale} currency={currency} periods={periods} isDemo={isDemo} height={Math.max(320, shown.length * 90 + 80)} />
    <label className="operations-target-select">{locale === "en" ? "Select a campaign" : "캠페인 선택"}
      <select value={selected || ""} onChange={event => onSelect(event.target.value)}>
        {rows.map(row => <option key={row.id} value={row.id}>{row.name} · {row.context}</option>)}
      </select>
    </label>
    <p className="operations-chart__caption">{locale === "en" ? `Each campaign: prior ● above, recent ▲ below. Horizontal position is the actual cost; the row label shows its change. Lower cost is better. Select a point or choose a campaign. ${shown.length} of ${rows.length} shown; complete values are below.` : `캠페인마다 위는 직전 ●, 아래는 최근 ▲입니다. 가로 위치는 실제 단가, 이름 아래는 변화율입니다. 단가가 낮을수록 효율이 좋습니다. 점을 누르거나 캠페인을 선택하세요. ${rows.length}개 중 ${shown.length}개 표시 · 전체 수치는 아래 표에 있습니다.`}</p>
  </>;
}

export function OperationsStageChart({ value, metricName, currency, locale, periods, isDemo, scopeLabel }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const config = useMemo(() => {
    const names = { impressions: locale === "en" ? "Impressions" : "노출", clicks: locale === "en" ? "Clicks" : "클릭", installs: locale === "en" ? "Installs" : "설치", actions: locale === "en" ? "Sign-ups" : "가입" };
    const label = item => item === "previous" ? (locale === "en" ? "Prior" : "직전") : item === "current" ? (locale === "en" ? "Recent" : "최근")
      : item.key === "cpm" ? "CPM" : `${names[item.fromField]} → ${names[item.toField]}`;
    const bars = stageWaterfall(value, label), opts = operationsChartOptions();
    return { type: "bar", data: { labels: bars.map(row => nameLines(row.label)), datasets: [{ label: metricName, data: bars.map(row => row.range),
      backgroundColor: bars.map(row => row.total ? CHART_THEME.primary : row.amount > 0 ? CHART_THEME.danger : CHART_THEME.success), maxBarThickness: 52 }] },
      plugins: [{ id: "operations-waterfall-labels", afterDatasetsDraw(chart) {
        const { ctx } = chart; const elements = chart.getDatasetMeta(0).data;
        const font = opts.plugins.legend.labels.font;
        ctx.save(); ctx.fillStyle = CHART_THEME.textPrimary; ctx.textAlign = "center"; ctx.font = `600 ${font.size}px ${font.family}`;
        for (const [index, element] of elements.entries()) { const row = bars[index]; ctx.fillText(`${!row.total && row.amount > 0 ? "+" : ""}${money(row.amount, currency)}`, element.x, Math.min(element.y, element.base) - 9); }
        ctx.restore();
      } }],
      options: { ...opts, layout: { padding: { top: 32, right: 8, left: 4, bottom: 8 } }, plugins: { ...opts.plugins, legend: { display: false }, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${metricName} ${money(bars[context.dataIndex].amount, currency)}` } } },
        scales: { x: { ...opts.scales.x, grid: { display: false }, ticks: { ...opts.scales.x.ticks, maxRotation: 0 } }, y: { ...opts.scales.y, beginAtZero: true, grace: "20%", title: { display: true, text: `${metricName} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.y.ticks, callback: amount => money(amount, currency) } } } } };
  }, [value, metricName, currency, locale]);
  if (!value?.ok) return <p className="chart-empty">{tr("단계별 데이터가 불완전해 기여를 나눌 수 없습니다.", "Stage data is incomplete; contributions cannot be separated.")}</p>;
  return <>
    <ChartCanvas config={config} scopeLabel={scopeLabel} title={tr(`단계별 ${metricName} 변화 기여`, `${metricName} change by stage`)} label={tr("단계별 단가 변화 워터폴", "Unit-cost change waterfall by stage")} fileName="operations_stage_waterfall" locale={locale} currency={currency} periods={periods} isDemo={isDemo} />
    <p className="operations-chart__caption">{tr("직전 단가 + 단계별 변화 기여 = 최근 단가. 단계별 집계의 산술 분해이며 원인을 증명하지 않습니다.", "Prior unit cost + stage contributions = recent unit cost. Arithmetic decomposition of aggregates does not prove causation.")}</p>
  </>;
}

export function OperationsMixChart({ value, currency, locale, periods, isDemo, metricName, scopeLabel }) {
  const config = useMemo(() => {
    const opts = operationsChartOptions(), rows = value?.finest || [];
    return { type: "bar", data: { labels: rows.map(row => nameLines(row.crKey || (locale === "en" ? "Unspecified" : "미지정"))), datasets: [
      { label: operationContributionLabels(metricName, locale).share, data: rows.map(row => row.mix), backgroundColor: CHART_THEME.comparison, maxBarThickness: 12 },
      { label: operationContributionLabels(metricName, locale).cost, data: rows.map(row => row.rate), backgroundColor: CHART_THEME.primary, maxBarThickness: 18 }] },
      options: { ...opts, indexAxis: "y", plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${context.dataset.label} ${money(context.parsed.x, currency)}` } } },
        scales: { x: { ...opts.scales.x, stacked: true, title: { display: true, text: `${metricName} ${locale === "en" ? "contribution" : "변화 기여"} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 5, callback: amount => money(amount, currency) } }, y: { ...opts.scales.y, stacked: true, grid: { display: false } } } } };
  }, [value, currency, locale, metricName]);
  if (!value) return <p className="chart-empty">{locale === "en" ? "Insufficient creative observations in the two periods." : "두 기간의 소재별 관측이 부족해 구성·단가 기여를 구분할 수 없습니다."}</p>;
  return <ChartCanvas config={config} scopeLabel={scopeLabel} label={operationContributionLabels(metricName, locale).title} fileName="operations_creative_contributions" locale={locale} currency={currency} periods={periods} isDemo={isDemo} height={Math.max(280, value.finest.length * 40 + 70)} />;
}

export function OperationsCreativeChart({ rows, currency, locale, metricName, periods, isDemo, selected, onSelect }) {
  const valid = useMemo(() => rows.filter(row => row.cost != null && row.cpr != null && row.results > 0).sort((a, b) => b.cost - a.cost).slice(0, 60), [rows]);
  const config = useMemo(() => {
    const opts = operationsChartOptions(), max = Math.max(...valid.map(row => row.results), 1);
    return { type: "bubble", data: { datasets: [true, false].map(isNew => ({
      label: locale === "en" ? (isNew ? "First seen this period" : "Established") : isNew ? "이번 기간 첫 관측" : "기존 소재",
      // Chart.js의 원은 πr², rectRot은 2r²: 같은 성과수의 실제 면적을 맞춘다.
      data: valid.filter(row => row.isNew === isNew).map(row => ({ x: row.cost, y: row.cpr, r: 23 * Math.sqrt(row.results / max) * (isNew ? Math.sqrt(Math.PI / 2) : 1), id: row.id, row })),
      pointStyle: isNew ? "rectRot" : "circle", backgroundColor: isNew ? CHART_THEME.primary : CHART_THEME.comparison,
      borderColor: CHART_THEME.textPrimary, borderWidth: context => context.raw?.id === selected ? 3 : 1,
    })) }, plugins: [{ id: "operations-selected-creative", afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart, font = opts.plugins.legend.labels.font;
      for (const [datasetIndex, dataset] of chart.data.datasets.entries()) {
        const index = dataset.data.findIndex(point => point.id === selected);
        if (index < 0) continue;
        const point = dataset.data[index], element = chart.getDatasetMeta(datasetIndex).data[index];
        const name = point.row.creative.length > 24 ? `${point.row.creative.slice(0, 23)}…` : point.row.creative;
        const lines = [name, `${metricName} ${money(point.y, currency)}`];
        ctx.save(); ctx.font = `600 ${font.size}px ${font.family}`;
        const width = Math.max(...lines.map(line => ctx.measureText(line).width));
        const x = Math.max(chartArea.left, Math.min(chartArea.right - width, element.x + point.r + 12));
        const y = Math.max(chartArea.top + font.size, Math.min(chartArea.bottom - 24, element.y - point.r - 28));
        ctx.strokeStyle = CHART_THEME.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(element.x, element.y - point.r); ctx.lineTo(x, y + 18); ctx.stroke();
        ctx.fillStyle = CHART_THEME.textPrimary; ctx.textAlign = "left"; ctx.fillText(lines[0], x, y); ctx.fillText(lines[1], x, y + 18); ctx.restore();
      }
    } }], options: { ...opts, onClick: (_, elements, chart) => { const point = elements[0]; if (point) onSelect(chart.data.datasets[point.datasetIndex].data[point.index].id); },
      plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, callbacks: { title: contexts => contexts[0].raw.row.creative,
        label: context => `${context.raw.row.campaign} · ${fmtNum(context.raw.row.results)} · ${metricName} ${money(context.parsed.y, currency)}` } } },
      scales: { x: { ...opts.scales.x, beginAtZero: true, title: { display: true, text: `${locale === "en" ? "Recent spend" : "최근 비용"} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 4, callback: amount => money(amount, currency) } },
        y: { ...opts.scales.y, beginAtZero: true, title: { display: true, text: `${metricName} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.y.ticks, callback: amount => money(amount, currency) } } } } };
  }, [valid, currency, locale, metricName, onSelect, selected]);
  if (!valid.length) return <><h3 id="ops-creative-title">{locale === "en" ? "Creative spend and efficiency" : "소재 비용과 효율"}</h3><p className="chart-empty">{locale === "en" ? "No valid creative-level spend and outcomes are available." : "소재별 유효한 비용·성과 관측이 없습니다."}</p></>;
  return <>
    <ChartCanvas config={config} headingId="ops-creative-title" title={locale === "en" ? `Creative spend and ${metricName}` : `소재별 비용과 ${metricName}`} label={locale === "en" ? "Creative spend versus unit cost, sized by outcomes" : "소재별 비용·단가·성과 규모"} fileName="operations_creative_map" locale={locale} currency={currency} periods={periods} isDemo={isDemo} />
    <p className="operations-chart__caption">{locale === "en" ? `Lower is more efficient · point area = outcomes. ${valid.length} of ${rows.length} plotted. Select a point or its name.` : `아래쪽일수록 낮은 단가 · 점 면적 = 성과수. ${rows.length}개 중 ${valid.length}개 표시. 점이나 이름을 선택하세요.`}</p>
    <label className="operations-target-select">{locale === "en" ? "Select a creative" : "소재 선택"}
      <select value={selected || ""} onChange={event => onSelect(event.target.value)}>
        {rows.map(row => <option key={row.id} value={row.id}>{row.campaign} · {row.creative}</option>)}
      </select>
    </label>
  </>;
}
