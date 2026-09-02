"use client";

import { useEffect, useMemo, useRef } from "react";
import Chart from "@/utils/chartGlobals";
import DataTable from "@/components/ds/DataTable";
import { canRenderModelDiagnostics } from "@/lib/analystCapabilities";
import { chartCommonOpts, CHART_THEME } from "@/utils/chartUtils";
import { fmtNum } from "@/utils/format";
import { computeOlsDiagnostics, computeVif, DIAG_THRESHOLDS } from "@/utils/modelDiagnostics";

function tx(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function DiagnosticChart({ type = "scatter", data, options }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = new Chart(ref.current, { type, data, options });
    const frame = requestAnimationFrame(() => chart.resize());
    return () => {
      cancelAnimationFrame(frame);
      chart.destroy();
    };
  }, [type, data, options]);
  return <div className="chart-container" style={{ height: "190px" }}><canvas ref={ref} /></div>;
}

function verdictText(value, locale) {
  const labels = {
    ok: tx(locale, "양호", "OK"),
    warn: tx(locale, "주의", "Check"),
    severe: tx(locale, "심각", "Severe"),
    positive: tx(locale, "양의 자기상관 신호", "Positive autocorrelation signal"),
    negative: tx(locale, "음의 자기상관 신호", "Negative autocorrelation signal"),
    not_applicable: tx(locale, "해당 없음", "Not applicable"),
    unknown: tx(locale, "추정 불가", "Not estimable"),
  };
  return labels[value] || labels.unknown;
}

export default function ModelDiagnosticsPanel({ scope, fit, X, labels = [], locale = "ko" }) {
  const available = canRenderModelDiagnostics(scope, fit, X);
  const diagnostics = useMemo(() => (available ? computeOlsDiagnostics(fit, X) : null), [available, fit, X]);
  const vif = useMemo(() => (available ? computeVif(X) : null), [available, X]);
  const summary = useMemo(() => {
    if (!diagnostics || !vif) return null;
    if (diagnostics.bg?.verdict === "warn") return tx(locale, "잔차에 시간 순서 패턴이 남아 있을 수 있습니다. 계수의 불확실성을 보수적으로 읽으세요.", "Residuals may retain time-order patterns. Read coefficient uncertainty conservatively.");
    if (vif.verdict === "severe") return tx(locale, "설명변수가 함께 움직여 각 변수의 몫을 분리하기 어렵습니다.", "Predictors move together, so their individual shares are difficult to separate.");
    if (diagnostics.influential.length) return tx(locale, `결과를 크게 움직이는 관측치 ${diagnostics.influential.length}개가 있습니다. 원자료를 확인하세요.`, `${diagnostics.influential.length} observation(s) move the result strongly. Check the source rows.`);
    if (diagnostics.hc3.changedInference.length) return tx(locale, "일반 표준오차와 HC3 강건 표준오차의 결론이 일부 다릅니다.", "Classical and HC3-robust standard errors change some inference.");
    return tx(locale, "현재 진단에서 뚜렷한 경고 신호는 없습니다. 그래도 관측 연관을 인과로 읽지는 마세요.", "No strong warning signal appears in these diagnostics. Do not read observational association as causation.");
  }, [diagnostics, locale, vif]);
  const chartConfigs = useMemo(() => {
    if (!diagnostics) return null;
    const baseOpts = chartCommonOpts();
    const noLegend = { ...baseOpts.plugins, legend: { ...baseOpts.plugins.legend, display: false } };
    const scatterOpts = {
      ...baseOpts,
      plugins: noLegend,
      scales: {
        x: { ...baseOpts.scales.x, title: { display: true, text: tx(locale, "적합값", "Fitted value"), color: CHART_THEME.muted } },
        y: { ...baseOpts.scales.y, title: { display: true, text: tx(locale, "잔차", "Residual"), color: CHART_THEME.muted }, beginAtZero: false },
      },
    };
    const qqOpts = {
      ...baseOpts,
      plugins: noLegend,
      scales: {
        x: { ...baseOpts.scales.x, title: { display: true, text: tx(locale, "정규분포 분위수", "Normal quantile"), color: CHART_THEME.muted } },
        y: { ...baseOpts.scales.y, title: { display: true, text: tx(locale, "외부 studentized 잔차", "Externally studentized residual"), color: CHART_THEME.muted }, beginAtZero: false },
      },
    };
    const scaleLocationOpts = {
      ...scatterOpts,
      scales: { ...scatterOpts.scales, y: { ...scatterOpts.scales.y, title: { display: true, text: "√|studentized residual|", color: CHART_THEME.muted }, beginAtZero: true } },
    };
    const cookOpts = {
      ...baseOpts,
      plugins: noLegend,
      scales: {
        x: { ...baseOpts.scales.x, title: { display: true, text: tx(locale, "관측치", "Observation"), color: CHART_THEME.muted } },
        y: { ...baseOpts.scales.y, title: { display: true, text: "Cook's D", color: CHART_THEME.muted }, beginAtZero: true },
      },
    };
    return {
      residual: { data: { datasets: [{ data: diagnostics.residVsFitted.x.map((x, index) => ({ x, y: diagnostics.residVsFitted.y[index] })), pointRadius: 3, backgroundColor: CHART_THEME.primary }] }, options: scatterOpts },
      qq: { data: { datasets: [{ data: diagnostics.qq.theoretical.map((x, index) => ({ x, y: diagnostics.qq.sample[index] })), pointRadius: 3, backgroundColor: CHART_THEME.secondary }] }, options: qqOpts },
      scaleLocation: { data: { datasets: [{ data: diagnostics.scaleLocation.x.map((x, index) => ({ x, y: diagnostics.scaleLocation.y[index] })), pointRadius: 3, backgroundColor: CHART_THEME.tertiary }] }, options: scaleLocationOpts },
      cooks: { data: { labels: diagnostics.cooksD.map((_, index) => String(index + 1)), datasets: [{ data: diagnostics.cooksD, backgroundColor: diagnostics.cooksD.map((value) => Number.isFinite(value) && value > DIAG_THRESHOLDS.cooksDMultiplier / X.length ? CHART_THEME.accent : CHART_THEME.primary) }] }, options: cookOpts },
    };
  }, [diagnostics, locale, X.length]);
  if (!available || !diagnostics || !vif || !chartConfigs) return null;
  const metricRows = [
    {
      metric: "Breusch–Godfrey",
      value: diagnostics.bg ? `p=${fmtNum(diagnostics.bg.pValue, 3)}` : tx(locale, "추정 불가", "Not estimable"),
      verdict: diagnostics.bg?.verdict || "unknown",
      note: tx(locale, "잔차의 1차 자기상관 검정", "Lag-1 residual autocorrelation test"),
    },
    {
      metric: "Durbin–Watson",
      value: diagnostics.dw == null ? "—" : fmtNum(diagnostics.dw, 2),
      verdict: diagnostics.dwVerdict,
      note: tx(locale, "검정이 아닌 보조 신호", "Supporting signal, not a significance test"),
    },
    {
      metric: "VIF",
      value: vif.maxVif == null ? verdictText(vif.verdict, locale) : fmtNum(vif.maxVif, 2),
      verdict: vif.verdict,
      note: tx(locale, "설명변수 간 겹침", "Predictor overlap"),
    },
    {
      metric: "Cook's D",
      value: diagnostics.cooksD.some(Number.isFinite) ? fmtNum(Math.max(...diagnostics.cooksD.filter(Number.isFinite)), 3) : "—",
      verdict: diagnostics.influential.length ? "warn" : "ok",
      note: tx(locale, `기준: ${fmtNum(DIAG_THRESHOLDS.cooksDMultiplier / X.length, 3)} 초과`, `Threshold: above ${fmtNum(DIAG_THRESHOLDS.cooksDMultiplier / X.length, 3)}`),
    },
    {
      metric: "HC3",
      value: diagnostics.hc3.valid ? tx(locale, "적용", "Applied") : tx(locale, "계산 불가", "Unavailable"),
      verdict: diagnostics.hc3.valid ? (diagnostics.hc3.changedInference.length ? "warn" : "ok") : "unknown",
      note: diagnostics.hc3.valid
        ? tx(locale, `일반 SE와 판정 차이 ${diagnostics.hc3.changedInference.length}개 계수`, `${diagnostics.hc3.changedInference.length} coefficient(s) change versus classical SE`)
        : tx(locale, "고레버리지로 강건 SE를 계산하지 못함", "Robust SE unavailable because of leverage"),
    },
  ];
  const vifRows = vif.variableIndices.map((columnIndex, index) => ({
    variable: labels[columnIndex] || `${tx(locale, "변수", "Variable")} ${columnIndex}`,
    value: vif.vif[index] == null ? tx(locale, "추정 불가", "Not estimable") : fmtNum(vif.vif[index], 2),
  }));

  return (
    <section className="block analyst-model-diagnostics" aria-label={tx(locale, "모델 신뢰도 점검", "Model reliability checks")}>
      <div className="section-head" style={{ justifyContent: "flex-start", alignItems: "baseline", gap: "8px" }}>
        <h2 className="section-title">{tx(locale, "모델 신뢰도 점검", "Model reliability checks")}</h2>
        <span className="ab-pill">{tx(locale, "분석가 모드", "Analyst mode")}</span>
      </div>
      <p style={{ margin: "7px 0 14px", fontSize: "13px", lineHeight: 1.55 }}>{summary}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
        <div><strong style={{ fontSize: "12px" }}>{tx(locale, "잔차 vs 적합값", "Residuals vs fitted")}</strong><DiagnosticChart {...chartConfigs.residual} /></div>
        <div><strong style={{ fontSize: "12px" }}>{tx(locale, "Q-Q 플롯 (시각 점검)", "Q-Q plot (visual check)")}</strong><DiagnosticChart {...chartConfigs.qq} /></div>
        <div><strong style={{ fontSize: "12px" }}>{tx(locale, "Scale–Location", "Scale–Location")}</strong><DiagnosticChart {...chartConfigs.scaleLocation} /></div>
        <div><strong style={{ fontSize: "12px" }}>{tx(locale, "영향점 (Cook's D)", "Influence (Cook's D)")}</strong><DiagnosticChart type="bar" {...chartConfigs.cooks} /></div>
      </div>
      <div style={{ marginTop: "14px" }}>
        <DataTable
          ariaLabel={tx(locale, "모델 진단 지표", "Model diagnostic metrics")}
          columns={[
            { key: "metric", label: tx(locale, "지표", "Metric") },
            { key: "value", label: tx(locale, "값", "Value"), align: "right" },
            { key: "verdict", label: tx(locale, "판정", "Reading"), fmt: (value) => verdictText(value, locale) },
            { key: "note", label: tx(locale, "해석", "Interpretation") },
          ]}
          rows={metricRows}
          rowKey={(row) => row.metric}
        />
      </div>
      {vifRows.length > 0 && <div style={{ marginTop: "12px" }}>
        <p className="muted" style={{ margin: "0 0 6px", fontSize: "11px" }}>{tx(locale, `VIF 5 이상은 주의, 10 이상은 심각으로 읽습니다.`, `Read VIF ≥5 as a warning and ≥10 as severe.`)}</p>
        <DataTable ariaLabel={tx(locale, "변수별 VIF", "VIF by variable")} columns={[{ key: "variable", label: tx(locale, "변수", "Variable") }, { key: "value", label: "VIF", align: "right" }]} rows={vifRows} rowKey={(row) => row.variable} />
      </div>}
      <p className="muted" style={{ margin: "12px 0 0", fontSize: "11px", lineHeight: 1.5 }}>{tx(locale, "Q-Q 플롯은 소표본 t-검정·신뢰구간 해석의 참고용입니다. 잔차 정규성은 OLS 계수 추정의 필수 조건이 아닙니다.", "The Q-Q plot informs small-sample t-test and interval interpretation. Normal residuals are not required to estimate OLS coefficients.")}</p>
    </section>
  );
}
