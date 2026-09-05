"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import PillGroup from "@/components/ds/PillGroup";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import CustomChartsSection from "./CustomChartsSection";
import { getMonFilteredRows, aggregateByKey, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts, downloadChartAsPNG, getCssVar } from "@/utils/chartUtils";
import { PACING_MATH } from "@/utils/pacingMath";
import { sourceCurrencyOf } from "@/utils/format";

const PACING_COPY = {
  ko: {
    sectionTitle: "페이싱 · 착지 예측",
    noDateData: "날짜·지표 데이터가 부족합니다.",
    metricLabel: "지표",
    cost: "비용",
    installs: "설치",
    registration: "가입",
    purchase: "구매",
    locked: " 🔒",
    forecastMode: "예측 방식",
    linear: "선형",
    weekday: "요일 보정",
    weekdayHint: "⊘ 요일당 최소 3개 관측(~3주) 필요. 데이터 더 쌓이면 활성화됩니다.",
    actionDef: "액션 정의",
    actionDefHint: "라벨/용어만 변경됩니다. 분석 데이터(actions 컬럼)는 동일합니다.",
    revenueNotice: (
      <>일별 매출 페이싱은 revenue_d7(코호트 윈도우)이 아닌 <strong>일별(캘린더) 매출 컬럼</strong>이 필요합니다 — 별도 업로드 예정.</>
    ),
    monthlyTargetLabel: (metricLabel) => `${metricLabel} 월 목표 (선택)`,
    monthlyTargetPlaceholder: "목표 입력 시 페이스 계산",
    mtd: (ym) => `MTD (${ym})`,
    daysElapsed: (d) => `D${d} 경과`,
    dailyRunRate: "일 run-rate",
    projectedLanding: "월말 착지 예측",
    weekdayAdjusted: "요일 보정",
    runRateFormula: (n) => `run-rate × ${n}일`,
    paceVsTarget: "목표 대비 페이스",
    recommendedDaily: "잔여일 일일 권장",
    costOver: (pct) => `예산 ${pct}% 초과 착지 예상 — 일일 소진 축소 필요`,
    costUnder: (pct) => `예산 ${pct}% 미달 착지 예상 — 소진 가속 여지`,
    costOk: "목표 페이스 정상 (±10% 이내)",
    outcomeOver: (pct) => `목표 ${pct}% 초과 달성 예상`,
    outcomeUnder: (pct) => `목표 ${pct}% 미달 예상 — 가속 필요`,
    noTargetHint: "월 목표를 입력하면 페이스·권장 소진액·경고가 표시됩니다.",
    dailyTrendTitle: (metricLabel) => `당월 일별 ${metricLabel} 추이`,
    pngBtn: "⬇ PNG",
    customChartsTitle: "커스텀 차트",
    cumulative: "누적",
    targetLinear: "목표(선형)",
  },
  en: {
    sectionTitle: "Pacing · Landing Forecast",
    noDateData: "Not enough date/metric data.",
    metricLabel: "Metric",
    cost: "Cost",
    installs: "Installs",
    registration: "Signups",
    purchase: "Purchases",
    locked: " 🔒",
    forecastMode: "Forecast method",
    linear: "Linear",
    weekday: "Weekday-adjusted",
    weekdayHint: "⊘ Needs at least 3 observations per weekday (~3 weeks). Will activate as more data accumulates.",
    actionDef: "Action definition",
    actionDefHint: "Only the label/terminology changes. The underlying data (actions column) is the same.",
    revenueNotice: (
      <>Daily revenue pacing needs a <strong>daily (calendar) revenue column</strong>, not revenue_d7 (cohort window) — separate upload planned.</>
    ),
    monthlyTargetLabel: (metricLabel) => `${metricLabel} monthly target (optional)`,
    monthlyTargetPlaceholder: "Enter a target to calculate pace",
    mtd: (ym) => `MTD (${ym})`,
    daysElapsed: (d) => `Day ${d} elapsed`,
    dailyRunRate: "Daily run-rate",
    projectedLanding: "Projected month-end landing",
    weekdayAdjusted: "Weekday-adjusted",
    runRateFormula: (n) => `run-rate × ${n} days`,
    paceVsTarget: "Pace vs target",
    recommendedDaily: "Recommended daily (remaining days)",
    costOver: (pct) => `Projected to land ${pct}% over budget — reduce daily spend`,
    costUnder: (pct) => `Projected to land ${pct}% under budget — room to accelerate spend`,
    costOk: "On pace with target (within ±10%)",
    outcomeOver: (pct) => `Projected to exceed target by ${pct}%`,
    outcomeUnder: (pct) => `Projected to fall short of target by ${pct}% — needs acceleration`,
    noTargetHint: "Enter a monthly target to see pace, recommended spend, and alerts.",
    dailyTrendTitle: (metricLabel) => `Daily ${metricLabel} trend (this month)`,
    pngBtn: "⬇ PNG",
    customChartsTitle: "Custom Charts",
    cumulative: "Cumulative",
    targetLinear: "Target (linear)",
  },
};

export default function PacingTab({ locale = "ko" } = {}) {
  const T = PACING_COPY[locale] || PACING_COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const dataCurrency = sourceCurrencyOf(csvData, displayCurrency);
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  const [metric, setMetric] = useState("cost");
  const [forecastMode, setForecastMode] = useState("linear");
  const [actionDef, setActionDef] = useState("registration");
  const [monthlyTarget, setMonthlyTarget] = useState("");

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { paceData, dailyData, hasData, mapping } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) return { hasData: false, mapping: {} };
    
    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const daily = aggregateByKey(rows, "date", ["cost", "installs", "actions"]).sort((a, b) => (a._key > b._key ? 1 : -1));
    
    if (daily.length === 0) return { hasData: false, mapping: csvData.mapping || {} };

    // Feed the golden PACING_MATH engine (source of truth) with {date, value}.
    const series = daily.map(d => ({ date: d._key, value: d[metric] || 0 }));
    const p = PACING_MATH.pace(series);
    if (!p) return { hasData: false, mapping: csvData.mapping || {} };

    const useWeekday = metric !== "cost";
    const pw = useWeekday ? PACING_MATH.paceWeekday(series) : null;

    const mtdData = daily.filter(d => d._key.startsWith(p.ym));

    return {
      hasData: true,
      dailyData: daily,
      paceData: {
        ym: p.ym,
        mtdTotal: p.mtd,
        daysElapsed: p.daysElapsed,
        daysInMonth: p.daysInMonth,
        runRate: p.runRate,
        projected: p.projected,
        weekday: pw,
        mtdSeries: mtdData
      },
      mapping: csvData.mapping || {}
    };
  }, [csvData, dashboardFilter, metric]);

  const target = Number(monthlyTarget) || 0;
  const isCost = metric === "cost";
  const actionLabel = actionDef === "purchase" ? T.purchase : T.registration;
  const metricLabel = { cost: T.cost, installs: T.installs, actions: actionLabel }[metric] || metric;
  const fmtV = (v) => v != null ? (isCost ? fmtCurrencyPrecise(v, dataCurrency) : Math.round(v).toLocaleString()) : "—";

  const useWd = forecastMode === "weekday" && !isCost;
  // 요일 보정 예측: paceWeekday가 fallback 아니면(요일당 최소 3개 관측) 활성.
  const wdOk = !!(paceData && paceData.weekday && !paceData.weekday.fallback);
  const projectedVal = paceData
    ? (useWd && wdOk ? paceData.weekday.weekdayProjected : paceData.projected)
    : null;

  let pacePct = null, recDaily = null, statusTone = "info", statusMsg = "";

  if (paceData && target > 0 && projectedVal != null) {
    pacePct = (projectedVal / target) * 100;
    const remainingDays = paceData.daysInMonth - paceData.daysElapsed;
    recDaily = remainingDays > 0 ? (target - paceData.mtdTotal) / remainingDays : 0;
    
    if (isCost) {
      if (pacePct > 110) {
        statusTone = "danger";
        statusMsg = T.costOver((pacePct - 100).toFixed(0));
      } else if (pacePct < 90) {
        statusTone = "warn";
        statusMsg = T.costUnder((100 - pacePct).toFixed(0));
      } else {
        statusTone = "ok";
        statusMsg = T.costOk;
      }
    } else {
      if (pacePct >= 100) {
        statusTone = "ok";
        statusMsg = T.outcomeOver((pacePct - 100).toFixed(0));
      } else {
        statusTone = "warn";
        statusMsg = T.outcomeUnder((100 - pacePct).toFixed(0));
      }
    }
  }

  useEffect(() => {
    if (!chartRef.current || !hasData || !paceData) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const mtdSeries = paceData.mtdSeries;
    let cum = 0;
    const cumData = mtdSeries.map(d => ({ x: d._key, y: (cum += (d[metric] || 0)) }));
    
    const ds = [{
      label: T.cumulative,
      data: cumData.map(d => d.y),
      borderColor: CHART_THEME.primary,
      backgroundColor: "rgba(173,198,255,0.3)",
      fill: true,
      tension: 0.2,
      pointRadius: 2,
    }];

    if (target > 0) {
      ds.push({
        label: T.targetLinear,
        data: mtdSeries.map((_, i) => target * (i + 1) / paceData.daysInMonth),
        borderColor: CHART_THEME.tertiary,
        borderDash: [5, 4],
        borderWidth: 1.5,
        pointRadius: 0,
      });
    }

    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels: mtdSeries.map(d => d._key.slice(5)),
        datasets: ds
      },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartCommonOpts().plugins,
          legend: { labels: { color: getCssVar("--text-muted"), font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { color: getCssVar("--text-muted"), maxTicksLimit: 12 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: getCssVar("--text-muted") }, grid: { color: getCssVar("--border") } }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, paceData, target, metric, isDarkMode, T]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-pacing">
        <section className="block" id="s-pace">
          <h2 className="section-title">{T.sectionTitle}</h2>
          <p className="muted">{T.noDateData}</p>
        </section>
      </div>
    );
  }

  const mapped = new Set(Object.values(mapping));
  const hasCost = mapped.has("cost");
  const hasInstalls = mapped.has("installs");
  const hasActions = mapped.has("actions");

  return (
    <div className="tab-pane active" id="tab-pacing">
      <section className="block" id="s-pace">
        <h2 className="section-title">{T.sectionTitle}</h2>

        <PillGroup
          label={T.metricLabel}
          value={metric}
          onChange={setMetric}
          options={[
            { value: "cost", label: <>{T.cost}{!hasCost && T.locked}</>, disabled: !hasCost },
            { value: "installs", label: <>{T.installs}{!hasInstalls && T.locked}</>, disabled: !hasInstalls },
            { value: "actions", label: <>{actionLabel}{!hasActions && T.locked}</>, disabled: !hasActions },
          ]}
        />

        {!isCost && (
          <>
            <PillGroup
              style={{ marginTop: "8px" }}
              label={T.forecastMode}
              value={useWd ? "weekday" : "linear"}
              onChange={setForecastMode}
              options={[
                { value: "linear", label: T.linear },
                { value: "weekday", label: <>{T.weekday}{!wdOk && T.locked}</>, disabled: !wdOk },
              ]}
            />
            {!wdOk && <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0" }}>{T.weekdayHint}</p>}
          </>
        )}

        {metric === "actions" && (
          <>
            <PillGroup
              style={{ marginTop: "8px" }}
              label={T.actionDef}
              value={actionDef}
              onChange={setActionDef}
              options={[
                { value: "registration", label: T.registration },
                { value: "purchase", label: T.purchase },
              ]}
            />
            <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0" }}>{T.actionDefHint}</p>
          </>
        )}

        <div className="callout" style={{ margin: "8px 0", padding: "8px 12px" }}>
          <div className="ico">i</div>
          <div className="body">
            <p style={{ margin: 0, fontSize: "12px" }}>{T.revenueNotice}</p>
          </div>
        </div>

        <div className="ab-field" style={{ maxWidth: "280px", margin: "10px 0" }}>
          <label>{T.monthlyTargetLabel(metricLabel)}</label>
          <input
            id="pacing-target"
            type="number"
            min="0"
            step={isCost ? "10000" : "100"}
            value={monthlyTarget}
            onChange={(e) => setMonthlyTarget(e.target.value)}
            placeholder={T.monthlyTargetPlaceholder}
          />
        </div>

        {paceData && (
          <div className="ab-stat-row" style={{ margin: "8px 0 12px" }}>
            <div className="ab-stat">
              <div className="ab-stat-label">{T.mtd(paceData.ym)}</div>
              <div className="ab-stat-value tnum">{fmtV(paceData.mtdTotal)}</div>
              <div className="ab-stat-hint">{T.daysElapsed(paceData.daysElapsed)}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label">{T.dailyRunRate}</div>
              <div className="ab-stat-value tnum">{fmtV(paceData.runRate)}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label">{T.projectedLanding}</div>
              <div className="ab-stat-value tnum">{fmtV(projectedVal)}</div>
              <div className="ab-stat-hint">{useWd && wdOk ? T.weekdayAdjusted : T.runRateFormula(paceData.daysInMonth)}</div>
            </div>
            {target > 0 && (
              <>
                <div className="ab-stat">
                  <div className="ab-stat-label">{T.paceVsTarget}</div>
                  <div className={`ab-stat-value tnum ${pacePct > 110 && isCost ? "neg" : pacePct < 90 ? "" : "pos"}`}>
                    {pacePct.toFixed(0)}%
                  </div>
                </div>
                {recDaily != null && (
                  <div className="ab-stat">
                    <div className="ab-stat-label">{T.recommendedDaily}</div>
                    <div className="ab-stat-value tnum">{fmtV(Math.max(0, recDaily))}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {target > 0 ? (
          <div className={`callout ${statusTone === "danger" ? "warning" : statusTone}`}>
            <div className="ico">{statusTone === "ok" ? "✓" : statusTone === "danger" ? "!" : "i"}</div>
            <div className="body">
              <strong>{statusMsg}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">{T.noTargetHint}</p>
        )}

        <div className="alloc-card" style={{ marginTop: "12px" }}>
          <div className="cann-card-header">
            <div className="alloc-card-title">{T.dailyTrendTitle(metricLabel)}</div>
            <button
              className="ab-pill"
              type="button"
              aria-label={locale === "en" ? "Download pacing chart as PNG" : "페이싱 차트 PNG 다운로드"}
              onClick={() => downloadChartAsPNG(chartRef.current, "pacing")}
            >
              {T.pngBtn}
            </button>
          </div>
          <div className="chart-container" style={{ height: "260px" }}>
            <canvas id="pacing-chart" ref={chartRef}></canvas>
          </div>
        </div>

      </section>
      <CustomChartsSection sectionNo="2" chartScope="5-2:pacing-charts" metricScope="5-2:viz-kpi" title={T.customChartsTitle} locale={locale} />
    </div>
  );
}
