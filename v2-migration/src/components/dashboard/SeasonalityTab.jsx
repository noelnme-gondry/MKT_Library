"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { getMonFilteredRows, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { buildCalendarSeasonality, detectCalendarGrain } from "@/utils/seasonalityMath";
import { buildGraphSheetRows, buildRawIsoRows, classifySeasonalitySource } from "@/utils/seasonalityExport";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import DownloadHub from "@/components/ds/DownloadHub";
import { downloadXlsx } from "@/utils/download";
import * as XLSX from "xlsx";

const METRICS = [
  { key: "installs", ko: "설치", en: "Installs", kind: "count" },
  { key: "actions", ko: "가입/액션", en: "Actions", kind: "count" },
  { key: "revenue_d7", ko: "매출 (D7)", en: "Revenue (D7)", kind: "currency" },
  { key: "cost", ko: "지출", en: "Spend", kind: "currency" },
  { key: "clicks", ko: "클릭", en: "Clicks", kind: "count" },
  { key: "impressions", ko: "노출", en: "Impressions", kind: "count" },
  { key: "cpi", ko: "CPI", en: "CPI", kind: "currency", ratio: { numerator: "cost", denominator: "installs" } },
  { key: "cpa", ko: "CPA", en: "CPA", kind: "currency", ratio: { numerator: "cost", denominator: "actions" } },
  { key: "roas", ko: "ROAS", en: "ROAS", kind: "percent", ratio: { numerator: "revenue_d7", denominator: "cost" } },
];

const MONTHS_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const monthLabel = (bucket, locale) => locale === "en" ? new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(Date.UTC(2024, bucket - 1, 1))) : MONTHS_KO[bucket - 1];
const bucketLabel = (bucket, grain, locale) => grain === "week" ? (locale === "en" ? `W${String(bucket).padStart(2, "0")}` : `${bucket}주`) : monthLabel(bucket, locale);

export default function SeasonalityTab({ locale = "ko" } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const mappedKeys = useMemo(() => new Set(Object.values(csvData?.mapping || {})), [csvData]);
  const availableMetrics = METRICS.filter((metric) => metric.ratio
    ? mappedKeys.has(metric.ratio.numerator) && mappedKeys.has(metric.ratio.denominator)
    : mappedKeys.has(metric.key));
  const [metric, setMetric] = useState("installs");
  const [grain, setGrain] = useState("month");
  const [detrend, setDetrend] = useState(false);
  const overlayRef = useRef(null);
  const indexRef = useRef(null);
  const trendRef = useRef(null);
  const chartsRef = useRef({});

  const selectedMetricKey = availableMetrics.some((item) => item.key === metric) ? metric : availableMetrics[0]?.key;
  const selected = METRICS.find((item) => item.key === selectedMetricKey);
  // 집계는 이 탭이 열렸을 때만 실행된다. 업로드·매핑 편집 화면에서는 호출되지 않아
  // 대용량 CSV의 입력 반응성을 해치지 않는다.
  const rows = getMonFilteredRows(csvData, dashboardFilter);
  const countriesInResult = [...new Set(rows.map((row) => String(row.country || "").trim()).filter(Boolean))];
  const sourceGrain = detectCalendarGrain(rows);
  const availableGrains = sourceGrain === "day" ? ["month", "week"] : sourceGrain === "week" ? ["week"] : sourceGrain === "month" ? ["month"] : [];
  const activeGrain = availableGrains.includes(grain) ? grain : availableGrains[0] || grain;
  const result = buildCalendarSeasonality(rows, { metric: selected?.ratio || selectedMetricKey, grain: activeGrain, detrend });

  useEffect(() => {
    Object.values(chartsRef.current).forEach((chart) => chart?.destroy());
    chartsRef.current = {};
    if (!result.sufficient || !overlayRef.current || !indexRef.current) return undefined;
    const labels = result.seasonal.map((item) => bucketLabel(item.bucket, activeGrain, locale));
    const common = chartCommonOpts();
    // 실제값 축 포맷(통화/비율/카운트) — detrend 무관하게 원 단위로 표기.
    const valueTickFormat = (value) => {
      if (selected?.kind === "currency") return fmtCurrencyPrecise(Number(value), displayCurrency);
      if (selected?.kind === "percent") return `${(Number(value) * 100).toFixed(1)}%`;
      return Math.round(Number(value)).toLocaleString();
    };
    // 오버레이 축: detrend면 인덱스(%)로, 아니면 실제값.
    const tickFormat = (value) => (detrend ? `${Number(value).toFixed(1)}%` : valueTickFormat(value));
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
    // 추세 제외 검증 차트 — 전체 타임라인의 실제값 vs 추세선(중앙 이동평균).
    // detrend 인덱스 = 실제값 ÷ 추세선 × 100 이므로, 이 두 선이 "어떻게 추세를 걷어냈는지"를
    // 눈으로 확인하는 근거다(토글 상태와 무관하게 방법을 보여준다).
    if (trendRef.current && result.points?.length) {
      const trendLabels = result.points.map((point) => `${point.year} ${bucketLabel(point.bucket, activeGrain, locale)}`);
      chartsRef.current.trend = new Chart(trendRef.current, {
        type: "line",
        data: {
          labels: trendLabels,
          datasets: [
            {
              label: locale === "en" ? "Actual value" : "실제값",
              data: result.points.map((point) => point.value),
              borderColor: CHART_THEME.primary,
              backgroundColor: CHART_THEME.primary,
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.2,
            },
            {
              label: locale === "en" ? "Trend baseline (moving average)" : "추세선 (이동평균)",
              data: result.points.map((point) => point.trend),
              borderColor: CHART_THEME.muted,
              backgroundColor: CHART_THEME.muted,
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 0,
              tension: 0.2,
            },
          ],
        },
        options: {
          ...common,
          plugins: { ...common.plugins, legend: { ...(common.plugins?.legend || {}), display: true } },
          scales: {
            ...common.scales,
            x: { ...common.scales.x, ticks: { ...common.scales.x?.ticks, maxTicksLimit: 12, autoSkip: true } },
            y: { ...common.scales.y, ticks: { ...common.scales.y.ticks, callback: valueTickFormat } },
          },
        },
      });
    }
    window.requestAnimationFrame(() => Object.values(chartsRef.current).forEach((chart) => chart?.resize()));
    return () => Object.values(chartsRef.current).forEach((chart) => chart?.destroy());
  }, [result, activeGrain, detrend, locale, displayCurrency, selected?.kind]);

  if (!availableMetrics.length) return <p className="muted">날짜와 설치·가입·매출·지출 중 하나를 매핑하면 시즈널리티를 볼 수 있습니다.</p>;

  const strongest = result.sufficient ? [...result.seasonal].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] : null;

  // 한 번의 XLSX 다운로드에 원본·Total/Paid/Organic·채널 그래프 데이터를 모두 담는다.
  const buildDownloadItems = () => {
    if (!result.sufficient || !csvData?.raw?.length) return [];
    const createWorkbook = () => {
    const rawIsoRows = buildRawIsoRows({ raw: csvData.raw, headers: csvData.headers || [], mapping: csvData.mapping || {}, grain: activeGrain });
    const seriesDefinitions = [
      { key: "total", label: locale === "en" ? "Total" : "전체", rows },
      { key: "paid", label: "Paid", rows: rows.filter((row) => classifySeasonalitySource(row.source) === "paid") },
      { key: "organic", label: "Organic", rows: rows.filter((row) => classifySeasonalitySource(row.source) === "organic") },
    ];
    const graphSheets = seriesDefinitions.map((definition) => ({
      ...definition,
      result: buildCalendarSeasonality(definition.rows, { metric: selected?.ratio || selectedMetricKey, grain: activeGrain, detrend }),
    }));
    const channelKeys = [...new Set(rows.map((row) => String(row.channel || "").trim()).filter(Boolean))].sort();
    const channelRows = channelKeys.flatMap((channel) => {
      const channelResult = buildCalendarSeasonality(rows.filter((row) => String(row.channel || "").trim() === channel), { metric: selected?.ratio || selectedMetricKey, grain: activeGrain, detrend });
      return channelResult.sufficient ? buildGraphSheetRows(channelResult, `channel:${channel}`, channel, activeGrain, (bucket, currentGrain) => bucketLabel(bucket, currentGrain, locale)) : [];
    });
    const workbook = XLSX.utils.book_new();
    const appendSheet = (name, sheetRows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), name.slice(0, 31));
    appendSheet("raw_iso", rawIsoRows);
    graphSheets.forEach((sheet) => {
      const sheetRows = sheet.result.sufficient
        ? buildGraphSheetRows(sheet.result, sheet.key, sheet.label, activeGrain, (bucket, currentGrain) => bucketLabel(bucket, currentGrain, locale))
        : [{ series: sheet.key, series_label: sheet.label, status: "not_available", reason: "source data insufficient" }];
      appendSheet(`calendar_${sheet.key}`, sheetRows);
    });
    if (channelRows.length) appendSheet("calendar_channel", channelRows);
    appendSheet("export_info", [
      { field: "metric", value: selectedMetricKey },
      { field: "grain", value: activeGrain },
      { field: "trend_removed", value: detrend ? "true" : "false" },
      { field: "raw_rows", value: csvData.raw.length },
      { field: "graph_rows", value: rows.length },
      { field: "date_filter", value: `${dashboardFilter.dateStart || ""}..${dashboardFilter.dateEnd || ""}` },
      { field: "source_filter", value: [...(dashboardFilter.sources || [])].join(" | ") },
      { field: "country_filter", value: [...(dashboardFilter.countries || [])].join(" | ") },
      { field: "platform_filter", value: [...(dashboardFilter.platforms || [])].join(" | ") },
      { field: "channel_filter", value: [...(dashboardFilter.channels || [])].join(" | ") },
    ]);
    return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    };
    return [{
      label: locale === "en" ? "Complete workbook (XLSX)" : "전체 데이터 한 번에 받기 (XLSX)",
      desc: locale === "en" ? "Raw + ISO, Total/Paid/Organic and channel chart data" : "원본 + ISO, 전체/Paid/Organic 및 채널별 그래프 데이터",
      icon: "📊",
      onSelect: () => downloadXlsx(createWorkbook(), "calendar_seasonality_export"),
    }];
  };
  const downloadItems = buildDownloadItems();

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
            {downloadItems.length > 0 && (
              <DownloadHub items={downloadItems} align="right" label={locale === "en" ? "Download" : "데이터 받기"} toolId="5-2" />
            )}
          </div>
        </div>

        <p className="seasonality-source-note">{sourceGrain === "day"
          ? (locale === "en" ? "Daily input detected · weekly and monthly views available." : "일별 데이터 인식 · 주별과 월별 모두 볼 수 있습니다.")
          : sourceGrain === "week"
            ? (locale === "en" ? "Weekly input detected · monthly view is disabled because weeks can cross calendar months." : "주별 데이터 인식 · 주가 월 경계를 넘을 수 있어 월별 보기는 비활성화했습니다.")
            : sourceGrain === "month"
              ? (locale === "en" ? "Monthly input detected · weekly view needs daily or weekly source data." : "월별 데이터 인식 · 주별 보기는 일별 또는 주별 원본이 필요합니다.")
              : (locale === "en" ? "Could not identify the date frequency." : "날짜 입력 단위를 인식하지 못했습니다.")}</p>
        {countriesInResult.length > 1 && <div className="seasonality-empty" style={{ marginTop: "9px", textAlign: "left" }}>{locale === "en" ? `Multiple countries (${countriesInResult.join(", ")}) are mixed. Select one country in the top filter before interpreting a national seasonal pattern.` : `국가 ${countriesInResult.join(", ")}가 섞여 있습니다. 국가별 계절성을 해석하려면 상단 필터에서 한 국가만 선택하세요.`}</div>}

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
              <span>{locale === "en" ? `coverage: ${result.years.map((year) => `${year} ${result.coverage?.[year] || 0}`).join(" · ")}` : `관측 구간: ${result.years.map((year) => `${year} ${result.coverage?.[year] || 0}${activeGrain === "week" ? "주" : "개월"}`).join(" · ")}`}</span>
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
            <article className="chart-container seasonality-verify">
              <h3>{locale === "en" ? "How the trend was removed (verification)" : "추세 제외 검증 — 어떻게 걷어냈나"}</h3>
              <p className="seasonality-verify__note">{locale === "en"
                ? "The dashed grey line is the centred moving-average trend (13 weeks / 5 months). The detrend index = actual ÷ trend × 100. Compare the two lines to see exactly what scale growth/decline was divided out."
                : "회색 점선이 중앙 이동평균 추세선(주 13개 / 월 5개 구간)입니다. 추세 제외 인덱스 = 실제값 ÷ 추세선 × 100. 두 선을 비교하면 규모 성장·하락을 어떻게 걷어냈는지 그대로 확인할 수 있습니다."}</p>
              <div style={{ height: "260px" }}><canvas ref={trendRef} /></div>
            </article>
          </>
        )}
        <details className="seasonality-note"><summary>{locale === "en" ? "How to read this / methodology" : "읽는 법 (방법론)"}</summary>
          <p>{detrend ? (locale === "en" ? "Trend removed uses a centred moving-average baseline (13 weeks / 5 months). +20% means the period is typically 20% above its surrounding trend. This is a repeated pattern, not proof of cause." : "추세 제외는 중앙 이동평균(주 13개/월 5개 구간)을 기준으로 계산합니다. +20%는 주변 추세보다 평균 20% 높다는 뜻입니다. 반복 패턴이지 원인 확정은 아닙니다.") : (locale === "en" ? "Actual-value view preserves the scale of each year. The bar chart and heatmap still compare each period against that year’s average so years of different size remain comparable." : "실제값 보기는 연도별 규모를 그대로 보여줍니다. 막대와 히트맵은 각 연도 평균 대비로 표시해 규모가 다른 연도도 비교할 수 있습니다.")}</p>
          <p><strong>{locale === "en" ? "How 'Remove trend' is computed" : "‘추세 제외’ 계산 방법"}</strong>{locale === "en"
            ? " — (1) sum the metric per calendar period (day input is grouped into ISO weeks or calendar months; ratio metrics like CPI/CPA/ROAS sum numerator & denominator first, then divide once). (2) Build a centred moving-average trend over the chronological timeline (radius 6 weeks → 13-point window, or 2 months → 5-point window). (3) Index = value ÷ trend × 100. The 'verification' chart above plots the actual line against this trend line so you can see exactly what was divided out."
            : " — (1) 지표를 달력 구간별로 합산합니다(일별 입력은 ISO주 또는 달력 월로 묶고, CPI/CPA/ROAS 같은 비율은 분자·분모를 먼저 합산한 뒤 한 번만 나눕니다). (2) 시간순 타임라인에 중앙 이동평균 추세선을 만듭니다(주=반경 6→13개 창, 월=반경 2→5개 창). (3) 인덱스 = 값 ÷ 추세선 × 100. 위 ‘검증’ 차트가 실제값 선과 이 추세선을 함께 그려 무엇을 걷어냈는지 보여줍니다."}</p>
          <p><strong>{locale === "en" ? "Download" : "데이터 받기"}</strong>{locale === "en"
            ? " — One XLSX contains the complete raw file with ISO annotations, separate Total/Paid/Organic chart sheets, channel-level chart data, and an export_info sheet with filters and method settings."
            : " — XLSX 한 파일에 업로드 원본 전체 + ISO 주석, 전체/Paid/Organic 그래프 시트, 채널별 그래프 데이터, 적용 필터·계산 설정이 함께 들어갑니다."}</p>
        </details>
      </section>
    </div>
  );
}
