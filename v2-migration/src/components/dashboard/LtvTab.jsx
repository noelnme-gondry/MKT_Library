"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import CustomChartsSection from "./CustomChartsSection";
import { getMonFilteredRows, effectiveDenomBasis, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { buildLtvData, LTV_DNS, LTVCAC_MATH } from "@/utils/ltvMath";
import { buildMaturationRows, MATURATION_MATH } from "@/utils/cohortMath";
import { applyMetricView } from "@/utils/metrics/metricView";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";

// 지표 뷰 설정 scope — LTV:CAC 표(§2)의 지표 컬럼 표시/순서.
const LTV_TABLE_SCOPE = "5-2:ltv-table";

// locale 카피(§ domain 리라벨과 별도 축 — VizTab VIZ_COPY와 동일 패턴).
const LTV_COPY = {
  ko: {
    fChannel: "채널", fCampaign: "캠페인", fCountry: "국가", fPlatform: "OS",
    noData: "데이터 없음",
    s1Title: "분석 단위 · LTV Horizon",
    unitLabel: "단위",
    ltvHorizonLabel: "LTV Horizon",
    denomLabel: "유저수 기준",
    denomTitle: "CAC와 ARPU의 분모(유저수) 기준. 액션이 '가입'이면 가입자수 기준으로 보고 싶을 수 있습니다.",
    installsOpt: "설치수 (installs)",
    actionsOpt: "액션수 (actions)",
    s2Title: (h) => `LTV:CAC · 회수기간 (LTV horizon = D${h})`,
    editCols: "⚙ 컬럼 편집",
    editColsTitle: "표시할 지표 컬럼과 순서 편집",
    s2Desc: (healthy, warn) => `초록 = LTV:CAC ≥ ${healthy}× (건강) · 빨강 = < ${warn}× (적자). payback = 누적 ARPU가 CAC에 도달하는 day (power 외삽). ⓘ = 미마감 구간 예측값.`,
    unitTh: "단위",
    noVisibleCols: "표시할 지표 컬럼이 없습니다. ⚙ 컬럼 편집에서 다시 켜세요.",
    s2CalloutPrefix: "LTV:CAC는 ",
    s2CalloutStrong: "유닛 이코노믹스 건강도",
    s2CalloutSuffix: "의 핵심 지표입니다. 3× 이상이면 공격적 확장 여지, 1× 미만이면 해당 단위는 적자이므로 입찰/예산 축소 또는 LTV 개선이 필요합니다. 회수기간이 목표(180일)보다 길면 현금흐름 부담을 검토하세요.",
    s3Title: "LTV D0~D360 곡선",
    s3Desc: "실선 = 실측 ARPU · 점선 = 예측(ⓘ 미마감). 단위 필터 및 Horizon 토글과 연동됩니다.",
    s4Title: "ROAS 성숙 예측",
    unitFilterAll: "전체",
    anchorLabel: "Anchor Dn",
    anchorSub: "(곡선 fit 포함)",
    methodLabel: "방법 표시",
    curveFit: "커브 fit",
    empirical: "경험적 비율",
    matUnitTh: "단위",
    matCostTh: "비용",
    matMaturityTh: "성숙배수",
    matExtrapTh: "외삽",
    matEmptyRow: "revenue_dN 컬럼을 매핑하면 ROAS 성숙 예측이 표시됩니다.",
    empiricalCalloutStrong: "경험적 비율",
    empiricalCalloutBody: (base) => `D${base} 실측 기반 완성비. D${base}와 목표 Dn을 모두 보유한 단위들의 비율(비용 가중 평균)을 미완성 단위에 적용합니다. 커브 fit과 일치할수록 예측 신뢰도 ↑.`,
    suffTitle: "🎯 Anchor 충분성 진단",
    suffSub: (h) => `— D${h} 예측이 안정화되는 최소 anchor 집합 자동 탐지`,
    suffSetTh: "Anchor 집합",
    suffPredTh: (h) => `D${h} 커브 예측`,
    suffChgTh: "이전 대비 변화율",
    suffStatusTh: "상태",
    converged: "✓ 안정화 (<2%)",
    needMoreData: "추가 데이터 필요",
    suffEmptyRow: "Anchor Dn을 2개 이상 관측하면 충분성 진단이 표시됩니다.",
    convergedStrong: (dns, h) => `[${dns}] anchor 집합부터 D${h} 예측 안정화`,
    convergedRest: " (변화율 <2%). 이 Dn 이상의 데이터가 있으면 예측이 충분히 수렴합니다.",
    notConvergedCallout: (h) => `사용 가능한 anchor 조합으로 D${h} 예측이 아직 안정화되지 않았습니다. 더 장기 Dn 데이터(예: D30, D90)를 추가하면 신뢰도가 높아집니다.`,
    s4CalloutPrefix: "조기 ROAS가 낮아 보여도 ",
    s4CalloutStrong: "성숙배수",
    s4CalloutSuffix: "가 크면(예: 2×+) D90엔 손익분기를 넘길 수 있습니다. 조기 D7만 보고 끄지 말고 성숙 예측을 함께 보세요. ⚠ 관측 이후 Dn은 외삽이므로 실측 누적되면 재확인.",
    modalTitle: "LTV:CAC 표 — 컬럼 편집",
    // 표 컬럼 라벨
    colCost: "비용", colUsers: (d) => `유저(${d})`, colUsersTitle: (d, basis) => `${d}수(${basis}) 기준`,
    colCac: "CAC", colRoas7: "ROAS D7", colRoas14: "ROAS D14",
    colLtv: (h) => `LTV(D${h})/user`,
    colLtvTooltip: (obs, h) => `이 단위는 D${obs}까지만 실측. D${h}는 미마감 구간으로 이전 Dn 추이를 기반으로 예측한 값입니다. 실측이 누적되면 재확인하세요.`,
    colRatio: "LTV:CAC", colPayback: "Payback", colFit: "외삽",
    paybackUnrecovered: "미회수",
    paybackDays: (n) => `${n}일`,
    customChartsTitle: "커스텀 차트",
    actionWord: "액션", installWord: "설치",
  },
  en: {
    fChannel: "Channel", fCampaign: "Campaign", fCountry: "Country", fPlatform: "OS",
    noData: "No data",
    s1Title: "Analysis unit · LTV Horizon",
    unitLabel: "Unit",
    ltvHorizonLabel: "LTV Horizon",
    denomLabel: "User count basis",
    denomTitle: "The denominator (user count) basis for CAC and ARPU. If your action is 'signup', you may want signup count as basis.",
    installsOpt: "Installs (installs)",
    actionsOpt: "Actions (actions)",
    s2Title: (h) => `LTV:CAC · Payback period (LTV horizon = D${h})`,
    editCols: "⚙ Edit columns",
    editColsTitle: "Edit which metric columns are shown and their order",
    s2Desc: (healthy, warn) => `Green = LTV:CAC ≥ ${healthy}× (healthy) · Red = < ${warn}× (unprofitable). Payback = day cumulative ARPU reaches CAC (power extrapolation). ⓘ = predicted value for an incomplete window.`,
    unitTh: "Unit",
    noVisibleCols: "No metric columns to display. Re-enable them in ⚙ Edit columns.",
    s2CalloutPrefix: "LTV:CAC is a core indicator of ",
    s2CalloutStrong: "unit economics health",
    s2CalloutSuffix: ". 3× or higher means room for aggressive scaling; below 1× means the unit is unprofitable and needs bid/budget reduction or LTV improvement. If payback period exceeds your target (180 days), review cash flow impact.",
    s3Title: "LTV D0~D360 Curve",
    s3Desc: "Solid line = observed ARPU · Dashed line = predicted (ⓘ incomplete). Linked to the unit filter and Horizon toggle.",
    s4Title: "ROAS Maturity Prediction",
    unitFilterAll: "All",
    anchorLabel: "Anchor Dn",
    anchorSub: "(included in curve fit)",
    methodLabel: "Show methods",
    curveFit: "Curve fit",
    empirical: "Empirical ratio",
    matUnitTh: "Unit",
    matCostTh: "Cost",
    matMaturityTh: "Maturity multiple",
    matExtrapTh: "Extrapolation",
    matEmptyRow: "Map revenue_dN columns to display ROAS maturity prediction.",
    empiricalCalloutStrong: "Empirical ratio",
    empiricalCalloutBody: (base) => `Completion ratio based on observed D${base}. Applies the ratio (cost-weighted average) of units holding both D${base} and the target Dn to units that haven't completed yet. Higher agreement with the curve fit means higher prediction confidence.`,
    suffTitle: "🎯 Anchor Sufficiency Diagnosis",
    suffSub: (h) => `— Auto-detects the minimum anchor set where D${h} prediction stabilizes`,
    suffSetTh: "Anchor set",
    suffPredTh: (h) => `D${h} curve prediction`,
    suffChgTh: "Change vs previous",
    suffStatusTh: "Status",
    converged: "✓ Stabilized (<2%)",
    needMoreData: "Needs more data",
    suffEmptyRow: "Observe 2 or more anchor Dn to display the sufficiency diagnosis.",
    convergedStrong: (dns, h) => `D${h} prediction stabilizes from the anchor set [${dns}]`,
    convergedRest: " (change <2%). Data at or beyond this Dn is sufficiently converged.",
    notConvergedCallout: (h) => `D${h} prediction hasn't stabilized yet with the available anchor combinations. Adding longer-term Dn data (e.g., D30, D90) will improve confidence.`,
    s4CalloutPrefix: "Even if early ROAS looks low, a large ",
    s4CalloutStrong: "maturity multiple",
    s4CalloutSuffix: " (e.g., 2×+) can mean breakeven by D90. Don't judge by D7 alone — check the maturity prediction too. ⚠ Dn beyond the observed window is extrapolated, so re-check as more data accumulates.",
    modalTitle: "LTV:CAC Table — Edit columns",
    colCost: "Cost", colUsers: (d) => `Users(${d})`, colUsersTitle: (d, basis) => `Based on ${d} count (${basis})`,
    colCac: "CAC", colRoas7: "ROAS D7", colRoas14: "ROAS D14",
    colLtv: (h) => `LTV(D${h})/user`,
    colLtvTooltip: (obs, h) => `This unit is only observed through D${obs}. D${h} is an incomplete window predicted from prior Dn trend. Re-check as more data accumulates.`,
    colRatio: "LTV:CAC", colPayback: "Payback", colFit: "Extrap.",
    paybackUnrecovered: "Unrecovered",
    paybackDays: (n) => `${n}d`,
    customChartsTitle: "Custom charts",
    actionWord: "action", installWord: "install",
  },
};

export default function LtvTab({ locale = "ko" } = {}) {
  const T = LTV_COPY[locale] || LTV_COPY.ko;
  // 엔진(ltvMath·cohortMath)이 붙이는 "전체"·"(미지정)" 그룹 라벨 렌더층 로컬라이즈.
  const luLabel = useCallback((k) => (k === "(미지정)" ? (locale === "en" ? "(unspecified)" : "(미지정)") : k === "전체" ? (locale === "en" ? "All" : "전체") : k), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const ltvTableCfg = useAppStore((state) => state.viewConfig[LTV_TABLE_SCOPE]);
  const setViewConfig = useAppStore((state) => state.setViewConfig);
  const resetViewConfig = useAppStore((state) => state.resetViewConfig);
  const [ltvCfgOpen, setLtvCfgOpen] = useState(false);
  const [unitField, setUnitField] = useState("channel");
  const [ltvHorizon, setLtvHorizon] = useState(30);
  // ROAS 성숙 예측 상태(§4)
  const [matUnit, setMatUnit] = useState("_all");
  const [matAnchors, setMatAnchors] = useState(null); // null = 전체 사용 가능 Dn
  const [matShowCurve, setMatShowCurve] = useState(true);
  const [matShowEmpirical, setMatShowEmpirical] = useState(true);
  const [matHorizon, setMatHorizon] = useState(360);

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const effBasis = effectiveDenomBasis(csvData, denomBasis);

  useEffect(() => {
    if (csvData && csvData.mapping) {
      const mapped = new Set(Object.values(csvData.mapping));
      const avail = [
        { k: "channel", l: T.fChannel },
        { k: "campaign_name", l: T.fCampaign },
        { k: "country", l: T.fCountry },
        { k: "platform", l: T.fPlatform }
      ];
      if (!mapped.has(unitField) && Array.from(mapped).length > 0) {
        const fallback = avail.find(a => mapped.has(a.k));
        // 무효 unitField를 유효 기본값으로 1회 보정 — 조건부라 무한루프 없음(의도된 패턴)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (fallback) setUnitField(fallback.k);
      }
    }
  }, [csvData, unitField, T]);

  const { rows, hasData, availFields, mappedFields, hasInstalls, hasActions } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) return { hasData: false, availFields: [], mappedFields: new Set() };
    const filtered = getMonFilteredRows(csvData, dashboardFilter);
    const mapping = csvData.mapping || {};

    const mapped = new Set(Object.values(mapping));
    const avail = [
      { k: "channel", l: T.fChannel },
      { k: "campaign_name", l: T.fCampaign },
      { k: "country", l: T.fCountry },
      { k: "platform", l: T.fPlatform }
    ];

    const _rows = buildLtvData(filtered, mapping, unitField, ltvHorizon, effBasis);
    return {
      hasData: true,
      rows: _rows,
      availFields: avail,
      mappedFields: mapped,
      hasInstalls: mapped.has("installs"),
      hasActions: mapped.has("actions"),
    };
  }, [csvData, dashboardFilter, unitField, ltvHorizon, effBasis, T]);

  // ── ROAS 성숙 예측(§4) — buildMaturationRows 엔진 배선 ─────────────────────
  // getMonFilteredRows는 이미 표준키로 매핑된 행을 반환하므로, 성숙 엔진(mapRows로
  // 재매핑)에는 identity 매핑을 넘겨 필터+매핑을 그대로 존중.
  const maturation = useMemo(() => {
    if (!hasData) return null;
    const mapping = csvData.mapping || {};
    const filtered = getMonFilteredRows(csvData, dashboardFilter);
    const mappedKeys = new Set(Object.values(mapping));
    const identity = {};
    for (const k of mappedKeys) identity[k] = k;
    const state = {
      unitField: matUnit,
      anchorDns: matAnchors,
      showCurve: matShowCurve,
      showEmpirical: matShowEmpirical,
      targetHorizon: matHorizon,
    };
    const res = buildMaturationRows(filtered, identity, state);
    const suffData =
      res.units.length > 0 && res.availDns.length >= 2
        ? MATURATION_MATH.sufficiency(res.units, res.availDns, matHorizon)
        : null;
    return { ...res, suffData, mappedKeys };
  }, [hasData, csvData, dashboardFilter, matUnit, matAnchors, matShowCurve, matShowEmpirical, matHorizon]);

  useEffect(() => {
    if (!hasData || !rows.length || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const topRows = rows.slice(0, 8);
    const PALETTE = ["#7aa2f7", "#9ece6a", "#e0af68", "#f7768e", "#bb9af7", "#2ac3de", "#ff9e64", "#73daca"];

    const labels = LTV_DNS.map(d => `D${d}`);
    const datasets = topRows.map((r, ri) => {
      const color = PALETTE[ri % PALETTE.length];
      const pts = LTV_DNS.map(d => {
        const { value, predicted } = LTVCAC_MATH.ltvPredict(r.unitRef, d);
        // §7: Math.round 금지 — 저객단가(USD·<1) 0-뭉개짐 방지. 소수 보존.
        return { y: value != null && isFinite(value) ? value : null, predicted };
      });

      return {
        label: luLabel(r.unit).slice(0, 20),
        data: pts.map(p => p.y),
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: pts.map(p => p.predicted ? 0 : 3),
        pointBackgroundColor: color,
        segment: {
          borderDash: ctx => {
            const p0 = pts[ctx.p0DataIndex];
            const p1 = pts[ctx.p1DataIndex];
            return (p0?.predicted || p1?.predicted) ? [4, 4] : undefined;
          }
        }
      };
    });

    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartCommonOpts().plugins,
          legend: { labels: { color: getCssVar("--text-muted"), font: { size: 11 } } },
          tooltip: {
            ...chartCommonOpts().plugins.tooltip,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmtCurrencyPrecise(ctx.parsed.y, displayCurrency)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: getCssVar("--text-muted"), maxTicksLimit: 14 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: getCssVar("--text-muted"), callback: (v) => fmtCurrencyPrecise(v, displayCurrency) }, grid: { color: getCssVar("--border") } }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, rows, displayCurrency, isDarkMode, luLabel]);

  if (!hasData) {
    return <div className="tab-pane active" id="tab-ltv"><p className="muted">{T.noData}</p></div>;
  }

  const fmtPct = (v) => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(0) + "%";
  const fmtX = (v) => v == null || !isFinite(v) ? "—" : v.toFixed(2) + "×";
  const fmtCur = (v) => fmtCurrencyPrecise(v, displayCurrency);
  const fmtPb = (v) => v == null ? <span style={{ color: "#f87171" }}>{T.paybackUnrecovered}</span> : T.paybackDays(v);

  const HEALTHY_RATIO = 3;
  const WARN_RATIO = 1;
  const ratioCls = (r) => r == null ? "" : (r >= HEALTHY_RATIO ? "pos" : (r < WARN_RATIO ? "neg" : ""));
  const denomLabel = effBasis === "actions" ? T.actionWord : T.installWord;

  // ROAS 성숙 표 컬럼 = 관측 Dn ∪ 표준 예측 horizon(90/180/360)
  const matPctFmt = (v) => (v == null || !isFinite(v) ? null : (v * 100).toFixed(0) + "%");
  const showCols = maturation
    ? [...new Set([...maturation.availDns, ...[90, 180, 360].filter((d) => !maturation.availDns.includes(d))])].sort((a, b) => a - b)
    : [];
  const isDnMapped = (d) => maturation && maturation.mappedKeys.has(`revenue_d${d}`);

  const toggleAnchor = (d) => {
    if (!maturation) return;
    const base = matAnchors == null ? [...maturation.availDns] : [...matAnchors];
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort((a, b) => a - b);
    setMatAnchors(next);
  };
  const anchorSelected = (d) => matAnchors == null || matAnchors.includes(d);

  // LTV:CAC 표(§2) 지표 컬럼(데이터 주도) — 첫 컬럼 '단위'는 행 헤더라 고정, 나머지
  // 지표 컬럼만 표시/순서 토글. render/값·계산은 기존과 동일(byte-동일).
  const ltvCols = [
    { k: "cost", label: T.colCost, render: (r) => fmtCur(r.cost) },
    { k: "users", label: T.colUsers(denomLabel), headTitle: T.colUsersTitle(denomLabel, effBasis), render: (r) => (r.users || 0).toLocaleString() },
    { k: "cac", label: T.colCac, render: (r) => (r.cac != null ? fmtCur(r.cac) : "—") },
    { k: "roas7", label: T.colRoas7, render: (r) => fmtPct(r.roas7) },
    { k: "roas14", label: T.colRoas14, render: (r) => fmtPct(r.roas14) },
    { k: "ltv", label: T.colLtv(ltvHorizon), render: (r) => (r.ltvAtHorizon != null ? (
      <>
        {fmtCur(r.ltvAtHorizon)}
        {r.ltvPredicted && <span style={{ fontSize: "9px", color: "#adc6ff", cursor: "help", marginLeft: "4px" }} title={T.colLtvTooltip(r.maxObsDn, ltvHorizon)}>ⓘ</span>}
      </>
    ) : "—") },
    { k: "ratio", label: T.colRatio, cellClass: (r) => ratioCls(r.ratio), render: (r) => <strong>{fmtX(r.ratio)}</strong> },
    { k: "payback", label: T.colPayback, render: (r) => fmtPb(r.payback) },
    { k: "fitKind", label: T.colFit, cellStyle: { color: "var(--text-muted)", fontSize: "10px" }, render: (r) => r.fitKind },
  ];
  const orderedLtvCols = applyMetricView(ltvCols, ltvTableCfg, (c) => c.k);

  return (
    <div className="tab-pane active" id="tab-ltv">
      <section className="block" id="s-ctl">
        <h2 className="section-title"><span className="ix">§1</span>{T.s1Title}</h2>
        <div className="ab-pillgroup">
          <span className="ab-pillgroup-label">{T.unitLabel}</span>
          {availFields.map(f => {
            const avail = mappedFields.has(f.k);
            return (
              <button
                key={f.k}
                className={`ab-pill ${unitField === f.k ? "active" : ""} ${!avail ? "disabled" : ""}`}
                onClick={() => avail && setUnitField(f.k)}
                disabled={!avail}
              >
                {f.l}{!avail && " 🔒"}
              </button>
            );
          })}
        </div>
        <div className="ab-pillgroup">
          <span className="ab-pillgroup-label">{T.ltvHorizonLabel}</span>
          {[7, 14, 30, 90, 180, 360].map(d => (
            <button key={d} className={`ab-pill ${ltvHorizon === d ? "active" : ""}`} onClick={() => setLtvHorizon(d)}>
              D{d}
            </button>
          ))}
        </div>
        <div className="ab-pillgroup">
          <span className="ab-pillgroup-label" title={T.denomTitle}>{T.denomLabel}</span>
          {[["installs", T.installsOpt], ["actions", T.actionsOpt]].map(([k, l]) => {
            const avail = k === "installs" ? hasInstalls : hasActions;
            return (
              <button
                key={k}
                className={`ab-pill ${effBasis === k ? "active" : ""} ${!avail ? "disabled" : ""}`}
                onClick={() => avail && setDenomBasis(k)}
                disabled={!avail}
              >
                {l}{!avail && " 🔒"}
              </button>
            );
          })}
        </div>
      </section>

      <section className="block" id="s-table">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="section-title"><span className="ix">§2</span>{T.s2Title(ltvHorizon)}</h2>
          <button className="ab-pill" onClick={() => setLtvCfgOpen(true)} title={T.editColsTitle}>{T.editCols}</button>
        </div>
        <p className="muted">
          {T.s2Desc(HEALTHY_RATIO, WARN_RATIO)}
        </p>
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>{T.unitTh}</th>
                {orderedLtvCols.map((c) => (
                  <th key={c.k} title={c.headTitle || undefined} style={{ textAlign: "right" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((r, i) => (
                <tr key={i}>
                  <td><strong>{luLabel(String(r.unit)).slice(0, 28)}</strong></td>
                  {orderedLtvCols.map((c) => (
                    <td
                      key={c.k}
                      className={`tnum ${c.cellClass ? c.cellClass(r) : ""}`.trim()}
                      style={c.cellStyle || undefined}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orderedLtvCols.length === 0 && (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noVisibleCols}</p>
        )}
        <div className="callout" style={{ marginTop: "10px" }}>
          <div className="ico">i</div>
          <div className="body">
            <p style={{ margin: 0, fontSize: "12px" }}>
              {T.s2CalloutPrefix}<strong>{T.s2CalloutStrong}</strong>{T.s2CalloutSuffix}
            </p>
          </div>
        </div>
      </section>

      <section className="block" id="s-ltv-curve">
        <h2 className="section-title"><span className="ix">§3</span>{T.s3Title}</h2>
        <p className="muted">{T.s3Desc}</p>
        <div className="chart-container" style={{ height: "260px" }}>
          <canvas id="ltvcac-curve" ref={chartRef}></canvas>
        </div>
      </section>

      <section className="block" id="s-mat">
        <h2 className="section-title"><span className="ix">§4</span>{T.s4Title}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start", marginBottom: "14px" }}>
          <div className="ab-pillgroup">
            <span className="ab-pillgroup-label">{T.unitLabel}</span>
            {[["_all", T.unitFilterAll], ["channel", T.fChannel], ["campaign_name", T.fCampaign]].map(([k, l]) => {
              const av = k === "_all" || (maturation && maturation.mappedKeys.has(k));
              return (
                <button
                  key={k}
                  className={`ab-pill ${matUnit === k ? "active" : ""} ${!av ? "disabled" : ""}`}
                  onClick={() => av && setMatUnit(k)}
                  disabled={!av}
                >
                  {l}{!av && " 🔒"}
                </button>
              );
            })}
          </div>
          <div className="ab-pillgroup">
            <span className="ab-pillgroup-label">{T.anchorLabel} <small style={{ opacity: 0.6, fontWeight: 400 }}>{T.anchorSub}</small></span>
            {MATURATION_MATH.ALL_DNS.filter((d) => isDnMapped(d)).map((d) => {
              const avail = maturation && maturation.availDns.includes(d);
              return (
                <button
                  key={d}
                  className={`ab-pill ${anchorSelected(d) && avail ? "active" : ""} ${!avail ? "disabled" : ""}`}
                  onClick={() => avail && toggleAnchor(d)}
                  disabled={!avail}
                >
                  D{d}
                </button>
              );
            })}
          </div>
          <div className="ab-pillgroup">
            <span className="ab-pillgroup-label">{T.methodLabel}</span>
            <button className={`ab-pill ${matShowCurve ? "active" : ""}`} style={{ color: "var(--accent)" }} onClick={() => setMatShowCurve((v) => !v)}>{T.curveFit}</button>
            <button className={`ab-pill ${matShowEmpirical ? "active" : ""}`} style={{ color: "#9ece6a" }} onClick={() => setMatShowEmpirical((v) => !v)}>{T.empirical}</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11px" }}>
            <thead>
              <tr>
                <th>{T.matUnitTh}</th>
                <th>{T.matCostTh}</th>
                {showCols.map((d) => <th key={d}>D{d}</th>)}
                <th>{T.matMaturityTh}</th>
                <th>{T.matExtrapTh}</th>
              </tr>
            </thead>
            <tbody>
              {maturation && maturation.units.length > 0 ? (
                maturation.units.slice(0, 60).map((u, ui) => {
                  const curvePred = (d) => (u.fit ? u.fit.predict(d) : null);
                  const empPred = (d) => {
                    if (
                      maturation.empiricalBase == null ||
                      maturation.empRatios[d] == null ||
                      u.roas[d] != null ||
                      u.roas[maturation.empiricalBase] == null
                    ) return null;
                    return u.roas[maturation.empiricalBase] * maturation.empRatios[d].avg;
                  };
                  const base = maturation.selAnchors.length
                    ? (u.roas[maturation.selAnchors[maturation.selAnchors.length - 1]] ?? u.roas[7] ?? u.roas[14])
                    : null;
                  const pred90 = u.roas[90] ?? curvePred(90);
                  const mat = base != null && pred90 != null && base > 0 ? pred90 / base : null;
                  const fmtCell = (d) => {
                    const actual = u.roas[d];
                    if (actual != null) return <strong>{matPctFmt(actual)}</strong>;
                    const parts = [];
                    const curve = matShowCurve ? curvePred(d) : null;
                    const emp = matShowEmpirical ? empPred(d) : null;
                    if (curve != null) parts.push(<span key="c" style={{ color: "var(--accent)" }}>{matPctFmt(curve)}</span>);
                    if (emp != null) parts.push(<em key="e" style={{ color: "#9ece6a" }}>{matPctFmt(emp)}</em>);
                    if (!parts.length) return <span style={{ color: "var(--text-muted)" }}>—</span>;
                    return parts.reduce((acc, el, i) => (i === 0 ? [el] : [...acc, <br key={"br" + i} />, el]), []);
                  };
                  return (
                    <tr key={ui}>
                      <td><strong>{luLabel(String(u.unit)).slice(0, 24)}</strong></td>
                      <td className="tnum">{fmtCur(u.cost)}</td>
                      {showCols.map((d) => <td key={d} className="tnum">{fmtCell(d)}</td>)}
                      <td className="tnum">{mat != null ? mat.toFixed(2) + "×" : "—"}</td>
                      <td className="tnum" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{u.fit?.kind || "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={showCols.length + 4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                    {T.matEmptyRow}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {maturation && maturation.empiricalBase != null && Object.values(maturation.empRatios).some((v) => v != null) && (
          <div className="callout" style={{ marginTop: "8px" }}>
            <div className="ico">i</div>
            <div className="body">
              <p style={{ margin: 0, fontSize: "12px" }}>
                <strong style={{ color: "#9ece6a" }}>{T.empiricalCalloutStrong}</strong>: {T.empiricalCalloutBody(maturation.empiricalBase)}
              </p>
            </div>
          </div>
        )}

        <h3 style={{ margin: "20px 0 10px", fontSize: "13px", fontWeight: 600 }}>
          {T.suffTitle}
          <small style={{ opacity: 0.6, fontWeight: 400, marginLeft: "8px" }}>{T.suffSub(matHorizon)}</small>
          <span className="ab-pillgroup" style={{ display: "inline-flex", marginLeft: "14px", verticalAlign: "middle" }}>
            {[90, 180, 360].map((h) => (
              <button key={h} className={`ab-pill ${matHorizon === h ? "active" : ""}`} onClick={() => setMatHorizon(h)}>D{h}</button>
            ))}
          </span>
        </h3>
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "12px" }}>
            <thead>
              <tr>
                <th>{T.suffSetTh}</th>
                <th>{T.suffPredTh(matHorizon)}</th>
                <th>{T.suffChgTh}</th>
                <th>{T.suffStatusTh}</th>
              </tr>
            </thead>
            <tbody>
              {maturation && maturation.suffData ? (
                maturation.suffData.steps.map((s, i) => (
                  <tr key={i} style={s.converged ? { background: "rgba(158,206,106,0.06)" } : {}}>
                    <td><code style={{ fontSize: "11px" }}>[{s.set.map((d) => "D" + d).join(", ")}]</code></td>
                    <td className="tnum"><strong>{s.pred != null ? (s.pred * 100).toFixed(1) + "%" : "—"}</strong></td>
                    <td className="tnum">{s.chg != null ? (s.chg * 100).toFixed(1) + "%" : "—"}</td>
                    <td>
                      {s.converged ? (
                        <span style={{ color: "#9ece6a", fontWeight: 600 }}>{T.converged}</span>
                      ) : i === maturation.suffData.steps.length - 1 && !maturation.suffData.convergedAt ? (
                        <span style={{ color: "var(--text-muted)" }}>{T.needMoreData}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                    {T.suffEmptyRow}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {maturation && maturation.suffData && (
          maturation.suffData.convergedAt ? (
            <div className="callout" style={{ marginTop: "8px", borderColor: "rgba(158,206,106,0.4)", background: "rgba(158,206,106,0.05)" }}>
              <div className="ico" style={{ color: "#9ece6a" }}>✓</div>
              <div className="body">
                <p style={{ margin: 0, fontSize: "12px" }}>
                  <strong>{T.convergedStrong(maturation.suffData.convergedAt.map((d) => "D" + d).join(", "), matHorizon)}</strong>{T.convergedRest}
                </p>
              </div>
            </div>
          ) : (
            <div className="callout warn" style={{ marginTop: "8px" }}>
              <div className="ico">⚠</div>
              <div className="body">
                <p style={{ margin: 0, fontSize: "12px" }}>
                  {T.notConvergedCallout(matHorizon)}
                </p>
              </div>
            </div>
          )
        )}
        <div className="callout" style={{ marginTop: "12px" }}>
          <div className="ico">i</div>
          <div className="body">
            <p style={{ margin: 0, fontSize: "12px" }}>
              {T.s4CalloutPrefix}<strong>{T.s4CalloutStrong}</strong>{T.s4CalloutSuffix}
            </p>
          </div>
        </div>
      </section>

      <MetricConfigPanel
        open={ltvCfgOpen}
        onClose={() => setLtvCfgOpen(false)}
        title={T.modalTitle}
        items={ltvCols.map((c) => ({ key: c.k, label: c.label }))}
        config={ltvTableCfg}
        onSave={(next) => {
          if (!next.hidden.length && !next.order.length) resetViewConfig(LTV_TABLE_SCOPE);
          else setViewConfig(LTV_TABLE_SCOPE, next);
          setLtvCfgOpen(false);
        }}
      />
      <CustomChartsSection sectionNo="5" chartScope="5-2:ltv-charts" metricScope="5-2:viz-kpi" title={T.customChartsTitle} locale={locale} />
    </div>
  );
}
