"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FigureHead } from "@/components/ds/FigurePngButton";
import { figureExportContext } from "@/utils/figureExportContext";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { fmtCurrency, fmtNum } from "@/utils/format";
import { evaluateAlert, pointValue, shiftDay } from "@/lib/performance-alerts/rules";

export const alertNumber = (rule, value) => value == null ? "—" : rule.metric === "cpr" ? fmtCurrency(value, { currency: rule.currency, precise: true }) : fmtNum(value, 2);
export default function AlertTrend({ rule, locale = "ko", isDemo = false }) {
  const en = locale === "en", canvas = useRef(null);
  const [days, setDays] = useState(84);
  const result = useMemo(() => evaluateAlert(rule), [rule]);
  const config = useMemo(() => {
    if (!rule.end) return null;
    const dates = Array.from({ length: days }, (_, index) => shiftDay(rule.end, index + 1 - days));
    const points = new Map(rule.history.map(point => [point.date, point]));
    const currentStart = shiftDay(rule.end, 1 - rule.days), previousStart = shiftDay(currentStart, -rule.days);
    const common = chartCommonOpts();
    const datasets = [{ label: en ? "Daily observation" : "일별 실측", data: dates.map(date => points.has(date) ? pointValue(rule, [points.get(date)]) : null), borderColor: CHART_THEME.primary, backgroundColor: CHART_THEME.primary, pointRadius: days > 28 ? 0 : 2, borderWidth: 2, spanGaps: false }];
    if (result.status !== "unavailable") {
      datasets.push({ label: en ? "Current period aggregate" : "최근 기간 집계", data: dates.map(date => date >= currentStart ? result.value : null), borderColor: CHART_THEME.textPrimary, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
      if (rule.comparison === "previous") datasets.push({ label: en ? "Prior period aggregate" : "직전 기간 집계", data: dates.map(date => date >= previousStart && date < currentStart ? result.reference : null), borderColor: CHART_THEME.comparison, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
      datasets.push({ label: en ? "Alert threshold" : "알림 임계값", data: dates.map(date => date >= currentStart ? result.threshold : null), borderColor: CHART_THEME.accent, borderDash: [7, 4], pointRadius: 0, borderWidth: 2 });
    }
    return { type: "line", data: { labels: dates, datasets }, options: { ...common, responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { ...common.plugins, legend: { ...common.plugins?.legend, display: true, position: "bottom" }, tooltip: { ...common.plugins?.tooltip, callbacks: { label: context => `${context.dataset.label}: ${alertNumber(rule, context.parsed.y)}` } } },
      scales: { x: { ...common.scales?.x, ticks: { ...common.scales?.x?.ticks, maxTicksLimit: en ? 6 : 8, maxRotation: 0, callback: index => dates[index]?.slice(5) } }, y: { ...common.scales?.y, beginAtZero: true, title: { display: true, text: rule.metric === "cpr" ? `${rule.currency} / ${rule.basis}` : rule.valueHeader } } } },
      plugins: [{ id: "alertPeriods", beforeDraw(chart) {
        const { ctx, chartArea: area, scales: { x } } = chart;
        if (!area) return;
        const step = area.width / Math.max(1, dates.length - 1);
        ctx.save();
        dates.forEach((date, index) => {
          const left = Math.max(area.left, x.getPixelForValue(index) - step / 2), right = Math.min(area.right, left + step);
          if (date >= currentStart || date >= previousStart) {
            ctx.fillStyle = date >= currentStart ? `${CHART_THEME.primary}18` : `${CHART_THEME.comparison}12`;
            ctx.fillRect(left, area.top, right - left, area.height);
          }
          if (index % 7 === 0) { ctx.strokeStyle = CHART_THEME.grid; ctx.beginPath(); ctx.moveTo(left, area.top); ctx.lineTo(left, area.bottom); ctx.stroke(); }
        });
        ctx.restore();
      } }] };
  }, [rule, days, en, result]);
  useEffect(() => {
    if (!canvas.current || !config) return undefined;
    const chart = new Chart(canvas.current.getContext("2d"), config);
    const frame = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(frame); chart.destroy(); };
  }, [config]);
  return <figure className="performance-alerts__trend">
    <div className="performance-alerts__heading"><FigureHead level={3} title={`${rule.name} · ${rule.channel || (en ? "All channels" : "전체 채널")}`} target={canvas} locale={locale} fileName="performance-alert-trend" context={figureExportContext({ title: rule.name, locale, scope: { dateStart: rule.end ? shiftDay(rule.end, 1 - days) : null, dateEnd: rule.end, caption: `${rule.metric} · ${rule.currency} · ${rule.channel || (en ? "All channels" : "전체 채널")}` }, source: { importSource: isDemo ? "demo" : "csv" } })} /><label>{en ? "Chart history" : "차트 표시 기간"}<select value={days} onChange={event => setDays(Number(event.target.value))}>{[28, 56, 84].map(value => <option key={value} value={value}>{value}{en ? " days" : "일"}</option>)}</select></label></div>
    {config ? <div className="chart-container performance-alerts__canvas"><canvas ref={canvas} role="img" aria-label={en ? `${days}-day observed trend with weekly divisions and comparison windows` : `${days}일 실측 추세, 주별 구획과 직전·최근 기간 비교`} /></div> : <p>{en ? "Analyze a matching daily CSV to see the trend." : "조건과 일치하는 일별 CSV를 분석하면 추세를 볼 수 있습니다."}</p>}
    <div className="performance-alerts__periods"><div><span>{rule.comparison === "target" ? (en ? "Target" : "목표") : (en ? "Prior period" : "직전 기간")}</span><strong>{alertNumber(rule, result.reference)}</strong><small>{rule.comparison === "previous" ? `${result.previousStart || "—"} — ${result.previousEnd || "—"}` : rule.currency}</small></div><div><span>{en ? "Recent period" : "최근 기간"}</span><strong>{alertNumber(rule, result.value)}</strong><small>{result.currentStart || "—"} — {rule.end || "—"}</small></div></div>
    <p className="performance-alerts__note">{en ? "Weekly divisions · Missing days break the line. Alerts use period aggregates, not daily crossings. CPR = total cost ÷ total outcomes." : "주별 구획 · 빠진 날짜는 선을 끊습니다. 알림은 일별 돌파가 아닌 기간 집계로 판정합니다. CPR = 비용 합계 ÷ 성과 합계."}</p>
  </figure>;
}
