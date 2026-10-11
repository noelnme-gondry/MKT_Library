"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { fmtCurrency, fmtNum } from "@/utils/format";
import { FigureHead } from "@/components/ds/FigurePngButton";
import PillGroup from "@/components/ds/PillGroup";
import { figureExportContext } from "@/utils/figureExportContext";
import { stageWaterfall } from "@/lib/operations/operationsReview";

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

function ChartCanvas({ config, label, title = label, headingId, scopeLabel, fileName, locale, currency, periods, isDemo, className = "", height, controls }) {
  const canvas = useRef(null);
  useEffect(() => {
    if (!canvas.current) return undefined;
    const chart = new Chart(canvas.current.getContext("2d"), config);
    const frame = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(frame); chart.destroy(); };
  }, [config]);
  const comparison = periods?.previous ? `${locale === "en" ? "Comparison" : "비교"}: ${periods.previous.start} – ${periods.previous.end}` : null;
  return <figure className={`operations-chart ${className}`}>
    <FigureHead level={3} id={headingId} title={title} target={canvas} locale={locale} fileName={fileName}
      exportTitle={[title, scopeLabel].filter(Boolean).join(" · ")}
      context={figureExportContext({ title: label, locale, scope: { dateStart: periods?.current.start, dateEnd: periods?.current.end, caption: [currency, scopeLabel, comparison].filter(Boolean).join(" · ") }, source: { importSource: isDemo ? "demo" : "csv" } })} />
    {controls}
    <div className="chart-container" style={height ? { height } : undefined}><canvas ref={canvas} role="img" aria-label={label} /></div>
  </figure>;
}

export function OperationsTrend({ rows, metricName, currency, locale, periods, isDemo }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const [view, setView] = useState("cpr");
  const views = { cpr: metricName, cost: tr("광고비", "Spend"), results: tr("성과수", "Outcomes") };
  const config = useMemo(() => {
    const opts = operationsChartOptions();
    const label = view === "cpr" ? metricName : view === "cost" ? (locale === "en" ? "Spend" : "광고비") : (locale === "en" ? "Outcomes" : "성과수");
    const format = value => view === "results" ? fmtNum(value) : money(value, currency);
    return { type: "line", data: { labels: rows.map(row => row.date), datasets: [{ label, data: rows.map(row => row[view]),
      borderColor: CHART_THEME.primary, backgroundColor: CHART_THEME.primary, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, spanGaps: false }] },
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
            ctx.globalAlpha = 0.18; ctx.fillStyle = CHART_THEME.primary;
            ctx.fillRect(left, chartArea.top, right - left, height);
          } else {
            ctx.globalAlpha = 0.4; ctx.strokeStyle = CHART_THEME.muted; ctx.lineWidth = 1;
            for (let diagonal = left - height; diagonal < right; diagonal += 8) {
              ctx.beginPath(); ctx.moveTo(diagonal, chartArea.bottom); ctx.lineTo(diagonal + height, chartArea.top); ctx.stroke();
            }
          }
          ctx.restore(); ctx.save(); ctx.strokeStyle = recent ? CHART_THEME.primary : CHART_THEME.muted;
          ctx.lineWidth = recent ? 2 : 1; ctx.setLineDash(recent ? [] : [4, 3]);
          ctx.strokeRect(left, chartArea.top, right - left, height); ctx.restore();
        }
      } }],
      options: { ...opts, plugins: { ...opts.plugins, legend: { display: false }, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${label} ${format(context.parsed.y)}` } } },
        scales: { x: { ...opts.scales.x, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 6, maxRotation: 0, callback: (_, index) => shortDate(rows[index].date) } },
          y: { ...opts.scales.y, beginAtZero: true, ticks: { ...opts.scales.y.ticks, callback: format }, title: { display: true, text: view === "results" ? label : `${label} · ${currency}`, color: CHART_THEME.muted } } } } };
  }, [rows, view, metricName, currency, locale, periods]);
  if (!rows.length) return <><h3 id="ops-trend-title">{tr("전체 실적 추이", "Portfolio performance trend")}</h3><p>{tr("추세를 계산할 관측이 없습니다.", "No observations are available for a trend.")}</p></>;
  return <div className="operations-trend">
    <ChartCanvas config={config} headingId="ops-trend-title" title={tr(`일별 ${views[view]} 추이`, `Daily ${views[view]} trend`)} label={tr(`전체 일별 실측 ${views[view]}`, `Daily observed portfolio ${views[view]}`)} fileName="operations_daily_unit_cost" locale={locale} currency={currency} periods={{ current: { start: rows[0].date, end: rows.at(-1).date } }} isDemo={isDemo} controls={<div className="operations-chart__toolbar">
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
      { label: locale === "en" ? "Current / day" : "현재 / 일", data: rows.slice(0, 12).map(row => row.current), backgroundColor: CHART_THEME.muted, maxBarThickness: 15 },
      { label: locale === "en" ? "Revised / day" : "조정안 / 일", data: rows.slice(0, 12).map(row => row.budget), backgroundColor: CHART_THEME.primary, maxBarThickness: 15 }] },
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
      { label: locale === "en" ? "Prior (upper)" : "직전 (위)", data: data.flatMap((row, index) => row.previous.cpr == null ? [] : [{ x: row.previous.cpr, y: index - 0.18, id: row.id }]), pointStyle: "circle", pointRadius: 5, backgroundColor: CHART_THEME.muted },
      { label: locale === "en" ? "Recent (lower)" : "최근 (아래)", data: data.flatMap((row, index) => row.current.cpr == null ? [] : [{ x: row.current.cpr, y: index + 0.18, id: row.id }]), pointStyle: "triangle", pointRadius: context => context.raw?.id === selected ? 9 : 7, pointBorderColor: CHART_THEME.textPrimary, pointBorderWidth: context => context.raw?.id === selected ? 2 : 0, backgroundColor: data.filter(row => row.current.cpr != null).map(row => row.changePct == null ? CHART_THEME.primary : row.changePct > 0 ? CHART_THEME.danger : CHART_THEME.success) }] },
      plugins: [{ id: "operations-cost-connectors", beforeDatasetsDraw(chart) {
        const { ctx, scales: { x, y } } = chart; ctx.save(); ctx.strokeStyle = CHART_THEME.muted; ctx.lineWidth = 2;
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
      { label: locale === "en" ? "Creative mix" : "소재 구성 변화", data: rows.map(row => row.mix), backgroundColor: CHART_THEME.tertiary, maxBarThickness: 18 },
      { label: locale === "en" ? "Creative unit costs" : "소재 단가 변화", data: rows.map(row => row.rate), backgroundColor: CHART_THEME.primary, maxBarThickness: 18 }] },
      options: { ...opts, indexAxis: "y", plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, callbacks: { label: context => `${context.dataset.label} ${money(context.parsed.x, currency)}` } } },
        scales: { x: { ...opts.scales.x, stacked: true, title: { display: true, text: `${metricName} ${locale === "en" ? "contribution" : "변화 기여"} · ${currency}`, color: CHART_THEME.muted }, ticks: { ...opts.scales.x.ticks, maxTicksLimit: 5, callback: amount => money(amount, currency) } }, y: { ...opts.scales.y, stacked: true, grid: { display: false } } } } };
  }, [value, currency, locale, metricName]);
  if (!value) return <p className="chart-empty">{locale === "en" ? "Insufficient creative observations in the two periods." : "두 기간의 소재별 관측이 부족해 구성·단가 기여를 구분할 수 없습니다."}</p>;
  return <ChartCanvas config={config} scopeLabel={scopeLabel} label={locale === "en" ? "Creative mix and unit-cost contributions" : "소재 구성·단가 변화 기여"} fileName="operations_creative_contributions" locale={locale} currency={currency} periods={periods} isDemo={isDemo} height={Math.max(280, value.finest.length * 40 + 70)} />;
}

export function OperationsCreativeChart({ rows, currency, locale, metricName, periods, isDemo, selected, onSelect }) {
  const valid = useMemo(() => rows.filter(row => row.cost != null && row.cpr != null && row.results > 0).sort((a, b) => b.cost - a.cost).slice(0, 60), [rows]);
  const config = useMemo(() => {
    const opts = operationsChartOptions(), max = Math.max(...valid.map(row => row.results), 1);
    return { type: "bubble", data: { datasets: [true, false].map(isNew => ({
      label: locale === "en" ? (isNew ? "First seen this period" : "Established") : isNew ? "이번 기간 첫 관측" : "기존 소재",
      // Chart.js의 원은 πr², rectRot은 2r²: 같은 성과수의 실제 면적을 맞춘다.
      data: valid.filter(row => row.isNew === isNew).map(row => ({ x: row.cost, y: row.cpr, r: 23 * Math.sqrt(row.results / max) * (isNew ? Math.sqrt(Math.PI / 2) : 1), id: row.id, row })),
      pointStyle: isNew ? "rectRot" : "circle", backgroundColor: isNew ? CHART_THEME.primary : CHART_THEME.muted,
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
