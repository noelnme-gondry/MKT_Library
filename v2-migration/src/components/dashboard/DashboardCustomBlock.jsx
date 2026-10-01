'use client';
import React, { useEffect, useMemo, useRef } from 'react';
import { useDashboardSetting } from './DashboardWorkspaceContext';
import Chart from '@/utils/chartGlobals';
import { useAppStore } from '@/store/useDataStore';
import { blockRows, groupDates, resolveBlockFilter, scopeLabel } from '@/lib/dashboard/workspace';
import { buildCustomChartConfig, buildChartFieldOptions, buildCustomScorecardModel, formatCustomScorecardValue } from '@/utils/customChartConfig';
import { CHART_THEME } from '@/utils/chartUtils';
import { sourceCurrencyOf } from '@/utils/format';
import FigurePngButton from '@/components/ds/FigurePngButton';

export default function DashboardCustomBlock({ definition, config, locale }) {
  const csv = useAppStore(s => s.csvData), common = useAppStore(s => s.dashboardFilter);
  const cohort = useAppStore(s => s.selectedCohort), basis = useAppStore(s => s.denomBasis);
  const dark = useAppStore(s => s.isDarkMode), currency = useAppStore(s => s.displayCurrency);
  const metrics = useDashboardSetting('customMetrics', '5-2:viz-kpi');
  const ref = useRef(null), card = useRef(null);
  const rows = useMemo(() => blockRows(csv, common, config.scope), [csv, common, config.scope]);
  const fields = useMemo(() => buildChartFieldOptions(csv?.mapping, metrics, locale), [csv?.mapping, metrics, locale]);
  const filter = resolveBlockFilter(common, config.scope).filter;
  const dates = [...new Set(rows.map(row => row.date).filter(Boolean))].sort();
  const resolved = { ...filter, dateStart: filter.dateStart || dates[0], dateEnd: filter.dateEnd || dates.at(-1) };
  const previous = useMemo(() => resolved.compareEnabled && resolved.comparisonStart && resolved.comparisonEnd ? blockRows(csv, common, { ...config.scope, period: 'custom', dateStart: resolved.comparisonStart, dateEnd: resolved.comparisonEnd, compareEnabled: false }) : [], [csv, common, config.scope, resolved.compareEnabled, resolved.comparisonStart, resolved.comparisonEnd]);
  const previousModel = buildCustomScorecardModel(definition, previous, { ...fields, cohort, denomBasis: basis });
  const model = buildCustomScorecardModel(definition, rows, { ...fields, cohort, denomBasis: basis });
  const type = definition.type;
  useEffect(() => {
    if (!ref.current || type === 'scorecard' || !rows.length) return;
    const aggregatedRows = definition.dim === 'date' ? groupDates(rows, definition.interval) : rows;
    const chartConfig = buildCustomChartConfig(definition, aggregatedRows, { ...fields, cohort, denomBasis: basis, locale });
    if (previous.length) {
      const comparison = buildCustomChartConfig(definition, definition.dim === 'date' ? groupDates(previous, definition.interval) : previous, { ...fields, cohort, denomBasis: basis, locale });
      const currentLabels = chartConfig.data.labels;
      const comparisonLabels = comparison.data.labels;
      const labels = [...new Set([...currentLabels, ...comparisonLabels])];
      if (definition.dim === 'date') labels.sort();
      const align = (dataset, names) => ({ ...dataset, data: labels.map(label => { const index = names.indexOf(label); return index < 0 ? null : dataset.data[index]; }) });
      const current = align(chartConfig.data.datasets[0], currentLabels);
      current.label = locale === 'en' ? 'Analysis period' : '분석 기간';
      const prior = align(comparison.data.datasets[0], comparisonLabels);
      prior.label = locale === 'en' ? 'Comparison period' : '비교 기간';
      prior.borderColor = CHART_THEME.muted; prior.backgroundColor = CHART_THEME.muted; prior.borderDash = [5, 4];
      chartConfig.data = { labels, datasets: [current, prior] };
      chartConfig.options.plugins.legend = { ...chartConfig.options.plugins.legend, display: true, position: definition.legend === 'right' ? 'right' : 'bottom' };
    }
    chartConfig.options.layout = { ...chartConfig.options.layout, padding: { top: 24, right: 12 } };
    if (definition.labels) chartConfig.plugins = [{ id: 'dashboardValueLabels', afterDatasetsDraw(chart) {
      const { ctx } = chart; ctx.save(); ctx.fillStyle = CHART_THEME.text; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      chart.data.datasets.forEach((ds, d) => chart.getDatasetMeta(d).data.forEach((point, i) => {
        const stride = Math.max(1, Math.ceil(ds.data.length / Math.max(1, (chart.chartArea.right - chart.chartArea.left) / 90)));
        if (i % stride || !Number.isFinite(ds.data[i])) return;
        const p = point.tooltipPosition();
        const label = formatCustomScorecardValue({ value: ds.data[i], unit: fields.metricUnitOf(definition.metric) }, sourceCurrencyOf(csv, currency), locale);
        const halfWidth = ctx.measureText(label).width / 2;
        const x = Math.max(chart.chartArea.left + halfWidth, Math.min(chart.chartArea.right - halfWidth, p.x));
        const y = chart.options.indexAxis === 'y' ? p.y - (point.height || 0) / 2 - 8 : p.y + (d ? 22 : -10);
        ctx.fillText(label, x, Math.max(14, Math.min(chart.chartArea.bottom - 4, y)));
      })); ctx.restore();
    } }];
    const chart = new Chart(ref.current, chartConfig);
    const frame = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(frame); chart.destroy(); };
  }, [rows, previous, definition, type, fields, cohort, basis, dark, locale, csv, currency]);
  return <section className="block dashboard-custom-block" ref={card}>
    <header className="dashboard-section-head"><div><h2 className="section-title">{definition.name}</h2><p className="muted">{fields.metricLabelOf(definition.metric)}{type === 'scorecard' ? '' : ` · ${fields.dimLabelOf(definition.dim)}`}</p></div><FigurePngButton target={type === 'scorecard' ? card : ref} title={definition.name} fileName={definition.id} locale={locale} context={{ scope: { ...resolved, caption: scopeLabel(resolved, config.scope, locale) } }} /></header>
    {!config.scope && <p className="dashboard-block-scope">{scopeLabel(resolved, {}, locale)}</p>}
    {resolved.compareEnabled && !previous.length && <p role="status">{locale === 'en' ? 'No observations in the comparison period.' : '비교 기간에 관측값이 없습니다.'}</p>}
    {!rows.length ? <p role="status">{locale === 'en' ? 'No matching data. Check the block and shared filters.' : '해당 조건의 데이터가 없습니다. 구역과 공통 필터를 확인하세요.'}</p> : type === 'scorecard' ? <div className="custom-scorecard"><strong>{formatCustomScorecardValue(model, sourceCurrencyOf(csv, currency), locale)}</strong><small>{locale === 'en' ? 'Aggregate for the displayed scope' : '표시된 범위의 집계값'}</small>{resolved.compareEnabled && <span>{locale === 'en' ? 'Comparison period' : '비교 기간'} · {formatCustomScorecardValue(previousModel, sourceCurrencyOf(csv, currency), locale)}</span>}</div> : <div className="chart-container dashboard-custom-canvas"><canvas ref={ref} role="img" aria-label={definition.name} /></div>}
  </section>;
}
