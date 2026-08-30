"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import BlockedOptionsNote from "@/components/ds/BlockedOptionsNote";
import { useAppStore } from "@/store/useDataStore";
import Chart from "@/utils/chartGlobals";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { CHART_THEME, getCssVar, downloadChartAsPNG } from "@/utils/chartUtils";
import CsvUploader from "@/components/CsvUploader";
import { showToast } from "@/utils/toast";
import {
  satActiveVerdict,
  satActiveIndex,
  satVerdictMeta,
  satAvailableFields,
  satBuildPoints,
  SAT_MATH,
  SAT_CONFIG,
} from "@/utils/satMath";
import { effectiveDenomBasis, getMappedRows } from "@/utils/dashboardAggregator";
import { TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import AnalysisControlBar from "@/components/dashboard/AnalysisControlBar";
import ToolPageShell from "@/components/ToolPageShell";
import ResultActionCard from "@/components/ds/ResultActionCard";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { stripHtmlTags } from "@/lib/htmlText";

// 우측 TOC — legacy page_5_22() 목차와 동일 (§0 요약/§1 순위/§2 응답곡선).
// 실제 렌더되는 section id(analyzed 분기 하위)만 포함 — 없는 앵커 추가 금지.
function buildSatToc(tr) {
  return [
    { id: "s-sat-summary", title: tr("요약", "Summary") },
    { id: "s-sat", title: tr("포화도 순위", "Saturation ranking") },
    { id: "s-sat-curve", title: tr("응답곡선", "Response curve") },
  ];
}

const CURRENCY_SYMBOLS = { KRW: "₩", USD: "$" };

/* index.html fmtCurrency 이식 — 통화 토글은 기호/소수 자리수만 바꿈(FX 변환 없음:
   USD metric=소수 1자리, KRW/절대값=정수). 통화는 render-time 인자로 주입. */
function fmtCurrency(value, currency, opts = {}) {
  if (value == null || !isFinite(value)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] || "₩";
  const isUSD = currency === "USD";
  const decimals = isUSD && opts.metric ? 1 : 0;
  return `${sym}${Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/* index.html buildToolTemplateCsv(toolId, "tool") 이식 (BOM+CRLF, canonical 헤더) —
   이 도구가 실제 쓰는 필드(필수+옵션)만 빈 헤더 CSV로. creative_id→creative_name 등
   canonical 규칙은 5-22엔 해당 없음. §7 CRLF+BOM 준수. */
function satToolTemplateFields(toolId) {
  const reqs = TOOL_REQUIRED_FIELDS[toolId] || [];
  const opts = TOOL_OPTIONAL_FIELDS[toolId] || [];
  const keys = [];
  reqs.forEach((r) => {
    if (typeof r === "string") keys.push(r);
    else if (r.oneOf) r.oneOf.forEach((k) => keys.push(k));
  });
  opts.forEach((o) => keys.push(o.key));
  // canonical header 순서: 디멘션 먼저 → 지표 (index dfmUnifiedFields 순서 근사)
  const order = ["date", "country", "platform", "channel", "campaign_name", "adgroup_name", "creative_name", "url", "cost", "spend", "impressions", "clicks", "installs", "actions"];
  const uniq = [...new Set(keys)];
  return uniq.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

// satVerdictMeta(엔진 util, src/utils/satMath.js)는 라벨을 한글 하드코딩 반환 —
// 엔진 파일은 불변 대상이라 여기서 컴포넌트 레벨로 감싸 locale 번역만 얹는다.
function trVerdictMeta(meta, tr) {
  const map = {
    "포화": tr("포화", "Saturated"),
    "여유": tr("여유", "Headroom"),
    "적정": tr("적정", "Steady"),
    "—": "—",
  };
  const adviceMap = {
    "증액 위험": tr("증액 위험", "Risk if increased"),
    "증액 기회": tr("증액 기회", "Opportunity to increase"),
    "현상 유지": tr("현상 유지", "Maintain"),
    "분석 불가": tr("분석 불가", "Cannot analyze"),
  };
  return {
    ...meta,
    label: map[meta.label] ?? meta.label,
    advice: adviceMap[meta.advice] ?? meta.advice,
  };
}

function downloadSatTemplateCsv(toolId) {
  const fields = satToolTemplateFields(toolId);
  // revenue_d7 옵션도 헤더에 노출(ROAS 진단용) — 표준 필드에 존재하면 canonical 헤더 사용
  if ((TOOL_OPTIONAL_FIELDS[toolId] || []).some((o) => o.key === "revenue_d7") && !fields.includes("revenue_d7")) {
    fields.push("revenue_d7");
  }
  const headers = [...new Set(fields.map((k) => k))];
  const csv = "﻿" + headers.join(",") + "\r\n";
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `template_${toolId}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function MarketingEfficiency({ locale = "ko" } = {}) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  // 전역 분모 기준(설치/가입) 구독 — 포화도 metricField를 basis 따라 installs↔actions 전환(§12.18/#3).
  const denomBasis = useAppStore((state) => state.denomBasis);
  // 분석 게이트: 그룹 시그니처 SSOT (efficiency 패밀리 공유, §12.5/#5). CsvUploader의 단일 분석하기 버튼이 세팅.
  const analyzed = useAppStore((state) => state.isGroupAnalyzed("5-22"));
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const [satState, setSatState] = useState({
    grain: "channel", // channel | campaign
    metric: "cpa", // cpa | roas
    selected: null,
  });
  // 표시 통화는 전역 store 단일 소스 — 토글 UI는 Header뿐(도구별 중복 금지).
  const currency = useAppStore((state) => state.displayCurrency);

  const hasData = csvData && csvData.raw && csvData.raw.length > 0;

  // Extract fields mapping
  const mappedKeys = new Set(Object.values(csvData?.mapping || {}).filter((v) => v && v !== "__ignore__"));
  const hasCampaign = mappedKeys.has("campaign_name");
  const revCandidates = ["revenue_d7", "revenue_d0", "revenue_d14", "revenue_d30", "revenue_d90", "revenue_d180", "revenue_d360"];
  const revField = revCandidates.find((k) => mappedKeys.has(k)) || null;

  // Enforce valid states synchronously
  const effectiveMetric = satState.metric === "roas" && !revField ? "cpa" : satState.metric;
  const effectiveGrain = satState.grain === "campaign" && !hasCampaign ? "channel" : satState.grain;

  // #3 — 결과 field(분모)를 전역 basis 따라 installs↔actions 전환. satMath는 installs 고정 선호라
  // basis-aware metricField를 직접 산출해 satBuildPoints로 점 생성(satAvailableFields는 revField만 재사용).
  // effectiveDenomBasis가 요청 basis 미매핑 시 installs→actions 자동 폴백(효율 패밀리 공통 규칙).
  const effBasis = effectiveDenomBasis(csvData, denomBasis);
  const costMetricLabel = effBasis === "actions" ? "CPA" : "CPI";
  const basisMetricField = mappedKeys.has(effBasis)
    ? effBasis
    : mappedKeys.has("installs")
      ? "installs"
      : mappedKeys.has("actions")
        ? "actions"
        : null;

  const rows = (() => {
    if (!hasData || !basisMetricField) return [];
    const { revField: rev } = satAvailableFields(csvData);
    const mapped = getMappedRows(csvData);
    const pointsMap = satBuildPoints(mapped, effectiveGrain, basisMetricField, rev);
    const out = [];
    for (const [name, pts] of pointsMap) {
      const a = SAT_MATH.analyzeEntity(pts, SAT_CONFIG);
      out.push({ name, raw: pts.length, ...a });
    }
    return out;
  })();
  const okRows = rows
    .filter((r) => r.ok && satActiveVerdict(r, effectiveMetric))
    .sort((a, b) => satActiveIndex(b, effectiveMetric) - satActiveIndex(a, effectiveMetric));
  const badRows = rows.filter((r) => !r.ok || !satActiveVerdict(r, effectiveMetric));

  useEffect(() => {
    if (typeof window === "undefined" || !chartRef.current || !hasData || !analyzed || !okRows.length) return;

    let sel = satState.selected ? okRows.find((r) => r.name === satState.selected) : null;
    if (!sel) sel = okRows[0];
    if (!sel) return;

    const A = ALLOC_MATH;
    const isRoas = effectiveMetric === "roas" && sel.roas;
    const revPerRes = isRoas ? sel.roas.revPerRes : null;
    const xs = sel.kept.map((p) => p.x);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    // 관측 구간 밖으로 5% 외삽하던 여유분(margin)을 제거 — Log 모델은 x→0 근처에서
    // a*ln(x) 항이 발산해(a<0이면 +∞) xMin 쪽으로 살짝만 외삽해도 곡선이 비정상적으로
    // 치솟아 보였음(#4). 곡선은 실제 관측 구간[xMin,xMax] 안에서만 그림.
    const fitMin = xMin, fitMax = xMax;
    // xMin을 빠뜨리면 predictSafeCpr의 하한 clamp(allocationMath.js:378)가 죽어
    // 관측 구간 아래로 외삽될 때 Log/Power/Poly2가 발산·음수로 튄다(감사 P1-4).
    const chWrap = { model: sel.model, poly2Shape: sel.poly2Shape, xMin, xMax };

    const curve = [];
    const STEPS = 60;
    for (let s = 0; s <= STEPS; s++) {
      const x = fitMin + (fitMax - fitMin) * (s / STEPS);
      const cpr = A.predictSafeCpr(chWrap, x);
      if (cpr == null || !isFinite(cpr) || cpr <= 0) continue;
      const y = isRoas ? revPerRes / cpr : cpr;
      if (isFinite(y)) curve.push({ x, y });
    }

    const scatter = sel.kept
      .map((p) => ({
        x: p.x,
        y: isRoas ? (p.rev != null && p.x > 0 ? p.rev / p.x : null) : p.y,
      }))
      .filter((d) => d.y != null && isFinite(d.y));

    const allY = scatter.map((p) => p.y).concat(curve.map((p) => p.y));
    const yLo = Math.min(...allY), yHi = Math.max(...allY);
    const marker = [
      { x: sel.currentCost, y: yLo },
      { x: sel.currentCost, y: yHi },
    ];

    const primary = getCssVar("--primary") || "#7aa2f7";
    const text = getCssVar("--text-muted") || "#9ca3af";
    const grid = getCssVar("--border") || "#2a2a2a";
    const obsLabel = isRoas ? tr("일별 관측 (Cost vs ROAS)", "Daily observations (Cost vs ROAS)") : tr(`일별 관측 (Cost vs ${costMetricLabel})`, `Daily observations (Cost vs ${costMetricLabel})`);
    const yTitle = isRoas ? tr("ROAS (Revenue/Cost, 높을수록 좋음)", "ROAS (Revenue/Cost, higher is better)") : tr(`${costMetricLabel} (Cost/결과, 낮을수록 좋음)`, `${costMetricLabel} (Cost/result, lower is better)`);

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    chartInstance.current = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: obsLabel,
            data: scatter,
            backgroundColor: primary + "55",
            borderColor: primary + "55",
            pointRadius: 3,
            pointStyle: "circle",
            showLine: false,
          },
          {
            label: `${tr("적합", "Fit")} ${sel.modelType} (R²=${sel.r2 != null ? sel.r2.toFixed(2) : "—"})`,
            data: curve,
            borderColor: primary,
            backgroundColor: "transparent",
            pointRadius: 0,
            pointStyle: "line",
            showLine: true,
            borderWidth: 2,
            tension: 0.35,
            cubicInterpolationMode: "monotone",
          },
          {
            label: tr("현 지출점", "Current spend point"),
            data: marker,
            borderColor: CHART_THEME.tertiary,
            borderDash: [5, 4],
            pointRadius: 0,
            pointStyle: "line",
            showLine: true,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // 점(관측)은 원형, 선(적합곡선/지출점)은 선 모양으로 범례 아이콘이 실제
          // 렌더 형태와 일치하도록(usePointStyle + 각 dataset의 pointStyle 사용).
          legend: { labels: { color: text, font: { size: 11 }, usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
        },
        scales: {
          x: {
            title: { display: true, text: tr("일 Cost", "Daily cost"), color: text },
            ticks: { color: text },
            grid: { color: grid },
          },
          y: {
            title: { display: true, text: yTitle, color: text },
            ticks: { color: text },
            grid: { color: grid },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
    // isDarkMode dep: re-evaluate getCssVar theme colors on light/dark toggle
  }, [okRows, satState.selected, effectiveMetric, hasData, analyzed, isDarkMode, locale, tr, costMetricLabel]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-sat">
        <ToolPageShell
          locale={locale}
          title={tr("마케팅 효율 진단 (Saturation)", "Marketing Efficiency Diagnosis (Saturation)")}
          summary={<p>{tr(
            "효율 CSV(일별 채널·캠페인 비용/결과) 한 번 업로드로 채널별 한계 CPA/ROAS를 진단합니다 — 증액하면 효율이 꺾이는지 판정합니다. 5-3 예산 배분과 같은 효율 CSV를 공유합니다.",
            "Upload an efficiency CSV once (daily channel/campaign cost and results) to diagnose each channel's marginal CPA/ROAS — this determines whether increasing spend will hurt efficiency. Shares the same efficiency CSV with 5-3 Budget Allocation."
          )}</p>}
        >
          <section className="block" id="s-prep">
            <h2 className="section-title">{tr("데이터 준비", "Data preparation")}</h2>
            <div className="callout warning">
              <div className="ico">!</div>
              <div className="body">
                <strong>{tr("CSV 업로드 대기", "Waiting for CSV upload")}</strong>
                <p>
                  {tr(
                    "효율 CSV(일별 채널·캠페인 비용/결과) 한 번 업로드로 채널별 포화도를 진단합니다.",
                    "Upload an efficiency CSV once (daily channel/campaign cost and results) to diagnose each channel's saturation."
                  )}
                  {" "}
                  {tr(
                    "5-3 예산 배분과 같은 효율 CSV를 공유합니다.",
                    "Shares the same efficiency CSV with 5-3 Budget Allocation."
                  )}
                </p>
                <div style={{ marginTop: "1rem" }}>
                  <CsvUploader toolId="5-22" locale={locale} />
                </div>
              </div>
            </div>
          </section>
        </ToolPageShell>
      </div>
    );
  }

  // --- Rendering Helpers ---
  const isRoas = effectiveMetric === "roas";
  const grainLabel = effectiveGrain === "campaign" ? tr("캠페인", "campaign") : tr("채널", "channel");
  const metricLabel = isRoas ? "ROAS" : costMetricLabel;
  const sat = okRows.filter((r) => satActiveVerdict(r, effectiveMetric) === "saturated");
  const scale = okRows.filter((r) => satActiveVerdict(r, effectiveMetric) === "scale");
  const scaleCandidate = [...scale].sort((a, b) => satActiveIndex(a, effectiveMetric) - satActiveIndex(b, effectiveMetric))[0] || null;
  const saturatedCandidate = sat[0] || null;
  const decisionTarget = scaleCandidate || saturatedCandidate || okRows[0] || null;
  const decisionDates = (decisionTarget?.kept || [])
    .map((point) => point.date)
    .filter((date) => date && !Number.isNaN(Date.parse(date)))
    .sort();
  const decisionSourcePeriod = decisionDates.length
    ? `${decisionDates[0]} ~ ${decisionDates[decisionDates.length - 1]}`
    : tr(`최근 ${SAT_CONFIG.recentDays}일 기준`, `Based on the latest ${SAT_CONFIG.recentDays} days`);

  const fmtRoas = (v) => (v == null || !isFinite(v) ? "—" : `${v.toFixed(2)}x`);

  let advice = "";
  if (!okRows.length) {
    advice = tr(
      `분석 가능한 ${grainLabel}이 없습니다. 각 ${grainLabel}에 최소 ${SAT_CONFIG.minPoints}개 이상의 일별 관측(비용·결과 >0)이 필요합니다.`,
      `No analyzable ${grainLabel}s found. Each ${grainLabel} needs at least ${SAT_CONFIG.minPoints} daily observations (cost and results > 0).`
    );
  } else if (sat.length && scale.length) {
    advice = tr(
      `${sat.slice(0, 2).map(r => r.name).join(", ")}는 이미 포화 — 추가 예산은 ${scale.slice(0, 2).map(r => r.name).join(", ")} 쪽으로 옮기면 같은 돈으로 ${isRoas ? "더 높은 매출" : "더 많은 결과"}를 기대할 수 있습니다.`,
      `${sat.slice(0, 2).map(r => r.name).join(", ")} ${sat.length > 1 ? "are" : "is"} already saturated — shifting extra budget to ${scale.slice(0, 2).map(r => r.name).join(", ")} could get you ${isRoas ? "more revenue" : "more results"} for the same money.`
    );
  } else if (sat.length) {
    advice = tr(
      `${sat.slice(0, 3).map(r => r.name).join(", ")}는 ${metricLabel} 기준 포화 상태 — 증액 시 효율이 빠르게 나빠집니다. 증액보다 소재·타겟 개선이 우선입니다.`,
      `${sat.slice(0, 3).map(r => r.name).join(", ")} ${sat.length > 1 ? "are" : "is"} saturated on ${metricLabel} — efficiency will drop quickly with more spend. Prioritize creative/targeting improvements over increasing budget.`
    );
  } else if (scale.length) {
    advice = tr(
      `${scale.slice(0, 3).map(r => r.name).join(", ")}는 아직 여유 구간 — 증액하면 효율이 오히려 개선될 여지가 있습니다.`,
      `${scale.slice(0, 3).map(r => r.name).join(", ")} still ${scale.length > 1 ? "have" : "has"} headroom — increasing spend could actually improve efficiency.`
    );
  } else {
    advice = tr(
      `모든 ${grainLabel}이 선형(적정) 구간 — 현 배분을 크게 흔들 근거는 약합니다.`,
      `All ${grainLabel}s are in the linear (steady) zone — there's little evidence to justify a major reallocation.`
    );
  }

  let head = tr("대부분 적정 구간", "Mostly in the steady zone");
  if (sat.length || scale.length) {
    const parts = [];
    if (sat.length) parts.push(`<span style="color:#f87171;">${tr(`포화 ${sat.length}개`, `${sat.length} saturated`)}</span> (${tr("증액 위험", "risk if you increase")})`);
    if (scale.length) parts.push(`<span style="color:#22c55e;">${tr(`여유 ${scale.length}개`, `${scale.length} with headroom`)}</span> (${tr("증액 기회", "opportunity to increase")})`);
    head = parts.join(" · ");
  }

  const activeStyle = { background: "var(--bg-2)", borderColor: "var(--text-1)", color: "var(--text-1)" };

  const selName = satState.selected || okRows[0]?.name || "curve";
  const handlePngDownload = () => {
    if (!chartRef.current) {
      showToast({ variant: "warn", title: tr("차트를 찾을 수 없음", "Chart not found"), body: "sat-curve-chart" });
      return;
    }
    const safeName = String(selName).replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    downloadChartAsPNG(chartRef.current, `sat_curve_${safeName}_${effectiveMetric}`);
  };

  return (
    <ToolPageShell
      locale={locale}
      title={tr("마케팅 효율 진단 (Saturation)", "Marketing Efficiency Diagnosis (Saturation)")}
      chips={<span className="chip"><span className="dot"></span>{csvData?.fileName || ""}</span>}
      summary={
        <>
          <p>{tr(
            `지금 더 늘릴 곳과 멈출 곳을 한계 ${costMetricLabel}/ROAS로 나눕니다.`,
            `Separate where to scale from where to stop using marginal ${costMetricLabel}/ROAS.`,
          )}</p>
          <details style={{ marginTop: "6px", fontSize: "11.5px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <summary>{tr("⚠️ 해석 참고", "⚠️ Interpretation notes")}</summary>
            <div style={{ marginTop: "6px", padding: "8px 10px", background: "var(--bg-1)", borderLeft: "3px solid var(--primary)", lineHeight: 1.6 }}>
              {tr(
                `포화지수 = 한계 ${costMetricLabel} ÷ 평균 ${costMetricLabel}(ROAS는 평균 ÷ 한계). 1보다 크면 다음 1원이 평균보다 비싸다는 뜻. 관측 범위 밖 외삽은 불안정하므로, 지출 변동이 거의 없는 채널의 곡선은 신뢰도가 낮습니다.`,
                `Saturation index = marginal ${costMetricLabel} ÷ average ${costMetricLabel} (for ROAS, average ÷ marginal). Above 1 means the next dollar costs more than average. Extrapolation beyond the observed range is unstable, so curves for channels with little spend variation are less reliable.`
              )}
            </div>
          </details>
        </>
      }
      toc={analyzed && okRows.length ? buildSatToc(tr) : undefined}
      stickyFilter={<AnalysisControlBar title={tr("표시 기준", "Display settings")} hint={tr("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>}
    >
      {/* 데이터 매핑은 결과 범위 제어와 다른 작업이다. sticky 헤드 밖에서 필요할 때만 연다. */}
      <details className="block analysis-data-mapping" open={!analyzed}>
        <summary>
          {tr("데이터·매핑", "Data & mapping")} {analyzed ? tr("— 변경하기", "— change") : tr("— 확인 후 분석", "— check before analysis")}
        </summary>
        <div className="analysis-data-mapping__body">
          <CsvUploader toolId="5-22" locale={locale} />
          <div className="analysis-data-mapping__footer">
            <button className="ab-pill" onClick={() => downloadSatTemplateCsv("5-22")}>
              {tr("템플릿 CSV 받기", "Download template CSV")}
            </button>
            <span>{tr("효율 CSV는 대시보드·예산 배분과 공유합니다.", "This efficiency CSV is shared with Dashboard and Budget Allocation.")}</span>
          </div>
        </div>
      </details>
      {!analyzed ? (
        <section className="block" id="s-sat-gate">
          <div className="callout" style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <div className="ico">▶</div>
            <div className="body">
              <strong>{tr("분석 대기 중", "Waiting to analyze")}</strong>
              <p style={{ margin: "4px 0 0" }}>{tr(
                <>위 &quot;데이터·매핑&quot;에서 컬럼 매핑을 확인한 뒤 <strong>▶ 분석하기</strong>를 누르면 포화도 진단 결과가 나타납니다.</>,
                <>Check the column mapping in &quot;Data &amp; mapping&quot; above, then click <strong>▶ Analyze</strong> to see the saturation diagnosis.</>
              )}</p>
            </div>
          </div>
        </section>
      ) : (
      <>
      <section className="block" id="s-sat-summary">
        <h2 className="section-title">{tr("한눈에 보기", "At a glance")}</h2>
        <ResultActionCard
          toolId="5-22"
          analysisType="saturation"
          resultState={okRows.length ? "ready" : "insufficient"}
          locale={locale}
          decisionReview={Boolean(okRows.length)}
          decisionPrefill={decisionTarget ? {
            conclusion: stripHtmlTags(head),
            action: saturatedCandidate && scaleCandidate
              ? tr(
                `${saturatedCandidate.name}의 추가 예산 일부를 ${scaleCandidate.name}으로 소규모 이동 시험한다`,
                `Run a small controlled shift of incremental budget from ${saturatedCandidate.name} to ${scaleCandidate.name}`,
              )
              : scaleCandidate
                ? tr(`${scaleCandidate.name} 예산을 소규모로 시험 증액한다`, `Run a small monitored budget increase for ${scaleCandidate.name}`)
                : tr(`${saturatedCandidate?.name || decisionTarget.name}의 증액을 보류하고 소재·타겟 한 가지를 개선한다`, `Hold further increases for ${saturatedCandidate?.name || decisionTarget.name} and improve one creative or targeting variable`),
            hypothesis: scaleCandidate
              ? tr(
                `관측 범위 모델상 ${decisionTarget.name}의 한계 ${metricLabel}이 현재 평균 대비 유리한 방향을 유지할 것이다`,
                `Within the observed-range model, ${decisionTarget.name}'s marginal ${metricLabel} should remain favorable versus its current average`,
              )
              : tr(
                `추가 증액을 멈추고 한 가지 운영 변수를 개선하면 ${metricLabel} 악화가 완화될 것이다`,
                `Holding further spend increases and improving one operating variable should reduce the ${metricLabel} deterioration`,
              ),
            metric: metricLabel,
            baseline: isRoas ? fmtRoas(decisionTarget.roas?.avgRoas) : fmtCurrency(decisionTarget.avgCpr, currency, { metric: true }),
            sourcePeriod: decisionSourcePeriod,
            reviewQuestion: tr(
              `시험 후 실제 ${metricLabel}이 기준값을 유지하거나 개선했는가?`,
              `After the test, did actual ${metricLabel} hold or improve from the baseline?`,
            ),
          } : null}
          tone={!okRows.length ? "bad" : sat.length ? "bad" : scale.length ? "good" : "neutral"}
          title={tr("포화도 결론", "Saturation conclusion")}
          headline={stripHtmlTags(head)}
          workbookExport={() => ({
            calculationMode: "hybrid_engine_output",
            calculationTables: [{
              name: "SATURATION_DIAGNOSTICS",
              title: tr("대상별 포화도 진단", "Saturation diagnostics by entity"),
              note: tr("곡선 적합·한계효율은 엔진 출력이고 포화지수는 수식", "Curve fit and marginal efficiency are engine outputs; the saturation index is a formula"),
              rows: [
                ["entity", "observations", "model", "r_squared_engine", "current_daily_cost", "average_efficiency_engine", "marginal_efficiency_engine", "saturation_index", "verdict_engine"],
                ...okRows.map((row, index) => {
                  const excelRow = index + 2;
                  const average = isRoas ? row.roas?.avgRoas : row.avgCpr;
                  const marginal = isRoas ? row.roas?.marginalRoas : row.marginalCpr;
                  return [
                    row.name, row.raw || row.n || 0, row.modelType || "", row.r2 ?? "", row.currentCost || 0,
                    Number.isFinite(average) ? average : "",
                    Number.isFinite(marginal) ? marginal : "",
                    { formula: isRoas ? `=IFERROR(F${excelRow}/G${excelRow},0)` : `=IFERROR(G${excelRow}/F${excelRow},0)` },
                    satActiveVerdict(row, effectiveMetric) || "",
                  ];
                }),
              ],
            }],
            method: {
              name: "saturation-curve-fit",
              version: "sat-v1",
              assumptions: [tr("평균·한계효율은 선택한 분석 단위와 관측 지출 범위 기준입니다.", "Average and marginal efficiency follow the selected grain and observed spend range.")],
              limitations: [tr("곡선 적합은 워크북에서 재학습되지 않으며 인과효과가 아닙니다.", "The curve is not refit in the workbook and is not a causal effect.")],
            },
          })}
          download={(
            <DownloadHub
              toolId="5-22"
              locale={locale}
              label={tr("실행 정보", "Run details")}
              manifest={buildResultManifest({
                toolId: "5-22",
                mode: effectiveMetric,
                source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
                inputSignature: `${csvData?.fileName || "dataset"}|${csvData?.raw?.length || 0}`,
                filter: { grain: effectiveGrain, metric: effectiveMetric },
                grain: effectiveGrain,
                metricDefinitions: [{ key: effectiveMetric, aggregation: "custom" }],
                engineVersion: "sat-v1",
                status: okRows.length ? "COMPLETE" : "ABSTAIN",
                warnings: ["Observed-range marginal efficiency is not causal incrementality"],
              })}
            />
          )}
          points={[{ text: advice, cls: !okRows.length || sat.length ? "bad" : scale.length ? "good" : "muted" }]}
          stats={[
            { label: tr("분석 가능", "Analyzable"), value: `${okRows.length}/${rows.length}` },
            { label: tr("포화", "Saturated"), value: sat.length },
            { label: tr("여유", "Headroom"), value: scale.length },
          ]}
          analysisDetails={(
            <AnalysisDetails
              locale={locale}
              statusLabel={okRows.length ? tr("관측 범위 내 참고", "In-range reference") : tr("판정 보류", "Abstain")}
              statusTone={!okRows.length || badRows.length ? "warning" : "neutral"}
              metric={metricLabel}
              unit={effectiveMetric === "roas" ? "ratio" : "currency / result"}
              meaning={tr("비용-성과 곡선의 관측 범위 내 한계효율 참고값이며 인과효과가 아닙니다.", "An in-range marginal-efficiency reference from the cost-performance curve; not a causal effect.")}
              sampleSize={{ value: rows.reduce((sum, row) => sum + (row.raw || 0), 0), label: tr("관측 행", "Observed rows"), detail: tr(`${grainLabel}별 최소 ${SAT_CONFIG.minPoints}개 관측 필요`, `At least ${SAT_CONFIG.minPoints} observations per ${grainLabel} are required`) }}
              method="saturation-curve-fit"
              version="sat-v1"
              metricDefinition={tr(`${costMetricLabel}는 Cost/성과, ROAS는 Revenue/Cost 기준입니다.`, `${costMetricLabel} uses Cost/results; ROAS uses Revenue/Cost.`)}
              warnings={[
                ...(badRows.length ? [tr(`${badRows.length}개 대상은 표본·변동성 부족으로 판정에서 제외됐습니다.`, `${badRows.length} target(s) were excluded because of insufficient sample or variation.`)] : []),
                tr("관측 지출 범위 밖의 외삽은 추천 근거로 사용하지 않습니다.", "Extrapolation beyond observed spend is not used as recommendation evidence."),
              ]}
            />
          )}
        />
      </section>

      <section className="block" id="s-sat">
        <h2 className="section-title">{tr("포화도 순위", "Saturation ranking")}</h2>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("분석 단위", "Analysis unit")}</span>
            <button
              className="ab-pill"
              style={effectiveGrain === "channel" ? activeStyle : {}}
              onClick={() => setSatState(s => ({...s, grain: "channel", selected: null}))}
            >
              {tr("채널", "Channel")}
            </button>
            <button
              className="ab-pill"
              disabled={!hasCampaign}
              style={{ ...(effectiveGrain === "campaign" ? activeStyle : {}), opacity: !hasCampaign ? 0.4 : 1, cursor: !hasCampaign ? "not-allowed" : "pointer" }}
              onClick={() => setSatState(s => ({...s, grain: "campaign", selected: null}))}
            >
              {tr("캠페인", "Campaign")}
            </button>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("효율 기준", "Efficiency metric")}</span>
            <button
              className="ab-pill"
              style={effectiveMetric === "cpa" ? activeStyle : {}}
              onClick={() => setSatState(s => ({...s, metric: "cpa"}))}
            >
              {tr(`${costMetricLabel} (낮을수록 좋음)`, `${costMetricLabel} (lower is better)`)}
            </button>
            <button
              className="ab-pill"
              disabled={!revField}
              style={{ ...(effectiveMetric === "roas" ? activeStyle : {}), opacity: !revField ? 0.4 : 1, cursor: !revField ? "not-allowed" : "pointer" }}
              onClick={() => setSatState(s => ({...s, metric: "roas"}))}
            >
              {tr("ROAS (높을수록 좋음)", "ROAS (higher is better)")}
            </button>
          </div>
          {/* 비활성 사유를 title에만 두면 터치·키보드에서 알 수 없다(product-ssot §5.4 · D-04). */}
          <BlockedOptionsNote items={[
            { label: tr("캠페인", "Campaign"), reason: !hasCampaign ? tr("campaign_name 컬럼을 매핑하면 활성화", "map the campaign_name column to enable") : "" },
            { label: "ROAS", reason: !revField ? tr("revenue 컬럼을 매핑하면 활성화", "map the revenue column to enable") : "" },
          ]} />
        </div>

        {okRows.length > 0 && (
          <div className="table-wrap">
            <table className="data" style={{ fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th className="tnum">#</th>
                  <th>{effectiveGrain === "campaign" ? tr("캠페인", "Campaign") : tr("채널", "Channel")}</th>
                  <th>{tr("적합 모델", "Fitted model")}</th>
                  <th className="tnum">{tr("최근 일예산", "Recent daily budget")}</th>
                  {isRoas ? (
                    <><th className="tnum">{tr("평균 ROAS", "Avg ROAS")}</th><th className="tnum">{tr("한계 ROAS", "Marginal ROAS")}</th></>
                  ) : (
                    <><th className="tnum">{tr(`평균 ${costMetricLabel}`, `Avg ${costMetricLabel}`)}</th><th className="tnum">{tr(`한계 ${costMetricLabel}`, `Marginal ${costMetricLabel}`)}</th></>
                  )}
                  <th className="tnum" title={tr("한계효율 ÷ 평균효율. 1보다 크면 다음 1원이 평균보다 비쌈", "Marginal efficiency ÷ average efficiency. Above 1 means the next dollar costs more than average")}>{tr("포화지수", "Saturation index")}</th>
                  <th>{tr("판정", "Verdict")}</th>
                </tr>
              </thead>
              <tbody>
                {okRows.map((r, i) => {
                  const v = satActiveVerdict(r, effectiveMetric);
                  const vm = trVerdictMeta(satVerdictMeta(v), tr);
                  const idx = satActiveIndex(r, effectiveMetric);
                  const idxStr = idx == null || !isFinite(idx) || idx === 1e9 ? "∞" : `${idx.toFixed(2)}x`;
                  const sel = satState.selected === r.name || (!satState.selected && i === 0);

                  return (
                    <tr
                      key={r.name}
                      onClick={() => setSatState(s => ({...s, selected: r.name}))}
                      style={{ cursor: "pointer", background: sel ? "rgba(122,162,247,0.08)" : "transparent" }}
                      title={tr("클릭 → 응답곡선 보기", "Click → view response curve")}
                    >
                      <td className="tnum" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td><strong>{r.name}</strong></td>
                      <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {r.modelType} <span className="tnum">R²={r.r2 != null ? r.r2.toFixed(2) : "—"}</span>
                      </td>
                      <td className="tnum">{fmtCurrency(r.currentCost, currency)}</td>
                      {isRoas ? (
                        <>
                          <td className="tnum">{fmtRoas(r.roas?.avgRoas)}</td>
                          <td className="tnum">{fmtRoas(r.roas?.marginalRoas)}</td>
                        </>
                      ) : (
                        <>
                          <td className="tnum">{fmtCurrency(r.avgCpr, currency, { metric: true })}</td>
                          <td className="tnum">{isFinite(r.marginalCpr) ? fmtCurrency(r.marginalCpr, currency, { metric: true }) : "∞"}</td>
                        </>
                      )}
                      <td className="tnum" style={{ fontWeight: 700, color: vm.color }}>{idxStr}</td>
                      <td>
                        <span className="chip" style={{ fontSize: "11px", padding: "2px 8px", color: vm.color, borderColor: `color-mix(in srgb, ${vm.color} 33%, transparent)` }}>
                          <span className="dot" style={{ background: vm.color }}></span>{vm.label}
                        </span>{" "}
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{vm.advice}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {badRows.length > 0 && (
          <details style={{ marginTop: "10px" }}>
            <summary style={{ cursor: "pointer", fontSize: "11.5px", color: "var(--text-muted)" }}>
              {tr(`⚠ 분석 제외 ${badRows.length}개 — 보기`, `⚠ ${badRows.length} excluded from analysis — view`)}
            </summary>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", lineHeight: 1.7 }}>
              {badRows.map((r, i) => {
                const why =
                  r.reason === "insufficient"
                    ? tr(`관측 ${r.raw || r.n || 0}개 (최소 ${SAT_CONFIG.minPoints} 필요)`, `${r.raw || r.n || 0} observations (needs at least ${SAT_CONFIG.minPoints})`)
                    : r.reason === "out_of_range"
                      ? tr("곡선이 현 지출점에서 음수/비정상", "Curve is negative/abnormal at the current spend point")
                      : r.reason === "nofit"
                        ? tr("곡선 적합 실패", "Curve fitting failed")
                        : effectiveMetric === "roas"
                          ? tr("매출 데이터 없음", "No revenue data")
                          : tr("분석 불가", "Cannot analyze");
                return <div key={i}>• <strong>{r.name}</strong> — {why}</div>;
              })}
            </div>
          </details>
        )}
      </section>

      {okRows.length > 0 && (
        <section className="block" id="s-sat-curve">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {tr("응답곡선", "Response curve")} — {selName}
            </h2>
            <button
              className="ab-pill"
              onClick={handlePngDownload}
              title={tr("이 차트를 PNG로 다운로드 (테마 배경 합성)", "Download this chart as PNG (composited with theme background)")}
            >
              {tr("⬇ PNG", "⬇ PNG")}
            </button>
          </div>
          <p className="muted" style={{ fontSize: "12px", marginTop: "6px" }}>
            {tr(
              `위 표에서 행을 클릭하면 해당 ${grainLabel}의 곡선으로 바뀝니다. 점=일별 관측(비용 vs ${metricLabel}), 선=적합 곡선, 주황 점선=현 지출점.`,
              `Click a row above to switch to that ${grainLabel}'s curve. Dots = daily observations (cost vs ${metricLabel}), line = fitted curve, orange dashed line = current spend point.`
            )}
          </p>
          {isRoas && (
            <p className="muted" style={{ fontSize: "11.5px", marginTop: "2px", color: "var(--text-muted)" }}>
              {tr(
                "⚠ ROAS 곡선은 CPA 적합 곡선을 매출/결과 비율로 역변환한 값입니다(직접 적합 아님). 매출 데이터가 희소하거나 결과당 매출 변동이 크면 곡선 신뢰도가 낮아질 수 있습니다.",
                "⚠ The ROAS curve is derived by inverting the fitted CPA curve using the revenue/result ratio (not fitted directly). If revenue data is sparse or revenue-per-result varies a lot, the curve's reliability may be lower."
              )}
            </p>
          )}
          <div className="chart-container" style={{ height: "300px" }}>
            <canvas ref={chartRef}></canvas>
          </div>
        </section>
      )}
      </>
      )}
    </ToolPageShell>
  );
}
