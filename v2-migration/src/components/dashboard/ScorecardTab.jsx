"use client";
import DashboardTabLayout from "./DashboardTabLayout";
import { useDashboardSetting, useDashboardAction, useDashboardFilter, useDashboardControl } from "./DashboardWorkspaceContext";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import { resolveDashCopy } from "@/utils/contentDomain";
import { aggregateByKey, fmtCurrencyCompact, fmtCurrencyPrecise, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { sourceCurrencyOf } from "@/utils/format";
import { CHART_THEME, chartCommonOpts, } from "@/utils/chartUtils";
import { applyMetricView } from "@/utils/metrics/metricView";
import { customMetricToDescriptor } from "@/utils/metrics/customMetric";
import InlineCardEditor from "@/components/ds/InlineCardEditor";
import CustomMetricBuilder from "@/components/ds/CustomMetricBuilder";
import BudgetHealthCard from "./BudgetHealthCard";
import { FigureHead } from "@/components/ds/FigurePngButton";

// 지표 뷰 설정 scope(도구:표면) — store viewConfig 키. persist 대상.
const SCORECARD_SCOPE = "5-2:scorecard";
// 커스텀 지표 정의는 운영 대시보드(Viz KPI)와 공유 — 한 번 만들면 양쪽에 나타남.
const KPI_METRIC_SCOPE = "5-2:viz-kpi";

// 정적 UI 카피(ko/en) — domain 리라벨(C.scLabels 등)과는 별개 축.
const SCORE_COPY = {
  ko: {
    periodLabel: "기간",
    days: (d) => `${d}일`,
    customMetric: "＋ 커스텀 지표",
    customMetricTitle: "데이터 컬럼으로 나만의 지표 만들기",
    reset: "초기화",
    resetTitle: "전체 표시·기본 순서·기본 크기",
    editDone: "완료",
    edit: "편집",
    editTitle: "카드를 그 자리에서 드래그·표시/숨김·크기 편집",
    editHint: "⠿ 드래그로 이동 · 표시/숨김. 변경은 자동 저장됩니다.",
    noPrevData: "직전 데이터 없음",
    wow: (arrow, pct) => `${arrow} ${pct}% WoW`,
    kpiTitle: (w) => `핵심 KPI (최근 ${w}일)`,
    profit: "이익",
    profitMargin: "이익률",
    scFootnote: (w) => `WoW = 최근 ${w}일 vs 직전 ${w}일. 색은 지표 성격 반영(비용 상승 지표↓·성과 지표↑ = 초록). 비용은 중립(규모). 카드 클릭 시 일별 상세.`,
    dailyDetailTitle: (w, label, n) => `일별 상세 — ${label} (최근 ${n}일)`,
    legendHint: (w) => `비교주(직전 ${w}일) / 목표주(최근 ${w}일) · 카드 재클릭 시 닫힘`,
    insufficientData: (n) => `⚠ 데이터가 충분하지 않습니다 (${n}일). 있는 만큼 표시합니다.`,
    pngBtn: "⬇ PNG",
    noData: "데이터 없음",
  },
  en: {
    periodLabel: "Period",
    days: (d) => `${d}d`,
    customMetric: "＋ Custom metric",
    customMetricTitle: "Build your own metric from data columns",
    reset: "Reset",
    resetTitle: "Show all · default order · default size",
    editDone: "Done",
    edit: "Edit",
    editTitle: "Drag to reorder · show/hide · resize cards in place",
    editHint: "⠿ Drag to move · show/hide. Changes save automatically.",
    noPrevData: "No prior data",
    wow: (arrow, pct) => `${arrow} ${pct}% WoW`,
    kpiTitle: (w) => `Key KPIs (last ${w} days)`,
    profit: "Profit",
    profitMargin: "Profit Margin",
    scFootnote: (w) => `WoW = last ${w}d vs prior ${w}d. Color reflects metric direction (cost-type ↓ / performance-type ↑ = green). Cost is neutral (scale). Click a card for daily detail.`,
    dailyDetailTitle: (w, label, n) => `Daily detail — ${label} (last ${n} days)`,
    legendHint: (w) => `Comparison week (prior ${w}d) / Target week (last ${w}d) · click card again to close`,
    insufficientData: (n) => `⚠ Not enough data (${n} days). Showing what's available.`,
    pngBtn: "⬇ PNG",
    noData: "No data",
  },
};

// domain 라벨(C.scLabels)의 영문 대응 — content/performance 공통 키만(값·계산 불변, 표시명만).
const SC_LABELS_EN = {
  cost: "Cost", inst: "Installs", cpi: "CPI", act: "Actions", cpa: "CPA",
  cvr: "CVR", ctr: "CTR", roas: "ROAS",
};

export default function ScorecardTab({ domain = "performance", locale = "ko" } = {}) {
  const C = resolveDashCopy(domain);
  const T = SCORE_COPY[locale] || SCORE_COPY.ko;
  const scLabel = useCallback((k) => (locale === "en" ? (SC_LABELS_EN[k] || C.scLabels[k] || k) : C.scLabels[k]), [locale, C]);
  const isContent = domain === "content";
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useDashboardFilter();
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const dataCurrency = sourceCurrencyOf(csvData, displayCurrency);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const scopeCfg = useDashboardSetting("viewConfig", SCORECARD_SCOPE);
  const setViewConfig = useDashboardAction("setViewConfig");
  const resetViewConfig = useDashboardAction("resetViewConfig");
  const customMetrics = useDashboardSetting("customMetrics", KPI_METRIC_SCOPE);
  const addCustomMetric = useDashboardAction("addCustomMetric");
  const removeCustomMetric = useDashboardAction("removeCustomMetric");
  const updateCustomMetric = useDashboardAction("updateCustomMetric");
  // 비교 기간은 상단 선택기와 결론 카드가 같은 store 상태를 공유한다.
  const windowDays = useAppStore((state) => state.dashWindowDays);
  const [selectedMetric, setSelectedMetric] = useDashboardControl("selectedMetric", null);
  const [editMode, setEditMode] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { recent, prev, daily, hasData, mapping, recentKeys, customPeriod } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) {
      return { hasData: false, mapping: {} };
    }
    const periods = dashboardPeriods(csvData, dashboardFilter, windowDays);
    const rows = periods.rows;
    const _daily = aggregateByKey(rows, "date", ["cost", "impressions", "clicks", "installs", "actions", "revenue_d7", "pu_d7"]).sort((a, b) => a._key > b._key ? 1 : -1);

    if (!periods.recentRows.length || !periods.previousRows.length) return { hasData: false, mapping: csvData.mapping || {} };

    const _recent = _daily.filter(row => periods.recentDates.has(row._key));
    const _prev = _daily.filter(row => periods.prevDates.has(row._key));
    const basis = effectiveDenomBasis(csvData, denomBasis);

    const sum = (arr, k) => arr.reduce((s, d) => s + (d[k] || 0), 0);
    const agg = (arr) => {
      const cost = sum(arr, "cost"), imp = sum(arr, "impressions"), clk = sum(arr, "clicks");
      const inst = sum(arr, "installs"), act = sum(arr, "actions"), rev = sum(arr, "revenue_d7"), pu = sum(arr, "pu_d7");
      return {
        cost, imp, clk, inst, act, rev,
        // 표준키 별칭 — 프리셋·커스텀 지표 compute(agg)용(Viz와 동일 계약).
        impressions: imp, clicks: clk, installs: inst, actions: act, revenue: rev, purchases: pu,
        denom: basis === "actions" ? act : inst,
        cpi: inst > 0 ? cost / inst : null,
        cpa: act > 0 ? cost / act : null,
        cvr: clk > 0 ? inst / clk : null,
        ctr: imp > 0 ? clk / imp : null,
        roas: cost > 0 && rev > 0 ? rev / cost : null,
        cpm: imp > 0 ? (cost / imp) * 1000 : null,
      };
    };

    return { hasData: true, recent: agg(_recent), prev: agg(_prev), daily: _daily.filter(row => periods.recentDates.has(row._key) || periods.prevDates.has(row._key)), recentKeys: periods.recentDates, customPeriod: periods.custom, mapping: csvData.mapping || {} };
  }, [csvData, dashboardFilter, windowDays, denomBasis]);

  const cards = useMemo(() => {
    if (!hasData) return [];
    const fmtCurrency = (v) => fmtCurrencyPrecise(v, dataCurrency);
    const fmtCurrencyCard = (v) => fmtCurrencyCompact(v, dataCurrency, locale);
    const mapped = new Set(Object.values(mapping));
    const hasRev = mapped.has("revenue_d7");

    // 기본 지표 카드 — chartable=일별 상세 차트 지원.
    const L = { cost: scLabel("cost"), inst: scLabel("inst"), cpi: scLabel("cpi"), act: scLabel("act"), cpa: scLabel("cpa"), cvr: scLabel("cvr"), ctr: scLabel("ctr"), roas: scLabel("roas") };
    const base = [
      { k: "cost", label: L.cost, val: recent.cost, prev: prev.cost, fmt: fmtCurrencyCard, better: "none", chartable: true },
      mapped.has("installs") && { k: "inst", label: L.inst, val: recent.inst, prev: prev.inst, fmt: v => Math.round(v).toLocaleString(), better: "high", chartable: true },
      mapped.has("installs") && { k: "cpi", label: L.cpi, val: recent.cpi, prev: prev.cpi, fmt: v => v != null ? fmtCurrency(v) : "—", better: "low", chartable: true },
      mapped.has("actions") && { k: "act", label: L.act, val: recent.act, prev: prev.act, fmt: v => Math.round(v).toLocaleString(), better: "high", chartable: true },
      mapped.has("actions") && { k: "cpa", label: L.cpa, val: recent.cpa, prev: prev.cpa, fmt: v => v != null ? fmtCurrency(v) : "—", better: "low", chartable: true },
      mapped.has("clicks") && mapped.has("installs") && { k: "cvr", label: L.cvr, val: recent.cvr, prev: prev.cvr, fmt: v => v != null ? (v * 100).toFixed(2) + "%" : "—", better: "high", chartable: true },
      mapped.has("impressions") && mapped.has("clicks") && { k: "ctr", label: L.ctr, val: recent.ctr, prev: prev.ctr, fmt: v => v != null ? (v * 100).toFixed(2) + "%" : "—", better: "high", chartable: true },
      mapped.has("revenue_d7") && { k: "roas", label: L.roas, val: recent.roas, prev: prev.roas, fmt: v => v != null ? (v * 100).toFixed(0) + "%" : "—", better: "high", chartable: true },
    ].filter(Boolean);

    // 프리셋(이익·이익률) — 매출 있을 때. 일별 상세 차트 지원.
    const presets = [];
    if (hasRev) {
      presets.push({ k: "profit", label: T.profit, val: recent.revenue - recent.cost, prev: prev.revenue - prev.cost, fmt: fmtCurrencyCard, better: "high", chartable: true });
      presets.push({ k: "profitMargin", label: T.profitMargin, val: recent.revenue ? (recent.revenue - recent.cost) / recent.revenue : null, prev: prev.revenue ? (prev.revenue - prev.cost) / prev.revenue : null, fmt: v => v != null ? (v * 100).toFixed(1) + "%" : "—", better: "high", chartable: true });
    }
    // 커스텀 지표(공유 스코프) — recent/prev 각각 compute해 값+WoW. 일별 상세 차트 지원(seriesVal에서 def 재조회).
    const customCards = (customMetrics || []).map((def) => {
      const desc = customMetricToDescriptor(def);
      return { k: def.id, label: def.name, val: desc.compute(recent), prev: desc.compute(prev), fmt: v => v == null ? "—" : Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 2 }), better: "none", chartable: true };
    });

    return [...base, ...presets, ...customCards];
  }, [hasData, recent, prev, mapping, dataCurrency, locale, customMetrics, T, scLabel]);

  // 커스텀 지표 빌더 피연산자 = 실제 매핑된 컬럼만.
  const builderFields = useMemo(() => {
    const entries = Object.entries((csvData && csvData.mapping) || {});
    const set = new Set(entries.map(([, v]) => v));
    const headerFor = (k) => (entries.find(([, v]) => v === k) || [])[0] || "";
    const isEn = locale === "en";
    return [
      { key: "cost", label: isEn ? "Cost" : "비용", header: headerFor("cost") },
      set.has("impressions") && { key: "impressions", label: isEn ? "Impressions" : "노출수", header: headerFor("impressions") },
      set.has("clicks") && { key: "clicks", label: isEn ? "Clicks" : "클릭수", header: headerFor("clicks") },
      set.has("installs") && { key: "installs", label: isEn ? "Installs" : "설치수", header: headerFor("installs") },
      set.has("actions") && { key: "actions", label: isEn ? "Actions/Signups" : "액션/가입", header: headerFor("actions") },
      set.has("revenue_d7") && { key: "revenue", label: isEn ? "Revenue (D7)" : "매출(D7)", header: headerFor("revenue_d7") },
      set.has("pu_d7") && { key: "purchases", label: isEn ? "Purchases (D7)" : "결제건수(D7)", header: headerFor("pu_d7") },
    ].filter(Boolean);
  }, [csvData, locale]);

  // 유저 지표 뷰 설정(표시/순서) 적용 — 후보(cards)에 hidden/order 반영(§Phase B).
  // scopeCfg 미설정(기본)이면 cards 원순서 그대로(byte-동일).
  const orderedCards = useMemo(
    () => applyMetricView(cards, scopeCfg, (c) => c.k),
    [cards, scopeCfg],
  );

  // 인라인 편집기용 카드 아이템(node=카드 엘리먼트). 편집 중엔 InlineCardEditor가
  // 카드 클릭을 차단하므로 여기 onClick은 평시에만 발화(차트 상세).
  const cardItems = cards.map((c) => {
    const d = c.prev != null && c.prev !== 0 && c.val != null ? (c.val - c.prev) / c.prev : null;
    const good = c.better === "none" || d == null ? null : (c.better === "high" ? d > 0 : d < 0);
    const arrow = d == null ? "" : (d > 0 ? "▲" : (d < 0 ? "▼" : "—"));
    const cls = good == null ? "" : (good ? "pos" : "neg");
    const isActive = selectedMetric === c.k;
    return {
      key: c.k, label: c.label,
      node: (
        <button
          type="button"
          className="ab-stat ab-stat-button"
          onClick={c.chartable ? () => setSelectedMetric(isActive ? null : c.k) : undefined}
          disabled={!c.chartable}
          aria-pressed={c.chartable ? isActive : undefined}
          style={{ cursor: c.chartable ? "pointer" : "default" }}
        >
          <div className="ab-stat-label">{c.label}</div>
          <div className="ab-stat-value tnum">{c.fmt(c.val)}</div>
          <div className={`ab-stat-hint ${cls}`}>
            {d == null ? T.noPrevData : customPeriod ? `${arrow} ${Math.abs(d * 100).toFixed(1)}%` : T.wow(arrow, Math.abs(d * 100).toFixed(1))}
          </div>
        </button>
      ),
    };
  });

  // If selected metric is no longer valid (또는 숨김 처리됨), reset it quietly
  useEffect(() => {
    if (selectedMetric && !orderedCards.find(c => c.k === selectedMetric)) {
      // 선택 지표가 더는 유효하지 않으면 1회 리셋 — 조건부라 무한루프 없음(의도된 패턴)
      setSelectedMetric(null);
    }
  }, [orderedCards, selectedMetric, setSelectedMetric]);

  const seriesVal = useCallback((d, sel) => {
    switch (sel) {
      case "cost": return d.cost;
      case "inst": return d.installs;
      case "cpi": return d.installs > 0 ? d.cost / d.installs : null;
      case "act": return d.actions;
      case "cpa": return d.actions > 0 ? d.cost / d.actions : null;
      case "cvr": return d.clicks > 0 ? d.installs / d.clicks : null;
      case "ctr": return d.impressions > 0 ? d.clicks / d.impressions : null;
      case "roas": return d.cost > 0 ? d.revenue_d7 / d.cost : null;
      case "profit": return d.revenue_d7 - d.cost;
      case "profitMargin": return d.revenue_d7 ? (d.revenue_d7 - d.cost) / d.revenue_d7 : null;
      default: {
        // 커스텀 지표 — 일별 로우를 agg 계약 키(revenue/purchases 별칭)로 변환 후 재사용 compute.
        const def = (customMetrics || []).find((m) => m.id === sel);
        if (!def) return null;
        const row = { ...d, revenue: d.revenue_d7, purchases: d.pu_d7 };
        return customMetricToDescriptor(def).compute(row);
      }
    }
  }, [customMetrics]);

  useEffect(() => {
    if (!hasData || !selectedMetric || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const slice2W = daily;
    if (slice2W.length < 2) return;

    const vals = slice2W.map(d => seriesVal(d, selectedMetric));
    const labels = slice2W.map(d => d._key.slice(5)); // MM-DD
    const n = slice2W.length;
    const pivotIdx = slice2W.findIndex(row => recentKeys.has(row._key));

    const ptBg = slice2W.map(row => recentKeys.has(row._key) ? CHART_THEME.primary : CHART_THEME.muted);
    const ptBorder = slice2W.map(row => recentKeys.has(row._key) ? CHART_THEME.primary : CHART_THEME.muted);
    const barColors = ptBorder;
    
    const gridColor = CHART_THEME.grid;
    const tickColor = CHART_THEME.muted;

    const customDef = (customMetrics || []).find((m) => m.id === selectedMetric);
    const isContinuous = customDef
      ? customDef.chartType === "line"
      : ["cvr", "ctr", "roas", "cpi", "cpa", "profitMargin"].includes(selectedMetric);
    // Chart.js line은 borderColor 배열을 세그먼트별로 적용하지 않음(포인트 색상 배열은
    // 적용됨) — 그래서 선 전체가 첫 색 하나로 통짜 렌더되던 버그. segment.borderColor로
    // 각 구간(두 점 사이)을 비교주/목표주 색으로 분리. 피벗 경계 구간(비교주 마지막→
    // 목표주 처음)은 목표주 색으로 이어줘 전환이 자연스럽게.
    const ds = isContinuous ? [{
      label: "",
      data: vals,
      borderColor: CHART_THEME.primary,
      backgroundColor: ptBg,
      pointBackgroundColor: ptBorder,
      pointBorderColor: ptBorder,
      pointRadius: 4,
      tension: 0.1,
      fill: false,
      segment: {
        borderColor: (ctx) => ptBorder[ctx.p1DataIndex],
      },
    }] : [{
      label: "",
      data: vals,
      backgroundColor: barColors,
      borderColor: barColors,
      borderWidth: 1,
    }];

    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: isContinuous ? "line" : "bar",
      data: { labels, datasets: ds },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (items) => items[0].label } }
        },
        scales: {
          x: {
            title: { display: true, text: locale === "en" ? "Date" : "날짜", color: tickColor },
            ticks: { color: tickColor, maxTicksLimit: 14 },
            grid: { color: gridColor },
            afterBuildTicks(ax) {
              if (ax.ticks.length > 0 && pivotIdx > 0 && pivotIdx < n) {
                ax.ticks[pivotIdx] = { ...ax.ticks[pivotIdx], major: true };
              }
            }
          },
          y: {
            title: { display: true, text: cards.find((c) => c.k === selectedMetric)?.label || selectedMetric, color: tickColor },
            ticks: { color: tickColor },
            grid: { color: gridColor },
          }
        }
      }
    });

    // 조건부 렌더(§0 카드 클릭 시 마운트)라 최초 생성 시 부모 폭이 0으로 측정될 수 있음
    // (§7 <details> 0px 함정과 동일 원인) — 레이아웃 안정 후 1회 resize로 강제 재측정.
    requestAnimationFrame(() => chartInstanceRef.current?.resize());

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, daily, selectedMetric, recentKeys, isDarkMode, customMetrics, seriesVal, cards, locale]);

  if (!hasData) {
    return <DashboardTabLayout className="tab-pane active"><p className="muted">{T.noData}</p></DashboardTabLayout>;
  }

  return (
    <DashboardTabLayout className="tab-pane active" id="tab-scorecard">
      {/* 예산 배분 진단·CTA는 마케팅 전용(콘텐츠엔 예산배분 도구가 없음) → content 제외. */}
      {!isContent && <BudgetHealthCard locale={locale} data-dashboard-static />}
      <section className="block" id="s-score">
        <h2 className="section-title">{customPeriod ? (locale === "en" ? "Selected-period KPIs" : "선택 기간 KPI 비교") : T.kpiTitle(windowDays)}</h2>
        <div className="dashboard-section-actions">
          <button className="ab-pill dashboard-legacy-edit" onClick={() => setBuilderOpen(true)} style={{ marginLeft: "auto" }} title={T.customMetricTitle}>
            {T.customMetric}
          </button>
          {editMode ? (
            <>
              <button className="ab-pill" onClick={() => resetViewConfig(SCORECARD_SCOPE)} title={T.resetTitle}>{T.reset}</button>
              <button className="ab-pill active" onClick={() => setEditMode(false)} style={{ fontWeight: 700 }}>{T.editDone}</button>
            </>
          ) : (
            <button className="ab-pill dashboard-legacy-edit" onClick={() => setEditMode(true)} title={T.editTitle}>
              {T.edit}
            </button>
          )}
        </div>
        {editMode && (
          <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "8px 0 0" }}>{T.editHint}</p>
        )}

        <div style={{ marginTop: "10px" }}>
          <InlineCardEditor
            items={cardItems}
            config={scopeCfg}
            editMode={editMode}
            onPatch={(p) => setViewConfig(SCORECARD_SCOPE, p)}
            gridClassName="ab-stat-row"
            locale={locale}
          />
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "8px" }}>
          {customPeriod ? (locale === "en" ? "Totals for the two selected periods; not normalized by duration." : "선택한 두 기간의 합계 비교입니다. 기간 길이로 보정하지 않습니다.") : locale === "en" ? T.scFootnote(windowDays) : C.scFootnote(windowDays)}
        </p>
      </section>

      <CustomMetricBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        locale={locale}
        fields={builderFields}
        agg={recent}
        existing={customMetrics || []}
        onCreate={(def) => addCustomMetric(KPI_METRIC_SCOPE, def)}
        onUpdate={(id, def) => updateCustomMetric(KPI_METRIC_SCOPE, id, def)}
        onDelete={(id) => removeCustomMetric(KPI_METRIC_SCOPE, id)}
      />

      {selectedMetric && (
        <section className="block" id="s-score-daily" style={{ paddingTop: "8px" }}>
          <h3 style={{ fontSize: "var(--fs-md)", fontWeight: "600", margin: "0 0 8px", color: "var(--text-muted)" }}>
            {customPeriod ? (locale === "en" ? "Daily values in the selected periods" : "선택한 두 기간의 일별 값") : T.dailyDetailTitle(windowDays, cards.find(c => c.k === selectedMetric)?.label || selectedMetric, daily.length)}
          </h3>
          <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "0 0 8px" }}>
            {locale === "en" ? "Gray: comparison period · Blue: analysis period" : "회색: 비교 기간 · 파란색: 분석 기간"}
          </p>
          {!customPeriod && daily.length < 2 * windowDays && (
            <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "4px 0 0" }}>
              {T.insufficientData(daily.slice(-2 * windowDays).length)}
            </p>
          )}
          {daily.length >= 2 && (<>
            <FigureHead exportTitle={locale === "en" ? "Daily performance trends" : "일별 성과 추이"} target={chartRef} fileName="scorecard_daily" locale={locale} />
            <div className="chart-container" style={{ height: "220px" }}>
              <canvas id="scorecard-daily-chart" ref={chartRef}></canvas>
            </div>
          </>)}
        </section>
      )}
    </DashboardTabLayout>
  );
}
