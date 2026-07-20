"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { getMonFilteredRows, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { buildCalendarSeasonality, detectCalendarGrain } from "@/utils/seasonalityMath";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";

const METRICS = [
  { key: "installs", ko: "설치", en: "Installs", kind: "count" },
  { key: "actions", ko: "가입/액션", en: "Actions", kind: "count" },
  { key: "revenue_d7", ko: "매출 (D7)", en: "Revenue (D7)", kind: "currency" },
  { key: "cost", ko: "지출", en: "Spend", kind: "currency" },
  { key: "clicks", ko: "클릭", en: "Clicks", kind: "count" },
  { key: "impressions", ko: "노출", en: "Impressions", kind: "count" },
];

const MONTHS_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const monthLabel = (bucket, locale) => locale === "en" ? new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(Date.UTC(2024, bucket - 1, 1))) : MONTHS_KO[bucket - 1];
const bucketLabel = (bucket, grain, locale) => grain === "week" ? (locale === "en" ? `W${String(bucket).padStart(2, "0")}` : `${bucket}주`) : monthLabel(bucket, locale);

export default function SeasonalityTab({ locale = "ko" } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const mappedKeys = useMemo(() => new Set(Object.values(csvData?.mapping || {})), [csvData]);
  const availableMetrics = METRICS.filter((metric) => mappedKeys.has(metric.key));
  const [metric, setMetric] = useState("installs");
  const [grain, setGrain] = useState("month");
  const [detrend, setDetrend] = useState(false);
  const overlayRef = useRef(null);
  const indexRef = useRef(null);
  const chartsRef = useRef({});

  const selectedMetricKey = availableMetrics.some((item) => item.key === metric) ? metric : availableMetrics[0]?.key;
  const selected = METRICS.find((item) => item.key === selectedMetricKey);
  // 집계는 이 탭이 열렸을 때만 실행된다. 업로드·매핑 편집 화면에서는 호출되지 않아
  // 대용량 CSV의 입력 반응성을 해치지 않는다.
  const rows = getMonFilteredRows(csvData, dashboardFilter);
  const sourceGrain = detectCalendarGrain(rows);
  const availableGrains = sourceGrain === "day" ? ["month", "week"] : sourceGrain === "week" ? ["week"] : sourceGrain === "month" ? ["month"] : [];
  const activeGrain = availableGrains.includes(grain) ? grain : availableGrains[0] || grain;
  const result = buildCalendarSeasonality(rows, { metric: selectedMetricKey, grain: activeGrain, detrend });

  useEffect(() => {
    Object.values(chartsRef.current).forEach((chart) => chart?.destroy());
    chartsRef.current = {};
    if (!result.sufficient || !overlayRef.current || !indexRef.current) return undefined;
    const labels = result.seasonal.map((item) => bucketLabel(item.bucket, activeGrain, locale));
    const common = chartCommonOpts();
    const tickFormat = (value) => {
      if (detrend) return `${Number(value).toFixed(1)}%`;
      return selected?.kind === "currency" ? fmtCurrencyPrecise(Number(value), displayCurrency) : Math.round(Number(value)).toLocaleString();
    };
    const overlayDatasets = result.years.map((year, index) => ({
      label: String(year),
      data: result.seasonal.map((item) => result.points.find((point) => point.year === year && point.bucket === item.bucket)?.display ?? null),
      borderColor: CHART_THEME.colors[index % CHART_THEME.colors.length],
      backgroundColor: CHART_THEME.colors[index % CHART_THEME.colors.length],
      borderWidth: 2,
      pointRadius: activeGrain === "week" ? 0 : 2.5,
      spanGaps: true,
      tension: 0.24,
    }));
    chartsRef.current.overlay = new Chart(overlayRef.current, {
      type: "line",
      data: { labels, datasets: overlayDatasets },
      options: {
        ...common,
        scales: { ...common.scales, y: { ...common.scales.y, beginAtZero: !detrend, ticks: { ...common.scales.y.ticks, callback: tickFormat } }, },
      },
    });
    chartsRef.current.index = new Chart(indexRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: locale === "en" ? "Average vs. yearly baseline" : "연간 기준 대비 평균",
          data: result.seasonal.map((item) => item.delta),
          backgroundColor: result.seasonal.map((item) => item.delta >= 0 ? CHART_THEME.secondary : CHART_THEME.accent),
          borderRadius: 3,
        }],
      },
      options: {
        ...common,
        scales: { ...common.scales, y: { ...common.scales.y, ticks: { ...common.scales.y.ticks, callback: (value) => `${value > 0 ? "+" : ""}${value}%` } } },
      },
    });
    window.requestAnimationFrame(() => Object.values(chartsRef.current).forEach((chart) => chart?.resize()));
    return () => Object.values(chartsRef.current).forEach((chart) => chart?.destroy());
  }, [result, activeGrain, detrend, locale, displayCurrency, selected?.kind]);

  if (!availableMetrics.length) return <p className="muted">날짜와 설치·가입·매출·지출 중 하나를 매핑하면 시즈널리티를 볼 수 있습니다.</p>;

  const strongest = result.sufficient ? [...result.seasonal].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] : null;
  return (
    <div className="tab-pane active" id="tab-seasonality">
      <section className="block" id="s-seasonality">
        <div className="seasonality-heading">
          <div>
            <h2 className="section-title"><span className="ix">§</span>{locale === "en" ? "Calendar seasonality" : "캘린더 시즈널리티"}</h2>
            <p className="seasonality-sub">{locale === "en" ? "Input frequency is detected automatically. Existing country, OS, channel and date filters apply." : "입력 단위를 자동 인식합니다. 상단의 국가·OS·채널·기간 필터가 그대로 적용됩니다."}</p>
          </div>
          <div className="seasonality-controls">
            <select value={selected?.key || ""} onChange={(event) => setMetric(event.target.value)} aria-label="시즈널리티 지표">
              {availableMetrics.map((item) => <option key={item.key} value={item.key}>{locale === "en" ? item.en : item.ko}</option>)}
            </select>
            <div className="ab-pillgroup" aria-label="시즈널리티 단위">
              {["month", "week"].map((value) => <button key={value} disabled={!availableGrains.includes(value)} className={`ab-pill ${activeGrain === value ? "active" : ""}`} onClick={() => setGrain(value)} title={!availableGrains.includes(value) ? (locale === "en" ? "Not available for this input frequency" : "입력 단위상 정확히 집계할 수 없습니다") : undefined}>{value === "month" ? (locale === "en" ? "Monthly" : "월별") : (locale === "en" ? "Weekly" : "주별")}</button>)}
            </div>
          </div>
        </div>

        <p className="seasonality-source-note">{sourceGrain === "day"
          ? (locale === "en" ? "Daily input detected · weekly and monthly views available." : "일별 데이터 인식 · 주별과 월별 모두 볼 수 있습니다.")
          : sourceGrain === "week"
            ? (locale === "en" ? "Weekly input detected · monthly view is disabled because weeks can cross calendar months." : "주별 데이터 인식 · 주가 월 경계를 넘을 수 있어 월별 보기는 비활성화했습니다.")
            : sourceGrain === "month"
              ? (locale === "en" ? "Monthly input detected · weekly view needs daily or weekly source data." : "월별 데이터 인식 · 주별 보기는 일별 또는 주별 원본이 필요합니다.")
              : (locale === "en" ? "Could not identify the date frequency." : "날짜 입력 단위를 인식하지 못했습니다.")}</p>

        <div className="seasonality-mode">
          <div><strong>{locale === "en" ? "Remove trend" : "추세 제외"}</strong><span>{detrend ? (locale === "en" ? "On · pattern index" : "켬 · 패턴 인덱스") : (locale === "en" ? "Off · actual values" : "끔 · 실제값")}</span></div>
          <button type="button" role="switch" aria-checked={detrend} className={`seasonality-switch ${detrend ? "is-on" : ""}`} onClick={() => setDetrend((value) => !value)}><span /></button>
        </div>

        {!result.sufficient ? (
          <div className="seasonality-empty">{result.reason === "grain_not_supported" ? (locale === "en" ? "This calendar view is not defensible for the detected input frequency." : "현재 입력 단위에서는 이 달력 보기를 정확히 만들 수 없습니다.") : (locale === "en" ? `Need at least two calendar years and more ${activeGrain === "week" ? "weekly" : "monthly"} observations. Current years: ${result.years.join(", ") || "—"}.` : `최소 2개 연도와 충분한 ${activeGrain === "week" ? "주별" : "월별"} 관측이 필요합니다. 현재 연도: ${result.years.join(", ") || "—"}.`)}</div>
        ) : (
          <>
            <div className="seasonality-summary">
              <span>{result.years.join(" · ")} {locale === "en" ? "comparison" : "비교"}</span>
              <strong>{bucketLabel(strongest.bucket, activeGrain, locale)} {strongest.delta >= 0 ? "+" : ""}{strongest.delta.toFixed(1)}%</strong>
              <span>{locale === "en" ? "largest recurring deviation from the yearly baseline" : "연간 기준 대비 가장 큰 반복 차이"}</span>
            </div>
            <div className="seasonality-grid">
              <article className="chart-container seasonality-chart"><h3>{detrend ? (locale === "en" ? "Trend-adjusted pattern by year" : "추세 제외 후 연도별 패턴") : (locale === "en" ? "Actual values by year" : "연도별 실제값")}</h3><canvas ref={overlayRef} /></article>
              <article className="chart-container seasonality-chart"><h3>{locale === "en" ? "Average seasonal index" : "평균 시즈널리티 인덱스"}</h3><canvas ref={indexRef} /></article>
            </div>
            <div className="seasonality-heatmap" aria-label="연도별 시즈널리티 히트맵">
              <div className="seasonality-heatmap__title">{locale === "en" ? "Year × calendar period" : "연도 × 달력 구간"}</div>
              <div className="seasonality-heatmap__body" style={{ "--season-columns": result.seasonal.length }}>
                <span />{result.seasonal.map((item) => <span key={item.bucket} className="seasonality-heatmap__label">{bucketLabel(item.bucket, activeGrain, locale)}</span>)}
                {result.years.map((year) => <React.Fragment key={year}><strong>{year}</strong>{result.seasonal.map((item) => {
                  const point = result.points.find((candidate) => candidate.year === year && candidate.bucket === item.bucket);
                  const delta = point ? point.index - 100 : null;
                  const color = delta == null ? "transparent" : delta >= 0 ? `color-mix(in srgb, var(--success) ${Math.min(78, 14 + Math.abs(delta))}%, var(--surface-container-low))` : `color-mix(in srgb, var(--danger) ${Math.min(78, 14 + Math.abs(delta))}%, var(--surface-container-low))`;
                  return <span key={item.bucket} title={point ? `${year} · ${bucketLabel(item.bucket, activeGrain, locale)}: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%` : "—"} className="seasonality-heatmap__cell" style={{ background: color }}>{point ? `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}` : "—"}</span>;
                })}</React.Fragment>)}
              </div>
            </div>
          </>
        )}
        <details className="seasonality-note"><summary>{locale === "en" ? "How to read this" : "읽는 법"}</summary><p>{detrend ? (locale === "en" ? "Trend removed uses a centred moving-average baseline (13 weeks / 5 months). +20% means the period is typically 20% above its surrounding trend. This is a repeated pattern, not proof of cause." : "추세 제외는 중앙 이동평균(주 13개/월 5개 구간)을 기준으로 계산합니다. +20%는 주변 추세보다 평균 20% 높다는 뜻입니다. 반복 패턴이지 원인 확정은 아닙니다.") : (locale === "en" ? "Actual-value view preserves the scale of each year. The bar chart and heatmap still compare each period against that year’s average so years of different size remain comparable." : "실제값 보기는 연도별 규모를 그대로 보여줍니다. 막대와 히트맵은 각 연도 평균 대비로 표시해 규모가 다른 연도도 비교할 수 있습니다.")}</p></details>
      </section>
    </div>
  );
}
