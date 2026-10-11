"use client";
import { useMemo } from "react";
import { buildOperationsDemo } from "@/lib/operations/operationsDemo";
import { operationsTotals, operationsDailyTrend } from "@/lib/operations/operationsBrief";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { fmtCurrency, fmtPct } from "@/utils/format";

export default function OperationsSamplePreview({ locale = "ko" }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const sample = useMemo(() => {
    const rows = getMappedRows(buildOperationsDemo(locale));
    const dates = [...new Set(rows.map(row => row.date))].sort();
    const recent = new Set(dates.slice(-7)), prior = new Set(dates.slice(-14, -7));
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.campaign_id)) grouped.set(row.campaign_id, []);
      grouped.get(row.campaign_id).push(row);
    }
    const campaigns = [...grouped.values()].map(values => ({
      name: values[0].campaign_name,
      current: operationsTotals(values.filter(row => recent.has(row.date)), "installs"),
      previous: operationsTotals(values.filter(row => prior.has(row.date)), "installs"),
      trend: operationsDailyTrend(values, "installs"),
    })).sort((a, b) => b.current.cpr / b.previous.cpr - a.current.cpr / a.previous.cpr);
    return { dates, campaigns, trend: operationsDailyTrend(rows, "installs"),
      current: operationsTotals(rows.filter(row => recent.has(row.date)), "installs"), previous: operationsTotals(rows.filter(row => prior.has(row.date)), "installs") };
  }, [locale]);
  const money = value => fmtCurrency(value, { currency: "KRW", precise: true });
  const change = sample.current.cpr / sample.previous.cpr - 1;
  const worst = sample.campaigns[0];
  const max = Math.max(...sample.trend.map(row => row.cpr), ...worst.trend.map(row => row.cpr)) * 1.1;
  const points = rows => rows.map((row, index) => `${46 + index / (rows.length - 1) * 316},${172 - row.cpr / max * 148}`).join(" ");
  return <aside className="home-result-preview home-result-preview--comparison operations-sample-preview" aria-label={tr("운영 플래너 데모 미리보기", "Operations planner demo preview")}>
    <h2>{tr("한 파일에서 다음 운영 계획까지", "From one file to your next operating plan")}</h2>
    <p className="home-sample-context">{tr("가상 운영 데이터 · 98일 · 4개 캠페인", "Fictional operations data · 98 days · 4 campaigns")}</p>
    <div className="operations-sample-preview__metric"><span>{tr("직전 7일 → 최근 7일 CPI", "Prior → recent 7-day CPI")}</span>
      <strong>{money(sample.previous.cpr)} → {money(sample.current.cpr)}</strong><b>{change > 0 ? "+" : ""}{fmtPct(change)}</b></div>
    <figure className="operations-sample-chart">
      <figcaption>{tr("일별 CPI 추세 · 전체와 악화 캠페인", "Daily CPI · portfolio and deteriorating campaign")}</figcaption>
      <svg viewBox="0 0 380 205" role="img" aria-label={tr("98일의 전체·선택 캠페인 실측 CPI 추세", "98 days of observed portfolio and selected campaign CPI")}>
        {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="46" x2="362" y1={172 - ratio * 148} y2={172 - ratio * 148} className="operations-sample-chart__grid" /><text x="39" y={176 - ratio * 148} textAnchor="end">{money(max * ratio)}</text></g>)}
        <rect x={46 + 91 / 97 * 316} y="24" width={6 / 97 * 316} height="148" className="operations-sample-chart__recent" />
        <polyline points={points(sample.trend)} className="operations-sample-chart__line" />
        <polyline points={points(worst.trend)} className="operations-sample-chart__line operations-sample-chart__line--alert" />
        <text x="46" y="195">{sample.dates[0].slice(5)}</text><text x="362" y="195" textAnchor="end">{sample.dates.at(-1).slice(5)}</text>
      </svg>
      <div className="operations-sample-chart__legend"><span><i />{tr("전체", "Portfolio")}</span><span><i />{worst.name}</span></div>
    </figure>
    <div className="operations-sample-campaigns">{sample.campaigns.map(row => <div key={row.name}><span>{row.name}</span><strong>{money(row.current.cpr)}</strong><b data-tone={row.current.cpr > row.previous.cpr ? "bad" : "good"}>{row.current.cpr > row.previous.cpr ? "+" : ""}{fmtPct(row.current.cpr / row.previous.cpr - 1)}</b></div>)}</div>
    <p className="home-sample-context">{sample.dates.at(-14)} – {sample.dates.at(-1)} · {tr("CPI = 광고비 ÷ 설치 수", "CPI = spend ÷ installs")}</p>
  </aside>;
}
