"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { allocResponseCurve, isAllocCurveSegmentEstimated } from "@/utils/allocResponseCurve";
import { getMappedRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import CsvUploader from "@/components/CsvUploader";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import AnalysisControlBar from "@/components/dashboard/AnalysisControlBar";
import ToolPageShell from "@/components/ToolPageShell";
import ResultActionCard from "@/components/ds/ResultActionCard";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { showToast } from "@/utils/toast";
import {
  getRowGroupKey,
  allocParseNum,
  allocFmtNum,
  calcChannelHistorySummary,
  calculateAllocationModeC,
  calculateAllocationModeB,
  computeAllocSummary,
  computeAllocScenarios,
  getAllocationEvidenceLimits,
  buildAllocationFrontier,
  isAllocationFullyFunded,
  selectBudgetForTarget,
} from "@/utils/budgetAllocTool";

const CHART_THEME = {
  get text() { return getCssVar("--text-muted") || "#6B7280"; },
  get textPrimary() { return getCssVar("--text-primary") || "#F9FAFB"; },
  get muted() { return getCssVar("--text-muted") || "#6B7280"; },
  get grid() { return getCssVar("--border-subtle") || "rgba(255,255,255,0.06)"; },
  get border() { return getCssVar("--border") || "rgba(255,255,255,0.08)"; },
  get primary() { return getCssVar("--chart-primary") || "#8fb1ff"; },
  get primaryContainer() { return getCssVar("--primary") || "#4d8eff"; },
  get secondary() { return getCssVar("--chart-secondary") || "#77dcaa"; },
  get series() {
    return [
      this.primary,
      this.secondary,
      getCssVar("--chart-tertiary") || "#ffc56e",
      getCssVar("--chart-accent") || "#ff8d7e",
      "#a78bfa",
      "#2dd4bf",
      "#fb923c",
      "#f472b6",
    ];
  },
  get surface() { return getCssVar("--bg-1") || "#0d0e0f"; },
};

const CURRENCY_SYMBOLS = { KRW: "₩", USD: "$" };

/* objective → 내부 metric 매핑 + 라벨/방향 (index.html ALLOC_OBJECTIVES 이식) */
const ALLOC_OBJECTIVES = {
  install: { metric: "installs", label: "Install · CPI 최적화", short: "CPI", arrow: "↓", desc: "낮을수록 긍정 (싸게 설치 1개)" },
  action: { metric: "actions", label: "Action · CPA 최적화", short: "CPA", arrow: "↓", desc: "낮을수록 긍정 (싸게 액션 1개)" },
  roas: { metric: "revenue_d7", label: "Revenue · ROAS 최적화", short: "ROAS", arrow: "↑", desc: "높을수록 긍정 (Revenue/Cost)" },
};
const ALLOC_OBJECTIVES_EN = {
  install: { metric: "installs", label: "Install · CPI optimization", short: "CPI", arrow: "↓", desc: "Lower is better (cheaper per install)" },
  action: { metric: "actions", label: "Action · CPA optimization", short: "CPA", arrow: "↓", desc: "Lower is better (cheaper per action)" },
  roas: { metric: "revenue_d7", label: "Revenue · ROAS optimization", short: "ROAS", arrow: "↑", desc: "Higher is better (Revenue/Cost)" },
};

/* 이상치 제거 강도 → numeric 임계값 (index.html OUTLIER_STRENGTH 이식) */
const OUTLIER_STRENGTH = {
  iqr: { standard: 1.5, strong: 1.0, very_strong: 0.5 },
  modz: { standard: 3.5, strong: 2.5, very_strong: 2.0 },
};
function getOutlierOpts(method, strength) {
  if (method === "iqr") return { iqrMult: OUTLIER_STRENGTH.iqr[strength] ?? 1.5 };
  if (method === "modz") return { modzThreshold: OUTLIER_STRENGTH.modz[strength] ?? 3.5 };
  return {};
}

/* index.html fmtCurrency 이식 — 통화 토글은 기호/소수 자리수만 바꿈(FX 변환 없음:
   CSV 값은 이미 특정 통화 기준이라 relabel만이 정직). USD는 전역 slider의 센트와
   목표 KPI가 0으로 뭉개지지 않게 최대 소수 둘째 자리까지 보존한다. */
function fmtCurrency(value, currency, opts = {}) {
  if (value == null || isNaN(value) || !isFinite(value)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] || "₩";
  const isUSD = currency === "USD";
  const minimumFractionDigits = isUSD && opts.metric ? 1 : 0;
  const maximumFractionDigits = isUSD ? 2 : 0;
  return `${sym}${Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
}

function isRoasMetric(metric) {
  return metric === "revenue_d7";
}
/* 내부 CPR(cost/result)을 표시용 값으로: ROAS면 1/CPR(=매출/비용), 아니면 CPR 그대로. */
function fmtCostMetric(cprValue, metric, currency) {
  if (cprValue == null || !isFinite(cprValue)) return "—";
  if (isRoasMetric(metric)) {
    const roas = cprValue > 0 ? 1 / cprValue : null;
    return roas == null ? "—" : (roas * 100).toFixed(1) + "%";
  }
  return fmtCurrency(cprValue, currency, { metric: true });
}

// 목표 입력값은 내부 CPR가 아니라 사용자가 읽는 CPI/CPA/ROAS 값이다.
function fmtGoalMetric(value, metric, currency) {
  if (value == null || !isFinite(value)) return "—";
  if (isRoasMetric(metric)) return `${(value * 100).toFixed(1)}%`;
  return fmtCurrency(value, currency, { metric: true });
}

function formatBudgetInput(value, currency) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (currency === "USD") {
    return parsed.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }
  return allocFmtNum(parsed);
}

function sanitizeBudgetInput(value, currency) {
  if (currency !== "USD") return String(value).replace(/[^\d,]/g, "");
  const [whole = "", ...fractionParts] = String(value)
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "")
    .split(".");
  return fractionParts.length ? `${whole}.${fractionParts.join("").slice(0, 2)}` : whole;
}

function getMetricUnitLabel(metric, locale = "ko") {
  const en = locale === "en";
  if (metric === "installs") return en ? "install" : "설치";
  if (metric === "actions") return en ? "action" : "액션";
  if (metric === "pu_d7") return en ? "purchase" : "결제";
  if (metric === "revenue_d7") return en ? "revenue" : "매출";
  return en ? "result" : "결과";
}

function getCostMetricLabel(metric) {
  if (metric === "installs") return "CPI";
  if (metric === "actions") return "CPA";
  if (metric === "pu_d7") return "CPA";
  if (metric === "revenue_d7") return "ROAS";
  return "CPR";
}

/* 내부 CPR → 표시용 metric 값. ROAS면 1/CPR(배수), 아니면 CPR 그대로. */
function displayMetricValue(cprValue, metric) {
  if (cprValue == null || !isFinite(cprValue)) return null;
  if (isRoasMetric(metric)) return cprValue > 0 ? 1 / cprValue : null;
  return cprValue;
}

function formatNumberK(n, decimals = 0) {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return Number(n).toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* 채널 적합 신뢰도(High/Med/Low) — R²(적합 품질) + 데이터 점 수 기반. Bayesian posterior가
   아니라 "적합 품질·데이터 커버리지" 기준임을 라벨/툴팁으로 정직히 고지(§8). wrapper=fitChannel 결과. */
function allocConfidence(wrapper) {
  if (!wrapper || !wrapper.model) return null;
  const r2 = Number(wrapper.r2);
  const n = wrapper.kept ? wrapper.kept.length : 0;
  if (!isFinite(r2) || n < 3) return { level: "low", ko: "낮음", en: "Low", r2, n };
  if (r2 >= 0.7 && n >= 6) return { level: "high", ko: "높음", en: "High", r2, n };
  if (r2 >= 0.4) return { level: "med", ko: "보통", en: "Med", r2, n };
  return { level: "low", ko: "낮음", en: "Low", r2, n };
}

/* 한계 CPR — 현 배분 지출점에서 +10% 늘렸을 때 추가 1건당 비용(Δcost/Δresults). predictSafeCpr(CPR
   공간) 재사용. 수확체감으로 추가 결과가 없으면 Infinity(한계효용 ≤ 0) → 표시층 "—". */
function allocMarginalCpr(wrapper, cost) {
  if (!wrapper || !(cost > 0)) return null;
  const c2 = cost * 1.1;
  const cpr1 = ALLOC_MATH.predictSafeCpr(wrapper, cost);
  const cpr2 = ALLOC_MATH.predictSafeCpr(wrapper, c2);
  if (!(cpr1 > 0) || !(cpr2 > 0)) return null;
  const r1 = cost / cpr1;
  const r2v = c2 / cpr2;
  if (!(r2v > r1)) return Infinity;
  return (c2 - cost) / (r2v - r1);
}

/* 채널별 (cost, CPR=cost/result) 포인트 맵. cost>0 & result>0만.
   이 도구는 creative/adgroup 분해를 하지 않으므로, CSV가 하위 grain이면 사용 grain(unit)×날짜로
   먼저 sum 후 점 1개 생성 (per-row 점 = creative 단위로 찍히는 버그 방지). */
function buildByChannel(rows, unit, metric) {
  const agg = new Map(); // ch -> Map(dateKey -> {cost, res, date})
  for (const r of rows) {
    const ch = getRowGroupKey(r, unit);
    if (!ch) continue;
    const cost = Number(r.cost) || 0;
    const res = Number(r[metric]) || 0;
    const dateKey = r.date != null && r.date !== "" ? String(r.date) : "__nodate__";
    if (!agg.has(ch)) agg.set(ch, new Map());
    const byDate = agg.get(ch);
    if (!byDate.has(dateKey)) byDate.set(dateKey, { cost: 0, res: 0, date: r.date });
    const e = byDate.get(dateKey);
    e.cost += cost;
    e.res += res;
  }
  const m = new Map();
  for (const [ch, byDate] of agg) {
    const pts = [];
    for (const e of byDate.values()) {
      if (e.cost <= 0 || e.res <= 0) continue; // 합산 후 필터
      pts.push({ x: e.cost, y: e.cost / e.res, date: e.date });
    }
    if (pts.length) m.set(ch, pts);
  }
  return m;
}

/* 채널 포인트 → outlier 제거 + (최근 가중치) → fitBest → wrapper.
   index.html getCachedModels 이식. adv = {trendType, outlierMethod, outlierStrength, weightMode, halfLifeDays}.
   trendType="auto"면 R² 최적, 아니면 지정 타입 강제 적합. */
const TREND_TYPE_LABEL = { linear: "Linear", log: "Log", poly2: "Poly2", power: "Power" };
function fitChannel(pts, adv) {
  const method = adv?.outlierMethod ?? "iqr";
  const outOpts = getOutlierOpts(method, adv?.outlierStrength ?? "standard");
  const { kept } = ALLOC_MATH.removeOutliers(pts, method, outOpts);
  if (!kept || kept.length < 2) return null;
  const trainData = kept.map((p) => [p.x, p.y]);
  const dates = kept.map((p) => p.date);
  const datesParsed = dates.map((d) => (d ? Date.parse(d) : NaN)).filter((t) => !isNaN(t));
  const maxDate = datesParsed.length ? Math.max(...datesParsed) : null;
  const weights =
    adv && adv.weightMode && adv.weightMode !== "none" && maxDate
      ? ALLOC_MATH.calcDateWeights(dates, adv.weightMode, maxDate, adv.halfLifeDays ?? 30)
      : null;
  const wt = adv?.trendType && adv.trendType !== "auto" ? adv.trendType : "auto";
  let model = null;
  if (wt === "auto") {
    model = ALLOC_MATH.fitBest(trainData, weights);
  } else {
    // 지정 타입 강제: fitBest는 auto라 개별 fit 후 wrapper 필요 → fitBest로 뽑고 type 검사
    const best = ALLOC_MATH.fitBest(trainData, weights);
    model = best && best.type === TREND_TYPE_LABEL[wt] ? best : (ALLOC_MATH[`fit${TREND_TYPE_LABEL[wt]}`] ? ALLOC_MATH[`fit${TREND_TYPE_LABEL[wt]}`](trainData, weights) : best);
  }
  if (!model) return null;
  const xs = kept.map((p) => p.x);
  return {
    model,
    kept,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    poly2Shape: ALLOC_MATH.detectPoly2Shape(model),
    // 적합도 R² — fitBest는 이미 model.r2를 붙이지만, 단일 trendType 오버라이드 경로의
    // fit*는 r2가 없으므로 kept로 보강(신뢰 칩·P3용). 순수엔진 불변, wrapper에만 노출.
    r2: model.r2 != null ? model.r2 : ALLOC_MATH.calcR2(kept, model),
  };
}
export function buildAllocationModels(byChannel, adv, modelOverrides = {}) {
  const models = new Map();
  for (const [ch, pts] of byChannel) {
    const selectedTrendType = modelOverrides[ch];
    models.set(
      ch,
      fitChannel(
        pts,
        selectedTrendType ? { ...adv, trendType: selectedTrendType } : adv,
      ),
    );
  }
  return models;
}

/* 산점도(점+추세선) Chart.js datasets 빌더 — Step2(단일 단위) · Step3(다중 채널) 공유.
   index.html renderAllocatorScatter 이식(§7 render-throw는 주입식 harness 대신 두 호출부 모두 이 함수를 거치므로
   여기서 한 번만 검증하면 됨). perAdv(ch)로 채널/단위별 trendType override를 줄 수 있음(Step2 개별 모델 선택). */
export function buildScatterDatasets(channels, byCh, adv, { hidePoints, normalizeMode: nmode, perAdv, colorOf, isRoas = false } = {}) {
  const datasets = [];
  const trendInfo = [];
  channels.forEach((ch, i) => {
    const pts = byCh.get(ch) || [];
    if (pts.length < 2) return;

    const color = colorOf ? colorOf(ch, i) : CHART_THEME.series[i % CHART_THEME.series.length];
    const chAdv = perAdv ? perAdv(ch) : adv;

    const fit = fitChannel(pts, chAdv);
    const kept = fit ? fit.kept : pts;
    if (kept.length < 2) return;

    // 엔진은 모든 목표를 내부 CPR(cost/result) 공간에서 적합한다. ROAS 목표의
    // 화면만 Revenue/Cost로 역변환해야 축 라벨(높을수록 좋음)과 점의 방향이 맞는다.
    const displayPoints = isRoas
      ? kept.map((p) => ({ ...p, y: p.y > 0 ? 1 / p.y : NaN }))
      : kept;
    const nctx = ALLOC_MATH.calcNormContext(displayPoints, nmode);
    const norm = (x, y) => ALLOC_MATH.normalizeXY(x, y, nmode, nctx);

    if (!hidePoints) {
      const ptData = displayPoints
        .map((p) => norm(p.x, p.y))
        .filter((v) => v && isFinite(v.x) && isFinite(v.y));
      datasets.push({
        label: `${ch} (Points)`,
        data: ptData,
        backgroundColor: color,
        borderColor: CHART_THEME.surface,
        borderWidth: 1.5,
        pointRadius: 5,
        pointStyle: "circle",
        showLine: false,
      });
    }

    if (fit && fit.model) {
      const { model, xMin, xMax } = fit;
      const trendPts = [];
      const steps = 50;
      const stepSize = (xMax - xMin) / steps;
      for (let j = 0; j <= steps; j++) {
        const x = xMin + j * stepSize;
        const rawY = model.predict(x);
        const y = isRoas && rawY > 0 ? 1 / rawY : rawY;
        if (isFinite(y) && y > 0) {
          const nv = norm(x, y);
          if (nv && isFinite(nv.x) && isFinite(nv.y)) trendPts.push(nv);
        }
      }
      datasets.push({
        label: `${ch} · ${model.type}`,
        data: trendPts,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        type: "line",
        fill: false,
        tension: 0,
        showLine: true,
      });
      trendInfo.push({ ch, model, fit });
    } else {
      trendInfo.push({ ch, model: null, fit: null });
    }
  });
  return { datasets, trendInfo };
}

/* multi-select Set 토글 (전체=null). value 클릭 시 add/remove, 전부 선택되면 null(=전체)로 정규화. */
function toggleInSet(prev, value, allValues) {
  const cur = prev ? new Set(prev) : new Set(allValues);
  if (cur.has(value)) cur.delete(value);
  else cur.add(value);
  if (cur.size === 0) return new Set(); // 명시 0개 (전체와 구분)
  if (cur.size === allValues.length) return null; // 전체 → null
  return cur;
}

// ── ★2 Step3 빠른 필터 바 — 드롭다운(전체 포함) + [적용] ────────────────────
// 요약칩(읽기전용)을 인라인 드롭다운으로 교체. draft 로컬 상태라 드롭다운을 바꿔도
// [적용] 누르기 전엔 결과가 안 변함(step3 재계산 X). 적용 시 부모 applyFiltersWith가
// 시그 비교 → 바뀌었으면 재검증(Step2), 안 바뀌었으면 그대로 유지(★1). 컴포넌트라
// step3 재진입마다 draft가 현재 applied 값으로 리셋(effect 불필요).
function AllocQuickFilterBar({ applied, filterOptions, objectives, onApply, locale = "ko" }) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const toSel = (v) => (v == null ? "__all__" : [...v][0] || "__all__");
  const [objective, setObjective] = useState(applied.objective);
  const [unitField, setUnitField] = useState(applied.unitField);
  const [country, setCountry] = useState(toSel(applied.countries));   // "__all__" | 단일국가
  const [channel, setChannel] = useState(toSel(applied.channels));    // "__all__" | 단일채널
  const [platform, setPlatform] = useState(applied.platform);

  const singleCountry = unitField === "channel" || unitField === "campaign_name";
  const selStyle = { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", color: "var(--text-1)", fontWeight: 600 };
  const lbl = { fontSize: "11px", color: "var(--text-muted)" };

  const apply = () => {
    const countries = country === "__all__" ? null : new Set([country]);
    const channels = channel === "__all__" ? null : new Set([channel]);
    onApply({ objective, unitField, countries, channels, platform });
  };
  const dirty = objective !== applied.objective || unitField !== applied.unitField
    || country !== toSel(applied.countries) || channel !== toSel(applied.channels) || platform !== applied.platform;

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", marginTop: "10px", fontSize: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      <span style={lbl}>🎯 {tr("목표", "Goal")}</span>
      <select style={selStyle} value={objective || ""} onChange={(e) => setObjective(e.target.value)}>
        {Object.entries(objectives).map(([k, o]) => <option key={k} value={k}>{o.short} {o.arrow}</option>)}
      </select>
      <span style={lbl}>{tr("단위", "Unit")}</span>
      <select style={selStyle} value={unitField} onChange={(e) => setUnitField(e.target.value)}>
        <option value="country">{tr("국가별", "By country")}</option>
        <option value="channel">{tr("국가 × 채널별", "Country × channel")}</option>
        <option value="campaign_name">{tr("국가 × 채널 × 캠페인별", "Country × channel × campaign")}</option>
      </select>
      {filterOptions.hasCountry && (
        <>
          <span style={lbl}>{tr("국가", "Country")}</span>
          <select style={selStyle} value={country === "__all__" && singleCountry ? (filterOptions.countries[0] || "") : country} onChange={(e) => setCountry(e.target.value)}>
            {!singleCountry && <option value="__all__">{tr("전체", "All")}</option>}
            {filterOptions.countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}
      {filterOptions.hasChannel && (
        <>
          <span style={lbl}>{tr("채널", "Channel")}</span>
          <select style={selStyle} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="__all__">{tr("전체", "All")}</option>
            {filterOptions.channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}
      {filterOptions.hasPlatform && (
        <>
          <span style={lbl}>OS</span>
          <select style={selStyle} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">{tr("전체 OS", "All OS")}</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
        </>
      )}
      <button className={`btn ${dirty ? "primary" : "secondary"}`} style={{ padding: "4px 12px", fontSize: "12px", marginLeft: "auto" }} onClick={apply}>
        {dirty ? tr("적용 (재검증)", "Apply (re-verify)") : tr("적용됨", "Applied")}
      </button>
    </div>
  );
}


export default function BudgetAllocation({ locale = "ko" } = {}) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const objI18n = locale === "en" ? ALLOC_OBJECTIVES_EN : ALLOC_OBJECTIVES;
  // 축 라벨 렌더층 로컬라이즈 — getAxisLabels(엔진, §2.1 불변)가 한국어 접미를 붙이므로
  // EN일 때만 알려진 접미 문자열을 영어로 치환(엔진·골든 불변, 표시층만).
  const localizeAxisLabels = useCallback((labels) => (locale !== "en" ? labels : {
    x: (labels.x || "").replace("· 정규화 (0~1)", "· normalized (0–1)"),
    y: (labels.y || "")
      .replace("Revenue / Cost, 높을수록 긍정", "Revenue / Cost, higher is better")
      .replace("Cost / 결과, 낮을수록 긍정", "Cost / result, lower is better")
      .replace("· 정규화 (0~1)", "· normalized (0–1)"),
  }), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  // 전역 분모 기준(설치/가입) — 효율 계열 도구(5-2/5-21/5-22/5-3)가 공유(§12.18).
  const denomBasis = useAppStore((state) => state.denomBasis);
  // 결과-먼저 착지(PRISM 뷰 P2): 데이터가 있으면 위저드(step 1)가 아니라 결과(step 3)로
  // 바로 진입한다. objective 미선택은 basis 기본값으로 폴백(effectiveObjective/metric)이라
  // allocation이 즉시 계산된다. 상세 설정(step 1)·곡선 검증(step 2)은 컨트롤 바·링크로 여전히 접근.
  const [step, setStep] = useState(3);
  const [unitField, setUnitField] = useState("channel");

  // PRISM의 단일 의사결정 입력: 총 예산 또는 효율 목표. 채널별 금액을 고정하는
  // 수동 편집기는 배분 결과를 왜곡하므로 이 화면에서는 제공하지 않는다.
  const [planningBasis, setPlanningBasis] = useState("budget"); // budget | target
  const [targetValue, setTargetValue] = useState(null);
  const [budgetPeriod, setBudgetPeriod] = useState("daily"); // daily | monthly
  const [budget, setBudget] = useState("");
  const [budgetAutoDefaulted, setBudgetAutoDefaulted] = useState(false); // 최초 진입 시 최근 일예산 합계로 1회 채움
  const [recentDays, setRecentDays] = useState(7);
  const [allocMode, setAllocMode] = useState("c"); // c | b
  // 표시 통화(₩/$) — 전역 store가 SSOT, 토글 UI는 Header뿐(도구별 중복 금지).
  const currency = useAppStore((state) => state.displayCurrency);

  // 최적화 목표 (필수) — metric을 파생. install|action|roas
  const [objective, setObjective] = useState(null);
  // 국가/채널/OS 필터 (Step 1 위저드)
  const [selectedCountries, setSelectedCountries] = useState(null); // null=전체, Set
  const [selectedChannelsFilter, setSelectedChannelsFilter] = useState(null); // null=전체, Set
  const [platformFilter, setPlatformFilter] = useState("all"); // all|android|ios

  // 고급 추세선 컨트롤 (Step 2/3 상세 설정)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [trendType, setTrendType] = useState("auto"); // auto|linear|log|poly2|power
  const [weightMode, setWeightMode] = useState("none"); // none|linear|exponential
  const [outlierMethod, setOutlierMethod] = useState("iqr"); // none|iqr|modz
  const [outlierStrength, setOutlierStrength] = useState("standard"); // standard|strong|very_strong
  const [normalizeMode, setNormalizeMode] = useState("raw"); // raw|log|minmax|robust (차트 표시 전용)
  const [hidePoints, setHidePoints] = useState(false); // 추세선만 표시
  // 차트 표시 대상 채널 (예산 분배와 무관, 차트에만). null=자동 상위6, Set=명시
  const [chartChannels, setChartChannels] = useState(null);

  // ★3 §3 상세 표 롤업 뷰 레벨. detail=finest(편집형) · country_channel · country · all(전체).
  // 분배는 항상 finest에서 계산, 롤업은 표시층 합산(레이트는 Σcost/Σresults 재계산, §8).
  const [rollupLevel, setRollupLevel] = useState("detail");

  // Step 2 검증(추세선 검증) 상태 — index.html ALLOC_STATE.verifySelectedGroup/groupModels/groupVerification 이식.
  const [verifySelectedGroup, setVerifySelectedGroup] = useState(null); // 좌측 목록에서 선택된 단위
  const [groupModels, setGroupModels] = useState({}); // { unit: "linear"|"log"|"poly2"|"power" } — 단위별 모델 override
  const [groupVerification, setGroupVerification] = useState({}); // { unit: "verified" }

  const hasData = csvData?.raw?.length > 0;

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const verifyChartRef = useRef(null);
  const verifyChartInstance = useRef(null);
  const scenarioChartRef = useRef(null);
  const scenarioChartInstance = useRef(null);
  const barChartRef = useRef(null);
  const barChartInstance = useRef(null);
  const curveChartRef = useRef(null);
  const curveChartInstance = useRef(null);
  const [curveChannel, setCurveChannel] = useState(null); // §6 반응 곡선 선택 채널

  // 매핑된 표준 필드 감지
  const mappedKeys = useMemo(
    () =>
      new Set(
        Object.values(csvData?.mapping || {}).filter(
          (v) => v && v !== "__ignore__",
        ),
      ),
    [csvData?.mapping],
  );

  // 전역 분모 기준(설치/가입) → 해석된 basis(미매핑 자동 폴백) + 매칭 objective 키.
  // 가입(actions) 기준이면 기본 목표=Action(CPA), 설치면 Install(CPI). ROAS는 명시 선택 전용.
  const effBasis = useMemo(
    () => effectiveDenomBasis(csvData, denomBasis),
    [csvData, denomBasis],
  );
  const basisObjective = effBasis === "actions" ? "action" : "install";
  // KPI는 예산/목표 모드가 공유하는 하나의 계획 기준이다. 목표 모드에서 ROAS를 고른 뒤
  // 총 예산으로 돌아왔을 때 CPI로 조용히 바뀌지 않게, 상세 필터의 objective도 같은 상태를 쓴다.
  const requestedObjective = objective || basisObjective;
  const effectiveObjective = mappedKeys.has(ALLOC_OBJECTIVES[requestedObjective]?.metric)
    ? requestedObjective
    : [basisObjective, "install", "action", "roas"].find((key) => mappedKeys.has(ALLOC_OBJECTIVES[key]?.metric)) || requestedObjective;
  const activePlanningObjective = effectiveObjective;

  // objective → metric. 미선택 시 전역 기준(설치/가입)에 맞춘 목표 metric으로 폴백.
  const metric = useMemo(() => {
    const obj = effectiveObjective && ALLOC_OBJECTIVES[effectiveObjective];
    if (obj && mappedKeys.has(obj.metric)) return obj.metric;
    // 목표 미선택 → 전역 basis 우선(가입=actions / 설치=installs)
    const basisMetric = basisObjective === "action" ? "actions" : "installs";
    if (mappedKeys.has(basisMetric)) return basisMetric;
    if (mappedKeys.has("installs")) return "installs";
    if (mappedKeys.has("actions")) return "actions";
    return "installs";
  }, [effectiveObjective, mappedKeys, basisObjective]);

  // 선택 metric이 매핑 안 됐으면 폴백 (전역 basis → installs → actions)
  const effectiveMetric = useMemo(() => {
    if (mappedKeys.has(metric)) return metric;
    const basisMetric = basisObjective === "action" ? "actions" : "installs";
    if (mappedKeys.has(basisMetric)) return basisMetric;
    if (mappedKeys.has("installs")) return "installs";
    if (mappedKeys.has("actions")) return "actions";
    return metric;
  }, [metric, mappedKeys, basisObjective]);

  const allRows = useMemo(
    () => (hasData ? getMappedRows(csvData) : []),
    [hasData, csvData],
  );

  // 필터 옵션 자동 감지 (국가/채널/OS + cascading). index.html detectAllocFilterOptions 이식.
  const filterOptions = useMemo(() => {
    const countries = new Set();
    const channels = new Set();
    const channelByCountry = new Map();
    const platforms = new Set();
    let hasCountry = false, hasChannel = false, hasPlatform = false;
    for (const r of allRows) {
      const ctry = String(r.country || "").trim();
      const ch = String(r.channel || "").trim();
      const pl = String(r.platform || "").trim().toLowerCase();
      if (ctry) { countries.add(ctry); hasCountry = true; }
      if (ch) { channels.add(ch); hasChannel = true; }
      if (pl) {
        hasPlatform = true;
        if (pl.includes("android")) platforms.add("android");
        else if (pl.includes("ios") || pl === "iphone") platforms.add("ios");
      }
      if (ctry && ch) {
        if (!channelByCountry.has(ctry)) channelByCountry.set(ctry, new Set());
        channelByCountry.get(ctry).add(ch);
      }
    }
    return {
      hasCountry, hasChannel, hasPlatform,
      countries: [...countries].sort(),
      channels: [...channels].sort(),
      channelByCountry, platforms,
    };
  }, [allRows]);

  // 채널/캠페인별은 Country×Channel grain → 국가 단일 강제(타국가 혼입 방지). index.html allocIsSingleCountryUnit.
  const isSingleCountryUnit = unitField === "channel" || unitField === "campaign_name";

  // 필터 적용된 rows. index.html getMappedRowsForAlloc 이식.
  const rows = useMemo(() => {
    let out = allRows;
    if (selectedCountries && selectedCountries.size > 0)
      out = out.filter((r) => selectedCountries.has(String(r.country || "").trim()));
    if (selectedChannelsFilter && selectedChannelsFilter.size > 0)
      out = out.filter((r) => selectedChannelsFilter.has(String(r.channel || "").trim()));
    if (platformFilter !== "all")
      out = out.filter((r) => {
        const p = String(r.platform || "").toLowerCase();
        if (platformFilter === "android") return p.includes("android");
        if (platformFilter === "ios") return p.includes("ios") || p === "iphone";
        return true;
      });
    return out;
  }, [allRows, selectedCountries, selectedChannelsFilter, platformFilter]);

  // 고급 컨트롤 묶음 (모델 재적합 트리거)
  const adv = useMemo(
    () => ({ trendType, outlierMethod, outlierStrength, weightMode, halfLifeDays: 30 }),
    [trendType, outlierMethod, outlierStrength, weightMode],
  );

  // 채널별 포인트 → 모델 → 히스토리(avgCPR) — 매핑/단위/지표/윈도우/고급 변화 시 재계산
  const byChannel = useMemo(
    () => buildByChannel(rows, unitField, effectiveMetric),
    [rows, unitField, effectiveMetric],
  );
  // Step 2에서 확정한 채널별 모델을 Step 3의 실제 분배에도 그대로 사용한다.
  // 이전에는 검증 산점도만 override를 반영해, "Linear로 확정"해도 자동 모델로
  // 예산이 계산되는 화면-계산 불일치가 있었다.
  const modelsMap = useMemo(
    () => buildAllocationModels(byChannel, adv, groupModels),
    [byChannel, adv, groupModels],
  );
  // 최근 N일 채널별 히스토리 요약 (모든 metric 동시 산출) — 진단/결론/총합계/이전평균 공유
  const historyByCh = useMemo(() => {
    const out = {};
    for (const ch of byChannel.keys()) {
      out[ch] = calcChannelHistorySummary(rows, unitField, ch, effectiveMetric, {
        recentDays,
      });
    }
    return out;
  }, [byChannel, rows, unitField, effectiveMetric, recentDays]);

  // 채널/캠페인별이면 국가를 단일로 강제(0·복수·무효 → 최고지출 국가). index.html normalizeAllocCountryFilter 이식.
  // 이벤트 기반: 단위 변경 시 호출(effect 내 setState 회피).
  const normalizeCountryForUnit = (unit, curSel) => {
    const single = unit === "channel" || unit === "campaign_name";
    if (!single || !filterOptions.hasCountry || filterOptions.countries.length <= 1) return curSel;
    const valid = curSel ? [...curSel].filter((c) => filterOptions.countries.includes(c)) : [];
    if (valid.length === 1) return new Set(valid);
    const candidates = valid.length ? valid : filterOptions.countries;
    const byC = new Map();
    for (const r of allRows) {
      const c = String(r.country || "").trim();
      if (!c || !candidates.includes(c)) continue;
      byC.set(c, (byC.get(c) || 0) + (Number(r.cost) || 0));
    }
    let best = null, bestV = -Infinity;
    for (const c of [...byC.keys()].sort()) {
      if (byC.get(c) > bestV) { bestV = byC.get(c); best = c; }
    }
    return best ? new Set([best]) : null;
  };
  // 단위 변경 핸들러 — 국가 단일 강제 반영
  const changeUnit = (u) => {
    setUnitField(u);
    setSelectedCountries((prev) => normalizeCountryForUnit(u, prev));
  };

  // ── ★1 필터 시그니처 캐시 + ★2 적용 게이트 ─────────────────────────────
  // 필터(목표·단위·국가·채널·OS)를 문자열 시그로. "적용" 눌렀을 때 시그가 이전과
  // 같으면 재검증하지 않고 확정 모델·검증 상태를 그대로 유지(안 바꿨는데 처음부터 다시
  // 검증하던 번거로움 해소). 다르면 기존대로 검증 초기화.
  const sigOf = (f) => JSON.stringify({
    objective: f.objective,
    unitField: f.unitField,
    countries: f.countries ? [...f.countries].sort() : null,
    channels: f.channels ? [...f.channels].sort() : null,
    platform: f.platform,
  });
  const currentFilter = () => ({ objective, unitField, countries: selectedCountries, channels: selectedChannelsFilter, platform: platformFilter });
  const filterSig = () => sigOf(currentFilter());
  const [appliedSig, setAppliedSig] = useState(null);   // 검증(Step2)에 진입한 필터 시그
  const [verifiedSig, setVerifiedSig] = useState(null); // 검증 완료(Step3 가능)까지 확정된 시그

  // 필터 값 f를 실제 상태에 반영 + 시그 비교. f가 이전 적용과 같으면 재검증 스킵.
  const applyFiltersWith = (f) => {
    if (!f.objective) return;
    // §12.14 국가 단일 강제 — 순수 채널별/캠페인별이면 국가 1개로 정규화.
    const nc = normalizeCountryForUnit(f.unitField, f.countries);
    const applied = { ...f, countries: nc };
    if (applied.objective !== objective) setTargetValue(null);
    setObjective(applied.objective);
    setUnitField(applied.unitField);
    setSelectedCountries(applied.countries);
    setSelectedChannelsFilter(applied.channels);
    setPlatformFilter(applied.platform);
    const sig = sigOf(applied);
    if (sig === appliedSig) {
      setStep(verifiedSig === sig ? 3 : 2); // 안 바뀜 → 검증 보존(완료했으면 바로 결과)
      return;
    }
    setGroupModels({});
    setGroupVerification({});
    setVerifySelectedGroup(null);
    setAppliedSig(sig);
    setVerifiedSig(null);
    setStep(2);
  };
  const applyFilters = () => applyFiltersWith(currentFilter()); // 위저드(Step1) 진행 버튼용

  // 일예산 환산 (월예산이면 ÷30)
  const dailyBudget = useMemo(() => {
    const raw = allocParseNum(budget) || 0;
    return budgetPeriod === "monthly" ? raw / 30 : raw;
  }, [budget, budgetPeriod]);

  // 각 곡선의 관측 최대 지출에서 전역 슬라이더의 상한을 만든다. 개별 채널에 수동
  // 상한을 입력시키지 않아도 추천안이 모델의 상단 관측값 밖으로 조용히 확장되지 않게 한다.
  const observedDailyBudget = useMemo(
    () =>
      Object.values(historyByCh).reduce(
        (sum, history) => sum + (history && Number.isFinite(history.totalCost) ? history.totalCost : 0),
        0,
      ),
    [historyByCh],
  );
  const evidenceLimits = useMemo(
    () => getAllocationEvidenceLimits({ modelsMap }),
    [modelsMap],
  );
  const budgetRange = useMemo(() => {
    const minUnit = currency === "USD" ? 0.01 : 10;
    const fallback = observedDailyBudget > 0 ? observedDailyBudget : dailyBudget;
    const max = Math.max(minUnit * 2, evidenceLimits.maxBudget || fallback || minUnit * 20);
    // 목표 달성 가능성이 작은 예산에만 있어도 frontier가 놓치지 않도록, 전역 입력의
    // 하한은 통화 최소단위로 둔다. frontier는 하단 로그 + 상단 선형 간격을 함께 쓴다.
    const min = minUnit;
    const rawStep = max / 160;
    const step =
      currency === "USD"
        ? Math.max(0.01, Math.round(rawStep * 100) / 100)
        : Math.max(10, Math.round(rawStep / 10) * 10);
    return { min, max, step, minUnit };
  }, [currency, dailyBudget, evidenceLimits.maxBudget, observedDailyBudget]);

  // CPI/CPA/ROAS 목표의 초기값은 데이터에서 읽되, 사용자가 값을 고르면 그 값을
  // 보존한다. 목표 slider는 frontier 범위 안에서만 움직여 0/무한 목표를 만들지 않는다.
  const historicalTargetValue = useMemo(() => {
    const totals = Object.values(historyByCh).reduce(
      (acc, history) => {
        if (!history) return acc;
        acc.cost += Number(history.totalCost) || 0;
        acc.installs += Number(history.totalInstalls) || 0;
        acc.actions += Number(history.totalActions) || 0;
        acc.revenue += Number(history.totalRevenue) || 0;
        return acc;
      },
      { cost: 0, installs: 0, actions: 0, revenue: 0 },
    );
    if (effectiveMetric === "revenue_d7") return totals.cost > 0 && totals.revenue > 0 ? totals.revenue / totals.cost : null;
    if (effectiveMetric === "actions") return totals.actions > 0 ? totals.cost / totals.actions : null;
    return totals.installs > 0 ? totals.cost / totals.installs : null;
  }, [historyByCh, effectiveMetric]);

  const targetFrontier = useMemo(() => {
    if (
      planningBasis !== "target" ||
      evidenceLimits.unavailableChannels.length > 0 ||
      !(evidenceLimits.maxBudget > 0)
    ) return [];
    return buildAllocationFrontier({
      modelsMap,
      minBudget: budgetRange.min,
      maxBudget: budgetRange.max,
      metric: effectiveMetric,
      mode: allocMode,
      maxSpends: evidenceLimits.maxSpends,
      extrapolateMode: "1.0",
      currency,
      historyByCh,
      steps: 49,
    });
  }, [
    planningBasis,
    evidenceLimits.unavailableChannels.length,
    evidenceLimits.maxBudget,
    evidenceLimits.maxSpends,
    modelsMap,
    budgetRange.min,
    budgetRange.max,
    effectiveMetric,
    allocMode,
    currency,
    historyByCh,
  ]);
  const targetRange = useMemo(() => {
    const values = targetFrontier.map((point) => point.value).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return null;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const floor = effectiveMetric === "revenue_d7" ? 0.01 : budgetRange.minUnit;
    const min = Math.max(floor, low * 0.85);
    const max = Math.max(min * 1.05, high * 1.15);
    const rawStep = (max - min) / 120;
    const step =
      effectiveMetric === "revenue_d7"
        ? Math.max(0.01, Math.round(rawStep * 100) / 100)
        : currency === "USD"
          ? Math.max(0.01, Math.round(rawStep * 100) / 100)
          : Math.max(10, Math.round(rawStep / 10) * 10);
    return { min, max, step };
  }, [targetFrontier, effectiveMetric, budgetRange.minUnit, currency]);
  const plannedTargetValue = useMemo(() => {
    if (!targetRange) return null;
    const raw = Number(targetValue);
    const seed = Number.isFinite(raw) && raw > 0 ? raw : historicalTargetValue;
    const fallback = Number.isFinite(seed) && seed > 0 ? seed : (targetRange.min + targetRange.max) / 2;
    return Math.min(targetRange.max, Math.max(targetRange.min, fallback));
  }, [targetValue, historicalTargetValue, targetRange]);
  const targetPlan = useMemo(
    () =>
      planningBasis === "target"
        ? selectBudgetForTarget({
            frontier: targetFrontier,
            targetValue: plannedTargetValue,
            metric: effectiveMetric,
            currency,
          })
        : null,
    [planningBasis, targetFrontier, plannedTargetValue, effectiveMetric, currency],
  );
  const isTargetPlanActionable =
    targetPlan?.status === "met" || targetPlan?.status === "cap_reached";
  const hasCompleteEvidence =
    evidenceLimits.unavailableChannels.length === 0 && evidenceLimits.maxBudget > 0;
  const budgetEvidenceEpsilon = Math.max(
    currency === "USD" ? 0.000001 : 0.001,
    budgetRange.max * Number.EPSILON * 16,
  );
  const hasBudgetOutsideEvidence =
    planningBasis === "budget" && dailyBudget > budgetRange.max + budgetEvidenceEpsilon;
  const isPlanActionable =
    planningBasis === "target"
      ? isTargetPlanActionable
      : hasCompleteEvidence && !hasBudgetOutsideEvidence && dailyBudget > 0;
  const plannedDailyBudget =
    planningBasis === "target"
      ? isTargetPlanActionable
        ? targetPlan?.candidate?.budget || 0
        : 0
      : hasBudgetOutsideEvidence
        ? 0
        : hasCompleteEvidence
          ? dailyBudget
          : 0;
  // 목표 역산은 반응 곡선의 일 단위 지출을 기준으로만 정직하게 비교한다. 예산 입력
  // 모드에서 선택한 월/일 표시 설정은 target 모드 결과의 단위를 바꾸지 않는다.
  const planBudgetPeriod = planningBasis === "target" ? "daily" : budgetPeriod;
  const budgetSliderValue = Math.min(
    budgetRange.max,
    Math.max(
      budgetRange.min,
      dailyBudget > 0 ? dailyBudget : observedDailyBudget || budgetRange.min,
    ),
  );
  const setDailyBudgetFromControl = (nextDailyBudget) => {
    const next = Number(nextDailyBudget);
    if (!(next > 0)) return;
    setBudget(formatBudgetInput(budgetPeriod === "monthly" ? next * 30 : next, currency));
  };
  const changeBudgetPeriod = (nextPeriod) => {
    if (nextPeriod === budgetPeriod) return;
    const raw = allocParseNum(budget);
    if (raw != null) {
      const currentDailyBudget = budgetPeriod === "monthly" ? raw / 30 : raw;
      setBudget(formatBudgetInput(nextPeriod === "monthly" ? currentDailyBudget * 30 : currentDailyBudget, currency));
    }
    setBudgetPeriod(nextPeriod);
  };

  // 최근 일예산 합계로 총예산 기본값 산출(사용자 미입력 시). Step 전환 이벤트에서 호출(effect 회피).
  const applyBudgetDefault = () => {
    if (budgetAutoDefaulted || (allocParseNum(budget) || 0) > 0) return;
    if (observedDailyBudget > 0) {
      setBudget(formatBudgetInput(budgetPeriod === "monthly" ? observedDailyBudget * 30 : observedDailyBudget, currency));
      setBudgetAutoDefaulted(true);
    }
  };

  // 결과-먼저 착지(PRISM 뷰 P2): step 3로 바로 들어오면 step 전환 이벤트가 없어 예산 기본값이
  // 안 채워져 allocation이 빈 결과가 된다. 데이터가 준비되면 1회 자동 채운다
  // (applyBudgetDefault는 budgetAutoDefaulted·사용자 입력 가드가 있어 idempotent).
  useEffect(() => {
    // 조건부·1회(idempotent 가드)라 set-state-in-effect 허용 — 결과-먼저 착지 예산 시드 전용.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasData && step === 3) applyBudgetDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, step, observedDailyBudget]);

  // 배분 결과 (mode C / B). target 모드는 미리 만든 안전 frontier의 선택 결과를
  // 재사용하므로 slider 이동 때 모델을 다시 25회 계산하지 않는다.
  const allocation = useMemo(() => {
    if (planningBasis === "target") {
      return isTargetPlanActionable
        ? targetPlan?.candidate?.allocation || { items: [], unallocated: 0, totalAllocated: 0, lockedTotal: 0, overspent: false }
        : { items: [], unallocated: 0, totalAllocated: 0, lockedTotal: 0, overspent: false };
    }
    if (!(plannedDailyBudget > 0))
      return { items: [], unallocated: 0, totalAllocated: 0, lockedTotal: 0, overspent: false };
    const common = {
      modelsMap,
      totalBudget: plannedDailyBudget,
      maxSpends: evidenceLimits.maxSpends,
    };
    if (allocMode === "b")
      return calculateAllocationModeB({ ...common, extrapolateMode: "1.0", currency });
    return calculateAllocationModeC({ ...common, metric: effectiveMetric, historyByCh, currency });
  }, [
    planningBasis,
    targetPlan,
    isTargetPlanActionable,
    modelsMap,
    plannedDailyBudget,
    allocMode,
    currency,
    effectiveMetric,
    historyByCh,
    evidenceLimits.maxSpends,
  ]);
  const isAllocationFullyFundedPlan = isAllocationFullyFunded({
    allocation,
    budget: plannedDailyBudget,
    currency,
  });
  const hasPartiallyAllocatedPlan =
    isPlanActionable && plannedDailyBudget > 0 && !isAllocationFullyFundedPlan;
  const canStorePlan = isPlanActionable && isAllocationFullyFundedPlan;

  // 배분 요약(이전 N일 vs 예상) — 총합계·결론 카드가 공유
  const summary = useMemo(() => {
    if (!allocation.items.length) return null;
    return computeAllocSummary({
      items: allocation.items,
      metric: effectiveMetric,
      historyByCh,
      recentDays,
    });
  }, [allocation.items, effectiveMetric, historyByCh, recentDays]);

  // §6 반응 곡선(PRISM P4): 선택 채널 없거나 사라지면 계획 지출 최대 채널로 폴백.
  const curveCh = useMemo(() => {
    const its = allocation.items;
    if (!its.length) return null;
    if (curveChannel && its.some((it) => it.channel === curveChannel)) return curveChannel;
    return [...its].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0].channel;
  }, [allocation.items, curveChannel]);

  // 선택 채널의 지출→결과 반응 곡선 + now/plan/knee/onset 마커(순수 헬퍼, 엔진 불변).
  const responseCurve = useMemo(() => {
    if (!curveCh) return null;
    const wrapper = modelsMap.get(curveCh);
    if (!wrapper || !wrapper.model) return null;
    const it = allocation.items.find((x) => x.channel === curveCh);
    const h = historyByCh[curveCh];
    const now = h && isFinite(h.windowCost) && recentDays > 0 ? h.windowCost / recentDays : 0;
    const plan = it ? it.cost || 0 : 0;
    return { curve: allocResponseCurve(wrapper, { now, plan }), now, plan, channel: curveCh };
  }, [curveCh, modelsMap, allocation.items, historyByCh, recentDays]);

  // §0 진단 — "지금 어디가 문제인가" (관측 최근 N일 효율 기준). index.html renderAllocDiagnosis 이식.
  const diagnosis = useMemo(() => {
    const items = allocation.items;
    if (!items.length) return null;
    const metric = effectiveMetric;
    const roas = isRoasMetric(metric);
    const metricLabel = getCostMetricLabel(metric);
    const chans = [];
    let totCost = 0,
      totResults = 0;
    for (const it of items) {
      const h = historyByCh[it.channel];
      if (!h || h.windowCost <= 0) continue;
      let eff;
      if (roas) eff = h.avgROAS != null && h.avgROAS > 0 ? 1 / h.avgROAS : Infinity;
      else eff = h.avgCPR != null && h.windowResults > 0 ? h.avgCPR : Infinity;
      chans.push({
        ch: it.channel,
        cost: h.windowCost,
        results: h.windowResults,
        cpr: h.avgCPR,
        roasV: h.avgROAS,
        eff,
      });
      totCost += h.windowCost;
      totResults += h.windowResults;
    }
    if (!chans.length || totCost <= 0) {
      return { insufficient: true, lines: [] };
    }
    const portEff = totResults > 0 ? totCost / totResults : null;
    const fin = chans.filter((c) => isFinite(c.eff));
    const worst = [...chans].sort((a, b) => b.eff - a.eff || (a.ch < b.ch ? -1 : 1))[0];
    const best = [...fin].sort((a, b) => a.eff - b.eff || (a.ch < b.ch ? -1 : 1))[0] || null;
    const topCh = chans.reduce((a, b) => (b.cost > a.cost ? b : a));
    const topShare = totCost > 0 ? topCh.cost / totCost : 0;
    const rnd = (v) => Math.round(v);
    const costSh = (c) => (totCost > 0 ? (c.cost / totCost) * 100 : 0);
    const resSh = (c) => (totResults > 0 ? (c.results / totResults) * 100 : 0);
    const resLbl = (c) =>
      roas ? fmtCurrency(c.results, currency) : tr(`${formatNumberK(c.results, 0)}건`, formatNumberK(c.results, 0));
    const effLbl = (c) =>
      !isFinite(c.eff)
        ? "—"
        : roas
          ? `${(c.roasV * 100).toFixed(0)}%`
          : fmtCostMetric(c.cpr, metric, currency);
    const ratioBad = isFinite(worst.eff) && portEff > 0 ? worst.eff / portEff : Infinity;
    const ratioGood =
      best && isFinite(best.eff) && best.eff > 0 && portEff > 0 ? portEff / best.eff : 1;
    const lines = [];
    if (chans.length < 2) {
      lines.push({
        cls: "muted",
        text: tr(
          `채널을 2개 이상 선택하면 채널 간 효율 비교 진단이 표시됩니다 (현재 ${chans.length}개).`,
          `Select 2 or more channels to see an efficiency comparison across channels (currently ${chans.length}).`
        ),
      });
    } else {
      if (!isFinite(worst.eff)) {
        lines.push({
          cls: "bad",
          text: tr(
            `💸 ${worst.ch} — 최근 ${recentDays}일 예산의 ${rnd(costSh(worst))}%(${fmtCurrency(worst.cost, currency)})를 쓰는데 ${roas ? "매출" : "결과"}가 거의 없습니다. 가장 시급한 점검 대상입니다.`,
            `💸 ${worst.ch} — spent ${rnd(costSh(worst))}% (${fmtCurrency(worst.cost, currency)}) of the last ${recentDays}-day budget with almost no ${roas ? "revenue" : "results"}. This is the most urgent item to review.`
          ),
        });
      } else if (ratioBad >= 1.2) {
        lines.push({
          cls: "bad",
          text: tr(
            `💸 ${worst.ch} — 최근 ${recentDays}일 예산의 ${rnd(costSh(worst))}%(${fmtCurrency(worst.cost, currency)})를 쓰는데 ${roas ? "매출 비중" : "결과 비중"}은 ${rnd(resSh(worst))}%(${resLbl(worst)})뿐입니다. ${metricLabel} ${effLbl(worst)} — 평균보다 ${ratioBad.toFixed(1)}배 비효율.`,
            `💸 ${worst.ch} — spent ${rnd(costSh(worst))}% (${fmtCurrency(worst.cost, currency)}) of the last ${recentDays}-day budget but only ${rnd(resSh(worst))}% (${resLbl(worst)}) of ${roas ? "revenue" : "results"}. ${metricLabel} ${effLbl(worst)} — ${ratioBad.toFixed(1)}x less efficient than average.`
          ),
        });
      } else {
        lines.push({
          cls: "neutral",
          text: tr(
            `📊 채널 간 효율 차이가 작습니다 (최고↔최저 ${best && best.eff > 0 ? (worst.eff / best.eff).toFixed(1) : "—"}배). 재배분으로 얻을 효율은 제한적 — 채널 자체 효율(소재·타겟) 개선이 우선입니다.`,
            `📊 The efficiency gap between channels is small (best↔worst ${best && best.eff > 0 ? (worst.eff / best.eff).toFixed(1) : "—"}x). Reallocation gains are limited here — improving channel efficiency itself (creative/targeting) should come first.`
          ),
        });
      }
      if (best && best.ch !== worst.ch && isFinite(best.eff) && ratioGood >= 1.2) {
        lines.push({
          cls: "good",
          text: tr(
            `💎 ${best.ch} — ${metricLabel} ${effLbl(best)}로 가장 효율적(평균보다 ${ratioGood.toFixed(1)}배)인데 예산은 ${rnd(costSh(best))}%뿐입니다. 증액 여지가 있습니다.`,
            `💎 ${best.ch} — the most efficient (${metricLabel} ${effLbl(best)}, ${ratioGood.toFixed(1)}x better than average) but only gets ${rnd(costSh(best))}% of the budget. There's room to increase it.`
          ),
        });
      }
      if (topShare >= 0.5 && topShare >= 1.5 / chans.length) {
        lines.push({
          cls: "neutral",
          text: tr(
            `📊 예산이 ${topCh.ch}에 ${rnd(topShare * 100)}% 집중 — 단일 채널 의존도가 높습니다. 리스크 분산을 점검하세요.`,
            `📊 ${rnd(topShare * 100)}% of the budget is concentrated in ${topCh.ch} — dependence on a single channel is high. Consider diversifying the risk.`
          ),
        });
      }
    }
    return { insufficient: false, lines };
  }, [allocation.items, effectiveMetric, historyByCh, recentDays, currency, tr]);

  // What-if 시나리오 데이터
  const scenarios = useMemo(() => {
    if (!(plannedDailyBudget > 0)) return [];
    return computeAllocScenarios({
      modelsMap,
      dailyBudget: plannedDailyBudget,
      metric: effectiveMetric,
      mode: allocMode,
      maxSpends: evidenceLimits.maxSpends,
      extrapolateMode: "1.0",
      currency,
      historyByCh,
    });
  }, [
    modelsMap,
    plannedDailyBudget,
    effectiveMetric,
    allocMode,
    evidenceLimits.maxSpends,
    currency,
    historyByCh,
  ]);

  // Step 2 검증 단위 목록 정렬(데이터 수 desc) + 유효하지 않으면 첫 항목으로 폴백(render-derived, setState 없음).
  const verifyGroups = useMemo(
    () => [...byChannel.keys()].sort((a, b) => (byChannel.get(b)?.length || 0) - (byChannel.get(a)?.length || 0) || (a < b ? -1 : 1)),
    [byChannel],
  );
  const effectiveVerifyGroup =
    verifySelectedGroup && verifyGroups.includes(verifySelectedGroup) ? verifySelectedGroup : (verifyGroups[0] ?? null);

  // Step 2 산점도(단일 검증 단위) — index.html renderAllocatorScatter의 step===2 분기(§순수함수 buildScatterDatasets 공유) 이식.
  // 단위별 모델 override(groupModels[unit])가 있으면 adv.trendType을 그 단위에만 적용.
  useEffect(() => {
    if (step !== 2 || !hasData || !verifyChartRef.current || !effectiveVerifyGroup) return;

    const ov = groupModels[effectiveVerifyGroup];
    const chAdv = ov ? { ...adv, trendType: ov } : adv;
    const isRoas = effectiveMetric === "revenue_d7";
    // ROAS 뷰는 항상 raw (Step3 효과와 동일 규칙).
    const nmode = isRoas ? "raw" : normalizeMode;

    const { datasets } = buildScatterDatasets([effectiveVerifyGroup], byChannel, adv, {
      hidePoints,
      normalizeMode: nmode,
      perAdv: () => chAdv,
      colorOf: () => CHART_THEME.series[0],
      isRoas,
    });

    const ctx = verifyChartRef.current.getContext("2d");
    if (verifyChartInstance.current) verifyChartInstance.current.destroy();

    const axisLabels = localizeAxisLabels(ALLOC_MATH.getAxisLabels(nmode, getCostMetricLabel(effectiveMetric), isRoas));
    const rawTooltip = nmode === "raw";

    verifyChartInstance.current = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: CHART_THEME.text, font: { family: "Inter", size: 10 }, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: CHART_THEME.surface,
            titleColor: CHART_THEME.textPrimary,
            bodyColor: CHART_THEME.textPrimary,
            borderColor: CHART_THEME.border,
            borderWidth: 1,
            callbacks: {
              label: (c) =>
                rawTooltip
                  ? `(${c.parsed.x.toFixed(0)}, ${(c.parsed.y * (isRoas ? 100 : 1)).toFixed(2)}${isRoas ? "%" : ""})`
                  : `(${c.parsed.x.toFixed(2)}, ${c.parsed.y.toFixed(2)})`,
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: axisLabels.x, color: CHART_THEME.muted },
            ticks: { color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
          },
          y: {
            type: "linear",
            title: { display: true, text: axisLabels.y, color: CHART_THEME.muted },
            ticks: { color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
            beginAtZero: false,
          },
        },
      },
    });

    // Step 전환 시 새로 마운트되는 캔버스는 최초 폭이 0으로 측정될 수 있음(§7 0px 함정) —
    // 레이아웃 안정 후 1회 resize로 강제 재측정.
    requestAnimationFrame(() => verifyChartInstance.current?.resize());

    return () => {
      if (verifyChartInstance.current) {
        verifyChartInstance.current.destroy();
        verifyChartInstance.current = null;
      }
    };
  }, [step, hasData, byChannel, effectiveVerifyGroup, adv, groupModels, hidePoints, normalizeMode, effectiveMetric, localizeAxisLabels]);

  useEffect(() => {
    if (step !== 3 || !hasData || !chartRef.current) return;

    const byCh = buildByChannel(rows, unitField, effectiveMetric);
    // 차트 표시 대상: 명시 선택(chartChannels) 우선, 없으면 최근 지출 상위 6.
    const ranked = ALLOC_MATH.sortChannelsByRecentCost(byCh, recentDays);
    const topChannels =
      chartChannels && chartChannels.size > 0
        ? ranked.filter((ch) => chartChannels.has(ch))
        : ranked.slice(0, 6);

    const isRoasView = effectiveMetric === "revenue_d7";
    // ROAS 뷰는 항상 raw (getAxisLabels와 동일 규칙). 그 외엔 사용자 정규화 모드.
    const nmode = isRoasView ? "raw" : normalizeMode;

    const { datasets } = buildScatterDatasets(topChannels, byCh, adv, {
      hidePoints,
      normalizeMode: nmode,
      isRoas: isRoasView,
    });

    const ctx = chartRef.current.getContext("2d");
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const isRoas = effectiveMetric === "revenue_d7";
    const axisLabels = localizeAxisLabels(ALLOC_MATH.getAxisLabels(nmode, getCostMetricLabel(effectiveMetric), isRoas));
    const yLabel = axisLabels.y;
    const xLabel = axisLabels.x;
    // 정규화 뷰(minmax/robust/log)면 tooltip은 정규화 값 그대로 표시(스케일 왜곡 방지).
    const rawTooltip = nmode === "raw";

    chartInstance.current = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: CHART_THEME.text,
              font: { family: "Inter", size: 10 },
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: CHART_THEME.surface,
            titleColor: CHART_THEME.textPrimary,
            bodyColor: CHART_THEME.textPrimary,
            borderColor: CHART_THEME.border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) =>
                rawTooltip
                  ? `(${ctx.parsed.x.toFixed(0)}, ${(ctx.parsed.y * (isRoas ? 100 : 1)).toFixed(2)}${isRoas ? "%" : ""})`
                  : `(${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(2)})`,
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: xLabel, color: CHART_THEME.muted },
            ticks: { color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
          },
          y: {
            type: "linear",
            title: { display: true, text: yLabel, color: CHART_THEME.muted },
            ticks: { color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
            beginAtZero: false,
          },
        },
      },
    });

    // Step 전환 시 새로 마운트되는 캔버스는 최초 폭이 0으로 측정될 수 있음(§7 0px 함정) —
    // 레이아웃 안정 후 1회 resize로 강제 재측정.
    requestAnimationFrame(() => chartInstance.current?.resize());

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [step, hasData, rows, unitField, effectiveMetric, recentDays, adv, hidePoints, chartChannels, normalizeMode, localizeAxisLabels]);

  // What-if 시나리오 차트 (예산 배수 → 예상 결과수 곡선). index.html renderAllocScenarioChart 이식.
  useEffect(() => {
    if (step !== 3 || !scenarioChartRef.current) {
      if (scenarioChartInstance.current) {
        scenarioChartInstance.current.destroy();
        scenarioChartInstance.current = null;
      }
      return;
    }
    if (!scenarios.length) {
      if (scenarioChartInstance.current) {
        scenarioChartInstance.current.destroy();
        scenarioChartInstance.current = null;
      }
      return;
    }
    const ctx = scenarioChartRef.current.getContext("2d");
    if (scenarioChartInstance.current) scenarioChartInstance.current.destroy();
    const unitLabel = getMetricUnitLabel(effectiveMetric, locale);
    // 다크/라이트 자동 — index.html getCssVar 이식(§7 var()-literal 함정: 로컬 하드코딩 CHART_THEME 대신 실제 CSS 변수 읽기).
    const axisText = getCssVar("--text-muted") || "#6B7280";
    const axisGrid = getCssVar("--border") || "rgba(255,255,255,0.08)";
    scenarioChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: scenarios.map((s) => `${s.m}×`),
        datasets: [
          {
            label: tr(`예상 ${unitLabel}수`, `Projected ${unitLabel}s`),
            data: scenarios.map((s) => Math.round(s.totResults)),
            borderColor: CHART_THEME.primary,
            backgroundColor: getCssVar("--chart-primary-soft") || "rgba(143,177,255,0.18)",
            fill: true,
            tension: 0.3,
            pointRadius: scenarios.map((s) => (s.m === 1.0 ? 6 : 3)),
            pointBackgroundColor: scenarios.map((s) =>
              s.m === 1.0 ? "#fbbf24" : "#adc6ff",
            ),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                tr(
                  `예산 ${fmtCurrency(scenarios[c.dataIndex].budget, currency)} → ${Math.round(scenarios[c.dataIndex].totResults).toLocaleString()} ${unitLabel}`,
                  `Budget ${fmtCurrency(scenarios[c.dataIndex].budget, currency)} → ${Math.round(scenarios[c.dataIndex].totResults).toLocaleString()} ${unitLabel}s`
                ),
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: tr("예산 배수 (현재 대비)", "Budget multiplier (vs current)"), color: axisText },
            ticks: { color: axisText },
            grid: { color: axisGrid },
          },
          y: {
            title: { display: true, text: tr(`예상 ${unitLabel}수`, `Projected ${unitLabel}s`), color: axisText },
            ticks: { color: axisText },
            grid: { color: axisGrid },
          },
        },
      },
    });

    // Step 전환 시 새로 마운트되는 캔버스는 최초 폭이 0으로 측정될 수 있음(§7 0px 함정) —
    // 레이아웃 안정 후 1회 resize로 강제 재측정.
    requestAnimationFrame(() => scenarioChartInstance.current?.resize());

    return () => {
      if (scenarioChartInstance.current) {
        scenarioChartInstance.current.destroy();
        scenarioChartInstance.current = null;
      }
    };
  }, [step, scenarios, effectiveMetric, currency, locale, tr]);

  // §6 채널 반응 곡선(PRISM P4) — 선택 채널의 지출→결과 곡선 + now/plan/knee/onset 마커.
  useEffect(() => {
    const rc = responseCurve && responseCurve.curve;
    if (step !== 3 || !curveChartRef.current || !rc || !rc.points.length) {
      if (curveChartInstance.current) {
        curveChartInstance.current.destroy();
        curveChartInstance.current = null;
      }
      return;
    }
    const ctx = curveChartRef.current.getContext("2d");
    if (curveChartInstance.current) curveChartInstance.current.destroy();
    const unitLabel = getMetricUnitLabel(effectiveMetric, locale);
    const axisText = getCssVar("--text-muted") || "#6B7280";
    const axisGrid = getCssVar("--border") || "rgba(255,255,255,0.08)";
    const xMax = rc.xMax;
    const colLine = getCssVar("--chart-primary") || "#8fb1ff";
    const colMuted = getCssVar("--text-muted") || "#9aa4b2";
    const colNow = getCssVar("--text-primary") || "#e6e9ef";
    const colKnee = getCssVar("--chart-tertiary") || "#ffc56e";
    const colOnset = getCssVar("--chart-accent") || "#ff8d7e";
    const mk = rc.markers;
    const markerSet = [
      { key: "now", pt: mk.now, color: colNow, label: tr("현재", "Now") },
      { key: "plan", pt: mk.plan, color: colLine, label: tr("계획", "Plan") },
      { key: "knee", pt: mk.knee, color: colKnee, label: tr("효율 최적", "Optimal") },
      { key: "onset", pt: mk.onset, color: colOnset, label: tr("과포화 시작", "Over-saturation") },
    ].filter((m) => m.pt);
    const fmtX = (v) => fmtCurrency(v, currency);
    curveChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: tr("예상 결과 곡선", "Projected response curve"),
            data: rc.points.map((p) => ({ x: p.x, y: p.y })),
            borderColor: colLine,
            backgroundColor: getCssVar("--chart-primary-soft") || "rgba(143,177,255,0.14)",
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 2,
            order: 2,
            // 관측 범위[xMin, xMax] 밖은 점선+연한 색 — predictSafeCpr의 양쪽 clamp를
            // 실제 관측처럼 보이게 하지 않는다(§8 정직).
            segment: {
              borderDash: (c) => (isAllocCurveSegmentEstimated(c.p0.parsed.x, c.p1.parsed.x, rc.xMin, xMax) ? [5, 4] : undefined),
              borderColor: (c) => (isAllocCurveSegmentEstimated(c.p0.parsed.x, c.p1.parsed.x, rc.xMin, xMax) ? colMuted : colLine),
            },
          },
          ...markerSet.map((m) => ({
            type: "scatter",
            label: m.label,
            data: [{ x: m.pt.x, y: m.pt.y }],
            borderColor: m.color,
            backgroundColor: m.color,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointStyle: m.key === "now" ? "rectRot" : "circle",
            order: 1,
          })),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: axisText, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            callbacks: {
              label: (c) => {
                const ds = c.dataset.label;
                const x = c.parsed.x;
                const y = c.parsed.y;
                return tr(
                  `${ds} · 지출 ${fmtCurrency(x, currency)} → ${Math.round(y).toLocaleString()} ${unitLabel}`,
                  `${ds} · Spend ${fmtCurrency(x, currency)} → ${Math.round(y).toLocaleString()} ${unitLabel}s`
                );
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: tr("일 지출", "Daily spend"), color: axisText },
            ticks: { color: axisText, callback: (v) => fmtX(v) },
            grid: { color: axisGrid },
          },
          y: {
            title: { display: true, text: tr(`예상 ${unitLabel}수`, `Projected ${unitLabel}s`), color: axisText },
            ticks: { color: axisText },
            grid: { color: axisGrid },
            beginAtZero: true,
          },
        },
      },
    });
    requestAnimationFrame(() => curveChartInstance.current?.resize());
    return () => {
      if (curveChartInstance.current) {
        curveChartInstance.current.destroy();
        curveChartInstance.current = null;
      }
    };
  }, [step, responseCurve, effectiveMetric, currency, locale, tr]);

  // §4 추천 배분 비중 — 단일 가로 스택 바 Chart.js(indexAxis:'y') 차트. index.html §4 alloc-bar 이식(CSS flexbox → canvas).
  // 채널별 weight(%) 세그먼트를 하나의 category("배분")에 쌓아 legacy와 동일한 "한 줄 막대 + 범례" 모양 유지.
  useEffect(() => {
    if (step !== 3 || !hasData || !barChartRef.current) return;
    const barItems = allocation.items || [];
    if (!(plannedDailyBudget > 0) || barItems.length === 0) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
        barChartInstance.current = null;
      }
      return;
    }

    const common = chartCommonOpts();
    const gridColor = getCssVar("--border") || common.scales.y.grid.color;
    const tickColor = getCssVar("--text-muted") || common.scales.x.ticks.color;

    const ctx = barChartRef.current.getContext("2d");
    if (barChartInstance.current) barChartInstance.current.destroy();

    barChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [tr("배분", "Allocation")],
        datasets: barItems.map((it, i) => ({
          label: it.channel,
          data: [it.weight * 100],
          backgroundColor: CHART_THEME.series[i % CHART_THEME.series.length],
          borderWidth: 0,
          stack: "alloc",
        })),
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { color: tickColor, font: { family: "Inter", size: 11 }, usePointStyle: true, boxWidth: 8, padding: 12 },
          },
          tooltip: {
            backgroundColor: CHART_THEME.surface,
            titleColor: CHART_THEME.textPrimary,
            bodyColor: CHART_THEME.textPrimary,
            borderColor: CHART_THEME.border,
            borderWidth: 1,
            callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.x.toFixed(1)}%` },
          },
        },
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: { color: tickColor, callback: (v) => `${v}%` },
            grid: { color: gridColor },
          },
          y: {
            stacked: true,
            ticks: { display: false },
            grid: { display: false },
          },
        },
      },
    });

    // Step 전환 시 새로 마운트되는 캔버스는 최초 폭이 0으로 측정될 수 있음(§7 0px 함정) —
    // 레이아웃 안정 후 1회 resize로 강제 재측정.
    requestAnimationFrame(() => barChartInstance.current?.resize());

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
        barChartInstance.current = null;
      }
    };
  }, [step, hasData, allocation.items, plannedDailyBudget, tr]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-alloc">
        <ToolPageShell
          locale={locale}
          titleLevel={2}
          title={tr("예산 배분 시뮬레이터", "Budget Allocation Simulator")}
          chips={
            <span className="chip warning">
              <span className="dot"></span>{tr("CSV 업로드 대기", "Waiting for CSV upload")}
            </span>
          }
          summary={
            <p>
              {tr(
                "필수: 날짜·비용·(채널 또는 캠페인)·(설치 또는 액션). 퍼널·세그먼트 진단은 무료 운영 대시보드(5-2)에서 확인하세요.",
                "Required: date, cost, (channel or campaign), (installs or actions). Funnel/segment diagnostics are available in the free Ops Dashboard (5-2)."
              )}
            </p>
          }
          toc={[{ id: "s-prep", title: tr("데이터 준비", "Data setup") }]}
        >
          <section className="block" id="s-prep">
            <h2 className="section-title">{tr("데이터 준비", "Data setup")}</h2>
            <div className="callout warning">
              <div className="ico">!</div>
              <div className="body">
                <strong>{tr("CSV 업로드 대기", "Waiting for CSV upload")}</strong>
                <p>{tr(
                  "효율 CSV 한 번 업로드로 채널별 예산 배분을 분석합니다. 그리디(Greedy) 방식은 '가장 효율이 좋은 곳에 예산을 1순위로' 배분합니다.",
                  "Upload your efficiency CSV once to analyze per-channel budget allocation. The greedy method allocates budget ‘to the most efficient spot first.’"
                )}</p>
                <div style={{ marginTop: "1rem" }}>
                  <CsvUploader toolId="5-3" locale={locale} />
                </div>
              </div>
            </div>
          </section>
        </ToolPageShell>
      </div>
    );
  }

  // --- Step 1: Filter Panel (최적화 목표 + 분석 단위 + 국가/채널/OS 필터) ---
  if (step === 1) {
    const objAvailable = {
      install: mappedKeys.has("installs"),
      action: mappedKeys.has("actions"),
      roas: mappedKeys.has("revenue_d7"),
    };
    // 국가 선택 기반 채널 옵션 cascading
    let availableChannels = filterOptions.channels;
    if (selectedCountries && selectedCountries.size > 0) {
      const set = new Set();
      for (const c of selectedCountries) {
        const chs = filterOptions.channelByCountry.get(c);
        if (chs) chs.forEach((x) => set.add(x));
      }
      availableChannels = [...set].sort();
    }
    const singleCountry = isSingleCountryUnit && filterOptions.countries.length > 1;
    const curCountry =
      selectedCountries && selectedCountries.size ? [...selectedCountries][0] : null;
    const unitOpts = [
      { v: "country", label: tr("국가별 (Country)", "By country"), desc: tr("국가 grain. 채널·캠페인은 상세에서 breakdown", "Country-level grain. Channel/campaign breakdown available in detail view") },
      { v: "channel", label: tr("채널별 (Country × Channel)", "By channel (Country × Channel)"), desc: tr("국가 + 채널 grain. 일반적 분석 단위", "Country + channel grain. The typical analysis unit") },
      { v: "campaign_name", label: tr("캠페인별 (Country × Channel × Campaign)", "By campaign (Country × Channel × Campaign)"), desc: tr("가장 세분화. 캠페인 수 많을 때 국가 필터 필수", "The most granular level. A country filter is required when there are many campaigns") },
    ];
    return (
      <div className="tab-pane active" id="tab-alloc">
        <ToolPageShell
          locale={locale}
          titleLevel={2}
          title={tr("예산 배분 시뮬레이터", "Budget Allocation Simulator")}
          chips={
            <span className="chip">
              <span className="dot"></span>{csvData?.fileName || ""}
            </span>
          }
          summary={
            <p>
              {tr("채널/캠페인 단위의 예산 배분 및 한계효용(Greedy Optimization) 시뮬레이션", "Channel/campaign-level budget allocation and marginal-utility (greedy optimization) simulation")}
            </p>
          }
          toc={[{ id: "s-filter", title: tr("분석 단위", "Analysis unit") }]}
          stickyFilter={<AnalysisControlBar title={tr("표시 기준", "Display settings")} hint={tr("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>}
        >
        <section className="block" id="s-filter">
          <h2 className="section-title"><span className="ix">§1</span>{tr("분석 조건", "Analysis settings")}</h2>
          <p className="muted" style={{ fontSize: "12px" }}>
            {tr(
              "최적화 목표를 먼저 선택하고, 분석 단위와 국가/채널/OS 필터를 정한 뒤 '적용'을 누르면 산점도·추세선·예산 분배가 계산됩니다.",
              "Pick an optimization goal first, set the analysis unit and country/channel/OS filters, then click 'Apply' to compute the scatter plot, trendline, and budget allocation."
            )}
          </p>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px", marginTop: "12px" }}>
            {/* 우선 결정: 최적화 목표 */}
            <div style={{ marginBottom: "14px" }}>
              <span className="ab-pillgroup-label">{tr("최적화 목표", "Optimization goal")}</span>
              <p className="muted" style={{ fontSize: "11px", margin: "2px 0 0" }}>
                {tr("전역 기준이", "The global basis is")} <strong>{effBasis === "actions" ? tr("가입(Action · CPA)", "signup (Action · CPA)") : tr("설치(Install · CPI)", "install (Install · CPI)")}</strong>{" "}
                {tr(
                  `이므로 미선택 시 ${effBasis === "actions" ? "CPA" : "CPI"} 기준으로 분석됩니다. 목표를 직접 바꾸려면 아래에서 선택하세요.`,
                  `so if nothing is selected, analysis defaults to ${effBasis === "actions" ? "CPA" : "CPI"}. Select a goal below to change it.`
                )}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                {Object.entries(ALLOC_OBJECTIVES).map(([k]) => {
                  const o = objI18n[k];
                  const ok = objAvailable[k];
                  // 목표 미선택 상태에서 전역 기준과 일치하는 목표는 "기본값" 배지로 표시.
                  const isBasisDefault = !objective && ok && k === basisObjective;
                  return (
                    <button
                      key={k}
                      className={`ab-pill ${objective === k ? "active" : ""}`}
                      disabled={!ok}
                      title={ok ? o.desc : tr(`필요 컬럼 매핑 안 됨 (${o.metric})`, `Required column not mapped (${o.metric})`)}
                      onClick={() => ok && setObjective(k)}
                      style={{ flexDirection: "column", alignItems: "flex-start", opacity: ok ? 1 : 0.4, cursor: ok ? "pointer" : "not-allowed", textAlign: "left" }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>{o.short} {o.arrow}{isBasisDefault ? tr(" ·기본", " ·default") : ""}</span>
                      <span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.85 }}>{o.label}{!ok ? " 🔒" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* 결과를 읽는 단위 */}
            <div style={{ marginBottom: "14px" }}>
              <span className="ab-pillgroup-label">{tr("결과를 볼 단위", "Result level")}</span>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                {unitOpts.map((o) => (
                  <button key={o.v} className={`ab-pill ${unitField === o.v ? "active" : ""}`} title={o.desc} onClick={() => changeUnit(o.v)}>{o.label}</button>
                ))}
              </div>
            </div>
            {/* 데이터 범위 */}
            <div style={{ marginBottom: "10px" }}>
              <span className="ab-pillgroup-label">{tr("분석 범위", "Analysis scope")}</span>
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
              {filterOptions.hasCountry && (
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {tr("국가", "Country")} {singleCountry ? tr("(채널·캠페인별은 1개만)", "(only 1 for channel/campaign view)") : tr("(다중, 미선택=전체)", "(multi-select, none = all)")}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px", maxWidth: "340px" }}>
                    {filterOptions.countries.map((c) => {
                      const active = singleCountry ? c === curCountry : (!selectedCountries || selectedCountries.has(c));
                      return (
                        <button
                          key={c}
                          className={`ab-pill ${active ? "active" : ""}`}
                          style={{ fontSize: "11px" }}
                          onClick={() =>
                            singleCountry
                              ? setSelectedCountries(new Set([c]))
                              : setSelectedCountries((prev) => toggleInSet(prev, c, filterOptions.countries))
                          }
                        >{c}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {filterOptions.hasChannel && (
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("채널 (다중, 미선택=전체)", "Channel (multi-select, none = all)")}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px", maxWidth: "340px" }}>
                    {availableChannels.map((c) => {
                      const active = !selectedChannelsFilter || selectedChannelsFilter.has(c);
                      return (
                        <button
                          key={c}
                          className={`ab-pill ${active ? "active" : ""}`}
                          style={{ fontSize: "11px" }}
                          onClick={() => setSelectedChannelsFilter((prev) => toggleInSet(prev, c, availableChannels))}
                        >{c}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {filterOptions.hasPlatform && (
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("OS 플랫폼", "OS platform")}</label>
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    {["all", "android", "ios"].map((p) => {
                      const enabled = p === "all" || filterOptions.platforms.has(p);
                      return (
                        <button
                          key={p}
                          className={`ab-pill ${platformFilter === p ? "active" : ""}`}
                          disabled={!enabled}
                          style={{ opacity: enabled ? 1 : 0.4 }}
                          onClick={() => enabled && setPlatformFilter(p)}
                        >{p === "all" ? tr("전체", "All") : p === "android" ? "Android" : "iOS"}</button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn primary"
                disabled={!objective}
                style={{ opacity: objective ? 1 : 0.4, cursor: objective ? "pointer" : "not-allowed" }}
                onClick={applyFilters}
              >
                {objective ? tr("✓ 적용 (검증 진행)", "✓ Apply (proceed to verification)") : tr("⚠ 최적화 목표를 먼저 선택하세요", "⚠ Select an optimization goal first")}
              </button>
            </div>
          </div>
        </section>
        </ToolPageShell>
      </div>
    );
  }

  // 고급 추세선 컨트롤 패널 (가중치·이상치 방법/강도·정규화·포인트 토글). Step 2/3 공유.
  const advancedPanel = (
    <div className="analysis-advanced-controls">
      <button className="ab-pill" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)}>
        {advancedOpen ? tr("▲ 상세 설정 닫기", "▲ Close advanced settings") : tr("▼ 상세 설정 (가중치·이상치·정규화·표시)", "▼ Advanced settings (weighting · outliers · normalization · display)")}
      </button>
      {advancedOpen && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px", fontSize: "12px" }}>
          <div>
            <span className="ab-pillgroup-label" title={tr("채널의 Cost↔CPR 관계를 어떤 곡선으로 적합할지. Auto는 R² 최고 모델 자동 선택.", "Which curve to fit for the channel's Cost↔CPR relationship. Auto picks the model with the best R².")}>{tr("추세선 모델", "Trendline model")}</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {[["auto", "Auto"], ["linear", "Linear"], ["log", "Log"], ["poly2", "Poly2"], ["power", "Power"]].map(([v, l]) => (
                <button key={v} className={`ab-pill ${trendType === v ? "active" : ""}`} onClick={() => setTrendType(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="ab-pillgroup-label" title={tr("추세선 적합 시 최근 데이터에 더 큰 비중. 시장이 최근 바뀌었다면 선형/지수.", "Weight recent data more heavily when fitting the trendline. Use linear/exponential if the market has shifted recently.")}>{tr("최근 가중치", "Recency weighting")}</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {[["none", tr("없음", "None")], ["linear", tr("선형", "Linear")], ["exponential", tr("지수(30일)", "Exponential (30d)")]].map(([v, l]) => (
                <button key={v} className={`ab-pill ${weightMode === v ? "active" : ""}`} onClick={() => setWeightMode(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="ab-pillgroup-label" title={tr("비정상적으로 튀는 (Cost,CPR) 포인트를 추세선 계산에서 제외.", "Exclude abnormal (Cost, CPR) points from the trendline calculation.")}>{tr("이상치 제거", "Outlier removal")}</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {[["none", tr("없음", "None")], ["iqr", "IQR"], ["modz", "Modified Z"]].map(([v, l]) => (
                <button key={v} className={`ab-pill ${outlierMethod === v ? "active" : ""}`} onClick={() => setOutlierMethod(v)}>{l}</button>
              ))}
            </div>
          </div>
          {outlierMethod !== "none" && (
            <div>
              <span className="ab-pillgroup-label" title={tr("이상치 제거 기준 엄격도. 강할수록 더 많이 제거.", "How strict the outlier removal threshold is. Stronger removes more points.")}>{tr("강도", "Strength")}</span>
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                {[["standard", tr("표준", "Standard")], ["strong", tr("강함", "Strong")], ["very_strong", tr("매우 강함", "Very strong")]].map(([v, l]) => (
                  <button key={v} className={`ab-pill ${outlierStrength === v ? "active" : ""}`} onClick={() => setOutlierStrength(v)}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="ab-pillgroup-label" title={tr("차트 표시 축 스케일만 변경(추세선 계산엔 영향 없음).", "Only changes the chart's display axis scale (does not affect the trendline calculation).")}>{tr("정규화 (표시)", "Normalization (display)")}</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {[["raw", tr("절대값", "Raw")], ["log", tr("로그", "Log")], ["minmax", "0~1"], ["robust", "Robust z"]].map(([v, l]) => (
                <button key={v} className={`ab-pill ${normalizeMode === v ? "active" : ""}`} onClick={() => setNormalizeMode(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="ab-pillgroup-label" title={tr("차트에 원본 데이터 점을 같이 표시할지 추세선만 볼지.", "Whether to show the raw data points on the chart, or the trendline only.")}>{tr("표시", "Display")}</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <button className={`ab-pill ${!hidePoints ? "active" : ""}`} onClick={() => setHidePoints(false)}>{tr("점 + 추세선", "Points + trendline")}</button>
              <button className={`ab-pill ${hidePoints ? "active" : ""}`} onClick={() => setHidePoints(true)}>{tr("추세선만", "Trendline only")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- Step 2: 추세선 검증 (Trendline Verification) — index.html renderAllocVerificationStep 이식.
  // 좌측 사이드바(단위 목록) + 우측 산점도/추세선 + 단위별 모델 선택 + 상세 설정 + 검증 요약 + 일괄/개별 승인.
  if (step === 2) {
    const outOpts = getOutlierOpts(outlierMethod, outlierStrength);
    // 단위별 상태 판정 — index.html bindAllocVerificationHandlers의 problemReason 이식.
    // 데이터 부족(<3) → 낮은 R²(<0.2) → Poly2 꼭짓점(Vertex)이 관측 구간 내부(±10%)에 있으면 주의.
    const verifyRows = verifyGroups.map((ch) => {
      const pts = byChannel.get(ch) || [];
      const { kept, removed } = ALLOC_MATH.removeOutliers(pts, outlierMethod, outOpts);
      const ov = groupModels[ch];
      const model = ov ? fitChannel(pts, { ...adv, trendType: ov })?.model : modelsMap.get(ch)?.model;
      const isVerified = groupVerification[ch] === "verified";
      let problemReason = null;
      if (kept.length < 3) {
        problemReason = tr("데이터 부족", "Insufficient data");
      } else if (model) {
        const shape = ALLOC_MATH.detectPoly2Shape(model);
        if (shape && shape.shape === "bell") {
          const xs = kept.map((p) => p.x);
          const xMin = Math.min(...xs);
          const xMax = Math.max(...xs);
          const range = xMax - xMin;
          if (shape.vertex >= xMin + 0.1 * range && shape.vertex <= xMax - 0.1 * range) problemReason = tr("꼭짓점(Vertex) 주의", "Vertex caution");
        } else if (model.r2 != null && model.r2 < 0.2) {
          problemReason = tr("낮은 적합도 (R² < 0.2)", "Low fit (R² < 0.2)");
        }
      } else {
        problemReason = tr("적합 실패", "Fit failed");
      }
      const isHealthy = !problemReason;
      return {
        ch,
        n: pts.length,
        kept: kept.length,
        removed: removed.length,
        model,
        modelLabel: ov ? TREND_TYPE_LABEL[ov] || ov : model ? model.type : "—",
        r2: model?.r2 ?? null,
        problemReason,
        isHealthy,
        isVerified,
      };
    });
    const healthyGroups = verifyRows.filter((r) => r.isHealthy && !r.isVerified).map((r) => r.ch);
    const unverifiedCount = verifyRows.filter((r) => r.isVerified !== true).length;
    const selectedRow = verifyRows.find((r) => r.ch === effectiveVerifyGroup) || null;

    const finishVerification = () => {
      // 네이티브 confirm()은 JS 스레드를 블로킹하고 앱 디자인과 안 맞음(§7 안티패턴) —
      // 비차단 토스트 경고 후 그대로 진행(미검증 그룹은 자동 적합 모델을 그대로 사용).
      if (unverifiedCount > 0) {
        showToast({
          title: tr("미검증 그룹 포함", "Includes unverified groups"),
          body: tr(
            `아직 검증되지 않은 그룹이 ${unverifiedCount}개 있습니다. 자동 적합 모델로 진행합니다.`,
            `${unverifiedCount} group(s) haven't been verified yet. Proceeding with the auto-fitted model.`
          ),
          variant: "warning",
        });
      }
      applyBudgetDefault();
      setVerifiedSig(filterSig()); // 이 필터 조합으로 검증 완료 → 재적용 시 재검증 스킵(★1)
      setStep(3);
    };

    return (
      <div className="tab-pane active" id="tab-alloc">
        <ToolPageShell
          locale={locale}
          titleLevel={2}
          title={tr("예산 배분 시뮬레이터", "Budget Allocation Simulator")}
          chips={
            <span className="chip">
              <span className="dot"></span>{csvData?.fileName || ""}
            </span>
          }
          summary={
            <p>
              {tr(
                "각 분석 단위의 산점도와 추세선을 확인하고, 가장 적합한 회귀 모델을 확정해 주세요. 이상치나 꼭짓점(Vertex) 문제가 있는 경우 수동 변경을 권장합니다.",
                "Review the scatter plot and trendline for each analysis unit and confirm the best-fitting regression model. If there are outlier or vertex issues, we recommend switching the model manually."
              )}
            </p>
          }
          toc={[{ id: "s-verify", title: tr("검증", "Verify") }]}
          stickyFilter={<AnalysisControlBar title={tr("표시 기준", "Display settings")} hint={tr("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>}
        >
        <section className="block" id="s-verify">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "8px" }}>
            <h2 className="section-title" style={{ margin: 0 }}><span className="ix">§2</span>{tr("추세선 검증 (Trendline Verification)", "Trendline verification")}</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn secondary"
                disabled={healthyGroups.length === 0}
                style={{ opacity: healthyGroups.length === 0 ? 0.5 : 1, cursor: healthyGroups.length === 0 ? "not-allowed" : "pointer" }}
                onClick={() => {
                  setGroupVerification((prev) => {
                    const next = { ...prev };
                    healthyGroups.forEach((g) => { next[g] = "verified"; });
                    return next;
                  });
                }}
              >
                {tr(`건강한 그룹 일괄 승인 (${healthyGroups.length}건)`, `Bulk-approve healthy groups (${healthyGroups.length})`)}
              </button>
              <button className="btn primary" onClick={finishVerification}>{tr("검증 완료 및 예산 배분 →", "Finish verification & allocate budget →")}</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem", alignItems: "start", marginTop: "0.75rem" }}>
            {/* 좌측: 분석 단위 목록 (클릭하면 우측 산점도 갱신) */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ background: "var(--bg-2)", padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                {tr("분석 단위 목록", "Analysis units")} <span>({verifyRows.length})</span>
              </div>
              <div style={{ maxHeight: "500px", overflowY: "auto", background: "var(--bg-1)" }}>
                {verifyRows.length === 0 ? (
                  <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
                    {tr(
                      "선택한 단위에서 유효한 데이터(비용>0 · 결과>0)를 찾지 못했습니다. §1에서 다른 단위를 선택하거나 지표 매핑을 확인하세요.",
                      "No valid data (cost > 0 · results > 0) was found for the selected unit. Choose a different unit in §1 or check your metric mapping."
                    )}
                  </div>
                ) : (
                  verifyRows.map((r) => {
                    const isSelected = r.ch === effectiveVerifyGroup;
                    return (
                      <div
                        key={r.ch}
                        onClick={() => setVerifySelectedGroup(r.ch)}
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--border)",
                          borderLeft: isSelected ? "3px solid var(--primary, #adc6ff)" : "3px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          background: isSelected ? "rgba(122,162,247,0.12)" : "transparent",
                          fontWeight: isSelected ? 700 : 400,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span
                            title={r.ch}
                            style={{ fontSize: "13px", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "180px", paddingRight: "8px" }}
                          >
                            {r.ch}
                          </span>
                          <span style={{ whiteSpace: "nowrap", fontSize: "12px", fontWeight: r.isVerified ? 600 : 400, color: r.isVerified ? "#5ad19a" : "var(--text-secondary)" }}>
                            {r.isVerified ? tr("✓ 확인됨", "✓ Confirmed") : tr("대기중", "Pending")}
                          </span>
                        </div>
                        <div>
                          {r.problemReason && (
                            <div style={{ color: "#f0917e", fontSize: "11.5px", fontWeight: 600, marginBottom: "2px" }}>⚠ {r.problemReason}</div>
                          )}
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {tr("선택된 모델:", "Selected model:")} <strong>{r.modelLabel}</strong>{r.r2 != null ? ` · R² ${r.r2.toFixed(2)}` : ""} · n={r.n}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 우측: 선택된 단위 상세 (산점도 + 모델 선택 + 상세 설정 + 검증 요약) */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", minHeight: "32px" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{effectiveVerifyGroup || tr("그룹을 선택하세요", "Select a group")}</h3>
                {effectiveVerifyGroup && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      value={groupModels[effectiveVerifyGroup] || "auto"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGroupModels((prev) => {
                          const next = { ...prev };
                          if (v === "auto") delete next[effectiveVerifyGroup];
                          else next[effectiveVerifyGroup] = v;
                          return next;
                        });
                      }}
                      style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-1)", fontSize: "12px" }}
                    >
                      <option value="auto">Auto (Best R²)</option>
                      <option value="linear">Linear</option>
                      <option value="log">Log</option>
                      <option value="poly2">Poly2</option>
                      <option value="power">Power</option>
                    </select>
                    <button
                      className="btn primary"
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                      onClick={() => setGroupVerification((prev) => ({ ...prev, [effectiveVerifyGroup]: "verified" }))}
                    >
                      {tr("확정", "Confirm")}
                    </button>
                  </div>
                )}
              </div>

              {advancedPanel}

              <div className="chart-canvas-wrap" style={{ height: "350px", marginTop: "0.5rem" }}>
                <canvas id="chart-alloc-scatter-verify" ref={verifyChartRef}></canvas>
              </div>

              {/* 추세 요약 — 단위별 R²/데이터 수/이상치 */}
              {selectedRow && (
                <div style={{ marginTop: "0.75rem", fontSize: "12.5px", color: "var(--text-secondary)", background: "var(--bg-1)", padding: "10px 12px", borderRadius: "6px" }}>
                  <strong>{selectedRow.ch}</strong> — {tr("모델", "model")} <strong>{selectedRow.modelLabel}</strong>
                  {selectedRow.r2 != null ? <> · R² <strong className="tnum">{selectedRow.r2.toFixed(3)}</strong></> : null}
                  {" "}· {tr(`데이터 ${selectedRow.n}개${selectedRow.removed > 0 ? ` (이상치 ${selectedRow.removed}개 제외)` : ""}`, `${selectedRow.n} data points${selectedRow.removed > 0 ? ` (${selectedRow.removed} outliers excluded)` : ""}`)}
                  {selectedRow.problemReason ? (
                    <span style={{ color: "#f0917e" }}> · ⚠ {selectedRow.problemReason}</span>
                  ) : (
                    <span style={{ color: "#5ad19a" }}> · {tr("통과", "Passed")}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="btn secondary" style={{ marginRight: "8px" }} onClick={() => setStep(1)}>{tr("뒤로", "Back")}</button>
            <button className="btn primary" onClick={finishVerification}>{tr("검증 완료 및 예산 배분 →", "Finish verification & allocate budget →")}</button>
          </div>
        </section>
        </ToolPageShell>
      </div>
    );
  }

  // --- Step 3: Simulation ---
  const items = allocation.items;
  const rankedChannels = ALLOC_MATH.sortChannelsByRecentCost(byChannel, recentDays);
  const unitLabel = getMetricUnitLabel(effectiveMetric, locale);
  const metricLabel = getCostMetricLabel(effectiveMetric);
  const roas = isRoasMetric(effectiveMetric);
  const totalCost = allocation.totalAllocated || 0;
  const totalResults = items.reduce((s, it) => s + it.results, 0);
  const avgCpr = totalResults > 0 ? totalCost / totalResults : 0;
  const showTable = plannedDailyBudget > 0;
  const allocationMoveCounts = items.reduce(
    (acc, item) => {
      const previous = historyByCh[item.channel]?.totalCost || 0;
      const delta = item.cost - previous;
      if (delta > 0.005) acc.increase += 1;
      else if (delta < -0.005) acc.decrease += 1;
      else acc.hold += 1;
      return acc;
    },
    { increase: 0, decrease: 0, hold: 0 },
  );

  // §5 배분 점검 스트립 데이터 (index.html renderAllocVerifyStrip 이식)
  const verify = (() => {
    if (items.length < 2) return null;
    const mode = allocMode;
    const rowsV = items.map((it) => {
      const h = historyByCh[it.channel];
      let eff = null;
      if (h) {
        if (roas) eff = h.avgROAS != null && h.avgROAS > 0 ? 1 / h.avgROAS : null;
        else eff = h.avgCPR != null && h.avgCPR > 0 ? h.avgCPR : null;
      }
      return {
        ch: it.channel,
        alloc: it.cost || 0,
        eff,
        cpr: h ? h.avgCPR : null,
        roasV: h ? h.avgROAS : null,
        zero: (it.cost || 0) === 0,
      };
    });
    const effLbl = (r) =>
      r.eff == null
        ? "—"
        : roas
          ? `${(r.roasV * 100).toFixed(0)}%`
          : fmtCostMetric(r.cpr, effectiveMetric, currency);
    let head = "",
      body = "",
      tone = "good";
    if (mode === "b") {
      tone = "neutral";
      head = tr("한계효용 기준 배분", "Marginal-utility allocation");
      const zeros = rowsV.filter((r) => r.zero).map((r) => r.ch);
      body = tr(
        `그리디(고급)는 평균 효율이 아니라 '추가 1원이 만드는 효과(한계효율)' 기준으로 배분합니다 — 평균 ${metricLabel} 순서와 달라도 정상입니다.` +
          (zeros.length ? ` 추가 투입 효과가 없어 0 배분된 채널: ${zeros.join(", ")}.` : ""),
        `Greedy (advanced) allocates based on 'the effect of one more unit of spend (marginal efficiency)', not average efficiency — it's normal for this to differ from the average ${metricLabel} order.` +
          (zeros.length ? ` Channels allocated 0 because extra spend has no additional effect: ${zeros.join(", ")}.` : "")
      );
    } else {
      const free = rowsV.filter((r) => r.eff != null && !r.zero);
      const sorted = [...free].sort((a, b) => a.eff - b.eff || (a.ch < b.ch ? -1 : 1));
      const inv = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].alloc > sorted[i].alloc * 1.001) inv.push([sorted[i], sorted[i + 1]]);
      }
      if (free.length < 2) {
        tone = "neutral";
        head = tr("점검 생략", "Check skipped");
        body = tr(
          "비교 가능한 채널이 부족합니다. 표와 곡선 근거를 함께 확인하세요.",
          "There are not enough comparable channels. Review the table and curve evidence together."
        );
      } else if (inv.length === 0) {
        tone = "good";
        head = tr("✓ 효율 순서대로 배분됨", "✓ Allocated in efficiency order");
        body = tr(
          `제약 없는 채널은 효율(${metricLabel})이 좋을수록 예산이 더 갔습니다 — 절대 CPR 가중이 정상 작동 중.`,
          `For unconstrained channels, better efficiency (${metricLabel}) got more budget — absolute CPR weighting is working as expected.`
        );
      } else {
        tone = "bad";
        head = tr("⚠ 효율↔배분 역전", "⚠ Efficiency↔allocation reversal");
        body = tr(
          inv
            .slice(0, 2)
            .map(
              ([b, w]) =>
                `${w.ch}(${effLbl(w)})가 ${b.ch}(${effLbl(b)})보다 효율이 낮은데 예산이 더 많습니다`,
            )
            .join(" · ") + `. 곡선 형태·관측 최대 지출 상한 때문에 생긴 결과인지 근거를 확인하세요.`,
          inv
            .slice(0, 2)
            .map(
              ([b, w]) =>
                `${w.ch} (${effLbl(w)}) has more budget than ${b.ch} (${effLbl(b)}) despite being less efficient`,
            )
            .join(" · ") + `. Check whether curve shape or the observed-spend ceiling explains this result.`
        );
      }
    }
    return { head, body, tone, note: "" };
  })();

  // 결론·액션 카드 데이터 (index.html renderAllocVerdict 이식)
  const verdict = (() => {
    if (!summary || !items.length) return null;
    const S = summary;
    const dPrev = displayMetricValue(S.prevAvgCPR, effectiveMetric);
    const dNext = displayMetricValue(S.nextAvgCPR, effectiveMetric);
    let tone = "neutral",
      text = "",
      pct = null;
    if (dPrev != null && dNext != null && dPrev !== 0) {
      const d = dNext - dPrev;
      pct = Math.abs(d / dPrev) * 100;
      const good = roas ? d > 0 : d < 0;
      if (pct < 2) {
        tone = "neutral";
        text = tr(
          `추천 배분은 현재와 거의 같습니다 (${metricLabel} 변화 ${pct.toFixed(1)}%). 재배분만으로 얻을 효율 개선은 미미하니, 채널 자체 효율(소재·타겟·랜딩)을 손보는 편이 낫습니다.`,
          `The recommended allocation is nearly the same as today (${metricLabel} change ${pct.toFixed(1)}%). Reallocation alone won't gain much efficiency — it's better to improve channel efficiency itself (creative/targeting/landing page).`
        );
      } else if (good) {
        tone = "good";
        text = tr(
          `추천대로 재배분하면 ${metricLabel}가 약 ${pct.toFixed(1)}% ${roas ? "상승" : "개선"}할 것으로 보입니다. 아래 액션부터 적용해 보세요.`,
          `Reallocating as recommended should ${roas ? "raise" : "improve"} ${metricLabel} by about ${pct.toFixed(1)}%. Try applying the actions below.`
        );
      } else {
        tone = "bad";
        text = tr(
          `현재 전역 입력으로는 ${metricLabel}가 약 ${pct.toFixed(1)}% 악화됩니다. 총 예산·효율 목표 또는 선택한 채널을 점검하세요.`,
          `With the current global input, ${metricLabel} would worsen by about ${pct.toFixed(1)}%. Check the total budget, efficiency target, or selected channels.`
        );
      }
    } else {
      text = tr(
        `예상 ${unitLabel} ${formatNumberK(S.next.results, 0)}건 기준으로 배분했습니다. 효율을 비교할 과거 데이터가 부족해 개선폭은 추정하지 않았습니다.`,
        `Allocated based on a projected ${formatNumberK(S.next.results, 0)} ${unitLabel}s. There isn't enough historical data to compare efficiency, so no improvement estimate is given.`
      );
    }
    const moves = items.map((it) => {
      const h = historyByCh[it.channel];
      const prevDaily = h ? h.totalCost : 0;
      return {
        ch: it.channel,
        cost: it.cost,
        prevDaily,
        delta: it.cost - prevDaily,
        zero: it.cost === 0,
      };
    });
    const incr = moves.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta);
    const decr = moves.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta);
    const acts = [];
    if (incr[0])
      acts.push(
        tr(
          `${incr[0].ch} 증액 — 일 ${fmtCurrency(Math.round(incr[0].delta), currency)} 더 (${fmtCurrency(Math.round(incr[0].prevDaily), currency)} → ${fmtCurrency(Math.round(incr[0].cost), currency)})`,
          `Increase ${incr[0].ch} — ${fmtCurrency(Math.round(incr[0].delta), currency)} more per day (${fmtCurrency(Math.round(incr[0].prevDaily), currency)} → ${fmtCurrency(Math.round(incr[0].cost), currency)})`
        ),
      );
    if (decr[0])
      acts.push(
        tr(
          `${decr[0].ch} ${decr[0].zero ? "중단·0 배분" : "감액"} — 일 ${fmtCurrency(Math.round(Math.abs(decr[0].delta)), currency)} 줄임${decr[0].zero ? " (추가 예산 대비 효율 없음 → 현 수준 유지/재검토)" : ""}`,
          `${decr[0].zero ? "Stop · 0 allocation" : "Decrease"} for ${decr[0].ch} — ${fmtCurrency(Math.round(Math.abs(decr[0].delta)), currency)} less per day${decr[0].zero ? " (no efficiency from extra spend → keep as-is / re-review)" : ""}`
        ),
      );
    if ((allocation.unallocated || 0) > 0)
      acts.push(
        tr(
          `남은 ${fmtCurrency(allocation.unallocated, currency)}은 채널별 관측 최대 지출 상한 또는 한계효용 때문에 자동 집행하지 않습니다.`,
          `The remaining ${fmtCurrency(allocation.unallocated, currency)} is not auto-spent because of an observed-spend ceiling or marginal-utility limit.`
        ),
      );
    return { tone, text, acts, S };
  })();

  const step3Toc = [
    { id: "s-controls", title: tr("PRISM 조정", "PRISM controls") },
    { id: "s-result", title: tr("추천 결과", "Recommendation") },
    { id: "s-scatter", title: tr("곡선 근거", "Curve evidence") },
    { id: "s-table", title: tr("상세", "Detail") },
    { id: "s-bar", title: tr("배분", "Allocation") },
    { id: "s-scenario", title: tr("시나리오", "Scenarios") },
    { id: "s-algo", title: tr("알고리즘", "Algorithm") },
  ];
  const step3StickyFilter = (
    <>
      <AnalysisControlBar title={tr("표시 기준", "Display settings")} hint={tr("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>
      {/* ★2 요약칩 → 드롭다운+적용 (토글 칩 바로 아래). draft라 적용 전엔 결과 불변. */}
      <AllocQuickFilterBar
        key={`objective-${objective ?? "__default__"}-${basisObjective}`}
        applied={{ objective, unitField, countries: selectedCountries, channels: selectedChannelsFilter, platform: platformFilter }}
        filterOptions={filterOptions}
        objectives={ALLOC_OBJECTIVES}
        onApply={applyFiltersWith}
        locale={locale}
      />
    </>
  );
  const planningObjectiveControl = (
    <div className="prism-driver__target-choice" role="radiogroup" aria-label={tr("채널 배분 성과 기준", "Channel-allocation performance metric")}>
      {[
        "install",
        "action",
        "roas",
      ].map((key) => {
        const meta = objI18n[key];
        const isAvailable = mappedKeys.has(ALLOC_OBJECTIVES[key].metric);
        const isActive = activePlanningObjective === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={isActive ? "active" : ""}
            disabled={!isAvailable}
            title={isAvailable ? meta.desc : tr("현재 CSV에 이 지표가 없습니다", "This metric is not in the current CSV")}
            onClick={() => {
              setObjective(key);
              setTargetValue(null);
            }}
          >{meta.short} {meta.arrow}</button>
        );
      })}
    </div>
  );

  return (
    <div className="tab-pane active" id="tab-alloc">
      {/* 헤더는 라우터가 주입하는 ToolIntro(단일 h1+설명+크로스링크)가 담당 — 셸 제목/요약은
          중복이라 제거(결과-먼저: 컨트롤 바 바로 아래에 스코어카드·결론). 알고리즘 설명은
          하단 §알고리즘 섹션(s-algo)에 유지. 셸은 sticky 컨트롤 바 + 칩만. */}
      <ToolPageShell
        locale={locale}
        chips={
          <span className="chip">
            <span className="dot"></span>{csvData?.fileName || ""}
          </span>
        }
        toc={step3Toc}
        stickyFilter={step3StickyFilter}
      >
      <section className="block prism-driver" id="s-controls" aria-labelledby="prism-driver-title">
        <div className="prism-driver__head">
          <div>
            <span className="prism-driver__eyebrow">PRISM CONTROL</span>
            <h2 className="section-title" id="prism-driver-title"><span className="ix">§1</span>{tr("무엇을 정할까요?", "What do you want to set?")}</h2>
            <p>{tr("예산이나 효율 목표 하나만 정하면, PRISM이 채널별 금액을 자동으로 계산합니다. 채널 행은 결과표이며 직접 조정하지 않습니다.", "Set one portfolio constraint — budget or efficiency target — and PRISM calculates the channel allocation. Channel rows are read-only results, not manual controls.")}</p>
          </div>
          <div className="prism-driver__mode" role="group" aria-label={tr("PRISM 조정 기준", "PRISM planning basis")}>
            <button
              type="button"
              className={planningBasis === "budget" ? "active" : ""}
              aria-pressed={planningBasis === "budget"}
              onClick={() => setPlanningBasis("budget")}
            >{tr("총 예산", "Total budget")}</button>
            <button
              type="button"
              className={planningBasis === "target" ? "active" : ""}
              aria-pressed={planningBasis === "target"}
              onClick={() => {
                setObjective((current) => current || basisObjective);
                setTargetValue(null);
                setPlanningBasis("target");
              }}
            >{tr("효율 목표", "Efficiency target")}</button>
          </div>
        </div>

        {planningBasis === "budget" ? (
          <div className="prism-driver__control">
            <div className="prism-driver__metric-row">
              <span>{tr("배분 성과 기준", "Allocation metric")}</span>
              {planningObjectiveControl}
            </div>
            <div className="prism-driver__label-row">
              <label htmlFor="prism-total-budget">{tr(`총 ${budgetPeriod === "monthly" ? "월" : "일"}예산`, `Total ${budgetPeriod === "monthly" ? "monthly" : "daily"} budget`)}</label>
              <output className="prism-driver__readout" htmlFor="prism-total-budget">
                {fmtCurrency(budgetPeriod === "monthly" ? budgetSliderValue * 30 : budgetSliderValue, currency)}
              </output>
            </div>
            <input
              id="prism-total-budget"
              className="prism-driver__range"
              type="range"
              min={budgetRange.min}
              max={budgetRange.max}
              step={budgetRange.step}
              value={budgetSliderValue}
              aria-valuetext={fmtCurrency(budgetPeriod === "monthly" ? budgetSliderValue * 30 : budgetSliderValue, currency)}
              onChange={(event) => setDailyBudgetFromControl(event.target.value)}
            />
            <div className="prism-driver__scale" aria-hidden="true">
              <span>{fmtCurrency(budgetPeriod === "monthly" ? budgetRange.min * 30 : budgetRange.min, currency)}</span>
              <span>{tr("관측 지출 상한", "observed-spend ceiling")} {fmtCurrency(budgetPeriod === "monthly" ? budgetRange.max * 30 : budgetRange.max, currency)}</span>
            </div>
            <div className="prism-driver__exact">
              <label htmlFor="prism-total-budget-exact">{tr("정확한 금액", "Exact amount")}</label>
              <input
                id="prism-total-budget-exact"
                type="text"
                inputMode={currency === "USD" ? "decimal" : "numeric"}
                autoComplete="off"
                value={budget}
                onChange={(event) => setBudget(sanitizeBudgetInput(event.target.value, currency))}
                onBlur={() => {
                  const parsed = allocParseNum(budget);
                  if (parsed != null) setBudget(formatBudgetInput(parsed, currency));
                }}
              />
              <span className="budget-period-toggle" role="group" aria-label={tr("예산 기간", "Budget period")}>
                <button type="button" className={budgetPeriod === "daily" ? "active" : ""} aria-pressed={budgetPeriod === "daily"} onClick={() => changeBudgetPeriod("daily")}>{tr("일", "Daily")}</button>
                <button type="button" className={budgetPeriod === "monthly" ? "active" : ""} aria-pressed={budgetPeriod === "monthly"} onClick={() => changeBudgetPeriod("monthly")}>{tr("월", "Monthly")}</button>
              </span>
            </div>
            {!hasCompleteEvidence ? (
              <p className="prism-driver__status prism-driver__status--unavailable" aria-live="polite">
                {tr(
                  `전역 자동 배분에는 선택 채널 전체의 반응 곡선이 필요합니다. 현재 ${evidenceLimits.unavailableChannels.length}개 채널의 곡선 검증이 필요해 실행·저장 가능한 추천안을 만들지 않았습니다.`,
                  `Global auto-allocation needs a response curve for every selected channel. ${evidenceLimits.unavailableChannels.length} channel(s) still need curve verification, so PRISM has not created an executable or savable recommendation.`,
                )}
              </p>
            ) : hasBudgetOutsideEvidence ? (
              <p className="prism-driver__status prism-driver__status--unavailable" aria-live="polite">
                {tr(
                  `입력한 ${budgetPeriod === "monthly" ? "월" : "일"}예산 ${fmtCurrency(budgetPeriod === "monthly" ? dailyBudget * 30 : dailyBudget, currency)}은 관측 지출 상한 ${fmtCurrency(budgetPeriod === "monthly" ? budgetRange.max * 30 : budgetRange.max, currency)}을 넘습니다. 이 금액 전체에 대한 자동 실행안은 만들지 않았습니다. 상한 안으로 낮추거나 추가 데이터를 쌓은 뒤 다시 계산하세요.`,
                  `The entered ${budgetPeriod === "monthly" ? "monthly" : "daily"} budget of ${fmtCurrency(budgetPeriod === "monthly" ? dailyBudget * 30 : dailyBudget, currency)} exceeds the observed-spend ceiling of ${fmtCurrency(budgetPeriod === "monthly" ? budgetRange.max * 30 : budgetRange.max, currency)}. PRISM has not created an executable plan for the full amount. Lower it within the ceiling or collect more data and recalculate.`,
                )}
              </p>
            ) : hasPartiallyAllocatedPlan ? (
              <p className="prism-driver__status prism-driver__status--unavailable" aria-live="polite">
                {tr(
                  `현재 배분 방식은 일 ${fmtCurrency(allocation.totalAllocated, currency)}만 자동 배분하고 ${fmtCurrency(allocation.unallocated, currency)}은 남깁니다. 전액을 실행할 수 있는 계획이 아니므로 저장하지 않았습니다. 전역 예산을 낮추거나 안정적 효율 가중 방식을 선택해 다시 계산하세요.`,
                  `The current allocation method can automatically allocate only ${fmtCurrency(allocation.totalAllocated, currency)} per day and leaves ${fmtCurrency(allocation.unallocated, currency)} unallocated. Because this is not a fully executable plan, it cannot be saved. Lower the global budget or choose stable efficiency weighting and recalculate.`,
                )}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="prism-driver__control">
            {planningObjectiveControl}
            {targetRange ? (
              <>
                <div className="prism-driver__label-row">
                  <label htmlFor="prism-efficiency-target">{tr(`목표 ${getCostMetricLabel(effectiveMetric)}`, `Target ${getCostMetricLabel(effectiveMetric)}`)}</label>
                  <output className="prism-driver__readout" htmlFor="prism-efficiency-target">{fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}</output>
                </div>
                <input
                  id="prism-efficiency-target"
                  className="prism-driver__range"
                  type="range"
                  min={targetRange.min}
                  max={targetRange.max}
                  step={targetRange.step}
                  value={plannedTargetValue ?? targetRange.min}
                  aria-valuetext={fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}
                  onChange={(event) => setTargetValue(Number(event.target.value))}
                />
                <div className="prism-driver__scale" aria-hidden="true">
                  <span>{fmtGoalMetric(targetRange.min, effectiveMetric, currency)}</span>
                  <span>{fmtGoalMetric(targetRange.max, effectiveMetric, currency)}</span>
                </div>
              </>
            ) : (
              <p className="prism-driver__empty">{tr("이 목표를 계산할 수 있는 유효한 반응 곡선이 아직 없습니다. 곡선 검증을 완료하거나 목표 지표가 있는 CSV를 사용하세요.", "There is not yet a valid response curve for this target. Complete curve verification or use a CSV with the target metric.")}</p>
            )}
            <div
              className={`prism-driver__status prism-driver__status--${targetPlan?.status || "unavailable"}`}
              aria-live="polite"
            >
              {(() => {
                if (evidenceLimits.unavailableChannels.length > 0) {
                  return tr(
                    `목표 예산을 역산하려면 모든 선택 채널의 반응 곡선이 필요합니다. 현재 ${evidenceLimits.unavailableChannels.length}개 채널은 곡선 검증이 필요합니다.`,
                    `Target-budget planning needs a response curve for every selected channel. ${evidenceLimits.unavailableChannels.length} channel(s) still need curve verification.`,
                  );
                }
                if (!targetPlan?.candidate || plannedTargetValue == null) {
                  return tr("관측 최대 지출 상한 안에서 목표 예산을 계산할 수 없습니다.", "A target budget cannot be calculated below the observed-spend ceilings.");
                }
                const candidateMetric = fmtGoalMetric(targetPlan.candidate.value, effectiveMetric, currency);
                const candidateBudget = fmtCurrency(targetPlan.candidate.allocation.totalAllocated, currency);
                if (targetPlan.status === "met") {
                  return tr(
                    `목표 ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}를 지키는 최대 일예산은 약 ${candidateBudget}입니다. 채널별 관측 최대 지출을 넘지 않습니다. 예상 ${getCostMetricLabel(effectiveMetric)} ${candidateMetric}.`,
                    `The estimated largest daily budget that meets ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)} is ${candidateBudget}, without exceeding each channel's observed maximum spend. Projected ${getCostMetricLabel(effectiveMetric)}: ${candidateMetric}.`,
                  );
                }
                if (targetPlan.status === "cap_reached") {
                  return tr(
                    `목표 ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}를 관측 지출 상한 ${candidateBudget}까지 충족합니다. 이 상한 밖은 추천하지 않습니다.`,
                    `The target ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)} is met through the observed-spend ceiling of ${candidateBudget}. PRISM does not recommend beyond this ceiling.`,
                  );
                }
                return tr(
                  `채널별 관측 최대 지출 상한 안에서는 목표 ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}를 충족할 예산이 없습니다. 가장 가까운 참고안은 일 ${candidateBudget}, 예상 ${getCostMetricLabel(effectiveMetric)} ${candidateMetric}이며 실행·저장할 수 없습니다.`,
                  `No budget below the observed-spend ceilings meets ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}. The closest reference is ${candidateBudget}/day with projected ${getCostMetricLabel(effectiveMetric)} ${candidateMetric}; it cannot be executed or saved as a recommendation.`,
                );
              })()}
            </div>
          </div>
        )}

        <div className="prism-driver__window" role="group" aria-label={tr("비교 기준 데이터", "Comparison window")}>
          <span>{tr("비교 기준", "Comparison")}</span>
          <div className="budget-period-toggle">
            {[7, 14, 28].map((days) => (
              <button key={days} type="button" className={recentDays === days ? "active" : ""} aria-pressed={recentDays === days} onClick={() => setRecentDays(days)}>{tr(`${days}일`, `${days}d`)}</button>
            ))}
          </div>
          <small>{tr("최근 N일 평균으로 반응 곡선과 기준 KPI를 계산", "Response curves and baseline KPI use the last N-day average")}</small>
        </div>

        <details className="prism-driver__method">
          <summary>{tr("배분 방식과 관측 지출 상한", "Allocation method and observed-spend ceilings")}</summary>
          <div>
            <div className="alloc-mode-toggle" role="group" aria-label={tr("배분 방식", "Allocation method")}>
              <button type="button" className={allocMode === "c" ? "active" : ""} aria-pressed={allocMode === "c"} onClick={() => setAllocMode("c")}>{tr("안정적 효율 가중", "Stable efficiency weighting")}</button>
              <button type="button" className={allocMode === "b" ? "active" : ""} aria-pressed={allocMode === "b"} onClick={() => setAllocMode("b")}>{tr("한계효용 그리디", "Marginal-utility greedy")}</button>
            </div>
            <p>{tr("PRISM은 각 채널의 관측 최대 지출을 넘지 않도록 자동 배분합니다. 마지막 효율을 관측 밖 비용에 연장해 목표 예산을 부풀리지 않습니다. 이는 관측된 비용·성과 관계를 쓴 시뮬레이션이며 인과 효과 보장은 아닙니다.", "PRISM auto-allocates without exceeding each channel's observed maximum spend. It does not extend the last efficiency beyond observed spend to inflate a target budget. This is a simulation from observed cost-performance relationships, not a causal guarantee.")}</p>
          </div>
        </details>
      </section>

      {/* 전역 driver 뒤에만 결과를 노출한다. */}
      {summary && (() => {
        const s = summary;
        const spendPct = s.prev.cost > 0 ? Math.round(((s.next.cost - s.prev.cost) / s.prev.cost) * 100) : null;
        const resDelta = Math.round(s.next.results - s.prev.results);
        const improved = s.nextAvgCPR != null && s.prevAvgCPR != null && s.nextAvgCPR < s.prevAvgCPR;
        const moved = Math.abs(s.next.cost - s.prev.cost);
        const word = getMetricUnitLabel(effectiveMetric, locale);
        const card = (label, value, sub, subColor) => (
          <div className="prism-result-card">
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.25 }}>{value}</div>
            <div style={{ fontSize: "11.5px", color: subColor || "var(--text-muted)" }}>{sub}</div>
          </div>
        );
        return (
          <div className="prism-result-grid" id="s-result">
            {card(
              tr("계획 지출", "Planned spend"),
              fmtCurrency(s.next.cost, currency),
              spendPct != null ? tr(`현재 대비 ${spendPct > 0 ? "+" : ""}${spendPct}%`, `${spendPct > 0 ? "+" : ""}${spendPct}% vs now`) : tr("현재 대비", "vs now"),
            )}
            {card(
              tr(`예상 ${word}`, `Projected ${word}`),
              formatNumberK(s.next.results),
              `${resDelta >= 0 ? "+" : ""}${formatNumberK(resDelta)}${tr(" 건", "")}`,
              resDelta >= 0 ? "var(--success)" : "var(--danger)",
            )}
            {card(
              tr(`평균 ${metricLabel}`, `Avg ${metricLabel}`),
              fmtCostMetric(s.nextAvgCPR, effectiveMetric, currency),
              tr(`현재 ${fmtCostMetric(s.prevAvgCPR, effectiveMetric, currency)}`, `now ${fmtCostMetric(s.prevAvgCPR, effectiveMetric, currency)}`),
              improved ? "var(--success)" : "var(--danger)",
            )}
            {card(
              tr("재배분 규모", "Reallocation size"),
              fmtCurrency(moved, currency),
              tr("채널 간 이동액", "moved across channels"),
            )}
          </div>
        );
      })()}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "0.5rem" }}>
        <button className="btn secondary" onClick={() => setStep(2)} style={{ padding: "4px 10px", fontSize: "12px" }}>{tr("곡선 검증·보정", "Verify / adjust curves")}</button>
      </div>

      {/* 결론·액션 카드 */}
      {verdict && canStorePlan && (
        <ResultActionCard
          toolId="5-3"
          locale={locale}
          tone={verdict.tone}
          title={tr("결론 — 이 예산으로 무엇을 할까", "Conclusion — what to do with this budget")}
          headline={verdict.text}
          decisionPrefill={{
            conclusion: verdict.text,
            action: verdict.tone === "good"
              ? tr(
                `추천 배분표 전체를 제한된 기간에 적용한다${verdict.acts.length ? ` — 핵심 이동: ${verdict.acts.slice(0, 2).join(" · ")}` : ""}`,
                `Apply the full recommended allocation for a limited window${verdict.acts.length ? ` — key moves: ${verdict.acts.slice(0, 2).join(" · ")}` : ""}`,
              )
              : verdict.tone === "bad"
                ? tr("전역 예산 또는 효율 목표를 한 단계 보수적으로 조정한 뒤 다시 계산한다", "Make the global budget or efficiency target one step more conservative, then recalculate")
                : tr("추천안과 현재안의 차이가 작은 채널 한 곳부터 운영 변수 하나를 개선한다", "Improve one operating variable in a channel where the recommendation is close to current allocation"),
            hypothesis: verdict.tone === "bad"
              ? tr(`전역 입력을 보수적으로 조정하면 예상 평균 ${metricLabel} 악화를 피할 수 있을 것이다`, `A more conservative global input should avoid the projected deterioration in average ${metricLabel}`)
              : verdict.tone === "good"
                ? tr(
                  `추천안을 제한적으로 적용하면 평균 ${metricLabel}가 ${fmtCostMetric(verdict.S.prevAvgCPR, effectiveMetric, currency)}에서 ${fmtCostMetric(verdict.S.nextAvgCPR, effectiveMetric, currency)} 방향으로 움직일 것이다`,
                  `A limited rollout of the recommendation should move average ${metricLabel} from ${fmtCostMetric(verdict.S.prevAvgCPR, effectiveMetric, currency)} toward ${fmtCostMetric(verdict.S.nextAvgCPR, effectiveMetric, currency)}`,
                )
                : tr(
                  `채널 운영 변수 하나를 개선하면 재배분만 할 때보다 평균 ${metricLabel}가 더 나아질 것이다`,
                  `Improving one channel operating variable should move average ${metricLabel} more than reallocation alone`,
                ),
            metric: metricLabel,
            baseline: fmtCostMetric(verdict.S.prevAvgCPR, effectiveMetric, currency),
            sourcePeriod: tr(`최근 ${summary?.recentDays || recentDays}일`, `Recent ${summary?.recentDays || recentDays} days`),
            reviewQuestion: verdict.tone === "good"
              ? tr(
                `같은 길이의 실행 기간 뒤 실제 ${metricLabel}가 예상 방향으로 움직였는가?`,
                `After an equally long operating window, did actual ${metricLabel} move in the projected direction?`,
              )
              : verdict.tone === "bad"
                ? tr(
                  `전역 예산 또는 목표를 조정해 다시 계산했을 때 예상 ${metricLabel} 악화가 사라졌는가?`,
                  `After adjusting the global budget or target and rerunning, did the projected ${metricLabel} deterioration disappear?`,
                )
                : tr(
                  `운영 변수 하나를 바꾼 뒤 실제 ${metricLabel}가 현재 기준보다 개선됐는가?`,
                  `After changing one operating variable, did actual ${metricLabel} improve from the baseline?`,
                ),
          }}
          download={(
            <DownloadHub
              toolId="5-3"
              locale={locale}
              label={tr("실행 정보", "Run details")}
              manifest={buildResultManifest({
                toolId: "5-3",
                mode: allocMode === "c" ? "absolute-cpr" : "marginal-utility-greedy",
                source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
                inputSignature: `${csvData?.fileName || "dataset"}|${csvData?.raw?.length || 0}`,
                filter: {
                  recentDays,
                  budgetPeriod: planBudgetPeriod,
                  evidenceScope: "observed_xmax",
                  effectiveMetric,
                  planningBasis,
                  targetObjective: planningBasis === "target" ? activePlanningObjective : null,
                  targetValue: planningBasis === "target" ? plannedTargetValue : null,
                  targetStatus: planningBasis === "target" ? targetPlan?.status || "unavailable" : null,
                  plannedDailyBudget,
                },
                grain: allocMode === "b" ? "channel-model" : "channel-history",
                metricDefinitions: [{ key: effectiveMetric, aggregation: "custom" }],
                engineVersion: "budget-allocation-v1",
                status: "COMPLETE",
                warnings: ["Historical efficiency simulation is not causal incrementality"],
              })}
            />
          )}
          points={verdict.acts.map((text) => ({ text }))}
          stats={[
            {
              label: tr(planBudgetPeriod === "monthly" ? "총 월예산" : "총 일예산", planBudgetPeriod === "monthly" ? "Total monthly budget" : "Total daily budget"),
              value: fmtCurrency(planBudgetPeriod === "monthly" ? plannedDailyBudget * 30 : plannedDailyBudget, currency),
            },
            { label: tr("증액 / 감액", "Increase / decrease"), value: `${allocationMoveCounts.increase} / ${allocationMoveCounts.decrease}`, detail: tr(`유지 ${allocationMoveCounts.hold}`, `${allocationMoveCounts.hold} unchanged`) },
            { label: tr("조정 기준", "Planning basis"), value: planningBasis === "target" ? `${getCostMetricLabel(effectiveMetric)} ${fmtGoalMetric(plannedTargetValue, effectiveMetric, currency)}` : tr("총 예산", "Total budget") },
            { label: tr(`예상 평균 ${metricLabel}`, `Projected average ${metricLabel}`), value: `${verdict.S.prevAvgCPR != null ? fmtCostMetric(verdict.S.prevAvgCPR, effectiveMetric, currency) : "—"} → ${verdict.S.nextAvgCPR != null ? fmtCostMetric(verdict.S.nextAvgCPR, effectiveMetric, currency) : "—"}` },
          ]}
          analysisDetails={(
            <AnalysisDetails
              locale={locale}
              statusLabel={tr("시나리오 참고", "Scenario reference")}
              statusTone={verdict.tone === "bad" ? "warning" : "neutral"}
              metric={metricLabel}
              unit={unitLabel}
              meaning={tr("관측된 비용·성과 관계를 이용한 예산 시뮬레이션이며 인과 증분 효과가 아닙니다.", "A budget simulation from observed cost-performance relationships; it is not causal incrementality.")}
              sampleSize={{ value: rows.length, label: tr("입력 행", "Input rows") }}
              scope={tr(`최근 ${summary?.recentDays || recentDays}일`, `Recent ${summary?.recentDays || recentDays} days`)}
              method={allocMode === "c" ? "absolute-cpr-weighting" : "marginal-utility-greedy"}
              version="budget-allocation-v1"
              metricDefinition={tr("목표 지표·분모는 상단 설정과 현재 매핑을 따릅니다.", "The objective metric and denominator follow the current settings and mapping.")}
              warnings={[
                tr(
                  "자동 배분과 목표 예산은 채널별 관측 최대 Cost 안에서만 계산합니다. 관측 범위 밖 성과를 마지막 효율로 연장하지 않습니다.",
                  "Automatic allocation and target budgets do not exceed each channel's observed maximum cost. PRISM does not extend the last efficiency above observed spend."
                ),
                tr("채널별 수동 금액 고정은 하지 않습니다. 각 채널의 관측 지출 상한 안에서 전역 입력에 맞춰 자동 배분합니다.", "There are no manual per-channel spend pins. PRISM auto-allocates from the global input within each channel's observed-spend ceiling."),
              ]}
            />
          )}
        />
      )}

      {/* §1 효율·추세선 분석 — PRISM 결과-먼저(P5): 진단 산점도는 기본 접힘, 펼칠 때 canvas resize(§7 0px). */}
      <details
        className="block alloc-fold"
        id="s-scatter"
        onToggle={(e) => { if (e.currentTarget.open) requestAnimationFrame(() => chartInstance.current?.resize()); }}
      >
        <summary className="section-title alloc-fold-summary" style={{ cursor: "pointer" }}>
          <span className="ix">§1</span>{tr("효율 및 추세선 분석 (단위 곡선)", "Efficiency & trendline analysis (unit curve)")}
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400, marginLeft: "6px" }}>{tr("추세선 모델·이상치·산점도 — 펼쳐서 검증", "Trendline model · outliers · scatter — expand to verify")}</span>
        </summary>
        <div className="alloc-card" style={{ marginTop: "12px" }}>
          {advancedPanel}
          {/* 차트 표시 대상 채널 필터 (예산 분배와 무관) */}
          {rankedChannels.length > 1 && (
            <div style={{ marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "13px", color: "var(--text-1)" }}>{tr("차트 표시 대상 선택", "Select chart display targets")}</strong>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 8px" }}>{tr("아래에서 선택한 대상만 차트에 표시됩니다. (예산 분배와는 무관)", "Only the targets selected below are shown on the chart. (Unrelated to budget allocation)")}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {rankedChannels.map((ch) => {
                  const active = chartChannels ? chartChannels.has(ch) : rankedChannels.slice(0, 6).includes(ch);
                  return (
                    <button
                      key={ch}
                      className={`ab-pill ${active ? "active" : ""}`}
                      style={{ fontSize: "11px" }}
                      onClick={() =>
                        setChartChannels((prev) => {
                          const base = prev || new Set(rankedChannels.slice(0, 6));
                          const next = new Set(base);
                          if (next.has(ch)) next.delete(ch);
                          else next.add(ch);
                          return next;
                        })
                      }
                    >{ch}</button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="chart-canvas-wrap" style={{ height: "400px" }}>
            <canvas id="chart-alloc-scatter" ref={chartRef}></canvas>
          </div>
        </div>
      </details>

      {/* §0 진단 카드 — 지금 어디가 문제인가 (PRISM P5: 결론카드가 헤드라인, 상세 진단은 접힘) */}
      {diagnosis && (
        <details
          className="alloc-diag-card alloc-fold"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: "1rem" }}
        >
          <summary style={{ fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>🔍 {tr("진단 — 지금 어디가 문제인가", "Diagnosis — what's the problem right now")}</summary>
          <div style={{ marginTop: "8px" }}>
          {diagnosis.insufficient ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              {tr(
                `최근 ${recentDays}일 집행 데이터가 부족해 문제 진단을 생략합니다.`,
                `Not enough spend data in the last ${recentDays} days, so the problem diagnosis is skipped.`
              )}
            </div>
          ) : (
            diagnosis.lines.map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: "13px",
                  lineHeight: 1.55,
                  padding: "3px 0",
                  color:
                    l.cls === "bad"
                      ? "#f0917e"
                      : l.cls === "good"
                        ? "#5ad19a"
                        : l.cls === "muted"
                          ? "var(--text-muted)"
                          : "var(--text-secondary)",
                }}
              >
                {l.text}
              </div>
            ))
          )}
          </div>
        </details>
      )}

      {/* 총 합계 비교 카드 */}
      {summary && (
        <details style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: "1rem" }}>
          <summary style={{ fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
            {tr("총 합계 비교", "Total comparison")}{" "}
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400 }}>
              {tr("과거와 추천안의 상세 수치", "Detailed historical vs recommended figures")}
            </span>
          </summary>
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
            {tr(
              `알고리즘: ${allocMode === "c" ? "절대 CPR 가중" : "한계효용 그리디"} · 분배 기준: ${planBudgetPeriod === "monthly" ? "월 (÷30 환산)" : "일"}예산 · 비교 기준: 최근 ${summary.recentDays}일 CPR 기반`,
              `Algorithm: ${allocMode === "c" ? "absolute CPR weighting" : "marginal-utility greedy"} · Basis: ${planBudgetPeriod === "monthly" ? "monthly (÷30)" : "daily"} budget · Comparison: last ${summary.recentDays}-day CPR`
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", alignItems: "center", marginTop: "10px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>{tr(`과거 기준 (최근 ${summary.recentDays}일 평균 일예산)`, `Historical basis (avg. daily budget, last ${summary.recentDays} days)`)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("비용 (일평균)", "Cost (daily avg.)")}</span><strong className="tnum">{fmtCurrency(summary.prev.cost, currency)}</strong></div>
              {summary.prev.installs > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("설치 (예상)", "Installs (projected)")}</span><strong className="tnum">{formatNumberK(summary.prev.installs, 0)}</strong></div>}
              {summary.prev.actions > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("액션 (예상)", "Actions (projected)")}</span><strong className="tnum">{formatNumberK(summary.prev.actions, 0)}</strong></div>}
              {summary.prev.revenue > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("매출 (예상)", "Revenue (projected)")}</span><strong className="tnum">{fmtCurrency(summary.prev.revenue, currency)}</strong></div>}
              <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }}></div>
              {summary.prev.installs > 0 && summary.prev.cost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("평균 CPI", "Average CPI")}</span><strong className="tnum">{fmtCurrency(summary.prev.cost / summary.prev.installs, currency, { metric: true })}</strong></div>}
              {summary.prev.actions > 0 && summary.prev.cost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("평균 CPA", "Average CPA")}</span><strong className="tnum">{fmtCurrency(summary.prev.cost / summary.prev.actions, currency, { metric: true })}</strong></div>}
              {summary.prevROAS != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("평균 ROAS", "Average ROAS")}</span><strong className="tnum">{(summary.prevROAS * 100).toFixed(1)}%</strong></div>}
            </div>
            <div style={{ fontSize: "20px", color: "var(--text-muted)" }}>→</div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>{tr("분배 후 예상 (일 단위)", "Projected after allocation (daily)")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("총 배분 Cost", "Total allocated cost")}</span><strong className="tnum">{fmtCurrency(summary.next.cost, currency)}{allocation.unallocated > 0 && <span style={{ color: "var(--text-muted)", fontSize: "11px" }}> {tr("+미배분", "+unallocated")} {fmtCurrency(allocation.unallocated, currency)}</span>}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr(`예상 ${unitLabel}수`, `Projected ${unitLabel}s`)}</span><strong className="tnum">{formatNumberK(summary.next.results, 0)}</strong></div>
              {summary.nextRevenue > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("예상 매출", "Projected revenue")}</span><strong className="tnum">{fmtCurrency(summary.nextRevenue, currency)}</strong></div>}
              <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }}></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr(`예상 평균 ${metricLabel}`, `Projected average ${metricLabel}`)}</span><strong className="tnum">{fmtCostMetric(summary.nextAvgCPR, effectiveMetric, currency)}{(() => {
                const dPrev = displayMetricValue(summary.prevAvgCPR, effectiveMetric);
                const dNext = displayMetricValue(summary.nextAvgCPR, effectiveMetric);
                if (dPrev == null || dNext == null || dPrev === 0) return null;
                const d = dNext - dPrev;
                const good = roas ? d > 0 : d < 0;
                const ar = d > 0 ? "▲" : d < 0 ? "▼" : "—";
                const pct = Math.abs(d / dPrev) * 100;
                return <span style={{ fontSize: "11px", marginLeft: "4px", color: good ? "#5ad19a" : "#f0917e" }}>{ar} {pct.toFixed(1)}%</span>;
              })()}</strong></div>
              {summary.nextROAS != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "2px 0" }}><span>{tr("예상 ROAS", "Projected ROAS")}</span><strong className="tnum">{(summary.nextROAS * 100).toFixed(1)}%</strong></div>}
            </div>
          </div>
        </details>
      )}

      {/* §5 배분 점검 스트립 — PRISM P5: 접힘. summary에 tone별 한 줄 헤드라인만 노출(펼치면 상세). */}
      {verify && plannedDailyBudget > 0 && items.length >= 2 && (
        <details
          className="alloc-fold"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderLeft: `3px solid ${verify.tone === "good" ? "#5ad19a" : verify.tone === "bad" ? "#f0917e" : "var(--primary, #adc6ff)"}`,
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            marginBottom: "1rem",
            fontSize: "13px",
            lineHeight: 1.55,
          }}
        >
          <summary style={{ cursor: "pointer" }}>
            <strong>{verify.head}</strong> <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{tr("배분 점검 — 펼쳐서 근거 보기", "Allocation check — expand for details")}</span>
          </summary>
          <div style={{ marginTop: "6px" }}>
            <span style={{ color: "var(--text-secondary)" }}>{verify.body}</span>
            {verify.note && <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "12px" }}>{verify.note}</div>}
          </div>
        </details>
      )}

      {showTable && (() => {
        // #3 이전(과거) 평균 컬럼 — 최근 N일 평균 일예산/결과/CPR + 전체 비중
        const prevByCh = {};
        let prevTotalDaily = 0;
        items.forEach((it) => {
          const h = historyByCh[it.channel];
          const daily = h && isFinite(h.windowCost) ? h.windowCost / recentDays : 0;
          const resDaily = h && isFinite(h.windowResults) ? h.windowResults / recentDays : 0;
          prevByCh[it.channel] = { daily, resDaily, cpr: h ? h.avgCPR : null };
          prevTotalDaily += daily;
        });

        // ★3 롤업 — 유닛 키("국가 · 채널 · [캠페인] · OS")를 prefix로 그룹핑.
        // 분배는 finest 그대로, 여기선 표시용 합산 + 레이트 Σcost/Σresults 재계산(§8 함정).
        const rollupLevels = unitField === "campaign_name"
          ? [["detail", tr("상세", "Detail")], ["country_channel", tr("국가×채널", "Country×channel")], ["country", tr("국가", "Country")], ["all", tr("전체", "All")]]
          : unitField === "channel"
            ? [["detail", tr("상세", "Detail")], ["country", tr("국가", "Country")], ["all", tr("전체", "All")]]
            : [["detail", tr("상세", "Detail")], ["all", tr("전체", "All")]];
        const rollupKeyOf = (chKey) => {
          const parts = String(chKey).split(" · ");
          if (rollupLevel === "country") return parts[0] || chKey;
          if (rollupLevel === "country_channel") return parts.slice(0, 2).join(" · ") || chKey;
          if (rollupLevel === "all") return tr("전체", "All");
          return chKey;
        };
        const rollupRows = (() => {
          if (rollupLevel === "detail") return null;
          const m = new Map();
          items.forEach((it) => {
            const k = rollupKeyOf(it.channel);
            if (!m.has(k)) m.set(k, { channel: k, cost: 0, results: 0, prevDaily: 0, prevRes: 0 });
            const g = m.get(k);
            g.cost += it.cost; g.results += it.results;
            const p = prevByCh[it.channel] || { daily: 0, resDaily: 0 };
            g.prevDaily += p.daily; g.prevRes += p.resDaily;
          });
          const arr = [...m.values()];
          arr.forEach((g) => {
            g.cpr = g.results > 0 ? g.cost / g.results : null;       // Σcost/Σresults 재계산
            g.prevCpr = g.prevRes > 0 ? g.prevDaily / g.prevRes : null;
            g.weight = totalCost > 0 ? g.cost / totalCost : 0;
            g.prevShare = prevTotalDaily > 0 ? (g.prevDaily / prevTotalDaily) * 100 : 0;
          });
          return arr.sort((a, b) => b.cost - a.cost);
        })();

        return (
        <section className="block" id="s-table">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <h2 className="section-title" style={{ margin: 0 }}><span className="ix">§3</span>{tr("채널별 상세", "Channel detail")}</h2>
            {rollupLevels.length > 1 && (
              <div className="ab-pillgroup" style={{ margin: 0 }}>
                <span className="ab-pillgroup-label" title={tr("분배는 항상 최소 단위에서 계산되고, 여기 뷰만 합쳐서 봅니다(효율은 합계 기준 재계산).", "Allocation is always calculated at the finest unit — this view just merges it for display (efficiency is recalculated from the totals).")}>{tr("묶어 보기", "Group view")}</span>
                {rollupLevels.map(([k, l]) => (
                  <button key={k} className={`ab-pill ${rollupLevel === k ? "active" : ""}`} onClick={() => setRollupLevel(k)}>{l}</button>
                ))}
              </div>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "0 0 0.5rem" }}>
            {rollupLevel === "detail"
              ? tr(
                  <>각 행은 PRISM이 계산한 <strong>권장 배분 Cost</strong>와 그에 따른 <strong>예상 {unitLabel}·효율</strong>을 읽기 전용으로 표시합니다. 조정은 위의 전역 예산 또는 목표 슬라이더에서 합니다.</>,
                  <>Each row is a read-only result: PRISM&apos;s <strong>recommended allocated cost</strong> and its <strong>projected {unitLabel}s · efficiency</strong>. Adjust the global budget or target slider above, not a channel row.</>
                )
              : tr(
                  <>최소 단위 분배 결과를 <strong>{rollupLevels.find(([k]) => k === rollupLevel)?.[1]}</strong> 기준으로 합쳐 봅니다(읽기 전용). 효율은 합계에서 재계산합니다(Σ비용÷Σ{unitLabel}).</>,
                  <>This groups the finest-grain allocation results by <strong>{rollupLevels.find(([k]) => k === rollupLevel)?.[1]}</strong> (read-only). Efficiency is recalculated from the totals (Σcost ÷ Σ{unitLabel}s).</>
                )}
          </p>
          {rollupLevel !== "detail" && rollupRows ? (
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: "150px" }}>{rollupLevels.find(([k]) => k === rollupLevel)?.[1]}</th>
                    <th style={{ textAlign: "right" }}>{tr("배분 Cost", "Allocated cost")}</th>
                    <th style={{ textAlign: "right" }}>{tr(`예상 ${unitLabel}`, `Projected ${unitLabel}s`)}</th>
                    <th style={{ textAlign: "right" }}>{tr(`예상 ${roas ? "ROAS" : "CPR"}`, `Projected ${roas ? "ROAS" : "CPR"}`)}</th>
                    <th style={{ textAlign: "right" }}>{tr("비중", "Share")}</th>
                    <th style={{ textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{tr("이전 비용", "Prior cost")}</th>
                    <th style={{ textAlign: "right", color: "var(--text-muted)" }}>{tr(`이전 ${unitLabel}`, `Prior ${unitLabel}s`)}</th>
                    <th style={{ textAlign: "right", color: "var(--text-muted)" }}>{tr(`이전 ${roas ? "ROAS" : "CPR"}`, `Prior ${roas ? "ROAS" : "CPR"}`)}</th>
                    <th style={{ textAlign: "right", color: "var(--text-muted)" }}>{tr("이전 비중", "Prior share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rollupRows.map((g) => (
                    <tr key={g.channel}>
                      <td>{g.channel}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{fmtCurrency(Math.round(g.cost), currency)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{g.results > 0 ? formatNumberK(g.results, 0) : "—"}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{g.cpr != null ? fmtCostMetric(g.cpr, effectiveMetric, currency) : "—"}</td>
                      <td className="tnum" style={{ textAlign: "right" }}><strong>{(g.weight * 100).toFixed(1)}%</strong></td>
                      <td className="tnum" style={{ textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{g.prevDaily > 0 ? fmtCurrency(Math.round(g.prevDaily), currency) : "—"}</td>
                      <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{g.prevRes > 0 ? formatNumberK(g.prevRes, 0) : "—"}</td>
                      <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{g.prevCpr != null ? fmtCostMetric(g.prevCpr, effectiveMetric, currency) : "—"}</td>
                      <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{g.prevShare > 0 ? g.prevShare.toFixed(1) + "%" : "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--bg-2)", fontWeight: "bold", borderTop: "2px solid var(--border)" }}>
                    <td style={{ textAlign: "right", paddingRight: "16px" }}>TOTAL</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{fmtCurrency(totalCost, currency)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{formatNumberK(totalResults, 0)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{fmtCostMetric(avgCpr, effectiveMetric, currency)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>100.0%</td>
                    <td className="tnum" style={{ textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{prevTotalDaily > 0 ? fmtCurrency(Math.round(prevTotalDaily), currency) : "—"}</td>
                    <td></td><td></td>
                    <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{prevTotalDaily > 0 ? "100.0%" : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
          <div className="table-wrap">
            <table className="data" style={{ fontSize: "12px" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "150px" }}>{tr("채널 (검증 통과)", "Channel (verified)")}</th>
                  <th style={{ minWidth: "120px", textAlign: "right" }}>{tr("배분 Cost", "Allocated cost")}</th>
                  <th style={{ minWidth: "90px", textAlign: "right" }}>{tr(`예상 ${unitLabel}`, `Projected ${unitLabel}s`)}</th>
                  <th style={{ minWidth: "90px", textAlign: "right" }}>{tr(`예상 ${roas ? "ROAS" : "CPR"}`, `Projected ${roas ? "ROAS" : "CPR"}`)}</th>
                  <th style={{ minWidth: "96px", textAlign: "right" }} title={tr("현 지출점에서 지출을 조금 늘렸을 때 추가 1건당 비용(한계효율). 평균보다 나쁘면 증액을 신중히.", "Cost per additional conversion when spending a bit more at the current point (marginal efficiency). Worse than average → scale up cautiously.")}>{tr(`한계 ${roas ? "ROAS" : "CPR"}`, `Marginal ${roas ? "ROAS" : "CPR"}`)}</th>
                  <th style={{ minWidth: "60px", textAlign: "right" }}>{tr("비중", "Share")}</th>
                  <th style={{ minWidth: "90px", textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{tr("이전 비용", "Prior cost")}</th>
                  <th style={{ minWidth: "80px", textAlign: "right", color: "var(--text-muted)" }}>{tr(`이전 ${unitLabel}`, `Prior ${unitLabel}s`)}</th>
                  <th style={{ minWidth: "80px", textAlign: "right", color: "var(--text-muted)" }}>{tr(`이전 ${roas ? "ROAS" : "CPR"}`, `Prior ${roas ? "ROAS" : "CPR"}`)}</th>
                  <th style={{ minWidth: "60px", textAlign: "right", color: "var(--text-muted)" }}>{tr("이전 비중", "Prior share")}</th>
                </tr>
              </thead>
              <tbody>
                {!(plannedDailyBudget > 0) ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                      {tr("전역 예산 또는 효율 목표를 정하면 채널별 분배 결과가 계산됩니다.", "Set a global budget or efficiency target to calculate the channel allocation.")}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                      {tr("배분 가능한 채널이 없습니다. 검증 단계(§2)에서 추세선 적합에 성공한 채널이 있는지 확인하세요.", "No channels are available for allocation. Check whether any channels have a successful trendline fit in the verification step (§2).")}
                    </td>
                  </tr>
                ) : (
                  <>
                    {items.map((it, i) => {
                      const isZero = it.cost === 0;
                      const prev = prevByCh[it.channel] || { daily: 0, resDaily: 0, cpr: null };
                      const prevShare = prevTotalDaily > 0 ? (prev.daily / prevTotalDaily) * 100 : 0;
                      const wrap = modelsMap.get(it.channel);
                      const mCpr = allocMarginalCpr(wrap, it.cost);
                      const conf = allocConfidence(wrap);
                      return (
                        <tr key={it.channel} className={isZero ? "alloc-row-zero" : ""}>
                          <td>
                            <div className="alloc-ch-name" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <span className="sw" style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: CHART_THEME.series[i % CHART_THEME.series.length] }}></span>
                              {it.channel}
                              {conf && (
                                <span
                                  title={tr(`적합 신뢰도 ${conf.ko} · R²=${(conf.r2 || 0).toFixed(2)} · 점 ${conf.n}개 (적합 품질·데이터 기반, 확률 아님)`, `Fit confidence ${conf.en} · R²=${(conf.r2 || 0).toFixed(2)} · ${conf.n} pts (fit quality/data, not probability)`)}
                                  style={{ fontSize: "10px", lineHeight: 1.5, padding: "0 6px", borderRadius: "10px", whiteSpace: "nowrap", background: conf.level === "high" ? "var(--success)" : conf.level === "low" ? "var(--danger)" : "var(--bg-1)", color: conf.level === "med" ? "var(--text-muted)" : "#fff", border: conf.level === "med" ? "1px solid var(--border)" : "none" }}
                                >{tr(conf.ko, conf.en)}</span>
                              )}
                            </div>
                          </td>
                          <td className="tnum" style={{ textAlign: "right" }}><strong>{fmtCurrency(it.cost, currency)}</strong></td>
                          <td className="tnum" style={{ textAlign: "right" }}>
                            {isZero ? <span style={{ color: "var(--text-muted)" }}>—</span> : formatNumberK(it.results, 0)}
                          </td>
                          <td className="tnum" style={{ textAlign: "right" }}>
                            {isZero ? <span style={{ color: "var(--text-muted)" }}>—</span> : fmtCostMetric(it.cpr, effectiveMetric, currency)}
                          </td>
                          <td className="tnum" style={{ textAlign: "right" }}>
                            {isZero || mCpr == null ? <span style={{ color: "var(--text-muted)" }}>—</span> : !isFinite(mCpr) ? <span style={{ color: "var(--text-muted)" }} title={tr("한계효용 ≤ 0 — 더 투입해도 효율↑ 없음", "marginal utility ≤ 0 — no gain from more spend")}>∞</span> : fmtCostMetric(mCpr, effectiveMetric, currency)}
                          </td>
                          <td className="tnum" style={{ textAlign: "right" }}><strong>{(it.weight * 100).toFixed(1)}%</strong></td>
                          <td className="tnum" style={{ textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{prev.daily > 0 ? fmtCurrency(prev.daily, currency) : "—"}</td>
                          <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{prev.resDaily > 0 ? formatNumberK(prev.resDaily, 0) : "—"}</td>
                          <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{prev.cpr != null ? fmtCostMetric(prev.cpr, effectiveMetric, currency) : "—"}</td>
                          <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{prevShare > 0 ? prevShare.toFixed(1) + "%" : "—"}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--bg-2)", fontWeight: "bold", borderTop: "2px solid var(--border)" }}>
                      <td style={{ textAlign: "right", paddingRight: "16px" }}>TOTAL</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{fmtCurrency(totalCost, currency)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{formatNumberK(totalResults, 0)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{fmtCostMetric(avgCpr, effectiveMetric, currency)}</td>
                      <td></td>
                      <td className="tnum" style={{ textAlign: "right" }}>100.0%</td>
                      <td className="tnum" style={{ textAlign: "right", borderLeft: "2px solid var(--border)", color: "var(--text-muted)" }}>{prevTotalDaily > 0 ? fmtCurrency(prevTotalDaily, currency) : "—"}</td>
                      <td></td>
                      <td></td>
                      <td className="tnum" style={{ textAlign: "right", color: "var(--text-muted)" }}>{prevTotalDaily > 0 ? "100.0%" : "—"}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          )}
          {allocation.unallocated > 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>
              · {tr(
                `미배분 ${fmtCurrency(allocation.unallocated, currency)} (채널별 관측 최대 지출 상한 또는 한계효용 때문에 자동 집행하지 않음)`,
                `${fmtCurrency(allocation.unallocated, currency)} unallocated (PRISM will not spend beyond a channel's observed-spend ceiling or positive marginal utility)`
              )}
            </p>
          )}
        </section>
        );
      })()}

      <section className="block" id="s-bar">
          <h2 className="section-title">
            <span className="ix">§4</span>{tr("권장 배분 비중", "Recommended allocation share")}
          </h2>
          {!(plannedDailyBudget > 0) || items.length === 0 ? (
            <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
              {tr("전역 예산 또는 효율 목표를 정하면 채널별 권장 비중이 표시됩니다.", "Set a global budget or efficiency target to see the recommended channel allocation share.")}
            </p>
          ) : (
            <div className="chart-container" style={{ height: "120px", marginTop: "12px" }}>
              <canvas id="alloc-bar" ref={barChartRef}></canvas>
            </div>
          )}
        </section>

      {/* §5 What-if 시나리오 */}
      <section className="block" id="s-scenario">
          <h2 className="section-title"><span className="ix">§5</span>{tr("What-if 시나리오 (예산별 예상 성과)", "What-if scenarios (projected performance by budget)")}</h2>
          {!(plannedDailyBudget > 0) || scenarios.length === 0 ? (
            <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
              {tr("전역 입력을 정하면 해당 계획 예산의 0.5×~2× 구간을 같은 알고리즘으로 비교합니다.", "Set a global input to compare the 0.5×–2× range around that planned budget with the same algorithm.")}
            </p>
          ) : (
            <div className="alloc-card">
              <div className="chart-container" style={{ height: "280px" }}>
                <canvas id="alloc-scenario-chart" ref={scenarioChartRef}></canvas>
              </div>
              <div className="table-wrap" style={{ marginTop: "12px" }}>
                <table className="data" style={{ fontSize: "11.5px" }}>
                  <thead>
                    <tr>
                      <th>{tr("시나리오", "Scenario")}</th>
                      <th style={{ textAlign: "right" }}>{tr("예산(일)", "Budget (daily)")}</th>
                      <th style={{ textAlign: "right" }}>{tr(`예상 ${unitLabel}수`, `Projected ${unitLabel}s`)}</th>
                      <th style={{ textAlign: "right" }}>{tr(`예상 평균 ${metricLabel}`, `Projected avg. ${metricLabel}`)}</th>
                      <th style={{ textAlign: "right" }}>Δ{unitLabel} {tr("vs 현재", "vs current")}</th>
                      <th style={{ textAlign: "right" }}>ΔCost</th>
                      <th style={{ textAlign: "right" }}>{tr(`증분 ${roas ? "ROAS" : metricLabel}`, `Incremental ${roas ? "ROAS" : metricLabel}`)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const base = scenarios.find((s) => s.m === 1.0);
                      return scenarios.map((s) => {
                        const dResults = base ? s.totResults - base.totResults : 0;
                        const dCost = base ? s.totCost - base.totCost : 0;
                        const marginal = dCost !== 0 ? dResults / dCost : null;
                        const isBase = s.m === 1.0;
                        return (
                          <tr key={s.m} style={{ background: isBase ? "rgba(173,198,255,0.10)" : "transparent" }}>
                            <td className="tnum">{s.m}× {isBase && <span style={{ color: "var(--primary, #adc6ff)", fontSize: "10px" }}>{tr("현재", "current")}</span>}</td>
                            <td className="tnum" style={{ textAlign: "right" }}>{fmtCurrency(s.budget, currency)}</td>
                            <td className="tnum" style={{ textAlign: "right" }}><strong>{formatNumberK(s.totResults, 0)}</strong> {unitLabel}{locale === "en" ? "s" : ""}</td>
                            <td className="tnum" style={{ textAlign: "right" }}>{fmtCostMetric(s.avgCpr, effectiveMetric, currency)}</td>
                            <td className="tnum" style={{ textAlign: "right" }}>{isBase ? "—" : (dResults >= 0 ? "+" : "") + formatNumberK(dResults, 0)}</td>
                            <td className="tnum" style={{ textAlign: "right" }}>{isBase ? "—" : (dCost >= 0 ? "+" : "") + fmtCurrency(dCost, currency)}</td>
                            <td className="tnum" style={{ textAlign: "right" }}>{isBase || marginal == null ? "—" : roas ? marginal.toFixed(2) + "×" : fmtCurrency(1 / marginal, currency, { metric: true })}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                {tr(
                  <>증분 {roas ? "ROAS" : metricLabel} = 현재 대비 <strong>추가 비용 1단위가 만드는 추가 {unitLabel}</strong>의 효율. 증액할수록 악화되면(=한계효용 체감) 그 지점이 증액 한계입니다.</>,
                  <>Incremental {roas ? "ROAS" : metricLabel} = the efficiency of <strong>the extra {unitLabel}s produced by one more unit of spend</strong>, vs. current. If it keeps worsening as you increase spend (diminishing marginal utility), that&apos;s the point where you should stop scaling up.</>
                )}
              </p>
            </div>
          )}
        </section>

      {/* §6 채널 반응 곡선 (PRISM P4) — 지출→결과 곡선 + now/plan/knee/onset 마커 */}
      <section className="block" id="s-response">
        <h2 className="section-title"><span className="ix">§6</span>{tr("채널 반응 곡선 (지출 → 결과)", "Channel response curve (spend → results)")}</h2>
        {!responseCurve || !responseCurve.curve || !responseCurve.curve.points.length ? (
          <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
            {tr("총 예산을 입력하고 채널을 선택하면 지출을 늘릴 때 결과가 어떻게 늘어나는지(수확체감·과포화 지점 포함) 곡선으로 보여줍니다.", "Enter a total budget and pick a channel to see how results grow as you increase spend — including the diminishing-returns and over-saturation points.")}
          </p>
        ) : (
          <div className="alloc-card">
            {/* 채널 선택 pill */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
              {allocation.items.map((it, i) => (
                <button
                  key={it.channel}
                  type="button"
                  className={`btn ${it.channel === curveCh ? "" : "secondary"}`}
                  onClick={() => setCurveChannel(it.channel)}
                  style={{ padding: "4px 10px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "2px", background: CHART_THEME.series[i % CHART_THEME.series.length] }}></span>
                  {it.channel}
                </button>
              ))}
            </div>
            <div className="chart-container" style={{ height: "300px" }}>
              <canvas id="alloc-response-curve" ref={curveChartRef}></canvas>
            </div>
            {/* 마커 평어 해석 (§8 정직: 없는 지점은 없다고 명시) */}
            {(() => {
              const c = responseCurve.curve;
              const m = c.markers;
              const roasM = isRoasMetric(effectiveMetric);
              const resAt = (pt) => (pt ? `${formatNumberK(pt.y, 0)} ${unitLabel}${locale === "en" ? "s" : ""}` : "—");
              return (
                <div style={{ fontSize: "12px", marginTop: "10px", lineHeight: 1.6, color: "var(--text-1)" }}>
                  <div>
                    <strong>{tr("현재", "Now")}</strong> {fmtCurrency(responseCurve.now, currency)} → {resAt(m.now)}
                    {" · "}
                    <strong>{tr("계획", "Plan")}</strong> {fmtCurrency(responseCurve.plan, currency)} → {resAt(m.plan)}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                    {m.knee
                      ? tr(`효율 최적 ≈ ${fmtCurrency(m.knee.x, currency)} — 이 지점부터 추가 지출당 결과 증가가 뚜렷이 둔화됩니다.`, `Optimal ≈ ${fmtCurrency(m.knee.x, currency)} — beyond here, results per extra unit of spend slow down sharply.`)
                      : tr("효율 최적 지점: 관측 범위에서 뚜렷한 수확체감 꺾임이 없습니다.", "Optimal point: no clear diminishing-returns knee within the observed range.")}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                    {m.onset
                      ? tr(`과포화 시작 ≈ ${fmtCurrency(m.onset.x, currency)} — 이 지점을 넘으면 추가 1${roasM ? "원" : "건"}의 ${roasM ? "매출 효율" : "획득 비용"}이 평균보다 나빠집니다.`, `Over-saturation ≈ ${fmtCurrency(m.onset.x, currency)} — past this point each extra unit performs worse than your average.`)
                      : tr("과포화 지점: 관측+추정 범위 안에서는 아직 과포화에 도달하지 않았습니다.", "Over-saturation: not yet reached within the observed + estimated range.")}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: "4px", fontSize: "11px" }}>
                    {tr(`관측 범위 ${fmtCurrency(c.xMin, currency)}~${fmtCurrency(c.xMax, currency)} · 점선 구간은 데이터 밖 추정(신뢰 낮음).`, `Observed range ${fmtCurrency(c.xMin, currency)}~${fmtCurrency(c.xMax, currency)} · the dashed segment is an out-of-data estimate (low confidence).`)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* §7 알고리즘 노트 (index.html s-algo 이식) */}
      <section className="block" id="s-algo">
        <h2 className="section-title"><span className="ix">§7</span>{tr("알고리즘 노트", "Algorithm notes")}</h2>
        <p>{tr(
          <>본 페이지는 Campaign Allocator(Streamlit)의 <strong>모드 A · 효율 기반 추천 비중</strong>을 JS로 포팅한 것입니다. 핵심 식:</>,
          <>This page is a JS port of Campaign Allocator&apos;s (Streamlit) <strong>Mode A · efficiency-based recommended share</strong>. Core formula:</>
        )}</p>
        <pre style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px", fontSize: "11.5px", overflowX: "auto", lineHeight: 1.5 }}>
          <code>{tr(
            `# 1) 채널별 합산
channel_cost    = Σ cost
channel_results = Σ conversions   # installs or pu_d7

# 2) 채널별 CPR (Cost Per Result)
CPR = channel_cost / channel_results

# 3) Efficiency = 역수, 정규화
efficiency = 1 / CPR
weight     = efficiency_i / Σ efficiency

# 4) 배분
allocation = total_budget × weight`,
            `# 1) Sum per channel
channel_cost    = Σ cost
channel_results = Σ conversions   # installs or pu_d7

# 2) CPR per channel (Cost Per Result)
CPR = channel_cost / channel_results

# 3) Efficiency = inverse, normalized
efficiency = 1 / CPR
weight     = efficiency_i / Σ efficiency

# 4) Allocation
allocation = total_budget × weight`
          )}</code>
        </pre>
        <p style={{ marginTop: "1rem" }}>
          {tr(
            <><strong>그리디 (고급·실험적, 모드 B)</strong>는 채널별로 Linear/Log/Poly2/Power 추세선을 적합하고, 작은 step 단위로 Δresults가 최대인 채널에 예산을 투입하는 방식. 관측 Cost 상한과 최신 데이터 가중치 옵션을 함께 적용합니다.</>,
            <><strong>Greedy (advanced/experimental, Mode B)</strong> fits a Linear/Log/Poly2/Power trendline per channel and, in small steps, allocates budget to whichever channel has the largest Δresults. It applies the observed cost ceiling and an optional recency weighting.</>
          )}
        </p>
        <div className="callout warning" style={{ marginTop: "0.75rem" }}>
          <div className="ico">⚠</div>
          <div className="body">
            <strong>{tr("그리디 주의사항", "Greedy mode caution")}</strong>
            <p>{tr(
              <>채널별 spend 변동이 작거나 데이터가 적으면 곡선 적합이 불안정해져 추천이 편향될 수 있습니다. <strong>기본 추천은 절대 CPR/ROAS 가중</strong>을 권장합니다.</>,
              <>If per-channel spend doesn&apos;t vary much or there&apos;s little data, curve fitting can become unstable and bias the recommendation. <strong>Absolute CPR/ROAS weighting is recommended as the default</strong>.</>
            )}</p>
          </div>
        </div>
        <div className="callout info" style={{ marginTop: "1rem" }}>
          <div className="ico">i</div>
          <div className="body">
            <strong>{tr("주의", "Note")}</strong>
            <p>{tr(
              "본 추천은 과거 데이터 기준입니다. 신규 채널 진입, 시장 변화, 매체 알고리즘 업데이트 시 재계산 필요. 절대 CPR/ROAS 가중은 데이터 부족·노이즈 채널에서도 안정적인 1차 권고를 제공합니다.",
              "This recommendation is based on historical data. Recalculate when entering new channels, when the market shifts, or after ad-platform algorithm updates. Absolute CPR/ROAS weighting gives a stable first-pass recommendation even for data-sparse or noisy channels."
            )}</p>
          </div>
        </div>
      </section>
      </ToolPageShell>
    </div>
  );
}
