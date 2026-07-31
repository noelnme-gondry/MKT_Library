"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Chart from "chart.js/auto";
import Link from "next/link";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { resolveDashCopy } from "@/utils/contentDomain";
import CustomChartsSection from "./CustomChartsSection";
import { getMonFilteredRows, aggregateByKey } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { ANOMALY_MATH } from "@/utils/anomalyMath";
import { fmtCurrency } from "@/utils/format";
import { applyMetricView } from "@/utils/metrics/metricView";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import { buildAttributionCache } from "@/utils/anomalyAttribution";

// 지표 뷰 설정 scope — 이상탐지 표의 지표 컬럼 표시/순서.
const ANOMALY_TABLE_SCOPE = "5-2:anomaly-table";

// EN 지표 라벨 — contentDomain.js(C.anLabels)는 ko 전용이라 로컬로 병행 유지(§domain 로직 불변).
const AN_LABELS_EN = {
  performance: {
    cost: "Cost", impressions: "Impressions", clicks: "Clicks", installs: "Installs",
    actions: "Actions", cpm: "CPM", ctr: "CTR", cpi: "CPI", cvr: "CVR",
    cpa: "CPA", roas: "ROAS",
  },
  content: {
    cost: "Cost", impressions: "Impressions", clicks: "Clicks", installs: "Visits",
    actions: "Subscriptions", cpm: "CPM", ctr: "CTR", cpi: "Cost/Visit", cvr: "CVR",
    cpa: "Cost/Subscription", roas: "ROAS",
  },
};

export default function AnomalyTab({ domain = "performance", locale = "ko" } = {}) {
  const C = resolveDashCopy(domain);
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const anomalyTableCfg = useAppStore((state) => state.viewConfig[ANOMALY_TABLE_SCOPE]);
  const setViewConfig = useAppStore((state) => state.setViewConfig);
  const resetViewConfig = useAppStore((state) => state.resetViewConfig);
  const setAnalysisHandoff = useAppStore((state) => state.setAnalysisHandoff);
  const [anomalyCfgOpen, setAnomalyCfgOpen] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  const [metric, setMetric] = useState("cost");
  const [win, setWin] = useState(14);
  const [zThresh, setZThresh] = useState(2.5);
  const [dowAdjust, setDowAdjust] = useState(false);

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { dailyData, anomalies, metricOpts, seriesVals, flags, hasData } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) return { hasData: false, metricOpts: [] };

    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const daily = aggregateByKey(rows, "date", ["cost", "installs", "actions", "clicks", "impressions", "revenue_d7"]).sort((a, b) => (a._key > b._key ? 1 : -1));
    
    if (daily.length === 0) return { hasData: false, metricOpts: [] };

    const mapped = new Set(Object.values(csvData.mapping || {}));

    // 지표 순서: 비용,노출,클릭,설치,액션,CPM,CTR,CPI,CVR,CPA,ROAS(고정)
    const AL = locale === "en" ? (AN_LABELS_EN[domain] || AN_LABELS_EN.performance) : C.anLabels;
    const mOpts = [
      ["cost", AL.cost],
      ["impressions", AL.impressions],
      ["clicks", AL.clicks],
      ["installs", AL.installs],
      ["actions", AL.actions],
      ["cpm", AL.cpm],
      ["ctr", AL.ctr],
      ["cpi", AL.cpi],
      ["cvr", AL.cvr],
      ["cpa", AL.cpa],
      ["roas", AL.roas]
    ].filter(([k]) => {
      if (k === "cost") return mapped.has("cost");
      if (k === "installs" || k === "cpi") return mapped.has("installs");
      if (k === "actions" || k === "cpa") return mapped.has("actions");
      if (k === "clicks") return mapped.has("clicks");
      if (k === "impressions") return mapped.has("impressions");
      if (k === "cpm") return mapped.has("cost") && mapped.has("impressions");
      if (k === "cvr") return mapped.has("installs") && mapped.has("clicks");
      if (k === "ctr") return mapped.has("clicks") && mapped.has("impressions");
      if (k === "roas") return mapped.has("revenue_d7");
      return false;
    });

    const getSeriesVal = (d) => {
      switch (metric) {
        case "cost": return d.cost;
        case "installs": return d.installs;
        case "actions": return d.actions;
        case "clicks": return d.clicks;
        case "impressions": return d.impressions;
        case "cpm": return d.impressions > 0 ? (d.cost / d.impressions) * 1000 : null;
        case "cpi": return d.installs > 0 ? d.cost / d.installs : null;
        case "cpa": return d.actions > 0 ? d.cost / d.actions : null;
        case "cvr": return d.clicks > 0 ? d.installs / d.clicks : null;
        case "ctr": return d.impressions > 0 ? d.clicks / d.impressions : null;
        case "roas": return d.cost > 0 ? d.revenue_d7 / d.cost : null;
        default: return d.cost;
      }
    };

    const sVals = daily.map(getSeriesVal);
    const dates = daily.map((d) => d._key);
    const valsNum = sVals.map((v) => (v == null ? NaN : v));

    // ANOMALY_MATH — EMA baseline + (요일 보정 ON이면) 요일 효과를 기대값에 반영
    const dowEffects = dowAdjust
      ? ANOMALY_MATH.computeDowEffects(valsNum, dates)
      : null;
    const _flags = ANOMALY_MATH.detect(valsNum, win, zThresh, dates, dowEffects);

    const _anomalies = _flags.filter(f => f.flag).map(f => ({
      date: daily[f.i]._key,
      value: sVals[f.i],
      z: f.z,
      mean: f.mean
    })).reverse();

    return {
      hasData: true,
      dailyData: daily,
      anomalies: _anomalies,
      metricOpts: mOpts,
      seriesVals: sVals,
      flags: _flags
    };
  }, [csvData, dashboardFilter, metric, win, zThresh, dowAdjust, C, domain, locale]);

  const attributionCache = useMemo(() => {
    if (!hasData || !anomalies?.length) return { eligibility: { eligible: false, reason: "no_anomalies" }, byDate: {} };
    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const mappedFields = new Set(Object.values(csvData?.mapping || {}));
    const filterSig = JSON.stringify({
      dateStart: dashboardFilter.dateStart,
      dateEnd: dashboardFilter.dateEnd,
      channels: [...(dashboardFilter.channels || [])].sort(),
      countries: [...(dashboardFilter.countries || [])].sort(),
      platforms: [...(dashboardFilter.platforms || [])].sort(),
      sources: [...(dashboardFilter.sources || [])].sort(),
    });
    return buildAttributionCache({
      rows,
      anomalyDates: anomalies.map((item) => item.date),
      metric,
      mappedFields,
      inputSignature: `${computeAnalyzeSig(csvData)}|${metric}|${filterSig}`,
    });
  }, [hasData, anomalies, csvData, dashboardFilter, metric]);

  const attributionReason = useCallback(() => {
    const reason = attributionCache.eligibility?.reason;
    if (reason === "unsupported_metric") return tr(
      "현재 지표는 비용÷결과 구조가 아니어서 무잔차 분해를 적용할 수 없습니다.",
      "This metric is not a cost-per-result ratio, so residual-free attribution is unavailable.",
    );
    if (reason === "missing_fields") return tr(
      "날짜·비용·결과·채널 매핑이 있어야 변동 기여를 나눌 수 있습니다.",
      "Date, cost, outcome, and channel mappings are required to attribute the change.",
    );
    return tr("비교 기간이 부족해 원인 기여를 계산할 수 없습니다.", "There is not enough comparison history to attribute this change.");
  }, [attributionCache.eligibility, tr]);

  const formatValue = useCallback((v) => {
    if (v == null) return "—";
    if (["cvr", "ctr", "roas"].includes(metric)) return (v * 100).toFixed(2) + "%";
    if (["cost", "cpi", "cpm", "cpa"].includes(metric)) return fmtCurrency(v, { currency: displayCurrency });
    return Math.round(v).toLocaleString();
  }, [metric, displayCurrency]);

  useEffect(() => {
    if (!hasData || !metricOpts.length || !dailyData.length || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = dailyData.map(d => d._key.slice(5)); // MM-DD
    
    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: metricOpts.find(m => m[0] === metric)?.[1] || metric,
          data: seriesVals,
          borderColor: CHART_THEME.primary,
          backgroundColor: "rgba(173,198,255,0.2)",
          fill: true,
          tension: 0.2,
          pointRadius: flags.map(f => f.flag ? 6 : 1.5),
          pointBackgroundColor: flags.map(f => f.flag ? (f.z > 0 ? "#fbbf24" : "#f87171") : CHART_THEME.primary),
          pointBorderColor: flags.map(f => f.flag ? "#000" : "transparent"),
          borderWidth: 2
        }]
      },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartCommonOpts().plugins,
          tooltip: {
            ...chartCommonOpts().plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const f = flags[idx];
                let lbl = `${ctx.dataset.label}: ${formatValue(ctx.raw)}`;
                if (f && f.flag) {
                  lbl += ` (z: ${f.z > 0 ? "+" : ""}${f.z.toFixed(2)})`;
                }
                return lbl;
              },
              afterBody: (items) => {
                const index = items?.[0]?.dataIndex;
                const date = dailyData[index]?._key;
                const result = attributionCache.byDate?.[date];
                if (!result || result.unavailable) return [];
                const heading = tr("변동 기여 상위", "Top change contributors");
                return [heading, ...result.drivers.slice(0, 3).map((driver) =>
                  `${driver.label}: ${driver.contribution >= 0 ? "+" : ""}${formatValue(driver.contribution)}`
                )];
              },
            }
          }
        },
        scales: {
          x: { ticks: { color: getCssVar("--text-muted"), maxTicksLimit: 14 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: getCssVar("--text-muted") }, grid: { color: getCssVar("--border") } }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, dailyData, seriesVals, flags, metric, metricOpts, isDarkMode, formatValue, attributionCache, tr]);

  if (!hasData || metricOpts.length === 0) {
    return (
      <div className="tab-pane active" id="tab-anomaly">
        <section className="block" id="s-anom">
          <h2 className="section-title"><span className="ix">§1</span>{tr("이상 감지", "Anomaly Detection")}</h2>
          <p className="muted">{tr("데이터가 없습니다.", "No data available.")}</p>
        </section>
      </div>
    );
  }

  // 이상탐지 표 지표 컬럼 — 첫 컬럼 '날짜'는 고정, 나머지만 표시/순서 토글(값 불변).
  const anomalyCols = [
    { k: "value", label: tr("값", "Value"), render: (a) => <strong>{formatValue(a.value)}</strong> },
    { k: "mean", label: tr(`기준 평균(${win}일)`, `Baseline avg (${win}d)`), render: (a) => formatValue(a.mean) },
    { k: "z", label: "z-score", cellClass: (a) => (Math.abs(a.z) >= 3 ? "neg" : ""), render: (a) => `${a.z > 0 ? "+" : ""}${a.z.toFixed(2)}` },
    { k: "dir", label: tr("방향", "Direction"), render: (a) => (a.z > 0 ? <span style={{ color: "#fbbf24" }}>{tr("▲ 급등", "▲ Spike")}</span> : <span style={{ color: "#f87171" }}>{tr("▼ 급락", "▼ Drop")}</span>) },
  ];
  const orderedAnomalyCols = applyMetricView(anomalyCols, anomalyTableCfg, (col) => col.k);

  return (
    <div className="tab-pane active" id="tab-anomaly">
      <section className="block" id="s-anom">
        <h2 className="section-title"><span className="ix">§1</span>{tr("이상 감지", "Anomaly Detection")}</h2>

        <div className="ab-pillgroup">
          <span className="ab-pillgroup-label">{tr("지표", "Metric")}</span>
          {metricOpts.map(([k, l]) => (
            <button key={k} className={`ab-pill ${metric === k ? "active" : ""}`} onClick={() => setMetric(k)}>
              {l}
            </button>
          ))}
        </div>

        <div className="ab-pillgroup">
          <span className="ab-pillgroup-label">{tr("민감도(z)", "Sensitivity (z)")}</span>
          {[2, 2.5, 3].map(zz => (
            <button key={zz} className={`ab-pill ${zThresh === zz ? "active" : ""}`} onClick={() => setZThresh(zz)}>
              {zz}σ
            </button>
          ))}
          <span className="ab-pillgroup-label" style={{ marginLeft: "8px" }}>{tr("기준 윈도우", "Baseline window")}</span>
          {[7, 14, 28].map(w => (
            <button key={w} className={`ab-pill ${win === w ? "active" : ""}`} onClick={() => setWin(w)}>
              {tr(`${w}일`, `${w}d`)}
            </button>
          ))}
          <span
            className="ab-pillgroup-label"
            style={{ marginLeft: "8px" }}
            title={tr(
              "요일별 효과(주말 노출↑·평일 CTR↓ 등)를 기대값에 반영해, 요일 특성으로 인한 거짓 이상탐지를 줄입니다.",
              "Reflects day-of-week effects (e.g. higher weekend impressions, lower weekday CTR) in the expected value, reducing false anomalies caused by weekly patterns."
            )}
          >
            {tr("요일 보정", "Day-of-week adjustment")}
          </span>
          <button className={`ab-pill ${!dowAdjust ? "active" : ""}`} onClick={() => setDowAdjust(false)}>
            OFF
          </button>
          <button className={`ab-pill ${dowAdjust ? "active" : ""}`} onClick={() => setDowAdjust(true)}>
            ON
          </button>
        </div>

        <div className="alloc-card" style={{ margin: "10px 0" }}>
          <div className="cann-card-header">
            <div className="alloc-card-title">{tr("시계열 + 이상 표기", "Time series + anomaly markers")}</div>
            <button className="ab-pill" data-pngdownload="anomaly-chart" data-pngname="anomaly">⬇ PNG</button>
          </div>
          <div className="chart-container" style={{ height: "260px" }}>
            <canvas id="anomaly-chart" ref={chartRef}></canvas>
          </div>
        </div>

        {anomalies.length ? (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
              <button className="ab-pill" onClick={() => setAnomalyCfgOpen(true)} title={tr("표시할 지표 컬럼과 순서 편집", "Edit displayed metric columns and order")}>{tr("⚙ 컬럼 편집", "⚙ Edit columns")}</button>
            </div>
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    <th>{tr("날짜", "Date")}</th>
                    {orderedAnomalyCols.map((col) => <th key={col.k}>{col.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {anomalies.slice(0, 40).map((a) => {
                    const attribution = attributionCache.byDate?.[a.date];
                    const isOpen = expandedDate === a.date;
                    return (
                      <React.Fragment key={a.date}>
                        <tr>
                          <td className="tnum">
                            {a.date}
                            <button
                              className="ab-pill"
                              type="button"
                              style={{ marginLeft: "8px" }}
                              onClick={() => setExpandedDate(isOpen ? null : a.date)}
                            >
                              {isOpen ? tr("접기", "Close") : tr("원인 보기", "View drivers")}
                            </button>
                          </td>
                          {orderedAnomalyCols.map((col) => (
                            <td key={col.k} className={`tnum ${col.cellClass ? col.cellClass(a) : ""}`.trim()}>{col.render(a)}</td>
                          ))}
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={orderedAnomalyCols.length + 1}>
                              {attribution && !attribution.unavailable ? (
                                <div className="callout info" style={{ margin: "8px 0" }}>
                                  <div className="body">
                                    <strong>{tr("이 변동에 크게 기여한 항목", "Largest contributors to this change")}</strong>
                                    <ul>
                                      {attribution.drivers.slice(0, 5).map((driver) => (
                                        <li key={driver.key}>
                                          {driver.label}: <b>{driver.contribution >= 0 ? "+" : ""}{formatValue(driver.contribution)}</b>
                                        </li>
                                      ))}
                                    </ul>
                                    <p className="muted">{tr(
                                      "통계적 기여 분해이며 원인·인과를 확정하지 않습니다.",
                                      "This is statistical attribution and does not establish cause or causality.",
                                    )}</p>
                                    <Link
                                      className="btn ghost"
                                      href={locale === "en" ? "/en/tools/campaign-variance" : "/tools/campaign-variance"}
                                      onClick={() => setAnalysisHandoff({
                                        schemaVersion: 1,
                                        sourceToolId: "5-2",
                                        targetToolId: "5-21",
                                        dataGroup: "efficiency",
                                        metric,
                                        anomalyDate: a.date,
                                        periodA: attribution.periodA,
                                        periodB: attribution.periodB,
                                        inputSignature: attributionCache.inputSignature,
                                      })}
                                    >
                                      {tr("성과 변동 분석에서 자세히 보기", "Inspect in Campaign Variance")}
                                    </Link>
                                  </div>
                                </div>
                              ) : <p className="muted">{attributionReason()}</p>}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {orderedAnomalyCols.length === 0 && (
              <p className="muted" style={{ fontSize: "12px" }}>{tr("표시할 지표 컬럼이 없습니다. ⚙ 컬럼 편집에서 다시 켜세요.", "No metric columns are shown. Re-enable them in ⚙ Edit columns.")}</p>
            )}
          </>
        ) : (
          <div className="callout ok">
            <div className="ico">✓</div>
            <div className="body">
              <strong>{tr("이상 없음", "No anomalies")}</strong>
              <p>{tr(`현재 지표·민감도 기준 |z|≥${zThresh} 이상치가 감지되지 않았습니다.`, `No anomalies (|z|≥${zThresh}) detected for the current metric and sensitivity.`)}</p>
            </div>
          </div>
        )}
      </section>
      <MetricConfigPanel
        open={anomalyCfgOpen}
        onClose={() => setAnomalyCfgOpen(false)}
        locale={locale}
        title={tr("이상탐지 표 — 컬럼 편집", "Anomaly detection table — Edit columns")}
        items={anomalyCols.map((col) => ({ key: col.k, label: col.label }))}
        config={anomalyTableCfg}
        onSave={(next) => {
          if (!next.hidden.length && !next.order.length) resetViewConfig(ANOMALY_TABLE_SCOPE);
          else setViewConfig(ANOMALY_TABLE_SCOPE, next);
          setAnomalyCfgOpen(false);
        }}
      />
      <CustomChartsSection sectionNo="2" chartScope="5-2:anomaly-charts" metricScope="5-2:viz-kpi" title={tr("커스텀 차트", "Custom Charts")} locale={locale} />
    </div>
  );
}
