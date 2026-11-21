"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import PeriodBars from "@/components/ds/PeriodBars";
import { FigureHead } from "@/components/ds/FigurePngButton";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { fmtCurrency, fmtNum } from "@/utils/format";
import { evaluateAlert, pointValue, shiftDay } from "@/lib/performance-alerts/rules";

export const alertNumber = (rule, value) => value == null ? "—" : rule.metric === "cpr" ? fmtCurrency(value, { currency: rule.currency, precise: true }) : fmtNum(value, 2);
export default function AlertTrend({ rule, locale = "ko", isDemo = false }) {
  const en = locale === "en", canvas = useRef(null);
  const [days, setDays] = useState(84);
  const unit = rule.metric === "cpr" ? `${rule.currency} / ${rule.basis === "installs" ? (en ? "install" : "설치") : (en ? "action" : "가입")}` : rule.valueHeader;
  const aggregation = {
    cpr: en ? "CPR = total cost ÷ total outcomes." : "CPR = 비용 합계 ÷ 성과 합계.",
    sum: en ? "The period value is the sum of the selected column." : "기간 값은 선택한 컬럼의 합계입니다.",
    mean: en ? "The period value is the column total divided by the number of rows." : "기간 값은 선택한 컬럼의 합계를 행 수로 나눈 값입니다.",
  }[rule.metric];
  const comparisonLabel = rule.comparison === "target"
    ? (en ? "target" : "목표값")
    : (en ? "prior period" : "직전 기간");
  const result = useMemo(() => evaluateAlert(rule), [rule]);
  const reference = rule.comparison === "target" ? rule.target : result.reference;
  const exportCaption = [unit, rule.channel || (en ? "All channels" : "전체 채널")];
  if (rule.metric === "sum") {
    exportCaption.push(
      `${rule.days}${en ? "-day total" : "일 합계"} ${alertNumber(rule, result.value)}`,
      `${comparisonLabel} ${alertNumber(rule, reference)}`,
      `${en ? "threshold" : "임계값"} ${alertNumber(rule, result.threshold)}`,
    );
  }
  const config = useMemo(() => {
    if (!rule.end) return null;
    const dates = Array.from({ length: days }, (_, index) => shiftDay(rule.end, index + 1 - days));
    const points = new Map(rule.history.map(point => [point.date, point]));
    const currentStart = shiftDay(rule.end, 1 - rule.days), previousStart = shiftDay(currentStart, -rule.days);
    const common = chartCommonOpts();
    const datasets = [{ label: en ? "Daily observation" : "일별 실측", data: dates.map(date => points.has(date) ? pointValue(rule, [points.get(date)]) : null), borderColor: CHART_THEME.primary, backgroundColor: CHART_THEME.primary, pointRadius: days > 28 ? 0 : 2, borderWidth: 2, spanGaps: false }];
    if (rule.metric !== "sum" && result.status !== "unavailable") {
      datasets.push({ label: en ? "Current period aggregate" : "최근 기간 집계", data: dates.map(date => date >= currentStart ? result.value : null), borderColor: CHART_THEME.textPrimary, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
      if (rule.comparison === "previous") datasets.push({ label: en ? "Prior period aggregate" : "직전 기간 집계", data: dates.map(date => date >= previousStart && date < currentStart ? result.reference : null), borderColor: CHART_THEME.comparison, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
      datasets.push({ label: en ? "Alert threshold" : "알림 임계값", data: dates.map(date => date >= currentStart ? result.threshold : null), borderColor: CHART_THEME.accent, borderDash: [7, 4], pointRadius: 0, borderWidth: 2 });
    }
    return { type: "line", data: { labels: dates, datasets }, options: { ...common, responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { ...common.plugins, legend: { ...common.plugins?.legend, display: true, position: "bottom" }, tooltip: { ...common.plugins?.tooltip, callbacks: { label: context => `${context.dataset.label}: ${alertNumber(rule, context.parsed.y)}` } } },
      scales: { x: { ...common.scales?.x, ticks: { ...common.scales?.x?.ticks, maxTicksLimit: en ? 6 : 8, maxRotation: 0, callback: index => dates[index]?.slice(5) } }, y: { ...common.scales?.y, beginAtZero: true, title: { display: true, text: unit } } } },
      plugins: [{ id: "alertPeriods", beforeDraw(chart) {
        const { ctx, chartArea: area, scales: { x } } = chart;
        if (!area) return;
        const step = area.width / Math.max(1, dates.length - 1);
        ctx.save();
        dates.forEach((date, index) => {
          const left = Math.max(area.left, x.getPixelForValue(index) - step / 2), right = Math.min(area.right, left + step);
          if (date >= currentStart || (rule.comparison === "previous" && date >= previousStart)) {
            ctx.fillStyle = date >= currentStart ? `${CHART_THEME.primary}18` : `${CHART_THEME.comparison}12`;
            ctx.fillRect(left, area.top, right - left, area.height);
          }
          if (index % 7 === 0) { ctx.strokeStyle = CHART_THEME.grid; ctx.beginPath(); ctx.moveTo(left, area.top); ctx.lineTo(left, area.bottom); ctx.stroke(); }
        });
        ctx.restore();
      } }] };
  }, [rule, days, en, result, unit]);
  useEffect(() => {
    if (!canvas.current || !config) return undefined;
    const chart = new Chart(canvas.current.getContext("2d"), config);
    const frame = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(frame); chart.destroy(); };
  }, [config]);
  return <figure className="performance-alerts__trend">
    <div className="performance-alerts__heading"><FigureHead level={3} title={`${rule.name} · ${rule.channel || (en ? "All channels" : "전체 채널")}`} target={canvas} locale={locale} fileName="performance-alert-trend" context={{ title: rule.name, resultState: result.status === "unavailable" ? "unavailable" : "ready",
      scope: { dateStart: rule.end ? shiftDay(rule.end, 1 - days) : null, dateEnd: rule.end, caption: exportCaption.join(" · ") },
      source: { importSource: isDemo ? "demo" : "csv" } }} /><label>{en ? "Chart history" : "차트 표시 기간"}<select value={days} onChange={event => setDays(Number(event.target.value))}>{[28, 56, 84].map(value => <option key={value} value={value}>{value}{en ? " days" : "일"}</option>)}</select></label></div>
    {config ? <div className="chart-container performance-alerts__canvas"><canvas ref={canvas} role="img" aria-label={en ? `${days}-day observed trend, recent period compared with ${comparisonLabel}` : `${days}일 실측 추세, 최근 기간과 ${comparisonLabel} 비교`} /></div> : <p>{en ? "Analyze a matching daily CSV to see the trend." : "조건과 일치하는 일별 CSV를 분석하면 추세를 볼 수 있습니다."}</p>}
    {rule.metric === "sum" && <PeriodBars
      title={en ? `${rule.days}-day total · ${unit}` : `${rule.days}일 합계 · ${unit}`}
      max={Math.max(0, result.value ?? 0, result.threshold ?? 0, reference ?? 0)}
      threshold={result.threshold}
      note={Number.isFinite(result.threshold) ? `${en ? "Dashed line · alert threshold" : "점선 · 알림 임계값"} ${alertNumber(rule, result.threshold)}` : undefined}
      rows={[
        { label: rule.comparison === "target" ? (en ? "Target" : "목표") : (en ? "Prior" : "직전"), value: reference, display: alertNumber(rule, reference), detail: rule.comparison === "previous" && result.previousStart ? `${result.previousStart} — ${result.previousEnd}` : null },
        { label: en ? "Recent" : "최근", value: result.value, display: alertNumber(rule, result.value), detail: result.currentStart ? `${result.currentStart} — ${rule.end}` : null },
      ]}
    />}
    {result.missingDates?.length > 0 && <p>{en ? "Missing dates" : "누락된 날짜"} · {result.missingDates.join(", ")}</p>}
    {config && <details><summary>{en ? "Daily observations" : "일별 관측값 보기"}</summary>
      <table><thead><tr><th>{en ? "Date" : "날짜"}</th><th>{unit}</th></tr></thead>
        <tbody>{config.data.labels.map((date, i) => <tr key={date}><th scope="row">{date}</th><td>{alertNumber(rule, config.data.datasets[0].data[i])}</td></tr>)}</tbody>
      </table></details>}
    {rule.metric !== "sum" && <div className="performance-alerts__periods"><div><span>{rule.comparison === "target" ? (en ? "Target" : "목표") : (en ? "Prior period" : "직전 기간")}</span><strong>{alertNumber(rule, rule.comparison === "target" ? rule.target : result.reference)}</strong><small>{rule.comparison === "previous" ? `${result.previousStart || "—"} — ${result.previousEnd || "—"}` : unit}</small></div><div><span>{en ? "Recent period" : "최근 기간"}</span><strong>{alertNumber(rule, result.value)}</strong><small>{result.currentStart || "—"} — {rule.end || "—"}</small></div></div>}
    <p className="performance-alerts__note">{en ? "Weekly divisions · Missing days break the line. Alerts use period aggregates, not daily crossings." : "주별 구획 · 빠진 날짜는 선을 끊습니다. 알림은 일별 돌파가 아닌 기간 집계로 판정합니다."} {aggregation}</p>
  </figure>;
}
