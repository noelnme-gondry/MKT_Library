"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import * as XLSX from "xlsx";
import { useAppStore } from "@/store/useDataStore";
import {
  MMM_METH_CONFIG,
  MMM_CHANNELS,
  MMM_NONMEDIA_GROUPS,
  mmmValidate,
  mmmBayesianRun,
  mmmBayesianWeeklyDecomp,
  mmmBayesianForecast,
  mmmTrendExistence,
  mmmElasticities,
  mmmCannibalization,
  mmmChannelCoverage,
  mmmIRF,
  mmmAudit,
  mmmMacroFacts,
  mmmResolveAbsorb,
  _mmmChans,
} from "@/utils/mmmMath";
import { mmmOls } from "@/utils/regMath";
import {
  mmmBuildCannibRank,
  mmmCannibLevel,
  mmmCannibActionShort,
  mmmGlobalCannib,
  mmmRankCfg,
  CANNIBAL_RANK,
} from "@/utils/responseCannibRank";
import CsvUploader from "@/components/CsvUploader";
import { trackProductEvent } from "@/lib/analytics";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import { buildDemoCsv, buildMmmPriorDemo } from "@/utils/demoData";
import MmmColumnMapper, { autoGuessColMap, buildPanelFromColMap, mmmPlatformTags, mmmSegmentValues } from "@/components/tools/MmmColumnMapper";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import AnalysisControlBar from "@/components/dashboard/AnalysisControlBar";
import { CURRENCY_SYMBOLS, convertCurrency, fmtCompact } from "@/utils/format";
import { buildMmmWeeklyPerformance } from "@/utils/mmmWeeklyPerformance";

/* ============================================================================
 * MarketingResponse (5-18) — MOCK → REAL 와이어링
 * index.html page_5_18 이식. 엔진(mmmMath/regMath/regForecastMath/regLabMath/
 * responseMath)은 이미 포팅·골든 검증됨 — 수학 재구현 금지, 이 컴포넌트는
 * (1) MmmColumnMapper(DnD colMap, index.html page_5_18 이식)가 PRIMARY 매퍼 — 단일 generic CSV를
 *     역할로 드래그 → buildPanelFromColMap로 패널 생성(모든 분석 공유)  (2) 엔진 호출  (3) 렌더.
 * 결정론(§3): 난수 사용 금지(0건). seededNoise만 사용.
 * ========================================================================== */

// _mmmSanKey 이식 — 채널/더미 키 위생(c_<slug>)
function mmmSanKey(name) {
  return (
    "c_" +
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

// 브랜드 채널 판별(이름 기반) — index kind='brand' 휴리스틱
function isBrandName(name) {
  return /brand|branded|검색|search.?ads|asa\b|apple.?search|브랜드/i.test(String(name || ""));
}

// _mmmTrimToActive 이식 — targets+ch 전부 0인 선/후행 주 제거(n≥4 가드)
function trimToActive(panel) {
  const n = panel.week.length;
  if (n < 4) return panel;
  const chKeys = Object.keys(panel.ch);
  const tgtKeys = Object.keys(panel.targets);
  const activeAt = (i) => {
    let s = 0;
    for (const k of tgtKeys) s += Math.abs(panel.targets[k][i] || 0);
    for (const k of chKeys) {
      const v = panel.ch[k][i];
      if (isFinite(v)) s += Math.abs(v || 0);
    }
    return s > 0;
  };
  let head = 0;
  while (head < n && !activeAt(head)) head++;
  let tail = n - 1;
  while (tail > head && !activeAt(tail)) tail--;
  if (head === 0 && tail === n - 1) return panel;
  if (tail - head + 1 < 4) return panel; // 너무 짧아지면 트림 안 함
  const slice = (arr) => arr.slice(head, tail + 1);
  const out = {
    ...panel,
    week: slice(panel.week),
    weekLabel: panel.weekLabel ? slice(panel.weekLabel) : undefined,
    ch: {},
    dummy: {},
    steps: {},
    targets: {},
  };
  for (const k of chKeys) out.ch[k] = slice(panel.ch[k]);
  for (const k of Object.keys(panel.dummy || {})) out.dummy[k] = slice(panel.dummy[k]);
  for (const k of Object.keys(panel.steps || {})) out.steps[k] = slice(panel.steps[k]);
  for (const k of tgtKeys) out.targets[k] = slice(panel.targets[k]);
  out.trimmed = { droppedHead: head, droppedTail: n - 1 - tail, origN: n, usedN: tail - head + 1 };
  return out;
}

function pickTarget(panel, preferred) {
  const avail = Object.keys(panel.targets);
  if (preferred && avail.includes(preferred)) return preferred;
  if (avail.includes("Regs")) return "Regs";
  return avail[0] || "Regs";
}

// Prior 원자료의 Y는 현재 MMM에서 고른 목표와 의미가 정확히 같을 때만 쓴다.
// "첫 번째 KPI 컬럼"으로 폴백하면 가입 근거가 매출 모델에 섞일 수 있으므로 금지한다.
const MMM_TARGET_HEADER_PATTERNS = {
  Traffic: /traffic|total.?visit|total.?user|총.?유입|방문자|sessions?/i,
  Regs: /signups?|registrations?|가입|등록/i,
  React: /reactiv|재유입|재활성/i,
  Purchasers: /purchaser|buyer|구매자|결제자/i,
  Revenue: /revenue|sales|gmv|매출|결제금액|payment/i,
};

function mmmTargetHeader(headers, target) {
  const pattern = MMM_TARGET_HEADER_PATTERNS[target];
  return pattern ? (headers || []).find((header) => pattern.test(String(header))) : null;
}

// 신뢰도 dots — p값 → ●●● / ●●○ / ●○○ / ○○○
function pDots(p) {
  if (p == null || !isFinite(p)) return "○○○";
  if (p < 0.01) return "●●●";
  if (p < 0.05) return "●●○";
  if (p < 0.1) return "●○○";
  return "○○○";
}
const POS = "#f87171";
const NEG = "#22c55e";
const MUTED = "var(--text-muted)";

const VERDICT_META = {
  ko: {
    incremental: { txt: "증분 ✓", color: NEG },
    suppress: { txt: "잠식 의심 ⚠", color: POS },
    noise: { txt: "불확실", color: MUTED },
    uncertain: { txt: "불확실", color: MUTED },
    sparse: { txt: "데이터 부족 ⊘", color: MUTED },
  },
  en: {
    incremental: { txt: "Incremental ✓", color: NEG },
    suppress: { txt: "Cannibalization? ⚠", color: POS },
    noise: { txt: "Uncertain", color: MUTED },
    uncertain: { txt: "Uncertain", color: MUTED },
    sparse: { txt: "Insufficient data ⊘", color: MUTED },
  },
};

// 상태 배지(Red/Yellow/Green) — 카니발 판정 등 Card 레이아웃 전반에서 재사용.
const BADGE_TONE = {
  ok: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.45)", color: "#22c55e" },
  warn: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", color: "#fbbf24" },
  danger: { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.45)", color: "#f87171" },
  neutral: { bg: "var(--bg-2)", border: "var(--border)", color: MUTED },
};
function Badge({ tone = "neutral", color, children }) {
  const c = BADGE_TONE[tone] || BADGE_TONE.neutral;
  const finalColor = color || c.color;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", background: color ? `${color}1f` : c.bg, border: `1px solid ${color || c.border}`, color: finalColor, fontWeight: 700, fontSize: "11.5px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
// Card — border/shadow/rounded 래퍼(레거시 톤 복구, §6).
function Card({ children, style }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: "14px 16px", background: "var(--bg-2)", ...style }}>
      {children}
    </div>
  );
}

// 통계 상세(아코디언 B) 소제목 — 좌측 액센트 바 + 볼드 + 평어 한 줄로 섹션 구분.
function StatHead({ title, hint }) {
  return (
    <div style={{ margin: "18px 0 8px", borderLeft: "3px solid var(--primary, #adc6ff)", paddingLeft: "10px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-1)" }}>{title}</div>
      {hint ? <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", lineHeight: 1.55 }}>{hint}</div> : null}
    </div>
  );
}

// 그룹별 기여 패널 — 단일 누적 막대는 큰 기본수요에 가려 마케팅·이벤트의
// 시계열이 읽히지 않는다. 회사 MMM과 같이 그룹마다 독립 y축을 쓴다.
function ContributionGroupPanel({ label, values, labels, color, locale }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const css = getComputedStyle(document.body);
    const muted = css.getPropertyValue("--text-muted").trim() || "#718096";
    const grid = css.getPropertyValue("--border").trim() || "rgba(148,163,184,.25)";
    const chart = new Chart(ref.current.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ label, data: values, backgroundColor: color, borderColor: color, borderWidth: 0, borderRadius: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${label}: ${ctx.parsed.y >= 0 ? "+" : ""}${Math.round(ctx.parsed.y).toLocaleString()}${locale === "ko" ? "명" : ""}` } } },
        scales: {
          x: { ticks: { color: muted, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: muted, callback: (v) => Math.round(v).toLocaleString() }, grid: { color: grid } },
        },
      },
    });
    requestAnimationFrame(() => chart.resize());
    return () => chart.destroy();
  }, [label, values, labels, color, locale]);
  return <div className="chart-container" style={{ height: "190px", minHeight: "190px" }}><canvas ref={ref}></canvas></div>;
}

// ③ 순증분 검정은 막대차트보다 "0 포함 여부"가 판단 핵심이다. 점추정·구간·판정을
// 한 줄에 고정해, 녹색 막대가 오류인지 효과인지 혼동되지 않게 한다.
function NetEffectEvidence({ net, locale }) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const coef = Number(net?.net_elasticity);
  const lo = Number(net?.ci_lo);
  const hi = Number(net?.ci_hi);
  if (![coef, lo, hi].every(Number.isFinite)) return <Card style={{ fontSize: "12px", color: MUTED }}>{tx("순증분 효과를 추정할 데이터가 부족합니다.", "Not enough data to estimate net incremental effect.")}</Card>;
  const min = Math.min(lo, 0, coef) - Math.max(0.03, Math.abs(hi - lo) * 0.12);
  const max = Math.max(hi, 0, coef) + Math.max(0.03, Math.abs(hi - lo) * 0.12);
  const pos = (v) => `${((v - min) / Math.max(1e-9, max - min)) * 100}%`;
  const isPositive = lo > 0;
  const isNegative = hi < 0;
  const verdict = isPositive
    ? tx("0을 넘지 않음: 광고 증액 뒤 전체 성과가 늘어날 가능성이 높습니다.", "Interval stays above 0: additional spend likely lifts total outcome.")
    : isNegative
      ? tx("0을 넘지 않음: 광고 증액이 전체 성과를 깎을 가능성이 있습니다.", "Interval stays below 0: additional spend may reduce total outcome.")
      : tx("0을 포함함: 순증가·순감소 어느 쪽도 확정할 수 없습니다. 이 결과는 보류입니다.", "Interval includes 0: neither net lift nor decline is established. Treat as inconclusive.");
  const tone = isPositive ? NEG : isNegative ? POS : "#f59e0b";
  return <Card style={{ padding: "14px 16px" }}>
    <div style={{ display: "flex", gap: "18px", alignItems: "baseline", flexWrap: "wrap" }}>
      <div><div className="lbl">{tx("점추정", "Point estimate")}</div><div style={{ fontSize: "24px", fontWeight: 750, color: tone }}>{coef >= 0 ? "+" : ""}{fmtOne(coef)}%</div></div>
      <div><div className="lbl">{tx("95% 신뢰구간", "95% confidence interval")}</div><div style={{ fontSize: "16px", fontWeight: 650 }}>[{fmtOne(lo)}%, {fmtOne(hi)}%]</div></div>
    </div>
    <div style={{ position: "relative", height: "48px", margin: "14px 8px 4px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ position: "absolute", left: pos(0), top: "0", bottom: "0", borderLeft: "1px dashed var(--text-muted)" }}><span style={{ position: "absolute", top: "28px", left: "-4px", fontSize: "10px", color: MUTED }}>0</span></div>
      <div style={{ position: "absolute", left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, top: "18px", height: "5px", borderRadius: "4px", background: tone }}></div>
      <div style={{ position: "absolute", left: pos(coef), top: "11px", width: "18px", height: "18px", marginLeft: "-9px", borderRadius: "50%", background: tone, border: "3px solid var(--bg-2)", boxShadow: "0 0 0 1px var(--border)" }} title={tx("점추정", "Point estimate")}></div>
    </div>
    <p style={{ fontSize: "11.5px", color: "var(--text-1)", margin: "12px 0 0", lineHeight: 1.5 }}><strong style={{ color: tone }}>{verdict}</strong> {tx("값은 ‘이 채널 지출 1% 증가 시 전체 성과가 몇 % 움직였는가’입니다.", "Value means expected % change in total outcome for a 1% spend increase in this channel.")}</p>
  </Card>;
}

// Prior는 기본 MMM을 대체하는 숨은 설정이 아니라, 어떤 외부 근거를 썼는지
// 결과 화면에서 추적·비교할 수 있는 별도 레이어다. 아직 근거가 없으면 이 카드도
// 조용히 기본 모델만 보여 준다. 실제 prior 추정은 원자료 검증을 거친 뒤에만 켠다.
function MmmEvidenceLedger({ locale, priorView, onPriorView, evidence, onEvidence, onLoadDemo, appliedPriorCount = 0, countryCandidates = [] }) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const experimentRef = useRef(null);
  const countryRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const parseEvidence = (file, kind) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields || [];
        const countryHeader = headers.find((h) => /(^|[_\s])(country|market)([_\s]|$)|국가|시장/i.test(String(h)));
        const countries = countryHeader
          ? [...new Set(data.map((row) => String(row[countryHeader] || "").trim()).filter(Boolean))].slice(0, 50)
          : [];
        onEvidence((current) => ({ ...current, [kind]: { name: file.name, rows: data.length, countries, raw: data, headers } }));
      },
    });
  };
  const hasExperiment = !!evidence.experiment;
  const hasCountry = !!evidence.country;
  const views = [
    { id: "base", label: tx("기본 데이터만", "Base data") },
    ...(hasExperiment ? [{ id: "experiment", label: tx("실험 근거", "Experiment evidence") }] : []),
    ...(hasCountry ? [{ id: "country", label: tx("추천 국가 세트", "Recommended markets") }] : []),
  ];
  return (
    <section className="mmm-evidence-ledger" aria-label={tx("근거 보정", "Evidence calibration")}>
      <div className="mmm-evidence-ledger__topline">
        <div>
          <span className="mmm-evidence-ledger__eyebrow">{tx("MODEL EVIDENCE", "MODEL EVIDENCE")}</span>
          <h2>{tx("결론의 근거를 분리해서 봅니다", "Keep the evidence behind the conclusion visible")}</h2>
          <p>{tx("근거가 없으면 지금의 기본 MMM만 사용합니다. 실험·국가 데이터는 선택적으로 추가하고, 적용 전후를 같은 화면에서 비교합니다.", "Without added evidence, this remains the current base MMM. Experiment and market data are optional and are compared beside the base model.")}</p>
        </div>
        <button className="ab-pill" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
          {isOpen ? tx("근거 설정 닫기", "Close evidence setup") : tx("근거 데이터 추가", "Add evidence")}
        </button>
      </div>

      <div className="mmm-evidence-ledger__views" role="tablist" aria-label={tx("모델 보기", "Model view")}>
        {views.map((view) => (
          <button key={view.id} role="tab" aria-selected={priorView === view.id}
            className={`mmm-evidence-ledger__view ${priorView === view.id ? "is-active" : ""}`}
            onClick={() => onPriorView(view.id)}>{view.label}</button>
        ))}
        {!hasExperiment && !hasCountry && <span className="mmm-evidence-ledger__base-note">{tx("현재: 기본 MMM", "Current: base MMM")}</span>}
      </div>

      {priorView !== "base" && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{appliedPriorCount ? tx(`${appliedPriorCount}개 채널 prior가 현재 모델에 적용되었습니다.`, `${appliedPriorCount} channel priors are applied to this model.`) : tx("적용 가능한 prior를 찾지 못했습니다.", "No applicable prior was found.")}</strong>
          <span>{appliedPriorCount ? tx("참고 국가의 매체 효과만 약하게 반영했습니다. 국가별 baseline·추세·계절성은 이식하지 않습니다.", "Only media effects are weakly borrowed; country baseline, trend, and seasonality are not transferred.") : tx("KPI·채널 헤더가 타깃 데이터와 같은지 확인하세요. 현재 수치는 기본 MMM 결과입니다.", "Check that KPI and channel headers match the target data. The figures shown remain the base MMM.")}</span>
        </div>
      )}
      {priorView === "country" && countryCandidates.length > 0 && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{tx(`추천 조합: ${countryCandidates[0].country} · 타깃 시장 마지막 12주 검증`, `Recommended set: ${countryCandidates[0].country} · target final-12-week validation`)}</strong>
          <span>{countryCandidates.slice(0, 5).map((c, i) => `${i + 1}. ${c.country} · RMSE ${Math.round(c.rmse).toLocaleString()} · 복잡도 반영 ${Math.round(c.score).toLocaleString()}`).join("   ")}</span>
        </div>
      )}

      {isOpen && (
        <div className="mmm-evidence-ledger__setup">
          <div className="mmm-evidence-ledger__source">
            <div className="mmm-evidence-ledger__source-head"><span>01</span><div><strong>{tx("홀드아웃 원자료", "Holdout source data")}</strong><p>{tx("On/Off 또는 Geo 실험의 기간·처리군·대조군·KPI·spend를 올립니다.", "Upload time period, treatment/control, KPI, and spend for an On/Off or geo experiment.")}</p></div></div>
            {hasExperiment ? <div className="mmm-evidence-ledger__file"><b>{evidence.experiment.name}</b><span>{evidence.experiment.rows.toLocaleString()}{tx("행 업로드됨", " rows imported")}</span></div> : <button className="ab-button" onClick={() => experimentRef.current?.click()}>{tx("실험 원자료 선택", "Choose experiment data")}</button>}
            <input ref={experimentRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { parseEvidence(e.target.files?.[0], "experiment"); e.target.value = null; }} />
          </div>
          <div className="mmm-evidence-ledger__source">
            <div className="mmm-evidence-ledger__source-head"><span>02</span><div><strong>{tx("참고 국가 MMM 데이터", "Reference-market MMM data")}</strong><p>{tx("타깃 국가와 같은 KPI·채널 포맷을 사용하고, 여러 국가라면 <code>country</code> 컬럼을 포함합니다.", "Use the target market's KPI/channel format; include a <code>country</code> column for multiple markets.")}</p></div></div>
            {hasCountry ? <div className="mmm-evidence-ledger__file"><b>{evidence.country.name}</b><span>{evidence.country.countries.length ? evidence.country.countries.join(" · ") : tx("country 컬럼을 찾지 못함", "No country column found")}</span></div> : <button className="ab-button" onClick={() => countryRef.current?.click()}>{tx("국가 데이터 선택", "Choose market data")}</button>}
            <input ref={countryRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { parseEvidence(e.target.files?.[0], "country"); e.target.value = null; }} />
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("선택 원칙", "Selection rule")}</strong>
            <span>{tx("모든 국가를 합치지 않습니다. 개별 적격성 → 최대 2~3개 조합 → 타깃 시장의 마지막 12주 백테스트 순서로, 가장 단순한 충분성 세트 하나만 추천합니다.", "Markets are not pooled blindly. The flow is individual eligibility → combinations of up to 2–3 → target-market final-12-week backtest, then one simplest sufficient set is recommended.")}</span>
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("Y 매핑", "Y mapping")}</strong>
            <span>{tx("타깃 KPI와 정의·단위가 같은 Y에만 prior를 반영합니다. 예를 들어 가입만 매핑되면 매출·구매자·총유입 결과에는 prior가 적용되지 않으며, 그 상태가 결과 화면에 표시됩니다.", "A prior is applied only to a target KPI with matching definition and units. If only registrations are mapped, revenue, purchasers, and traffic remain unadjusted; the result screen will state that status.")}</span>
          </div>
          {!hasExperiment && !hasCountry && (
            <button className="mmm-evidence-ledger__demo" onClick={onLoadDemo}>
              <span>✦</span>
              <strong>{tx("데모 근거 데이터 불러오기", "Load demo evidence data")}</strong>
              <small>{tx("반복 On/Off 홀드아웃 + JP·TW·SG·US 참고 국가", "Repeated On/Off holdout + JP · TW · SG · US reference markets")}</small>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function fmtInt(v) {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString();
}

function fmtOne(v) {
  if (v == null || !isFinite(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// 천단위 콤마 입력(§7 `type=number`는 콤마 불가 · §12.14 라이브 콤마+커서 보존 포트). type=text로
// 표시=콤마, 읽기=콤마 strip. onCommit(number|null) — 빈칸이면 null(부모가 기본값 복귀).
function CommaNumberInput({ value, onCommit, style, placeholder }) {
  const ref = useRef(null);
  const focusedRef = useRef(false);
  const fmt = (n) => (n == null || n === "" || !isFinite(n) ? "" : Number(n).toLocaleString());
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => { if (!focusedRef.current) setTxt(fmt(value)); }, [value]);
  const handle = (e) => {
    const raw = e.target.value, caret = e.target.selectionStart;
    const digitsLeft = raw.slice(0, caret).replace(/[^\d]/g, "").length;
    const num = raw.replace(/[^\d]/g, "");
    const formatted = num === "" ? "" : Number(num).toLocaleString();
    setTxt(formatted);
    onCommit(num === "" ? null : Number(num));
    requestAnimationFrame(() => {
      if (!ref.current) return;
      let pos = 0, seen = 0;
      while (pos < formatted.length && seen < digitsLeft) { if (/\d/.test(formatted[pos])) seen++; pos++; }
      ref.current.setSelectionRange(pos, pos);
    });
  };
  return (
    <input ref={ref} type="text" inputMode="numeric" value={txt} placeholder={placeholder}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; setTxt(fmt(value)); }}
      onChange={handle} style={style} />
  );
}


/* ── CSV helpers (§7 CRLF+BOM, RFC4180 quoting) — index _mmmDownload/q 이식 ── */
function csvQ(s) {
  s = String(s == null ? "" : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvNum(v, d = 2) {
  return v == null || !isFinite(v) ? "" : (+v).toFixed(d);
}
function csvDownload(name, lines) {
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// 현재 필터·타깃 기준을 하나의 감사 가능한 분석 패키지로 내보낸다. 원본은 브라우저 안에서만
// 워크북으로 변환되고 서버 전송은 없다. 각 시트는 그래프용 long-format과 해석 안내를 함께 둔다.
function downloadMmmWorkbook({ mmm, cannib, decomp, trend, forecast, csvData, colMap, locale, currency }) {
  if (!mmm || mmm.empty) return;
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const run = mmm.run;
  const generated = new Date().toISOString();
  add("00_Index", [
    [tx("MMM 분석 패키지", "MMM analysis package")],
    [tx("생성 시각", "Generated"), generated],
    [tx("타깃", "Target"), mmm.target],
    [tx("통화", "Currency"), currency],
    [tx("모델", "Model"), run.methodLabel],
    [tx("기간", "Periods"), mmm.panel.week.length],
    [],
    [tx("시트", "Sheet"), tx("무엇을 확인하나", "What it contains")],
    ["01_Input", tx("분석에 사용한 원본·매핑", "Source rows and mapping")],
    ["02_STL", tx("추세·계절성·잔차", "Trend, seasonality, residual")],
    ["03_Cannibal", tx("4개 잠식 검증의 채널별 결과", "Per-channel four-check cannibal evidence")],
    ["04_Model", tx("Bayesian 모델·적합도·채널 파라미터", "Bayesian model, fit, channel parameters")],
    ["05_WeeklyContribution", tx("주별 그룹 기여", "Weekly group contribution")],
    ["06_ChannelEffect", tx("양수확률·신뢰구간·한계효과", "Probability, interval, marginal effect")],
    ["07_ResponseData", tx("지출별 기여·CPA/ROAS 그래프용", "Spend response and CPA/ROAS chart data")],
    ["08_Forecast", tx("기준 예측·참고구간", "Baseline forecast and reference interval")],
    ["09_Glossary", tx("모델·지표 해석과 한계", "Model, metric definitions, limitations")],
  ]);
  const headers = csvData?.headers || [];
  add("01_Input", [
    [tx("컬럼", "Column"), tx("매핑", "Mapping")],
    ...headers.map((h) => [h, JSON.stringify(colMap?.[h] || { role: "ignore" })]),
    [],
    headers,
    ...(csvData?.raw || []).map((row) => headers.map((h) => row[h] ?? "")),
  ]);
  add("02_STL", trend?.stl ? [
    ["week", "actual", "trend", "seasonality", "residual"],
    ...mmm.panel.week.map((w, i) => [mmm.panel.weekLabel?.[i] || w, mmm.panel.targets[mmm.target][i], trend.stl.trend?.[i], trend.stl.seasonal?.[i], trend.stl.residual?.[i]]),
  ] : [[tx("STL 결과", "STL result")], [tx("이 패키지는 시계열 점검 단계에서 다운로드하면 STL 원자료를 포함합니다.", "Download from the time-series step to include STL source data.")]]);
  add("03_Cannibal", cannib?.cannibRank ? [
    ["channel", "verdict", "eligible", "active_weeks", "precedence_vote", "detrend_vote", "net_vote", "lag_p", "lag_coef", "notes"],
    ...cannib.cannibRank.map((r) => {
      const c = cannib.cannibByChannel?.[r.key] || {};
      return [r.label, c.verdict, r.eligible, r.nActive, c.precedence?.vote, c.detrend_corr?.vote, c.net_incrementality?.vote, c.granger?.spend_to_organic?.p, c.granger?.spend_to_organic?.coefSum, c.power_gate?.reasons?.join(" | ") || ""];
    }),
  ] : [[tx("카니발 결과", "Cannibal result")], [tx("카니발 진단 단계에서 다운로드하면 4검증 원자료를 포함합니다.", "Download from the cannibalization step to include four-check evidence.")]]);
  add("04_Model", [
    ["model", run.methodLabel], ["R2", run.posterior?.r2], ["sigma", run.posterior?.sigma], ["target", mmm.target], [],
    ["channel", "adstock_alpha", "half_saturation", "hill_slope", "posterior_positive_probability"],
    ...Object.values(run.saturationByChannel || {}).map((s) => [s.label, s.params.alpha, s.params.ec, s.params.slope, s.posteriorPositive]),
  ]);
  add("05_WeeklyContribution", decomp?.weeks ? [
    ["week", "actual", "fitted", "residual", "baseline", ...decomp.groupNames],
    ...decomp.weeks.map((w) => [w.week, w.actual, w.fitted, w.residual, w.baseline, ...decomp.groupNames.map((g) => w.contrib[g] || 0)]),
  ] : [[tx("주별 기여", "Weekly contribution")], [tx("기여 분해 결과가 없습니다.", "Contribution result unavailable.")]]);
  add("06_ChannelEffect", [
    ["channel", "posterior_positive_probability", "effect_size", "ci_low", "ci_high", "recent_spend", "marginal_per_1000"],
    ...Object.values(run.saturationByChannel || {}).map((s) => [s.label, s.posteriorPositive, s.ln_coef, s.ci?.[0], s.ci?.[1], s.recentMean, s.currentMarginal]),
  ]);
  const grid = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];
  const responseRows = [["channel", "spend", "incremental_contribution", mmm.target === "Revenue" ? "ROAS" : "CPA"]];
  Object.values(run.saturationByChannel || {}).forEach((s) => grid.forEach((mult) => {
    const spend = (s.recentMean || 1) * mult, result = s.responseAt(spend);
    responseRows.push([s.label, spend, result, spend > 0 && result > 0 ? (mmm.target === "Revenue" ? result / spend : spend / result) : null]);
  }));
  add("07_ResponseData", responseRows);
  add("08_Forecast", forecast ? [
    ["period", "actual", "fitted_or_forecast", "lower", "upper"],
    ...forecast.labels.map((label, i) => [label, forecast.actual?.[i] ?? null, forecast.fittedHist?.[i] ?? forecast.predFut?.[i - forecast.splitAt] ?? null, forecast.lo?.[i - forecast.splitAt] ?? null, forecast.hi?.[i - forecast.splitAt] ?? null]),
  ] : [[tx("예측", "Forecast")], [tx("예측 결과가 없습니다.", "Forecast unavailable.")]]);
  add("09_Glossary", [
    [tx("항목", "Term"), tx("설명", "Description")],
    ["Bayesian MMM", tx("약한 Gaussian prior를 둔 browser Bayesian 선형 posterior. 관측 데이터의 연관 모델이며 인과 확정이 아닙니다.", "Browser Bayesian posterior with weak Gaussian prior. Observational association, not causal proof.")],
    ["P(effect > 0)", tx("채널 효과가 양수일 posterior 확률. 80% 이상만 예산 추천에 씁니다.", "Posterior probability channel effect is positive. Budget recommendation threshold: 80%.")],
    ["Adstock", tx("광고 효과의 다음 주 이월.", "Carryover of ad effect into later weeks.")],
    ["Hill saturation", tx("지출이 커질수록 추가 효과가 줄어드는 반응 곡선.", "Response curve with diminishing marginal return.")],
    ["STL", tx("성과를 장기추세·계절성·잔차로 나누는 시계열 분해.", "Time-series decomposition into trend, seasonality, residual.")],
    ["Cannibalization", tx("유료 광고가 기존 오가닉 성과를 대체했을 가능성. 4개 관측 검증은 확정이 아니며 holdout이 필요합니다.", "Possibility paid ads replace organic outcome. Four observational checks require holdout for confirmation.")],
  ]);
  XLSX.writeFile(wb, `MMM_analysis_package_${mmm.target}_${_today()}.xlsx`);
}
// 엑셀 열 문자(0→A). index colL 이식.
function csvColL(n) {
  let s = "",
    x = n + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
const _today = () => new Date().toISOString().slice(0, 10);

// 텍스트(.md) 다운로드 — "이 과정 자세히" 문서용.
function textDownload(name, text) {
  const blob = new Blob(["﻿" + text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// 카니발 진단 전 과정을 평어+전문 병기로 설명하는 자체완결 문서(현재 결과 요약 포함).
function buildCannibGuideDoc(cannib, targetKo, locale = "ko") {
  if (locale === "en") return buildCannibGuideDocEn(cannib, targetKo);
  const L = [];
  L.push(`# 카니발(잠식) 진단 — 이 분석은 무엇이고 어떻게 판정하나`);
  L.push("");
  L.push(`대상 지표: ${targetKo} · 생성일: ${_today()}`);
  L.push("");
  L.push(`## 한 줄 요약`);
  L.push(`"카니발리제이션(잠식)"은 유료 광고가, 원래 광고 없이도 공짜로 들어왔을 오가닉(자연) 유입을 갉아먹는 현상입니다. 이 도구는 채널마다 "그 채널 광고가 오가닉을 잠식하는가?"를 4가지 서로 다른 각도로 따져보고, 그 결과를 종합해 **잠식 의심 / 애매함 / 문제 없음** 세 칸으로 분류합니다.`);
  L.push("");
  L.push(`## 왜 중요한가`);
  L.push(`광고 대시보드에 찍히는 전환은 "광고가 새로 만든 것"과 "원래 왔을 사람을 광고가 가로챈 것"이 섞여 있습니다. 뒤쪽(잠식)이 크면, 광고를 꺼도 성과가 별로 안 줄어드는데도 예산만 계속 쓰게 됩니다. 그래서 "이 채널을 늘려야 하나?"의 답이 달라집니다.`);
  L.push("");
  L.push(`## 4가지 신호 (각 채널마다 따져보는 것)`);
  L.push(`- **① 광고를 늘리기 전에 이미 줄고 있었나?** — 저지출 구간에서 오가닉이 이미 하락 추세였다면, 그 하락은 광고 탓이 아닐 가능성이 큽니다. (전문: 저지출 구간 기울기 검정)`);
  L.push(`- **② 시즌·추세를 걷어내도 광고 늘 때 오가닉이 줄어드나?** — 계절성·전반 추세를 제거한 뒤에도 광고비↑ 시 오가닉↓이면 잠식이 의심됩니다. (전문: 탈추세·1차차분 상관)`);
  L.push(`- **③ 광고를 늘리면 (잠식을 빼고도) 전체 성과가 순증가하나?** — 잠식분을 감안하고도 전체가 순으로 늘면 방어 양호입니다. (전문: 순증분 탄력성, 95% 신뢰구간)`);
  L.push(`- **④ 광고비가 몇 주 뒤에 오가닉을 끌어내리나?** — ①~③은 "같은 주"만 봅니다. ④는 시차를 두고(예: 3~6주 뒤) 광고비가 오가닉을 떨어뜨리는지 봅니다. (전문: 그랜저 인과, prewhitening 후 F-검정)`);
  L.push(`- **⑤ 충격 반응(IRF)** — 지출을 한 번 확 늘렸을 때 이후 몇 주간 성과가 어떻게 반응하는지 곡선으로 봅니다. 아래로 내려가면 시차 잠식, 위로 올라가면 시차 증분.`);
  L.push("");
  L.push(`## 판정은 어떻게 종합하나 (입증책임 비대칭)`);
  L.push(`- **문제 없음(방어 양호)**: 네 방향 모두 뚜렷한 잠식 신호가 없을 때만. "잠식 신호가 없다"는 강한 증거가 있어야 OK를 줍니다.`);
  L.push(`- **잠식 의심**: 어느 한 신호라도 잠식을 가리키면(특히 ④ 시차 신호가 있으면) 의심으로 올립니다. 같은 주 지표가 괜찮아도 시차에서 걸리면 의심입니다.`);
  L.push(`- **애매함(판단 보류)**: 데이터가 부족하거나(집행 주 수가 적음) 채널끼리 지출이 거의 똑같이 움직여(공선) 서로 구분이 안 되면, 억지로 판정하지 않고 보류합니다.`);
  L.push("");
  L.push(`## 꼭 기억할 것`);
  L.push(`이 진단은 전부 **"연관(association)"**이지 **"인과(causation)"**가 아닙니다. 관측 데이터만으로는 "광고가 잠식을 유발했다"를 확정할 수 없습니다. 이 도구의 역할은 **의심 채널을 좁혀주는 것**이고, 확정은 반드시 **홀드아웃(geo/시간 분할) 실험**으로 해야 합니다. "잠식 의심" 칸의 채널부터 실험 1순위로 검토하세요.`);
  L.push("");
  L.push(`## 수학·통계 상세 (전문가용)`);
  L.push("");
  L.push(`### ① 시간 선행성 — Theil-Sen 기울기 + Mann-Kendall 유의성`);
  L.push(`저지출 구간(지출 ≤ 전체 지출의 25번째 백분위수, p25)만 잘라내 그 구간 안에서 오가닉 KPI의 시간 추세를 봅니다.`);
  L.push(`- **기울기 추정**: Theil-Sen estimator — 모든 두 점 쌍 (i,j)의 기울기 (yⱼ−yᵢ)/(j−i)를 계산해 그 **중앙값**을 대표 기울기로 씀(이상치에 강함, OLS보다 로버스트).`);
  L.push(`- **유의성 검정**: Mann-Kendall 검정 통계량 S = Σᵢ<ⱼ sign(yⱼ−yᵢ). 분산 Var(S) = n(n−1)(2n+5)/18(동순위 보정 포함). Z = (S−sign(S))/√Var(S). |Z| > 1.96(양측 α=0.05)이면 유의한 추세로 판정.`);
  L.push(`- **판정 규칙**: 유의하게 하락(slope<0, p<0.05) → FOR(오가닉, 광고와 무관한 하락). 유의하게 상승 → AGAINST(카니발 의심). 유의하지 않거나 표본(n=low_n) 부족 → ABSTAIN.`);
  L.push("");
  L.push(`### ② 허위상관 — 탈추세·1차차분 Pearson 상관`);
  L.push(`시간(t)에 걸쳐 같이 늘어나는 두 변수는 서로 무관해도 상관이 크게 나옵니다(허위상관). 이를 걸러내기 위해:`);
  L.push(`1. **원상관(raw)**: 광고비와 오가닉 KPI의 단순 Pearson r.`);
  L.push(`2. **탈추세(detrended)**: 각 시계열에서 선형 추세(OLS 적합값)를 빼고 남은 잔차끼리의 상관.`);
  L.push(`3. **1차차분(first_diff)**: yₜ − yₜ₋₁ 변환 후 상관(단위근 제거 효과, 추세를 완전히 없앰).`);
  L.push(`- **판정 규칙**: detrended ≥ −0.10 AND first_diff ≥ −0.10 → FOR(허위상관이었을 뿐, 진짜 음의 관계 아님). detrended ≤ −0.20 OR first_diff ≤ −0.20 → AGAINST(탈추세해도 음의 관계 유지 = 잠식 의심). 그 사이는 ABSTAIN.`);
  L.push("");
  L.push(`### ③ 순증분 — log-log 탄력성 회귀 (AR(1) 자기상관 보정)`);
  L.push(`ln(오가닉 KPI) = β·ln(1+광고비) + 통제변수 + 오차, 형태의 회귀를 적합해 계수 β(탄력성)를 추정합니다.`);
  L.push(`- **AR(1) 보정**: 잔차가 자기상관(어제 오차가 오늘 오차에 영향)을 가지면 OLS 표준오차가 과소평가돼 거짓 유의성이 나올 수 있습니다. Yule-Walker로 AR(1) 계수 ρ를 추정하고 Cochrane-Orcutt류 변환(yₜ−ρyₜ₋₁)으로 재적합해 보정된 표준오차·p값을 씁니다.`);
  L.push(`- **95% 신뢰구간**: β ± 1.96×SE(β). CI가 0을 포함하지 않고 β>0이면 FOR(순증분 확인), β<0이고 CI가 0 미포함이면 AGAINST(순수 잠식), CI가 0을 포함하면 ABSTAIN(증거 없음 ≠ 효과 없음).`);
  L.push(`- **검정력 게이트**: 표본(n)이 적거나 광고비 변동계수(CV)가 작으면(=지출이 거의 늘 비슷해서 효과를 식별할 통계적 힘이 없으면) ③을 강제로 ABSTAIN 처리 — "효과 없음"과 "증거 없음"을 구분하기 위한 안전장치.`);
  L.push("");
  L.push(`### ④ 그랜저 인과 — Prewhitening 후 lagged F-검정`);
  L.push(`①~③은 전부 "같은 주(동시점)" 관계만 봅니다. 그랜저 인과는 "광고비의 **과거값**이 오가닉의 **미래값**을 추가로 설명하는가"를 봐서 시차 효과를 잡습니다.`);
  L.push(`- **Prewhitening**: 두 시계열 각각에서 추세(선형)+52주 계절성(Fourier 2차 항)을 먼저 제거해 순수한 단기 변동만 남깁니다(장기 추세 때문에 생기는 허위 그랜저-인과 방지).`);
  L.push(`- **F-검정**: "오가닉ₜ = f(오가닉 과거값들)"만 있는 축소모형과, "오가닉ₜ = f(오가닉 과거값들, 광고비 과거값들)"인 완전모형을 비교. 완전모형이 유의하게 더 잘 맞으면(F-검정 p<0.05) 광고비가 오가닉을 그랜저-인과함.`);
  L.push(`- **방향 두 가지**: 광고비→오가닉(시차 잠식/증분 여부), 오가닉→광고비(페이싱=예산 담당자가 오가닉이 약할 때 방어적으로 예산을 올리는 역인과 패턴 — 이게 유의하면 ②④의 음의 관계가 인과가 아니라 반응일 수 있음).`);
  L.push("");
  L.push(`### ⑤ 임펄스 응답 함수(IRF)`);
  L.push(`Prewhiten한 레벨 VAR(벡터자기회귀) 모형에서, 광고비에 1표준편차(1SD) 크기의 충격을 한 번 줬을 때 이후 여러 주에 걸쳐 오가닉이 어떻게 반응하는지 경로를 계산합니다. 음수 구간이 있으면 시차 잠식, 양수면 시차 증분. n<24주면 신뢰할 수 없어 곡선을 생략합니다.`);
  L.push("");
  L.push(`### 추세 존재성 검정 — STL 분해 + Mann-Kendall 4변형 + 단위근 검정`);
  L.push(`- **STL(Seasonal-Trend decomposition using Loess)**: 시계열을 추세+계절+잔차로 분해(52주 주기, 2회 반복).`);
  L.push(`- **Mann-Kendall 4가지**: 원본(raw), 자기상관 보정(Hamed-Rao, 순위 기반 분산 보정), 계절형(seasonal MK, 같은 계절끼리만 비교), 탈계절 잔차형(deseason). 네 개가 일치해야 "진짜 추세"로 확신.`);
  L.push(`- **ADF(Augmented Dickey-Fuller)**: 단위근(비정상성, 추세가 발산) 존재 여부 검정. p<0.05면 정상(추세가 있어도 발산 안 함).`);
  L.push(`- **KPSS**: ADF와 반대 귀무가설(정상성을 귀무가설로) — 두 검정이 서로 보완. 둘 다 통과해야 "trend-stationary" 확정.`);
  L.push("");
  L.push(`### 데이터 위생 + 매크로 — 모델-독립 검증`);
  L.push(`모델을 적합하기 전에 스키마·연속성·결측을 점검(위생 경고)하고, 2024 vs 2025처럼 연도 단위 YoY(spend·KPI)를 계산합니다. 이건 어떤 회귀 모형에도 의존하지 않는 "가장 확실한" 헤드라인 숫자라, 모델이 이상해도 이 숫자는 흔들리지 않습니다.`);
  L.push("");
  L.push(`### 단순 모델 audit — HAC(Newey-West) 표준오차`);
  L.push(`모든 채널 지출을 하나로 합친 naive 모델(ln_총지출)을 적합하고, 일반 OLS p값과 **HAC(Newey-West) 자기상관·이분산 보정** p값을 나란히 비교합니다. HAC는 OLS보다 항상 보수적(표준오차가 크거나 같음) — 둘이 크게 다르면 OLS 결과를 그대로 믿으면 안 된다는 신호입니다. 또한 브랜드 채널 추가 전후 R²·계수 변화로 공선성(다중공선성)을 점검합니다(회귀변수 추가는 이론상 R²를 못 낮추므로, 다른 target에서 총지출 계수가 크게 출렁이면 공선 증거).`);
  L.push("");
  if (cannib && cannib.cannibRank && cannib.cannibRank.length) {
    L.push(`## 현재 데이터 판정 요약`);
    for (const r of cannib.cannibRank) {
      const lv = mmmCannibLevel(r);
      const bucket = !r.eligible || lv.lv === 1 ? "애매함(판단 보류)" : lv.lv >= 4 ? "잠식 의심" : "문제 없음";
      L.push(`- **${r.label}** → ${bucket}${r.eligible ? "" : ` (데이터 부족 ${r.nActive}/${r.total}주)`}`);
    }
    L.push("");
  }
  L.push(`## 함께 보는 다른 분석`);
  L.push(`- **추세 존재성**: 성과에 광고와 무관한 시간 흐름 자체의 추세가 있는지(STL 분해 + Mann-Kendall·ADF·KPSS 검정).`);
  L.push(`- **데이터 위생**: 분석 전에 데이터가 깨끗한지(결측·연속성) + 작년 대비 지표 변화.`);
  L.push(`- **단순 모델 점검**: "모든 지출을 하나로 뭉친 대충 만든 모델"이 왜 못 믿을 만한지(자기상관·공선성) 확인.`);
  L.push("");
  L.push(`— Growth Opt Playbook · 마케팅 반응 분석(MMM)`);
  return L.join("\n");
}

// English version of buildCannibGuideDoc (same structure/content, translated).
function buildCannibGuideDocEn(cannib, targetLabel) {
  const L = [];
  L.push(`# Cannibalization Diagnosis — what this analysis is and how it's judged`);
  L.push("");
  L.push(`Target metric: ${targetLabel} · Generated: ${_today()}`);
  L.push("");
  L.push(`## One-line summary`);
  L.push(`"Cannibalization" is when paid ads eat into organic (free) traffic that would have arrived anyway. This tool checks, per channel, "is this channel's ads cannibalizing organic?" from 4 independent angles, then combines them into three buckets: **Cannibalization suspected / Unclear / No issue**.`);
  L.push("");
  L.push(`## Why it matters`);
  L.push(`Conversions on an ad dashboard mix "what ads newly created" with "people who would have come anyway, that ads intercepted." If the latter (cannibalization) is large, turning ads off won't hurt performance much even though you keep spending. That changes the answer to "should we scale this channel?"`);
  L.push("");
  L.push(`## The 4 signals (checked per channel)`);
  L.push(`- **① Was organic already declining before ad spend increased?** — If organic was already trending down in low-spend periods, that decline is likely not ads' fault. (Technical: low-spend-window slope test)`);
  L.push(`- **② After removing season/trend, does organic still fall when ads rise?** — If organic still moves opposite to spend after detrending, cannibalization is suspected. (Technical: detrended / first-difference correlation)`);
  L.push(`- **③ Does total performance net-increase when ads rise (even accounting for cannibalization)?** — If the net total still rises, defense is good. (Technical: net-incremental elasticity, 95% CI)`);
  L.push(`- **④ Does spend pull organic down a few weeks later?** — ①–③ only look at "the same week." ④ checks whether spend depresses organic with a lag (e.g. 3–6 weeks later). (Technical: Granger causality, F-test after prewhitening)`);
  L.push(`- **⑤ Impulse response (IRF)** — Shows, as a curve, how performance responds over the following weeks to a one-time spend shock. A dip below zero = lagged cannibalization; a rise = lagged incrementality.`);
  L.push("");
  L.push(`## How the verdict is combined (asymmetric burden of proof)`);
  L.push(`- **No issue (well-defended)**: only when none of the four signals show a clear cannibalization signal. Strong evidence of "no signal" is required to give an OK.`);
  L.push(`- **Cannibalization suspected**: if any signal points to cannibalization (especially the lagged signal ④), it's flagged as suspected — even if same-week metrics look fine.`);
  L.push(`- **Unclear (verdict withheld)**: if data is insufficient (few active weeks) or channels move almost identically (collinear) and can't be separated, we withhold judgment rather than force a verdict.`);
  L.push("");
  L.push(`## Key takeaway`);
  L.push(`All of this is **association**, not **causation**. Observational data alone cannot confirm "ads caused cannibalization." This tool's job is to **narrow down suspect channels** — confirmation requires a **holdout (geo/time-split) experiment**. Prioritize testing channels in the "cannibalization suspected" bucket first.`);
  L.push("");
  L.push(`## Math & statistics detail (for specialists)`);
  L.push("");
  L.push(`### ① Temporal precedence — Theil-Sen slope + Mann-Kendall significance`);
  L.push(`We isolate the low-spend window (spend ≤ the 25th percentile of total spend, p25) and look at the organic KPI's time trend within it.`);
  L.push(`- **Slope estimate**: Theil-Sen estimator — computes the slope (yⱼ−yᵢ)/(j−i) for every pair of points (i,j) and takes the **median** as the representative slope (robust to outliers, more robust than OLS).`);
  L.push(`- **Significance test**: Mann-Kendall test statistic S = Σᵢ<ⱼ sign(yⱼ−yᵢ). Variance Var(S) = n(n−1)(2n+5)/18 (with tie correction). Z = (S−sign(S))/√Var(S). |Z| > 1.96 (two-sided α=0.05) is judged a significant trend.`);
  L.push(`- **Decision rule**: significantly declining (slope<0, p<0.05) → FOR (organic decline unrelated to ads). Significantly rising → AGAINST (cannibalization suspected). Not significant or sample too small (n=low_n) → ABSTAIN.`);
  L.push("");
  L.push(`### ② Spurious correlation — detrended / first-difference Pearson correlation`);
  L.push(`Two variables that both grow over time (t) can appear highly correlated even if unrelated (spurious correlation). To filter this out:`);
  L.push(`1. **Raw correlation**: simple Pearson r between spend and the organic KPI.`);
  L.push(`2. **Detrended**: correlation between the residuals left after subtracting a linear trend (OLS fit) from each series.`);
  L.push(`3. **First difference**: correlation after the yₜ − yₜ₋₁ transform (removes unit roots, fully removes trend).`);
  L.push(`- **Decision rule**: detrended ≥ −0.10 AND first_diff ≥ −0.10 → FOR (was just spurious correlation, not a real negative relationship). detrended ≤ −0.20 OR first_diff ≤ −0.20 → AGAINST (negative relationship survives detrending = cannibalization suspected). In between → ABSTAIN.`);
  L.push("");
  L.push(`### ③ Net incrementality — log-log elasticity regression (AR(1) autocorrelation correction)`);
  L.push(`Fits a regression of the form ln(organic KPI) = β·ln(1+spend) + controls + error, estimating coefficient β (elasticity).`);
  L.push(`- **AR(1) correction**: if residuals are autocorrelated (yesterday's error affects today's), OLS standard errors are underestimated, producing false significance. We estimate the AR(1) coefficient ρ via Yule-Walker and refit with a Cochrane-Orcutt-style transform (yₜ−ρyₜ₋₁) to get corrected SE/p-values.`);
  L.push(`- **95% CI**: β ± 1.96×SE(β). If CI excludes 0 and β>0 → FOR (net incrementality confirmed); β<0 with CI excluding 0 → AGAINST (pure cannibalization); CI including 0 → ABSTAIN (no evidence ≠ no effect).`);
  L.push(`- **Power gate**: if sample size (n) is small or spend's coefficient of variation (CV) is low (i.e. spend barely varies, so there's no statistical power to identify an effect), ③ is force-set to ABSTAIN — a safeguard distinguishing "no effect" from "no evidence."`);
  L.push("");
  L.push(`### ④ Granger causality — lagged F-test after prewhitening`);
  L.push(`①–③ only look at "same week" (contemporaneous) relationships. Granger causality checks whether **past values** of spend explain **future values** of organic beyond organic's own history, capturing lagged effects.`);
  L.push(`- **Prewhitening**: trend (linear) + 52-week seasonality (2nd-order Fourier terms) are first removed from each series, leaving only pure short-term variation (prevents spurious Granger causality from long-term trends).`);
  L.push(`- **F-test**: compares a restricted model "organicₜ = f(organic's own past)" against a full model "organicₜ = f(organic's own past, spend's past)." If the full model fits significantly better (F-test p<0.05), spend Granger-causes organic.`);
  L.push(`- **Two directions**: spend→organic (lagged cannibalization/incrementality), organic→spend (pacing = a reverse-causality pattern where budget owners raise spend defensively when organic is weak — if this is significant, the negative relationship in ②④ may be a response, not a cause).`);
  L.push("");
  L.push(`### ⑤ Impulse response function (IRF)`);
  L.push(`In a prewhitened level VAR (vector autoregression) model, we compute the path of how organic responds over the following weeks to a single one-standard-deviation (1SD) shock to spend. A negative stretch = lagged cannibalization; positive = lagged incrementality. With n<24 weeks the curve is omitted as unreliable.`);
  L.push("");
  L.push(`### Trend-existence test — STL decomposition + 4 Mann-Kendall variants + unit-root tests`);
  L.push(`- **STL (Seasonal-Trend decomposition using Loess)**: decomposes the series into trend + seasonal + residual (52-week period, 2 iterations).`);
  L.push(`- **4 Mann-Kendall variants**: raw, autocorrelation-corrected (Hamed-Rao, rank-based variance correction), seasonal MK (compares only within the same season), deseasonalized-residual MK. All four must agree to be confident it's a "real trend."`);
  L.push(`- **ADF (Augmented Dickey-Fuller)**: tests for a unit root (non-stationarity, a diverging trend). p<0.05 means stationary (even with a trend, it doesn't diverge).`);
  L.push(`- **KPSS**: opposite null hypothesis to ADF (stationarity as the null) — the two tests complement each other. Both must pass to confirm "trend-stationary."`);
  L.push("");
  L.push(`### Data hygiene + macro facts — model-independent verification`);
  L.push(`Before fitting any model, we check schema/continuity/missing data (hygiene warnings) and compute year-over-year (spend·KPI) changes like 2024 vs 2025. This is the "most certain" headline number, independent of any regression model — so it doesn't move even if the model looks odd.`);
  L.push("");
  L.push(`### Naive-model audit — HAC (Newey-West) standard errors`);
  L.push(`Fits a naive model lumping all channel spend together (ln_total_spend), and compares plain OLS p-values side by side with **HAC (Newey-West) autocorrelation/heteroskedasticity-corrected** p-values. HAC is always at least as conservative as OLS (SE equal or larger) — a large gap between the two is a signal you shouldn't trust the OLS result as-is. We also check for collinearity (multicollinearity) via R²/coefficient shifts before/after adding a brand channel (adding a regressor can't theoretically lower R², so a large swing in the total-spend coefficient across targets is evidence of collinearity).`);
  L.push("");
  if (cannib && cannib.cannibRank && cannib.cannibRank.length) {
    L.push(`## Current-data verdict summary`);
    for (const r of cannib.cannibRank) {
      const lv = mmmCannibLevel(r);
      const bucket = !r.eligible || lv.lv === 1 ? "Unclear (withheld)" : lv.lv >= 4 ? "Cannibalization suspected" : "No issue";
      L.push(`- **${r.label}** → ${bucket}${r.eligible ? "" : ` (insufficient data ${r.nActive}/${r.total} weeks)`}`);
    }
    L.push("");
  }
  L.push(`## Related analyses`);
  L.push(`- **Trend existence**: whether performance has a trend from pure time flow, unrelated to ads (STL decomposition + Mann-Kendall/ADF/KPSS tests).`);
  L.push(`- **Data hygiene**: whether the data is clean before analysis (missing data/continuity) + year-over-year metric change.`);
  L.push(`- **Naive-model check**: why "one crude model lumping all spend together" can't be trusted (autocorrelation/collinearity).`);
  L.push("");
  L.push(`— Growth Opt Playbook · Marketing Response Analysis (MMM)`);
  return L.join("\n");
}

// MMM 기여 분해 전 과정 설명 문서(평어 + 수학·통계 상세 + 현재 결과 요약).
function buildMmmGuideDoc(mmm, targetKo, locale = "ko") {
  if (locale === "en") return buildMmmGuideDocEn(mmm, targetKo);
  const L = [];
  const run = mmm.run || {};
  L.push(`# MMM 기여 분해 — 이 분석은 무엇이고 어떻게 계산하나`);
  L.push("");
  L.push(`대상 지표: ${targetKo} · 생성일: ${_today()}`);
  L.push("");
  L.push(`## 한 줄 요약`);
  L.push(`MMM(Marketing Mix Modeling·마케팅 믹스 모델링)은 "지난 ${targetKo} 성과의 등락을 무엇이 얼마나 만들었나"를 나눠보는 분석입니다. 시즌·추세 같은 비매체 요인과 각 광고 채널의 기여를 공정하게 분해하고, "다음 1,000달러를 어디에 쓰면 가장 효율적인가"까지 안내합니다.`);
  L.push("");
  L.push(`## 무엇을 보여주나 (평어)`);
  L.push(`- **무엇이 성과를 움직였나**: 성과 등락의 설명력을 시즌·추세·채널별로 % 배분(설명력 비중).`);
  L.push(`- **다음 예산은 어디로**: 지금 지출 수준에서 1,000달러를 더 쓸 때 채널별로 늘어나는 ${targetKo} 인원 순위.`);
  L.push(`- **실제 vs 모델**: 모델이 실제 성과를 얼마나 잘 따라갔는지(오차), 어느 주가 크게 튀었는지.`);
  L.push("");
  L.push(`## 수학·통계 상세 (전문가용)`);
  L.push("");
  L.push(`### 1. Adstock (광고 잔효)`);
  L.push(`광고 효과는 집행한 주에만 나타나지 않고 다음 주로 이어집니다(잔향). adstockₜ = spendₜ + λ·adstockₜ₋₁ 형태의 기하 감쇠를 후보 λ별로 만들고, 비매체 요인을 걷어낸 성과와 가장 잘 맞는 변환을 채널별로 고릅니다.`);
  L.push("");
  L.push(`### 2. Saturation (수확체감)`);
  L.push(`같은 채널도 많이 쓸수록 1달러당 효과가 줄어듭니다. Hill 곡선 ` + "`adstock^s/(ec^s + adstock^s)`" + `으로 반응을 만들며, 지출이 커질수록 한계효과가 감소합니다. "+$1k당 N명"은 현재 지출점의 국소 기울기입니다.`);
  L.push("");
  L.push(`### 3. Bayesian posterior`);
  L.push(`${targetKo} = 절편 + Σβᵢ·Hill(adstockᵢ) + 추세 + 계절(Fourier) + 휴일·구조변화 + 오차를 약한 Gaussian prior로 추정합니다. 각 채널의 β와 불확실성을 posterior로 계산하며, **P(효과>0) 80% 이상** 채널만 예산 추천에 포함합니다.`);
  L.push("");
  L.push(`### 4. 효과 신뢰도`);
  L.push(`p값·VIF는 제거했습니다. 이 화면의 "효과 양수 확률"은 posterior에서 β>0일 확률이고, 90% credible interval은 효과 크기의 불확실성 범위입니다.`);
  L.push("");
  L.push(`### 5. 기여 변동`);
  L.push(`각 드라이버의 주별 기여가 posterior 예측에서 흔들린 크기를 비교합니다. 인과 확정이나 OLS Shapley R²가 아닙니다.`);
  L.push("");
  L.push(`### 6. 주별 기여 분해 (decomposition)`);
  L.push(`매주 실제값을 기본 수요·추세, 계절, 휴일·구조변화, 매체 절대기여로 쪼갭니다. 양수 매체 계수는 저지출 주에도 음수가 되지 않도록 원 단위 반응값으로 표시합니다. RMSE·MAPE로 실제 적합도를 확인합니다.`);
  L.push("");
  if (run.shapley && run.shapley.rows && run.shapley.rows.length) {
    L.push(`## 현재 데이터 설명력 비중 (Shapley R², total R²=${run.shapley.total})`);
    [...run.shapley.rows].sort((a, b) => b.r2_share - a.r2_share).forEach((r) => {
      L.push(`- ${r.driver}: ${(r.pct || 0).toFixed(1)}%`);
    });
    L.push("");
  }
  L.push(`## 꼭 기억할 것`);
  L.push(`MMM는 관측 데이터 기반 **연관·기술(descriptive) 모델**이지 인과 확정이 아닙니다. "다음 예산 순위"는 반응곡선상의 가설이며, 실제 증분·ROI 확정은 홀드아웃 실험에서 합니다. 단기 캠페인 단위 배분은 예산 배분 시뮬레이터(5-3)를 쓰세요.`);
  L.push("");
  L.push(`— Growth Opt Playbook · 마케팅 반응 분석(MMM)`);
  return L.join("\n");
}

// English version of buildMmmGuideDoc.
function buildMmmGuideDocEn(mmm, targetLabel) {
  const L = [];
  const run = mmm.run || {};
  L.push(`# MMM Contribution Decomposition — what this analysis is and how it's computed`);
  L.push("");
  L.push(`Target metric: ${targetLabel} · Generated: ${_today()}`);
  L.push("");
  L.push(`## One-line summary`);
  L.push(`MMM (Marketing Mix Modeling) breaks down "what made last period's ${targetLabel} performance go up or down, and by how much." It fairly decomposes contribution across non-media factors (season, trend) and each ad channel, and guides you on "where should the next $1,000 go for the best return."`);
  L.push("");
  L.push(`## What it shows (plain language)`);
  L.push(`- **What moved performance**: % breakdown of explanatory power for performance swings, by season/trend/channel (share of explained variance).`);
  L.push(`- **Where the next budget should go**: ranking of channels by how many extra ${targetLabel} you'd get per additional $1,000 spent at current spend levels.`);
  L.push(`- **Actual vs. model**: how well the model tracked actual performance (error), and which weeks spiked.`);
  L.push("");
  L.push(`## Math & statistics detail (for specialists)`);
  L.push("");
  L.push(`### 1. Adstock (ad carryover)`);
  L.push(`Ad effects carry into later weeks. We build geometric adstock candidates, adstockₜ = spendₜ + λ·adstockₜ₋₁, then choose each channel's transformation by fit after accounting for non-media drivers.`);
  L.push("");
  L.push(`### 2. Saturation (diminishing returns)`);
  L.push(`Even the same channel yields less per dollar as spend grows. A Hill response curve makes marginal effect shrink at higher spend. "+N per $1k" is the local slope at current spend.`);
  L.push("");
  L.push(`### 3. Bayesian posterior`);
  L.push(`${targetLabel} = intercept + Σβᵢ·Hill(adstockᵢ) + trend + seasonality + holiday/regime change + error. A weak Gaussian prior stabilizes the estimate. Only channels with posterior P(effect > 0) ≥80% enter budget recommendations.`);
  L.push("");
  L.push(`### 4. Effect confidence`);
  L.push(`Legacy OLS p-values and VIF do not apply. P(effect > 0) is posterior probability; the 90% credible interval is the uncertainty range for effect size.`);
  L.push("");
  L.push(`### 5. Contribution variation`);
  L.push(`Compares how much each driver's weekly contribution moves in posterior prediction. It is not causal proof or OLS Shapley R².`);
  L.push("");
  L.push(`### 6. Weekly contribution decomposition`);
  L.push(`Splits each week into base demand/trend, seasonality, holidays/regime change, and absolute media contribution. Positive media effects remain positive at low spend. RMSE/MAPE measure fit to actuals.`);
  L.push("");
  if (run.shapley && run.shapley.rows && run.shapley.rows.length) {
    L.push(`## Current-data share of explained variance (Shapley R², total R²=${run.shapley.total})`);
    [...run.shapley.rows].sort((a, b) => b.r2_share - a.r2_share).forEach((r) => {
      L.push(`- ${r.driver}: ${(r.pct || 0).toFixed(1)}%`);
    });
    L.push("");
  }
  L.push(`## Key takeaway`);
  L.push(`MMM is an observational-data **association/descriptive model**, not a causal confirmation. The "next budget ranking" is a hypothesis based on the response curve — actual incrementality/ROI confirmation should come from a holdout experiment. For short-term campaign-level allocation, use the Budget Allocation simulator (5-3).`);
  L.push("");
  L.push(`— Growth Opt Playbook · Marketing Response Analysis (MMM)`);
  return L.join("\n");
}

/* ── §7 살아있는 수식 예측 CSV (index downloadMmmForecastCsv 이식) ──
 * spend 칸을 바꾸면 adstock→ln→예측이 엑셀 수식으로 자동 연쇄 계산.  */
function buildForecastCsv(fc, target, locale = "ko") {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const tKo = target === "Regs" ? tx("가입", "signup") : target === "React" ? tx("재활성", "reactivation") : target;
  const chByLn = {};
  fc.chans.forEach((ch) => (chByLn["ln_" + ch.key] = ch.label));
  const evLbl = {};
  (fc.steps || []).forEach((s) => {
    evLbl["d_" + s.key] = s.label;
    evLbl[s.key] = s.label;
  });
  const featPlain = (nm) => {
    if (nm === "(Intercept)") return tx("기본값 — 모든 재료가 0일 때의 출발점", "Baseline — starting point when every ingredient is 0");
    if (nm === "trend") return tx("시간 추세 (전반적으로 늘고 있나 줄고 있나)", "Time trend (is it generally rising or falling)");
    if (/^(sin|cos)_0$/.test(nm)) return tx("계절 패턴 (1년 주기)", "Seasonal pattern (annual cycle)");
    if (/^(sin|cos)_/.test(nm)) return tx("계절 패턴 (보조 주기)", "Seasonal pattern (secondary cycle)");
    if (nm.startsWith("ln_"))
      return (
        (chByLn[nm] || nm.replace(/^ln_c_/, "").replace(/_/g, " ")) +
        tx(" 지출 — 광고잔효+수확체감 변환값(클수록 예측↑, 계수 부호 따라)", " spend — adstock+saturation-transformed value (larger → prediction↑, depending on coefficient sign)")
      );
    if (nm.startsWith("d_"))
      return tx("이벤트/휴일: ", "Event/holiday: ") + (evLbl[nm] || nm.slice(2)) + tx(" — 그 주 해당하면 1, 아니면 0", " — 1 if that week applies, else 0");
    if (evLbl[nm]) return tx("구조변화: ", "Regime change: ") + evLbl[nm] + tx(" — 전환 후 1로 지속", " — stays 1 after the switch");
    return tx("재료 ", "Ingredient ") + nm;
  };
  const L = [];
  let lamRow = 4;
  [
    [tx("# 도구", "# Tool"), "MMM Trend Forecast (5-18)"],
    [tx("# 대상", "# Target"), tKo + " (" + target + ")"],
    [tx("# 모델", "# Model"), fc.model],
    [tx("# adstock_lambda(광고잔효 λ)", "# adstock_lambda (carryover λ)"), fc.lam],
    [tx("# R2(모델 적합도·1에 가까울수록 잘맞음)", "# R2 (model fit · closer to 1 = better)"), fc.r2],
    [tx("# sigma_resid(과거 잔차 표준편차)", "# sigma_resid (historical residual standard deviation)"), fc.sigma],
    [tx("# 과거 데이터 행수", "# Historical rows"), fc.n],
    [tx("# 예측 기간(행)", "# Forecast horizon (rows)"), fc.horizon],
    [
      tx("# 참고 범위 종류", "# Reference-range type"),
      fc.isRidge
        ? tx("릿지 모델 과거 잔차 참고 범위 — ±1.96×잔차 σ, 확률 보장 아님", "Ridge historical-residual reference — ±1.96×residual σ, not probability-calibrated")
        : fc.bandMode === "mean"
          ? tx("과거 잔차 기반 평균 추세 참고 범위 — t·σ·√leverage, 확률 보장 아님", "Historical-residual average-trend reference — t·σ·√leverage, not probability-calibrated")
          : tx("과거 잔차 기반 개별 주 참고 범위 — t·σ·√(1+leverage), 확률 보장 아님", "Historical-residual individual-week reference — t·σ·√(1+leverage), not probability-calibrated"),
    ],
    [
      tx("# 주의", "# Note"),
      tx(
        "관측 회귀의 외삽(가설)입니다. 인과/증분 아님 — 확정은 holdout(5-15). 미래 휴일=0, 이벤트는 마지막 값 지속.",
        "This is an extrapolation (hypothesis) from observational regression. Not causal/incremental — confirm via holdout (5-15). Future holidays=0, events carry the last value.",
      ),
    ],
  ].forEach((kv) => {
    if (String(kv[0]).includes("adstock_lambda") || String(kv[0]).toLowerCase().includes("adstock_lambda")) lamRow = L.length + 1;
    L.push(kv.map(csvQ).join(","));
  });
  L.push("");
  // 계수표 (coef는 B열 — 아래 수식이 참조)
  L.push([tx("# 계수 (이 값들을 바꾸면 아래 예측이 자동 재계산됩니다)", "# Coefficients (change these values and the forecast below auto-recalculates)")].map(csvQ).join(","));
  L.push(
    [
      tx("term(재료)", "term (ingredient)"),
      tx("coef(계수)", "coef (coefficient)"),
      tx("std_error(편차·불확실성)", "std_error (uncertainty)"),
      tx("p_value(작을수록 신뢰)", "p_value (smaller = more confident)"),
      tx("의미 (쉬운 설명)", "meaning (plain explanation)"),
    ]
      .map(csvQ)
      .join(","),
  );
  const coefRow = {};
  fc.coefTable.forEach((ct) => {
    coefRow[ct.term] = L.length + 1;
    L.push(
      [
        ct.term,
        csvNum(ct.coef, 6),
        ct.se == null ? "—" : csvNum(ct.se, 4),
        ct.p == null ? "—" : csvNum(ct.p, 4),
        featPlain(ct.term),
      ]
        .map(csvQ)
        .join(","),
    );
  });
  if (fc.isRidge)
    L.push([tx("# (릿지 모델은 정규화 추정이라 편차·p값이 없습니다)", "# (Ridge model is a regularized estimate, so it has no std error/p-value)")].map(csvQ).join(","));
  L.push("");
  L.push([tx("# ── 아래 '예측값' 칸은 어떻게 나오나요? (엑셀 수식으로 살아있음) ──", "# ── How is the 'forecast' column below computed? (live Excel formulas) ──")].map(csvQ).join(","));
  (locale === "en" ? [
    "# 1) Start from the 'Intercept' (baseline) above.",
    "# 2) Each ingredient has a 'coefficient.' We add up that week's 'ingredient value × coefficient' one by one.",
    "# 3) A positive coefficient means the forecast rises as the ingredient grows; a negative one lowers it.",
    "# 4) Change a channel's spend cell → the 'adstock' cell → the 'ln_channel' cell → the forecast automatically recalculates in a chain (all formulas).",
    "# 5) adstock (carryover) = this week's spend + λ × last week's adstock — the cumulative value of ad effect carrying into next week.",
    "# 6) ln_channel = LN(1 + adstock) — a transform where extra effect shrinks the more you spend (diminishing returns).",
    "# 7) The sum of all ingredients is that week's forecast value.",
    "# * Lower/upper columns are historical-residual reference bounds (future only), not calibrated 95% confidence or prediction intervals.",
    "# * The adstock λ references the 'adstock_lambda' cell in the metadata above (B" + lamRow + ").",
  ] : [
    "# 1) 위 '기본값(Intercept)'에서 출발합니다.",
    "# 2) 각 재료마다 '계수'가 있습니다. 그 주의 '재료 값 × 계수'를 차례로 더합니다.",
    "# 3) 계수가 양수면 그 재료가 클수록 예측이 올라가고, 음수면 내려갑니다.",
    "# 4) 채널 지출(spend) 칸을 바꾸면 → 'adstock' 칸 → 'ln_채널' 칸 → 예측이 자동으로 줄줄이 다시 계산됩니다 (전부 수식).",
    "# 5) adstock(광고잔효) = 이번 주 지출 + λ × 지난주 adstock — 광고 효과가 다음 주로 이어지는 누적값입니다.",
    "# 6) ln_채널 = LN(1 + adstock) — 많이 쓸수록 추가 효과가 줄어드는(수확체감) 변환.",
    "# 7) 모든 재료를 더한 합이 그 주의 예측값입니다.",
    "# ※ 하한/상한은 과거 잔차를 예측값 주변에 적용한 참고 범위입니다(미래만). 보정된 95% 신뢰·예측구간이 아닙니다.",
    "# ※ adstock λ는 위 메타의 'adstock_lambda' 셀(B" + lamRow + ")을 참조합니다.",
  ]).forEach((s) => L.push([s].map(csvQ).join(",")));
  L.push("");
  // 시계열 — spend → adstock → ln → 예측 살아있는 수식 체인
  const fcMatrix = fc.featMatrix;
  const featStart = 7,
    nNames = fc.names.length;
  const lnChanK = {};
  fc.chans.forEach((ch, k) => {
    const j = fc.names.indexOf("ln_" + ch.key);
    if (j >= 0) lnChanK[j] = k;
  });
  const chansLn = fc.chans.map((_, k) => k).filter((k) => Object.values(lnChanK).includes(k));
  const adStart = featStart + nNames,
    spStart = adStart + chansLn.length;
  const featCol = (j) => csvColL(featStart + j);
  const adCol = (k) => csvColL(adStart + chansLn.indexOf(k));
  const spCol = (k) => csvColL(spStart + k);
  const header = [
    "t",
    "label",
    "segment",
    tx("actual(실측)", "actual"),
    tx("fitted_or_forecast(예측·수식)", "fitted_or_forecast"),
    tx("residual_reference_low(참고하한)", "residual_reference_low"),
    tx("residual_reference_high(참고상한)", "residual_reference_high"),
    ...fc.names,
    ...chansLn.map((k) => "adstock_" + fc.chans[k].label),
    ...fc.chans.map((ch) => "spend_" + ch.label),
  ];
  L.push(tx("# 시계열 — spend 칸을 바꾸면 adstock·ln·예측이 자동 연쇄 계산 (전부 수식)", "# Time series — change a spend cell and adstock/ln/forecast auto-recalculate in a chain (all formulas)"));
  L.push(header.map(csvQ).join(","));
  const buildFitted = (er) =>
    "=$B$" +
    coefRow["(Intercept)"] +
    fc.names.map((nm, j) => "+$B$" + coefRow[nm] + "*" + featCol(j) + er).join("");
  const firstRow = L.length + 1;
  for (let i = 0; i < fc.n + fc.horizon; i++) {
    const er = L.length + 1,
      isHist = i < fc.n;
    const lbl = isHist ? fc.histLabels[i] : fc.futLabels[i - fc.n];
    const feats = fc.names.map((nm, j) =>
      lnChanK[j] != null ? "=LN(1+" + adCol(lnChanK[j]) + er + ")" : csvNum(fcMatrix[i][j], 6),
    );
    const adcells = chansLn.map((k) =>
      er === firstRow
        ? "=" + spCol(k) + er
        : "=" + spCol(k) + er + "+$B$" + lamRow + "*" + adCol(k) + (er - 1),
    );
    const spend = fc.chans.map((ch, k) =>
      isHist
        ? csvNum((fc.histSpendByKey[ch.key] || [])[i], 0)
        : csvNum(fc.futSpendByKey[ch.key][i - fc.n], 0),
    );
    let loCell = "",
      hiCell = "";
    if (!isHist) {
      const k = i - fc.n,
        margin = +(fc.hi[k] - fc.predFut[k]).toFixed(2);
      loCell = "=E" + er + "-" + margin;
      hiCell = "=E" + er + "+" + margin;
    }
    L.push(
      [
        i + 1,
        lbl,
        isHist ? "history" : "forecast",
        isHist ? Math.round(fc.actual[i]) : "",
        buildFitted(er),
        loCell,
        hiCell,
        ...feats,
        ...adcells,
        ...spend,
      ]
        .map(csvQ)
        .join(","),
    );
  }
  return L;
}

/* ── 채널별 카니발 삼각검증 + 탄력성·커버리지 CSV (index downloadMmmCannibCsv 이식) ── */
function buildCannibCsv(cannib, effects, target) {
  const chans = cannib.cannChannels || [];
  const effByKey = {};
  (effects || []).forEach((e) => (effByKey[e.key] = e));
  const header = [
    "channel", "channel_label", "is_brand_intercept", "verdict", "verdict_class",
    "vote_FOR", "vote_AGAINST", "vote_ABSTAIN", "for_bar", "power_gate_blocked",
    "power_gate_reasons", "reverse_causality_risk", "spend_time_corr",
    "prec_vote", "prec_low_n", "prec_p25", "prec_slope_per_wk", "prec_slope_p", "prec_change_pct",
    "detrend_vote", "detrend_raw", "detrend_detrended", "detrend_first_diff",
    "net_vote", "net_elasticity", "net_p", "net_ci_lo", "net_ci_hi",
    "elasticity", "ci_lo", "ci_hi", "p", "significant", "effect_verdict",
    "per10pct_pct", "weekly_per_1k", "mean_spend",
    "coverage_nonzero", "coverage_total", "coverage_ratio", "sparse", "trailing_zero",
    "granger_cannibal", "granger_help", "pacing",
    "granger_s2o_lag", "granger_s2o_F", "granger_s2o_p", "granger_s2o_coefsum",
    "granger_o2s_lag", "granger_o2s_F", "granger_o2s_p", "granger_o2s_coefsum",
  ];
  const lines = [header.map(csvQ).join(",")];
  for (const k of chans) {
    const cn = cannib.cannibByChannel[k];
    if (!cn) continue;
    const e = effByKey[k] || {};
    const pr = cn.precedence,
      dt = cn.detrend_corr,
      ni = cn.net_incrementality,
      vt = cn.votes || {},
      pg = cn.power_gate || {},
      g = cn.granger;
    const per10 = e.elas != null ? +(e.elas * 10).toFixed(2) : "";
    const cov = e.total ? +(e.nonzero / e.total).toFixed(3) : "";
    lines.push(
      [
        k, cn.channelLabel, cn.is_brand_intercept, cn.verdict, cn.verdict_class,
        vt.FOR, vt.AGAINST, vt.ABSTAIN, cn.for_bar, pg.blocked,
        (pg.reasons || []).join(" | "), cn.reverse_causality_risk, cn.spend_time_corr,
        pr.vote, pr.low_n, pr.p25, pr.kpi_slope_per_wk, pr.slope_p, pr.kpi_change_over_window_pct,
        dt.vote, dt.raw, dt.detrended, dt.first_diff,
        ni.vote, ni.net_elasticity, ni.p,
        ni.ci_lo != null ? ni.ci_lo : "", ni.ci_hi != null ? ni.ci_hi : "",
        e.elas != null ? e.elas : "", e.ci ? e.ci[0] : "", e.ci ? e.ci[1] : "",
        e.p != null ? e.p : "", e.sig != null ? e.sig : "", e.verdict || "",
        per10, e.weeklyPer1k == null ? "" : e.weeklyPer1k, e.meanSpend != null ? e.meanSpend : "",
        e.nonzero != null ? e.nonzero : "", e.total != null ? e.total : "", cov,
        e.sparse != null ? e.sparse : "", e.trailingZero != null ? e.trailingZero : "",
        cn.granger_cannibal, cn.granger_help, cn.pacing,
        g && g.spend_to_organic ? g.spend_to_organic.lag : "",
        g && g.spend_to_organic ? g.spend_to_organic.F : "",
        g && g.spend_to_organic ? g.spend_to_organic.p : "",
        g && g.spend_to_organic ? g.spend_to_organic.coefSum : "",
        g && g.organic_to_spend ? g.organic_to_spend.lag : "",
        g && g.organic_to_spend ? g.organic_to_spend.F : "",
        g && g.organic_to_spend ? g.organic_to_spend.p : "",
        g && g.organic_to_spend ? g.organic_to_spend.coefSum : "",
      ]
        .map(csvQ)
        .join(","),
    );
  }
  return lines;
}

/* ── §4 검정 원자료 CSV — 주별 타깃·채널별 ln(1+지출)·탈추세 잔차·1차차분
 * (index downloadMmmCannibSeriesCsv 이식 — 엑셀 CORREL로 화면 상관 직접 재현) ── */
function buildCannibSeriesCsv(panel, target) {
  const y = panel.targets[target],
    week = panel.week,
    n = week.length;
  const tr = week.map((_, i) => [1, i]);
  const yFit = mmmOls(tr, y);
  const yResid = yFit ? yFit.resid : y.map(() => null);
  const chans = _mmmChans(panel).filter((ch) => panel.ch[ch.key]);
  const series = chans.map((ch) => {
    const lnG = panel.ch[ch.key].map((v) => Math.log1p(v > 0 ? v : 0));
    const gFit = mmmOls(tr, lnG);
    return { ch, spend: panel.ch[ch.key], lnG, resid: gFit ? gFit.resid : lnG.map(() => null) };
  });
  const wl = (i) => (panel.weekLabel ? panel.weekLabel[i] : week[i]);
  const header = ["t", "week", target, target + "_detrend", target + "_diff"];
  chans.forEach((ch) =>
    header.push(
      "spend_" + ch.label,
      "ln_" + ch.label,
      "ln_" + ch.label + "_detrend",
      "ln_" + ch.label + "_diff",
    ),
  );
  const lines = [header.map(csvQ).join(",")];
  for (let i = 0; i < n; i++) {
    const row = [
      i + 1,
      wl(i),
      Math.round(y[i]),
      csvNum(yResid[i], 4),
      i > 0 ? (y[i] - y[i - 1]).toFixed(1) : "",
    ];
    series.forEach((s) =>
      row.push(
        isFinite(s.spend[i]) ? Math.round(s.spend[i]) : "",
        csvNum(s.lnG[i], 5),
        csvNum(s.resid[i], 5),
        i > 0 ? (s.lnG[i] - s.lnG[i - 1]).toFixed(5) : "",
      ),
    );
    lines.push(row.map(csvQ).join(","));
  }
  return lines;
}

// MMM 흐름: 시계열 점검 → 카니발 → 기여 → 예측.
// locale-aware — 함수로 감싸 ko/en 두 세트를 제공(§12.20 렌더층 다국어 패턴).
function mmmStageDefs(locale) {
  if (locale === "en") {
    return [
      { id: "trend", no: "① Time series", title: "STL trend check", icon: "〰", desc: "Separate natural trend, seasonality, and irregular weeks before judging ad effects." },
      { id: "diagnose", no: "② Cannibalization", title: "Cannibalization diagnosis", icon: "🔬", desc: "Is paid advertising eating into organic traffic that would have come for free? — checked per channel." },
      { id: "mmm", no: "③ Contribution", title: "MMM contribution breakdown", icon: "🧩", desc: "What actually moved performance? Where should the next budget go?" },
      { id: "lab", no: "④ Forecast", title: "Regression · Forecast", icon: "📈", desc: "If things stay the same, or if you change the budget, how will the next weeks look?" },
    ];
  }
  return [
    { id: "trend", no: "① 시계열 점검", title: "STL 추세 분석", icon: "〰", desc: "광고 판단 전에 자연 추세·계절성·이상 주차를 분리합니다." },
    { id: "diagnose", no: "② 잠식 진단", title: "카니발 진단", icon: "🔬", desc: "유료 광고가 공짜로 들어올 오가닉 유입을 갉아먹고 있나? — 채널별로 점검합니다." },
    { id: "mmm", no: "③ 기여 분해", title: "MMM 기여 분해", icon: "🧩", desc: "무엇이 우리 성과를 실제로 움직였나? 다음 예산은 어디에 써야 하나?" },
    { id: "lab", no: "④ 미래 예측", title: "회귀 · 미래 예측", icon: "📈", desc: "이대로 가면, 또는 예산을 바꾸면 다음 몇 주 성과는 어떻게 될까?" },
  ];
}

// ② 기여 분해 스택 차트 버킷 — 12+ 드라이버를 마케터가 한눈에 읽는 4묶음으로.
// 엔진 groupNames→버킷 매핑(수학 불변, 표시 그룹핑만). tone은 다크/라이트 둘 다 읽히는 중간 채도.
function mmmBucketMeta(locale) {
  if (locale === "en") {
    return {
      base: { label: "Seasonality", tone: "#94a3b8" },
      trend: { label: "Base demand · trend", tone: "#38bdf8" },
      event: { label: "Events · regime change", tone: "#f59e0b" },
      media: { label: "Ad effect", tone: "#8b7ff0" },
    };
  }
  return {
    base: { label: "계절 요인", tone: "#94a3b8" },
    trend: { label: "기본 수요·추세", tone: "#38bdf8" },
    event: { label: "이벤트·구조변화", tone: "#f59e0b" },
    media: { label: "광고 효과", tone: "#8b7ff0" },
  };
}
// 아래→위 쌓는 순서. base(=baseline+계절)는 절대 밴드로 별도 처리, 나머지는 그 위 누적.
const MMM_BUCKET_ORDER = ["base", "trend", "event", "media"];
function decompBucketOf(g) {
  if (g === "Seasonality") return "base";
  if (g === "Trend") return "trend";
  if (g === "Holidays" || g === "Regime(steps)") return "event";
  return MMM_NONMEDIA_GROUPS.includes(g) ? "event" : "media";
}
// 개별 채널(광고) 밴드용 팔레트 — 보라 계열 명도차. hex+alpha는 fill에만.
const MMM_MEDIA_PALETTE = ["#8b7ff0", "#a78bfa", "#c084fc", "#e879f9", "#7dd3fc", "#67e8f9"];

// 차트 테마·공통 옵션 — 컴포넌트 밖(상수)로 두어 effect 의존성 안정화
const CHART_THEME = { text: "#334155", muted: "#64748b", grid: "#e2e8f0" };
function chartBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { labels: { color: CHART_THEME.text, font: { size: 11 } } },
      tooltip: { backgroundColor: "rgba(15,23,42,0.9)", padding: 10, cornerRadius: 6 },
    },
    scales: {
      x: { ticks: { color: CHART_THEME.muted, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: CHART_THEME.muted, font: { size: 10 } }, grid: { color: CHART_THEME.grid } },
    },
  };
}

export default function MarketingResponse({ locale = "ko" }) {
  // 3단계(index MMM_STAGE_DEFS): diagnose | mmm | lab. 구 "forecast" 스테이지는 lab에 흡수 —
  // ③ lab이 mmmForecast(②계수) §7 미래예측을 렌더(stage==="lab"). 셋 다 shared mmmColMap 사용.
  const tx = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]); // 인라인 텍스트 로컬라이즈 헬퍼(§12.20 v2 i18n 패턴)
  const bucketMeta = mmmBucketMeta(locale);
  const [stage, setStage] = useState("trend"); // trend | diagnose | mmm | lab
  const [target, setTarget] = useState("Regs");
  const decompModel = "bayesian";
  const [decompGrouped, setDecompGrouped] = useState(true); // §5.5 true=4버킷 묶음 / false=광고 개별채널
  const [satHidden, setSatHidden] = useState({}); // 수확체감 곡선 채널별 표시 토글 { [chKey]: true=숨김 }
  const [spikeNotes, setSpikeNotes] = useState({}); // §5.5 튀는 구간 메모 { [target|week]: note }
  const [fcHorizon, setFcHorizon] = useState(13);
  const [fcBudget, setFcBudget] = useState({}); // {chKey: 주 평균 예산} — 미입력 채널은 최근평균
  const [fcStepOff, setFcStepOff] = useState({}); // {stepKey: 켜둘 미래 기간 N} — 빈값=지속
  const [cannibChannel, setCannibChannel] = useState(null);
  const [cannibQuestion, setCannibQuestion] = useState("precedence");
  // 기본 결과는 기존 MMM 그대로. prior 관련 데이터가 실제로 있을 때만 결과 탭 후보가 추가된다.
  // 원자료는 이 컴포넌트 메모리에만 두며 서버로 보내지 않는다.
  const [priorView, setPriorView] = useState("base");
  const [priorEvidence, setPriorEvidence] = useState({ experiment: null, country: null });
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const demoDisabled = useAppStore((state) => state.demoDisabled);
  const requestAd = useAppStore((state) => state.requestAd);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const currencySym = CURRENCY_SYMBOLS[displayCurrency] || "$";
  // 원본 CSV 통화(업로드 시 지정, 기본 KRW) — 표시 토글과 다르면 실제 배율 변환.
  // §전에는 토글이 라벨만 바꾸고 숫자는 그대로였음(예: $35k → ₩35k, 오해 유발).
  const sourceCurrency = csvData?.currency || "KRW";
  const convAmt = (v) => convertCurrency(v, sourceCurrency, displayCurrency);
  const hasData = csvData?.raw?.length > 0;
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));

  // 5-18 = colMap DnD가 PRIMARY 매퍼(index.html page_5_18 이식). 단일 generic CSV를
  // 주차/날짜/가입/재활성/채널(perf·brand)/더미/step 역할로 드래그 → 모든 분석(진단·MMM·시뮬)
  // 이 이 하나의 패널을 공유. 표준필드(DataFeatureMatrix) 경로 미사용.
  const [mmmColMap, setMmmColMap] = useState(null);
  const [mmmAnalyzedSig, setMmmAnalyzedSig] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisEventRef = useRef(null);
  // 분석하기: 무거운 mmm useMemo가 커밋 렌더에서 동기 실행되므로, 로딩 오버레이를 먼저
  // 페인트(더블 rAF)한 뒤 시그니처를 커밋 → "멈춤" 대신 "분석 중" 표시(§7 성능).
  const runMmmAnalyze = (sig) => {
    trackProductEvent("analysis_started", { tool_id: "5-18", source: isDemo ? "demo" : "csv", row_count: csvData?.raw?.length || 0, analysis_type: "mmm" });
    setIsAnalyzing(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMmmAnalyzedSig(sig);
        window.scrollTo({ top: 0, behavior: "smooth" });
        requestAnimationFrame(() => setIsAnalyzing(false));
      });
    });
  };
  // 플랫폼 필터(Total/Android/iOS) — colMap 헤더 태그(_android/_ios) 기준. 태그 없으면 토글 자체 숨김.
  const [platformFilter, setPlatformFilter] = useState("all"); // all | android | ios

  // CSV 로드 시 colMap 자동 초기화(이름 기반 부분 추정 — reg/react/채널만, 나머지는 트레이).
  const csvSig = hasData ? `${csvData.fileName}|${(csvData.headers || []).join(",")}` : "";
  const prevCsvSig = useRef(null);
  // Set by the demo button so the auto-guessed colMap is also auto-confirmed
  // (analyze gate opened) — results render instantly, matching other tools.
  const demoPending = useRef(false);
  useEffect(() => {
    if (hasData && prevCsvSig.current !== csvSig) {
      const guess = autoGuessColMap(csvData.headers, csvData.raw);
      setMmmColMap(guess);
      setMmmAnalyzedSig(demoPending.current ? JSON.stringify(guess) : null);
      setPriorView("base");
      setPriorEvidence({ experiment: null, country: null });
      demoPending.current = false;
      prevCsvSig.current = csvSig;
    } else if (!hasData && prevCsvSig.current !== null) {
      setMmmColMap(null);
      setMmmAnalyzedSig(null);
      prevCsvSig.current = null;
    }
  }, [hasData, csvSig, csvData.headers, csvData.raw]);

  // 파일 업로드(자체 dropzone — 5-18은 표준 CsvUploader/DataFeatureMatrix 미사용).
  const mmmFileRef = useRef(null);
  const handleMmmFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || !res.data.length) return;
        setCsvData({ raw: res.data, headers: res.meta.fields || [], mapping: {}, fileName: file.name });
      },
    });
  };
  const handleLoadDemo = () => {
    demoPending.current = true;
    setCsvData(buildDemoCsv("response"));
  };
  const handleLoadPriorDemo = () => {
    const demo = buildMmmPriorDemo();
    setPriorEvidence({
      experiment: { name: demo.experiment.fileName, rows: demo.experiment.raw.length, countries: ["KR"], raw: demo.experiment.raw, headers: demo.experiment.headers },
      country: {
        name: demo.country.fileName,
        rows: demo.country.raw.length,
        countries: [...new Set(demo.country.raw.map((row) => row.country))],
        raw: demo.country.raw,
        headers: demo.country.headers,
      },
    });
    setPriorView("base");
  };

  // 첫 진입(데이터 없음) 시 샘플 데이터 자동 로드(CsvUploader와 동일 패턴, SEO·첫인상).
  useEffect(() => {
    if (!hasData && !demoDisabled) handleLoadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const colMapSig = mmmColMap ? JSON.stringify(mmmColMap) : "";
  const mmmAnalyzed = mmmAnalyzedSig != null && mmmAnalyzedSig === colMapSig;

  // 단일 컬럼 세그먼트(platform role) 모드 — 그 컬럼 고유값(성별·플랫폼·국가 등) pill 토글.
  // 태그 모드(mmmPlatformTags)와 상호배타(buildPanelFromColMap: r.platform 있으면 태그 무시).
  const segmentSel = useMemo(
    () => (hasData && mmmColMap && mmmAnalyzed ? mmmSegmentValues(csvData.headers, csvData.raw, mmmColMap) : null),
    [hasData, mmmColMap, csvData, mmmAnalyzed],
  );
  // platformFilter가 현재 세그먼트 값에 없으면(매핑 변경 잔상) Total로 파생(setState 대신
  // 렌더타임 파생 — AHA validSeg 패턴, 캐스케이딩 렌더 회피). 패널·pill 모두 이 값 사용.
  const effPlatformFilter = useMemo(() => {
    if (segmentSel && platformFilter !== "all" && !segmentSel.values.some((v) => v.value === platformFilter)) return "all";
    return platformFilter;
  }, [segmentSel, platformFilter]);

  // Chart refs
  const cvRef = useRef(null);
  const shapleyRef = useRef(null);
  const satRef = useRef(null);
  const efficiencyRef = useRef(null);
  const fitRef = useRef(null);
  const decompRef = useRef(null);
  const forecastRef = useRef(null);
  const trendRef = useRef(null);
  const simpleRef = useRef(null);
  const irfRef = useRef(null);

  // ── MMM 캐시 (buildMmmMethCache 축약) — 매핑·데이터·target·model 변경 시 재계산 ──
  const mmm = useMemo(() => {
    if (!hasData) return null;
    // 분석 게이트(index 분석하기): 매핑 확정 전엔 무거운 엔진(mmmRunMmm 등)을 돌리지 않음 —
    // 드래그 도중 반쯤 매핑된 colMap으로 엔진이 도는 것을 막고(성능·크래시 방지) 게이트 후에만 계산.
    if (!mmmAnalyzed) return { empty: true, reason: tx("매핑 확정(분석하기) 후 결과가 표시됩니다.", "Results appear after you confirm the mapping (Analyze).") };
    try {
      // colMap(PRIMARY) → 패널. 미완성이면 매핑 안내(패널 empty).
      if (!mmmColMap) return { empty: true, reason: tx("컬럼 역할을 매핑하세요 (주차·가입/재활성·채널 spend).", "Map column roles (week · signup/reactivation · channel spend).") };
      const built = buildPanelFromColMap(csvData.headers, csvData.raw, mmmColMap, effPlatformFilter, locale);
      if (built.missing.length) return { empty: true, reason: tx("필수 역할 미지정: ", "Required role not set: ") + built.missing.join(", ") };
      const panel = trimToActive(built.panel);
      const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
      const t = pickTarget(panel, target);
      const validate = mmmValidate(panel, locale);
      const derived = {
        orientation: "colmap",
        target: t,
        availableTargets: Object.keys(panel.targets),
        channels: built.roles.channels.map((c) => c.label),
        time: built.roles.week.length ? tx("매핑된 주차 컬럼", "Mapped week column") : tx("행 순서", "Row order"),
        n: panel.week.length,
        dummies: built.roles.dummies.map((d) => d.label),
        useDummies: panel.useDummies,
      };
      // 자동 흡수(공선쌍) — index와 동일 순서: resolve → cfg.absorbed 세팅 → run/effects/decomp가 반영.
      const absorb = mmmResolveAbsorb(panel, cfg);
      cfg.absorbed = absorb.absorbed;
      // 국가 prior: 동일 포맷의 참고 시장을 각각 적합한 뒤 매체 β만 평균낸다.
      // baseline·추세·계절성은 절대 이식하지 않으며, country 컬럼별 개별 모델이
      // 성공한 경우만 약한 precision으로 참고한다.
      const mediaPriors = {};
      let countryCandidates = [];
      const experiment = priorView === "experiment" ? priorEvidence.experiment : null;
      if (experiment?.raw?.length && experiment.headers?.length) {
        const targetHeader = mmmTargetHeader(experiment.headers, t);
        const stateHeader = experiment.headers.find((h) => /treatment_state|state|on.?off|상태/i.test(String(h)));
        const armHeader = experiment.headers.find((h) => /(^|[_\s])arm|group|treatment.*control|처리군|대조군/i.test(String(h)));
        const periodHeader = experiment.headers.find((h) => /post|pre|period|phase|사전|사후|기간/i.test(String(h)));
        const spends = experiment.headers.filter((h) => /spend|cost|비용|지출/i.test(String(h)));
        if (targetHeader && spends.length) {
          spends.forEach((spendHeader) => {
            const parse = (v) => Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;
            const key = mmmSanKey(spendHeader);
            let effect = null;
            let n = 0;
            if (armHeader) {
              const treated = experiment.raw.filter((row) => /treat|처리/i.test(String(row[armHeader] || "")));
              const control = experiment.raw.filter((row) => /control|대조/i.test(String(row[armHeader] || "")));
              if (treated.length >= 4 && control.length >= 4) {
                const mean = (rows) => rows.reduce((sum, row) => sum + parse(row[targetHeader]), 0) / Math.max(1, rows.length);
                const tPost = treated.filter((row) => /post|after|사후/i.test(String(row[periodHeader] || "")));
                const tPre = treated.filter((row) => /pre|before|사전/i.test(String(row[periodHeader] || "")));
                const cPost = control.filter((row) => /post|after|사후/i.test(String(row[periodHeader] || "")));
                const cPre = control.filter((row) => /pre|before|사전/i.test(String(row[periodHeader] || "")));
                effect = tPost.length && tPre.length && cPost.length && cPre.length ? (mean(tPost) - mean(tPre)) - (mean(cPost) - mean(cPre)) : mean(treated) - mean(control);
                n = periodHeader && tPost.length && tPre.length && cPost.length && cPre.length ? Math.min(tPost.length, tPre.length, cPost.length, cPre.length) : Math.min(treated.length, control.length);
              }
            } else if (stateHeader) {
              const on = experiment.raw.filter((row) => /^(on|treat|1)$/i.test(String(row[stateHeader] || "").trim()));
              const off = experiment.raw.filter((row) => /^(off|control|0)$/i.test(String(row[stateHeader] || "").trim()));
              if (on.length >= 4 && off.length >= 4) {
                const ordered = experiment.raw.map((row, i) => ({ row, i })).sort((a, b) => String(a.row.week || a.row.date || a.i).localeCompare(String(b.row.week || b.row.date || b.i)));
                const X = ordered.map(({ row }, i) => [1, i, Math.sin((2 * Math.PI * i) / 52), Math.cos((2 * Math.PI * i) / 52), /^(on|treat|1)$/i.test(String(row[stateHeader] || "").trim()) ? 1 : 0]);
                const fit = mmmOls(X, ordered.map(({ row }) => parse(row[targetHeader])));
                effect = fit ? fit.beta[4] : on.reduce((sum, row) => sum + parse(row[targetHeader]), 0) / on.length - off.reduce((sum, row) => sum + parse(row[targetHeader]), 0) / off.length;
                n = Math.min(on.length, off.length);
              }
            }
            const baseRun = mmmBayesianRun(panel, cfg, t, false);
            const channel = Object.values(baseRun?.saturationByChannel || {}).find((item) => item.key === key);
            const avgSpend = experiment.raw.reduce((sum, row) => sum + parse(row[spendHeader]), 0) / experiment.raw.length;
            if (channel && effect != null && avgSpend > 0) {
              const p = channel.params;
              const transformed = Math.max(0.05, Math.pow(avgSpend / p.ec, p.slope) / (1 + Math.pow(avgSpend / p.ec, p.slope)));
              mediaPriors[key] = { mean: effect / transformed, precision: Math.min(1.2, 0.12 * n) };
            }
          });
        }
      }
      const source = priorView === "country" ? priorEvidence.country : null;
      if (source?.raw?.length && source.headers?.length) {
        const countryHeader = source.headers.find((h) => /(^|[_\s])(country|market)([_\s]|$)|국가|시장/i.test(String(h)));
        const countries = countryHeader ? [...new Set(source.raw.map((row) => String(row[countryHeader] || "").trim()).filter(Boolean))] : [];
        const slicePanel = (input, end) => ({ ...input, week: input.week.slice(0, end), ch: Object.fromEntries(Object.entries(input.ch).map(([key, values]) => [key, values.slice(0, end)])), dummy: Object.fromEntries(Object.entries(input.dummy || {}).map(([key, values]) => [key, values.slice(0, end)])), steps: Object.fromEntries(Object.entries(input.steps || {}).map(([key, values]) => [key, values.slice(0, end)])), targets: Object.fromEntries(Object.entries(input.targets).map(([key, values]) => [key, values.slice(0, end)])) });
        const candidatePriors = [];
        countries.forEach((country) => {
          const ref = buildPanelFromColMap(source.headers, source.raw.filter((row) => String(row[countryHeader]).trim() === country), mmmColMap, "all", locale);
          if (ref.missing.length) return;
          const refPanel = trimToActive(ref.panel);
          // 참고국에 같은 Y가 없으면 다른 목표(예: 가입)를 대신 쓰지 않는다.
          if (!Object.prototype.hasOwnProperty.call(refPanel.targets, t)) return;
          const refRun = mmmBayesianRun(refPanel, { ...MMM_METH_CONFIG, absorbed: new Set() }, t, false);
          const prior = {};
          Object.values(refRun?.saturationByChannel || {}).forEach((s) => {
            if (isFinite(s.ln_coef)) prior[s.key] = { mean: s.ln_coef, precision: 0.35 };
          });
          if (!Object.keys(prior).length) return;
          const holdout = Math.min(12, Math.floor(panel.week.length * 0.2));
          if (holdout < 8) return;
          const train = slicePanel(panel, panel.week.length - holdout);
          const fit = mmmBayesianRun(train, cfg, t, false, { mediaPriors: prior });
          const futureSpend = Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, values.slice(-holdout)]));
          const forecast = fit && mmmBayesianForecast(fit, train, futureSpend, holdout);
          const actual = panel.targets[t].slice(-holdout);
          const rmse = forecast?.predFut?.length === actual.length ? Math.sqrt(actual.reduce((sum, value, index) => sum + (value - forecast.predFut[index]) ** 2, 0) / actual.length) : Infinity;
          candidatePriors.push({ country, prior, rmse });
        });
        candidatePriors.sort((a, b) => a.rmse - b.rmse);
        const top = candidatePriors.slice(0, 4);
        const sets = [];
        const scoreSet = (members) => {
          const combined = {};
          members.forEach(({ prior }) => Object.entries(prior).forEach(([key, value]) => (combined[key] ||= []).push(value.mean)));
          const prior = Object.fromEntries(Object.entries(combined).map(([key, values]) => [key, { mean: values.reduce((sum, value) => sum + value, 0) / values.length, precision: Math.min(1.2, 0.35 * values.length) }]));
          const holdout = Math.min(12, Math.floor(panel.week.length * 0.2));
          const train = slicePanel(panel, panel.week.length - holdout);
          const fit = mmmBayesianRun(train, cfg, t, false, { mediaPriors: prior });
          const fc = fit && mmmBayesianForecast(fit, train, Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, values.slice(-holdout)])), holdout);
          const actual = panel.targets[t].slice(-holdout);
          const rmse = fc?.predFut?.length === actual.length ? Math.sqrt(actual.reduce((sum, value, index) => sum + (value - fc.predFut[index]) ** 2, 0) / actual.length) : Infinity;
          // 복잡도 패널티: 아주 작은 오차 차이로 국가 수가 늘지 않게 한다.
          return { country: members.map((m) => m.country).join(" + "), prior, rmse, score: rmse * (1 + 0.015 * (members.length - 1)) };
        };
        top.forEach((a, i) => {
          sets.push(scoreSet([a]));
          top.slice(i + 1).forEach((b, j) => {
            sets.push(scoreSet([a, b]));
            top.slice(i + j + 2).forEach((c) => sets.push(scoreSet([a, b, c])));
          });
        });
        sets.sort((a, b) => a.score - b.score);
        countryCandidates = sets;
        Object.assign(mediaPriors, sets[0]?.prior || {});
      }
      const run = mmmBayesianRun(panel, cfg, t, true, { mediaPriors });
      if (!run) throw new Error("Bayesian posterior estimate failed");
      const effects = [];
      return { empty: false, panel, cfg, derived, target: t, validate, run, effects, absorb, mediaPriors, countryCandidates };
    } catch (e) {
      // null-fit(특이행렬)은 대개 채널 공선성(예산이 함께 움직임)·기간 부족 → 정직한 도메인 메시지 (§8)
      const msg = String(e && e.message || "");
      if (/reading '?(beta|coef|params)'?|null|singular|is not a function/i.test(msg)) {
        return {
          empty: true,
          reason: tx(
            "회귀 추정 불가 — 채널 지출이 서로 강하게 연동(공선성)되어 있거나 유효 기간(주)이 부족합니다. 채널별로 독립적인 지출 변동이 있는 데이터가 필요합니다.",
            "Regression estimate not possible — channel spends are strongly linked (collinear), or the valid period (weeks) is too short. Data with independent spend variation per channel is needed.",
          ),
        };
      }
      return { empty: true, reason: tx("분석 오류: ", "Analysis error: ") + msg };
    }
  }, [hasData, csvData, target, mmmColMap, mmmAnalyzed, effPlatformFilter, locale, tx, priorView, priorEvidence]);

  useEffect(() => {
    if (!mmmAnalyzed) return;
    const signature = `${mmmAnalyzedSig}|${target}|${effPlatformFilter}`;
    if (analysisEventRef.current === signature) return;
    analysisEventRef.current = signature;
    trackProductEvent("analysis_completed", {
      tool_id: "5-18",
      source: isDemo ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: "mmm",
      result_state: mmm?.empty ? "insufficient" : "ready",
    });
  }, [mmmAnalyzed, mmmAnalyzedSig, target, effPlatformFilter, mmm?.empty, isDemo, csvData?.raw?.length]);

  const decomp = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return null;
    try {
      return mmmBayesianWeeklyDecomp(mmm.run);
    } catch (e) {
      return null;
    }
  }, [mmm, stage]);

  // 해당 기간의 실제 주별 지출을 모델 곡선에 대입한 채널별 평균 성과.
  // 전체 타깃을 채널마다 복제하지 않고, 채널별 예측 기여만 보여준다.
  const weeklyChannelPerformance = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return [];
    return buildMmmWeeklyPerformance(mmm.panel, mmm.run.saturationByChannel);
  }, [mmm, stage]);

  const forecast = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab") return null;
    try {
      // fcBudget: 채널별 주 평균 예산(명시 채널만 H개로 채움) → 미입력은 mmmForecast가 최근평균 사용.
      const chans = _mmmChans(mmm.panel).filter((ch) => mmm.panel.ch[ch.key]);
      const futureSpend = {};
      chans.forEach((ch) => {
        const b = fcBudget[ch.key];
        if (b != null && isFinite(b)) futureSpend[ch.key] = Array(fcHorizon).fill(b);
      });
      const hasBudget = Object.keys(futureSpend).length > 0;
      return mmmBayesianForecast(
        mmm.run,
        mmm.panel,
        hasBudget ? futureSpend : null,
        fcHorizon,
      );
    } catch (e) {
      return null;
    }
  }, [mmm, stage, fcHorizon, fcBudget]);

  const trend = useMemo(() => {
    if (!mmm || mmm.empty || !["trend", "diagnose"].includes(stage)) return null;
    try {
      return mmmTrendExistence(mmm.panel, mmm.cfg, mmm.target, locale);
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // 채널별 카니발 + §4.5 랭킹/전역 종합 (index buildMmmMethCache byTarget 오케스트레이션 포트)
  const cannib = useMemo(() => {
    // 분석 패키지는 어느 단계에서 받아도 4검증을 모두 포함해야 한다. 화면은
    // diagnose 단계에서만 렌더하지만 결과 캐시는 분석 완료 뒤 유지한다.
    if (!mmm || mmm.empty) return null;
    try {
      const { panel, cfg, target: t } = mmm;
      const elas = mmmElasticities(panel, cfg, t, cfg.defaultLam);
      const chans = _mmmChans(panel).filter((c) => panel.ch[c.key]);
      const cannibByChannel = {};
      const cannChannels = [];
      const rows = chans.map((c) => {
        const e = elas.find((x) => x.var === "ln_" + c.key);
        const net = e
          ? { coef: e.coef, ci_lo: e.ci_lo, ci_hi: e.ci_hi, p: e.p }
          : { coef: 0, ci_lo: -1, ci_hi: 1, p: 1 };
        const cn = mmmCannibalization(panel, cfg, t, net, c.key, locale);
        cannibByChannel[c.key] = cn;
        cannChannels.push(c.key);
        return { channel: c, verdict: cn };
      });
      // 데이터 충분성(적격) 게이트 — index isIdentified: 집행주·지출변동CV·df (공선은 제외 안 함)
      const cov = mmmChannelCoverage(panel, cfg);
      const rcfg = mmmRankCfg();
      const isIdentified = (k) =>
        CANNIBAL_RANK.eligibility(panel.ch[k] || [], (cov[k] || { nonzero: 0 }).nonzero, rcfg)
          .eligible;
      const identifiedChannels = cannChannels.filter(isIdentified);
      const globalCannib = mmmGlobalCannib(cannibByChannel, identifiedChannels);
      const cannibRank = mmmBuildCannibRank(panel, t, cannibByChannel, cov, cannChannels);
      return { rows, cannibByChannel, cannChannels, cov, identifiedChannels, globalCannib, cannibRank };
    } catch (e) {
      return null;
    }
  }, [mmm, locale]);

  // ── §1 매크로 사실 + 자동 흡수(공선) + §2 naive-model audit (모델 독립) ──
  const diag = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "diagnose") return null;
    try {
      const { panel, cfg } = mmm;
      // 주별 Date 배열 — weekLabel이 ISO(YYYY-MM-DD)면 그것을, 아니면 macro는 빈 객체.
      const dates = (panel.weekLabel || []).map((s) => {
        const t = new Date(String(s) + "T00:00:00Z").getTime();
        return isNaN(t) ? null : new Date(t);
      });
      const validDates = dates.every(Boolean) && dates.length === panel.week.length;
      const macro = validDates ? mmmMacroFacts(panel, cfg, dates, locale) : {};
      // 자동 흡수는 mmm useMemo에서 이미 cfg.absorbed에 반영됨 — 여기선 노티스 표시용으로 재사용.
      const absorb = mmm.absorb || { absorbed: new Set(), notices: [] };
      // naive-model audit (RR 필요 — Regs+React 둘 다 있어야 의미). throw 가드.
      let audit = null;
      try {
        audit = mmmAudit(panel, cfg);
      } catch (e) {
        audit = null;
      }
      return { macro, absorb, audit, validDates };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // target 사용 가능 목록 (setState-in-effect 회피: 선택은 파생값으로 클램프, mmm.target이 실제 사용 타깃)
  const availTargets = mmm && !mmm.empty ? mmm.derived.availableTargets : [];

  const cannibChannels = cannib ? cannib.rows.map((r) => r.channel.key) : [];
  const activeCannibCh =
    cannibChannel && cannibChannels.includes(cannibChannel)
      ? cannibChannel
      : cannibChannels[0] || null;
  // 활성 채널의 카니발 검정 결과(§4 상세용)
  const activeCn =
    cannib && activeCannibCh ? cannib.cannibByChannel[activeCannibCh] : null;

  /* ------------------------------ CHARTS ------------------------------ */
  // Stage ② charts: CV, Shapley, saturation, fit, decomp
  useEffect(() => {
    const inst = [];
    if (stage === "mmm" && mmm && !mmm.empty) {
      const run = mmm.run;
      // Bayesian engine selects a carryover parameter per channel; the legacy
      // single-λ CV chart is only meaningful for the old point-estimate engine.
      if (cvRef.current && run.cv_rmse && Object.keys(run.cv_rmse).length) {
        const grid = mmm.cfg.adstockGrid.filter((l) => run.cv_rmse[l] != null);
        inst.push(
          new Chart(cvRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels: grid.map((l) => l.toFixed(1)),
              datasets: [
                {
                  label: "OOS RMSE",
                  data: grid.map((l) => run.cv_rmse[l]),
                  borderColor: "#7aa2f7",
                  pointBackgroundColor: grid.map((l) => (l === run.best_lambda ? NEG : "#7aa2f7")),
                  pointRadius: grid.map((l) => (l === run.best_lambda ? 6 : 3)),
                  tension: 0.2,
                },
              ],
            },
            options: chartBase(),
          }),
        );
      }
      // Shapley R² share (horizontal bar)
      if (shapleyRef.current && run.shapley?.rows?.length) {
        const rows = [...run.shapley.rows].sort((a, b) => b.r2_share - a.r2_share);
        inst.push(
          new Chart(shapleyRef.current.getContext("2d"), {
            type: "bar",
            data: {
              labels: rows.map((r) => r.driver),
              datasets: [
                {
                  label: tx("R² 기여", "R² contribution"),
                  data: rows.map((r) => +r.r2_share.toFixed(4)),
                  backgroundColor: "#7aa2f7",
                  borderRadius: 3,
                },
              ],
            },
            options: {
              ...chartBase(),
              indexAxis: "y",
              plugins: {
                ...chartBase().plugins,
                tooltip: {
                  callbacks: { label: (c) => `${(rows[c.dataIndex].pct || 0).toFixed(1)}% (R² ${c.parsed.x})` },
                },
              },
            },
          }),
        );
      }
      // 반응 곡선 (per channel, y = ln_coef·ln(1+x) = 그 지출에서의 예상 기여).
      // 기존 한계응답(ln_coef/(1+x)) 곡선은 x→0에서 발산(1,000,000)해 판독 불가(§유저) →
      // 누적 반응 곡선으로 교체(단조·발산 없음, 평평해질수록 수확체감). 현재 지출 위치 점으로 표시.
      if (satRef.current && run.saturationByChannel) {
        const themeVarS = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColS = themeVarS("--text-muted") || CHART_THEME.muted;
        const textColS = themeVarS("--text-1") || CHART_THEME.text;
        const chs = Object.entries(run.saturationByChannel);
        if (chs.length) {
          const maxSpend = Math.max(...chs.map(([, s]) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const respAt = (s, x) => s.responseAt(x);
          // 현재 지출 위치(●)는 각 채널 선 위 데이터점으로 → 선을 숨기면 점도 같이 숨겨짐(별도 scatter 제거).
          const lineDs = chs.map(([key, s], i) => {
            const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: respAt(s, x) })),
              borderColor: col,
              borderDash: s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: textColS,
              pointBorderWidth: 1.5,
              hidden: !!satHidden[key],
            };
          });
          const satOpts = chartBase();
          satOpts.plugins.legend = { display: false }; // 커스텀 HTML 범례(채널 토글) 사용
          satOpts.plugins.tooltip = { ...satOpts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${fmtOne(c.parsed.y)}${tx("명", "")} @ ${currencySym}${fmtOne(convAmt(c.parsed.x))}` } };
          satOpts.scales.x = { type: "linear", ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          satOpts.scales.y = { ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => fmtOne(v) }, grid: { color: CHART_THEME.grid } };
          inst.push(
            new Chart(satRef.current.getContext("2d"), {
              data: { datasets: lineDs },
              options: satOpts,
            }),
          );
        }
      }
      // 목표가 전환이면 CPA, 매출이면 ROAS. 수확체감 반응곡선을 비용 효율 언어로
      // 다시 읽어 예산을 늘릴수록 왜 CPR이 오르고 ROAS가 내려가는지 보여준다.
      if (efficiencyRef.current && run.saturationByChannel) {
        const themeVarE = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColE = themeVarE("--text-muted") || CHART_THEME.muted;
        const chs = Object.entries(run.saturationByChannel);
        if (chs.length) {
          const isRoas = mmm.target === "Revenue";
          const maxSpend = Math.max(...chs.map(([, s]) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const metricAt = (s, spend) => {
            const result = s.responseAt(spend);
            if (!(spend > 0) || !(result > 0)) return null;
            return isRoas ? result / spend : spend / result;
          };
          const datasets = chs.map(([key, s], i) => {
            const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: metricAt(s, x) })),
              borderColor: col,
              borderDash: s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: mutedColE,
              pointBorderWidth: 1.5,
              hidden: !!satHidden[key],
              spanGaps: false,
            };
          });
          const opts = chartBase();
          opts.plugins.legend = { display: false };
          opts.plugins.tooltip = { ...opts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${isRoas ? "" : currencySym}${fmtOne(c.parsed.y)}${isRoas ? "x" : ""}` } };
          opts.scales.x = { type: "linear", ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          opts.scales.y = { ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => `${isRoas ? "" : currencySym}${fmtOne(v)}${isRoas ? "x" : ""}` }, grid: { color: CHART_THEME.grid } };
          inst.push(new Chart(efficiencyRef.current.getContext("2d"), { data: { datasets }, options: opts }));
        }
      }
      // "baseline" 필드는 회귀절편(전체 기간 평균) 단일 상수라 원래 평평함 — 시즌·추세는 그 위에
      // 별도 contrib로 얹힘. 그래서 이 필드만 그리면 "왜 안 움직이나" 혼란(§ 실사용 피드백) →
      // 두 차트 모두 baseline+비매체(시즌·추세·휴일·구조변화) 합산 시계열을 같이 씀.
      const nonMediaGroupsAll = decomp ? decomp.groupNames.filter((g) => MMM_NONMEDIA_GROUPS.includes(g)) : [];
      const nonMediaSeries = decomp
        ? decomp.weeks.map((w) => w.baseline + nonMediaGroupsAll.reduce((s, g) => s + (w.contrib[g] || 0), 0))
        : [];
      // Fit chart (actual vs fitted vs 시즌·추세 등)
      if (fitRef.current && decomp) {
        const labels = decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week);
        inst.push(
          new Chart(fitRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels,
              datasets: [
                { label: tx("실제", "Actual"), data: decomp.weeks.map((w) => w.actual), borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
                { label: tx("모델", "Model"), data: decomp.weeks.map((w) => w.fitted), borderColor: "#7aa2f7", pointRadius: 0, tension: 0.2 },
                { label: tx("시즌·추세 등(비매체)", "Season/trend etc. (non-media)"), data: nonMediaSeries, borderColor: "#e0af68", borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
              ],
            },
            options: chartBase(),
          }),
        );
      }
      // Decomp stacked area — 기준선(기본 수요) 위에 버킷/채널을 누적. 맨 위 누적선 = 모델(fitted).
      // 그룹모드: 4버킷(기본·시즌추세·이벤트·광고). 개별모드: 비매체 버킷 + 광고를 채널별로 각각 누적.
      // 어느 모드든 모든 밴드를 기준선 위로 쌓아 최상단이 모델선과 일치(=아래 텍스트의 "모델"과 sum 일치).
      if (decompRef.current && decomp) {
        const labels = decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week);
        // 테마 토큰은 body.light-mode에 재정의됨 → documentElement가 아니라 body에서 읽어야 라이트 반영.
        const themeVar = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const textCol = themeVar("--text-1") || CHART_THEME.text;
        const mutedCol = themeVar("--text-muted") || CHART_THEME.muted;
        // 버킷별 주간 합 시계열
        const bucketSeries = (bucket) =>
          decomp.weeks.map((w) =>
            decomp.groupNames.reduce((s, g) => (decompBucketOf(g) === bucket ? s + (w.contrib[g] || 0) : s), 0),
          );
        // area+누적선 방식은 밴드가 음수일 때 선이 역행해 다른 밴드를 침범(§유저 피드백: "쭉 꺼지는 게 카니발?").
        // stacked bar로 전환 — Chart.js는 양/음수를 0선 기준 위/아래로 각자 독립 누적해 절대 안 꼬임.
        // 기본 수요 = baseline(상수) + 계절(Seasonality) 흡수.
        const bars = [];
        bars.push({ label: bucketMeta.base.label, data: decomp.weeks.map((w, t) => w.baseline + bucketSeries("base")[t]), tone: bucketMeta.base.tone });
        bars.push({ label: bucketMeta.trend.label, data: bucketSeries("trend"), tone: bucketMeta.trend.tone });
        bars.push({ label: bucketMeta.event.label, data: bucketSeries("event"), tone: bucketMeta.event.tone });
        if (decompGrouped) {
          bars.push({ label: bucketMeta.media.label, data: bucketSeries("media"), tone: bucketMeta.media.tone });
        } else {
          const mediaGroups = decomp.groupNames.filter((g) => decompBucketOf(g) === "media");
          mediaGroups.forEach((g, i) => {
            bars.push({ label: g, data: decomp.weeks.map((w) => w.contrib[g] || 0), tone: MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length] });
          });
        }
        const datasets = bars.map((b) => ({
          type: "bar",
          label: b.label,
          data: b.data,
          backgroundColor: b.tone,
          stack: "decomp",
          borderRadius: 2,
          order: 2,
        }));
        // 실제(점선 오버레이) — 막대 스택 합과 얼마나 가까운지 눈으로 확인.
        datasets.push({
          type: "line",
          label: tx("실제", "Actual"),
          data: decomp.weeks.map((w) => w.actual),
          borderColor: textCol,
          backgroundColor: "transparent",
          borderDash: [4, 3],
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 0,
        });
        const decompOpts = chartBase();
        decompOpts.plugins.legend = {
          position: "bottom",
          labels: { color: textCol, font: { size: 11 }, boxWidth: 12, boxHeight: 12, padding: 10, usePointStyle: true },
        };
        decompOpts.plugins.tooltip = {
          ...decompOpts.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? "+" : ""}${Math.round(ctx.parsed.y).toLocaleString()}${tx("명", "")}`,
          },
        };
        decompOpts.scales.x = { ...decompOpts.scales.x, stacked: true, ticks: { ...decompOpts.scales.x.ticks, color: mutedCol, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 } };
        decompOpts.scales.y = { ...decompOpts.scales.y, stacked: true, ticks: { ...decompOpts.scales.y.ticks, color: mutedCol, callback: (v) => Math.round(v).toLocaleString() } };
        // 메모 남긴 튀는 주 → 세로 점선 + 번호 뱃지(글씨 겹침 방지, 실제 메모는 아래 표에 동일 번호로).
        const notedSpikes = (decomp.spikes || []).filter((s) => (spikeNotes[`${mmm.target}|${s.week}`] || "").trim());
        const numOf = (s) => notedSpikes.findIndex((n) => n.week === s.week) + 1;
        const spikeLinePlugin = {
          id: "spikeLines",
          afterDraw(chart) {
            if (!notedSpikes.length) return;
            const { ctx, chartArea, scales } = chart;
            ctx.save();
            notedSpikes.forEach((s) => {
              const idx = s.i != null ? s.i : s.week - 1;
              const x = scales.x.getPixelForValue(idx);
              if (x < chartArea.left || x > chartArea.right) return;
              ctx.strokeStyle = "#f59e0b";
              ctx.setLineDash([4, 3]);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x, chartArea.top + 12);
              ctx.lineTo(x, chartArea.bottom);
              ctx.stroke();
              ctx.setLineDash([]);
              // 번호 뱃지(원)
              ctx.fillStyle = "#f59e0b";
              ctx.beginPath();
              ctx.arc(x, chartArea.top + 7, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 10px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(numOf(s)), x, chartArea.top + 7);
            });
            ctx.restore();
          },
        };
        inst.push(
          new Chart(decompRef.current.getContext("2d"), {
            data: { labels, datasets },
            options: decompOpts,
            plugins: [spikeLinePlugin],
          }),
        );
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
    // convAmt는 sourceCurrency/displayCurrency로만 결정되는 순수 파생 함수라 그
    // 둘을 deps에 넣는 것으로 충분(함수 레퍼런스 자체는 deps에 안 넣음, §매 렌더 재생성).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mmm, decomp, spikeNotes, decompGrouped, satHidden, currencySym, sourceCurrency, displayCurrency, tx]);

  // Stage ③ forecast chart
  useEffect(() => {
    const inst = [];
    if (stage === "lab" && forecast && forecastRef.current) {
      const fc = forecast;
      const nHist = fc.splitAt;
      const labels = fc.labels;
      // actual: hist만; model: hist fitted + future pred (n-1 지점 연결)
      const actual = [...fc.actual, ...Array(fc.horizon).fill(null)];
      const model = [
        ...fc.fittedHist,
        ...Array(fc.horizon).fill(null),
      ];
      const future = [
        ...Array(nHist - 1).fill(null),
        fc.fittedHist[nHist - 1],
        ...fc.predFut,
      ];
      const bandLo = [...Array(nHist).fill(null), ...fc.lo];
      const bandHi = [...Array(nHist).fill(null), ...fc.hi];
      inst.push(
        new Chart(forecastRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제", "Actual"), data: actual, borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
              { label: tx("모델(과거)", "Model (past)"), data: model, borderColor: "#7aa2f7", pointRadius: 0, tension: 0.2 },
              { label: tx("예측(미래)", "Forecast (future)"), data: future, borderColor: "#7aa2f7", borderDash: [6, 4], pointRadius: 0, tension: 0.2 },
              { label: tx("상한", "Upper bound"), data: bandHi, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: "+1", pointRadius: 0 },
              { label: tx("하한", "Lower bound"), data: bandLo, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: false, pointRadius: 0 },
            ],
          },
          options: chartBase(),
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, forecast, tx]);

  // Stage ① trend chart (STL trend + actual)
  useEffect(() => {
    const inst = [];
    if (["trend", "diagnose"].includes(stage) && trend && trendRef.current && mmm && !mmm.empty) {
      const y = mmm.panel.targets[mmm.target];
      const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
      inst.push(
        new Chart(trendRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제", "Actual"), data: y, borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.15 },
              { label: tx("STL 추세", "STL trend"), data: trend.stl?.trend || [], borderColor: "#7aa2f7", pointRadius: 0, borderWidth: 2 },
            ],
          },
          options: chartBase(),
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, trend, mmm, tx]);

  // Stage ① 카니발 4검증 — 선택한 질문 하나의 근거 차트만 렌더.
  useEffect(() => {
    const inst = [];
    if (
      stage === "diagnose" &&
      mmm &&
      !mmm.empty &&
      irfRef.current &&
      cannib &&
      activeCannibCh
    ) {
      try {
        const y = mmm.panel.targets[mmm.target] || [];
        const spend = mmm.panel.ch[activeCannibCh] || [];
        const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
        const cn = activeCn;
        if (cannibQuestion === "precedence") {
          const p25 = cn?.precedence?.p25 ?? 0;
          inst.push(
            new Chart(irfRef.current.getContext("2d"), {
              type: "line",
              data: {
                labels,
                datasets: [
                  {
                    label: tx("성과", "Outcome"), data: y, borderColor: "#7aa2f7", pointRadius: spend.map((v) => v <= p25 ? 3 : 0), pointBackgroundColor: "#f59e0b", tension: 0.2,
                  },
                  {
                    label: tx("지출", "Spend"), data: spend, borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 0, tension: 0.2, yAxisID: "spend",
                  },
                ],
              },
              options: { ...chartBase(), scales: { ...chartBase().scales, spend: { position: "right", ticks: { color: CHART_THEME.muted, callback: (v) => currencySym + fmtInt(v) }, grid: { drawOnChartArea: false } } } },
            }),
          );
        } else if (cannibQuestion === "detrend") {
          const residual = (a) => {
            const n = a.length, xm = (n - 1) / 2, ym = a.reduce((s, v) => s + v, 0) / Math.max(1, n);
            let num = 0, den = 0;
            a.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
            const slope = den ? num / den : 0;
            return a.map((v, i) => v - (ym + slope * (i - xm)));
          };
          const logSpend = spend.map((v) => Math.log1p(v));
          const rs = residual(logSpend), ry = residual(y);
          const ds = logSpend.slice(1).map((v, i) => v - logSpend[i]);
          const dy = y.slice(1).map((v, i) => v - y[i]);
          inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "scatter",
            data: { datasets: [
              { label: tx("추세 제거 후", "Detrended"), data: rs.map((x, i) => ({ x, y: ry[i] })), backgroundColor: "#7aa2f7", pointRadius: 3 },
              { label: tx("전주 대비 변화", "Weekly change"), data: ds.map((x, i) => ({ x, y: dy[i] })), backgroundColor: "#e0af68", pointRadius: 3 },
            ] },
            options: { ...chartBase(), scales: { x: { type: "linear", ticks: { color: CHART_THEME.muted }, grid: { color: CHART_THEME.grid } }, y: { ticks: { color: CHART_THEME.muted }, grid: { color: CHART_THEME.grid } } } },
          }));
        } else if (cannibQuestion === "net") {
          // JSX NetEffectEvidence가 0 기준·신뢰구간·판정을 더 명확하게 표시한다.
        } else {
          const irf = mmmIRF(y, spend, { horizon: 12 });
          if (irf) inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "line", data: { labels: irf.irf.map((_, i) => (i === 0 ? tx("충격", "Shock") : tx(`+${i}주`, `+${i}wk`))), datasets: [
              { label: tx("주별 반응", "Weekly response"), data: irf.irf, borderColor: "#7aa2f7", pointRadius: 0, tension: 0.25 },
              { label: tx("누적 반응", "Cumulative response"), data: irf.cum, borderColor: "#e0af68", borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
            ] }, options: chartBase(),
          }));
        }
      } catch (e) {
        /* 데이터 부족 시 근거 차트 생략 */
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, mmm, cannib, activeCannibCh, activeCn, cannibQuestion, currencySym, tx]);

  // Stage ① simple-cannib chart 없음 (통계 카드만) — 잔차 산점도는 디퍼

  // Lab chart (actual vs predicted)
  // ③ LAB(회귀·미래예측)은 mmmForecast(위 forecast useMemo) 기반으로 렌더 — ②와 같은 MMM 모델 계수를
  // 그대로 써서 과거 적합 + 미래 외삽. buildPanelFromColMap이 타깃을 플랫폼 합산하므로 토글도 자동 반영.

  /* ------------------------------ RENDER ------------------------------ */
  // 아코디언 안 차트는 접힘 상태에서 폭 0으로 마운트됨(§7 함정) → 펼칠 때 resize 이벤트로 재측정.
  const onAccordionToggle = (e) => {
    if (e.currentTarget.open) requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  // index.html MMM_STAGE_DEFS(3단계) + renderMmmStageTabs 카드형 탭 이식. 구 "시뮬레이션"(TF)은
  // §12.15대로 회귀·미래예측(lab)에 흡수. 카드: no·아이콘·제목·설명 + active 하이라이트.
  const renderTabs = () => (
    <section className="block" style={{ padding: 0, border: "none", background: "none", marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {mmmStageDefs(locale).map((d) => {
          const on = stage === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setStage(d.id)}
              style={{
                flex: 1, minWidth: "170px", textAlign: "left", color: "var(--text-1)",
                background: on ? "linear-gradient(135deg,rgba(122,162,247,0.16),rgba(122,162,247,0.04))" : "var(--bg-2)",
                border: `1px solid ${on ? "rgba(122,162,247,0.55)" : "var(--border)"}`,
                borderRadius: "12px", padding: "11px 14px", cursor: "pointer", transition: "all .15s",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".04em", color: on ? "#adc6ff" : "var(--text-2)" }}>{d.no}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "1px" }}>{d.icon} {d.title}</div>
              <div style={{ fontSize: "10.5px", color: "var(--text-2)", marginTop: "2px", lineHeight: 1.35 }}>{d.desc}</div>
            </button>
          );
        })}
      </div>
    </section>
  );

  // 5-18 전용 템플릿 — colMap 방식이라 표준필드 경로(효율 template)와 무관, 자체 헤더+예시.
  const downloadMmmTemplate = () => {
    const csv = "﻿week,signups,google_spend,meta_spend,tiktok_spend,brand_spend\r\n2024-01-01,3800,32000000,22000000,8000000,6000000\r\n2024-01-08,4100,35000000,24000000,9500000,6200000\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template_5-18.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // 5-18 전용 dropzone (표준 CsvUploader/DataFeatureMatrix 미사용 — 단일 generic CSV → colMap).
  const mmmDropzone = (
    <>
      <CsvGuide toolId="5-18" onDownloadTemplate={downloadMmmTemplate} locale={locale} />
      <div
        className="csv-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleMmmFile(e.dataTransfer.files[0]); }}
        onClick={() => mmmFileRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <div className="csv-drop-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div className="csv-drop-text">{tx("CSV 파일 드래그 & 드롭", "Drag & drop a CSV file")}</div>
        <div className="csv-drop-sub">{tx("주간 패널 CSV. 업로드 후 컬럼을 역할로 드래그합니다. 주차·가입(또는 재활성)·채널 spend 1개 이상 필요.", "A weekly panel CSV. After upload, drag columns into roles. Needs at least week · signups (or reactivation) · one channel spend.")}</div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={mmmFileRef}
          onChange={(e) => { if (e.target.files?.[0]) handleMmmFile(e.target.files[0]); e.target.value = null; }} />
      </div>
      <DemoLoadButton onLoad={handleLoadDemo} locale={locale} />
    </>
  );

  // colMap 매퍼 + 분석 게이트 섹션 (CSV 로드 후 · 분석 전). index.html §0 데이터·매핑 이식.
  const mmmMapperSection = () => {
    const built = mmmColMap ? buildPanelFromColMap(csvData.headers, csvData.raw, mmmColMap) : { missing: [tx("매핑", "mapping")] };
    const ready = mmmColMap && built.missing.length === 0;
    return (
      <section className="block" id="s-prep">
        <div className="file-state">
          <div className="meta-text">
            <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
            {isDemo ? <strong>{tx("샘플 데이터로 미리보기 중", "Previewing with sample data")}</strong> : <strong>{csvData.fileName}</strong>}
            <span className="csv-loaded-stats tnum">{csvData.raw.length.toLocaleString()}{tx("행", " rows")} · {csvData.headers.length}{tx("컬럼", " columns")}{isDemo ? tx(" · 실제 데이터 아님", " · not real data") : ""}</span>
          </div>
          <button className="ab-pill csv-change-btn" title={tx("CSV 제거 후 다른 파일 업로드", "Remove this CSV and upload another file")}
            onClick={() => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })}>{isDemo ? tx("📁 내 CSV 업로드", "📁 Upload my CSV") : tx("⟳ CSV 변경", "⟳ Change CSV")}</button>
        </div>
        {!isDemo && (
          <div className="analysis-local-controls" style={{ marginTop: "8px" }}>
            <div className="analysis-local-controls__inner">
              <span className="analysis-local-controls__label">{tx("CSV 금액 통화", "CSV amount currency")}</span>
              <span className="muted" style={{ fontSize: "11px" }}>{tx("표시 통화와 다르면 고정 환율로 환산합니다.", "Uses a fixed exchange rate when it differs from display currency.")}</span>
              <div className="ab-pillgroup" style={{ margin: 0 }}>
                <button className={`ab-pill ${sourceCurrency === "KRW" ? "active" : ""}`} onClick={() => setCsvData({ ...csvData, currency: "KRW" })}>{tx("원 ₩", "KRW ₩")}</button>
                <button className={`ab-pill ${sourceCurrency === "USD" ? "active" : ""}`} onClick={() => setCsvData({ ...csvData, currency: "USD" })}>{tx("달러 $", "USD $")}</button>
              </div>
            </div>
          </div>
        )}
        <h3 style={{ fontSize: "14px", margin: "12px 0 8px", color: "var(--primary, #adc6ff)" }}>{tx("🗂 컬럼 역할 매핑 (드래그로 지정)", "🗂 Map column roles (assign by dragging)")}</h3>
        <MmmColumnMapper
          headers={csvData.headers}
          rows={csvData.raw}
          colMap={mmmColMap || autoGuessColMap(csvData.headers, csvData.raw)}
          onChange={setMmmColMap}
          locale={locale}
        />
        {ready && (
          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))", border: "1px solid rgba(122,162,247,0.3)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-1)" }}>{tx("✅ 필수 역할 매핑 완료.", "✅ Required roles mapped.")} <strong>{tx("매핑이 맞는지 확인한 뒤 분석을 실행하세요.", "Check that the mapping is correct, then run the analysis.")}</strong> <span style={{ color: "var(--text-muted)" }}>{tx("(매핑만으로 자동 분석하지 않습니다.)", "(Mapping alone doesn't auto-run the analysis.)")}</span></span>
            <button className="ab-button" style={{ marginLeft: "auto" }}
              onClick={() => requestAd(() => runMmmAnalyze(colMapSig))}>{tx("▶ 분석하기", "▶ Analyze")}</button>
          </div>
        )}
      </section>
    );
  };

  const effectiveTarget = mmm && !mmm.empty ? mmm.target : target;
  // 태그(_android/_ios) 있는 컬럼이 매핑돼 있을 때만 플랫폼 토글 노출(단일 플랫폼 컬럼 없는 wide 데이터용).
  const platformTags = hasData && mmmColMap ? mmmPlatformTags(csvData.headers, mmmColMap) : [];

  // 브레드크럼 = 현재 위치 + 타깃/플랫폼 토글을 한 바(bar)에 좌측 정렬로 병합(토글이 곧 breadcrumb).
  const stageKo = stage === "trend" ? tx("시계열 점검", "Time series") : stage === "mmm" ? tx("기여 분해", "Contribution") : stage === "lab" ? tx("회귀·미래예측", "Regression · Forecast") : tx("잠식 진단", "Cannibalization");
  const demoBanner = isDemo && (
    <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
      <div>
        <strong>{tx("🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다", "🧪 You're viewing sample (example) data")}</strong>
        <p style={{ margin: "0.25rem 0 0" }}>{tx("실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.", "This isn't your real data, and nothing is sent to a server. Upload your own CSV to replace it instantly.")}</p>
      </div>
      <button className="ab-button" onClick={() => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })}>{tx("📁 내 CSV 업로드하기", "📁 Upload my CSV")}</button>
    </div>
  );
  const controlBar = () => (
    <div className="analysis-local-controls__inner">
      <span className="analysis-local-controls__label">
        {tx("마케팅 반응 분석", "Marketing Response Analysis")} <span style={{ margin: "0 4px" }}>·</span> <strong style={{ color: "var(--text-1)" }}>{stageKo}</strong>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {availTargets.length > 1 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">{tx("타깃", "Target")}</span>
            {availTargets.map((t) => (
              <button key={t} className={`ab-pill ${effectiveTarget === t ? "active" : ""}`} onClick={() => setTarget(t)}>
                {t === "Traffic" ? tx("총유입", "Traffic") : t === "Regs" ? tx("가입", "Signups") : t === "React" ? tx("재유입", "Reactivation") : t === "Purchasers" ? tx("구매자", "Purchasers") : t === "Revenue" ? tx("매출", "Revenue") : tx("가입+재유입", "Signups + Reactivation")}
              </button>
            ))}
          </div>
        )}
        {platformTags.length > 0 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">{tx("플랫폼", "Platform")}</span>
            <button className={`ab-pill ${effPlatformFilter === "all" ? "active" : ""}`} onClick={() => setPlatformFilter("all")}>Total</button>
            {platformTags.includes("android") && (
              <button className={`ab-pill ${effPlatformFilter === "android" ? "active" : ""}`} onClick={() => setPlatformFilter("android")}>Android</button>
            )}
            {platformTags.includes("ios") && (
              <button className={`ab-pill ${effPlatformFilter === "ios" ? "active" : ""}`} onClick={() => setPlatformFilter("ios")}>iOS</button>
            )}
          </div>
        )}
        {segmentSel && segmentSel.values.length > 0 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label" title={tx(`나눠보기: ${segmentSel.col}`, `Break down by: ${segmentSel.col}`)}>🔀 {segmentSel.col}</span>
            <button className={`ab-pill ${effPlatformFilter === "all" ? "active" : ""}`} onClick={() => setPlatformFilter("all")}>{tx("전체", "All")}</button>
            {segmentSel.values.map((v) => (
              <button key={v.value} className={`ab-pill ${effPlatformFilter === v.value ? "active" : ""}`} onClick={() => setPlatformFilter(v.value)} title={tx(`${v.count.toLocaleString()}행`, `${v.count.toLocaleString()} rows`)}>
                {v.value}
              </button>
            ))}
            {segmentSel.truncated && <span style={{ fontSize: "10.5px", color: "#f59e0b" }}>{tx("⚠ 상위 20개만", "⚠ Top 20 only")}</span>}
          </div>
        )}
        {mmm && !mmm.empty && (
          <button className="ab-pill" onClick={() => {
            const packageDecomp = mmmBayesianWeeklyDecomp(mmm.run);
            const packageTrend = trend || mmmTrendExistence(mmm.panel, mmm.cfg, mmm.target, locale);
            const packageForecast = mmmBayesianForecast(mmm.run, mmm.panel, null, 13);
            downloadMmmWorkbook({ mmm, cannib, decomp: packageDecomp, trend: packageTrend, forecast: packageForecast, csvData, colMap: mmmColMap, locale, currency: displayCurrency });
          }}>{tx("⬇ 분석 패키지", "⬇ Analysis package")}</button>
        )}
      </div>
    </div>
  );

  // ── LAB stage ──
  // ③ 회귀·미래예측(lab)은 이제 ①②와 동일하게 no-data→shared 게이트→분석완료 흐름을 타므로
  // 여기서 early-return하지 않는다(별도 업로드·샘플·매핑 제거). 실제 렌더는 아래 analyzed return에서.

  // ── no-data ──
  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-response">
        {renderTabs()}
        <section className="block" id="s-prep">
          <h2 className="section-title">{tx("데이터 준비", "Data preparation")}</h2>
          <p className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>{tx("주간 패널 CSV 하나로 카니발 진단 → 기여 분해(MMM) → 회귀·미래예측을 모두 분석합니다. 업로드 후 컬럼을 역할로 드래그하세요. 데이터는 브라우저 메모리에만 — 서버 전송 없음.", "A single weekly panel CSV powers cannibalization diagnosis → contribution breakdown (MMM) → regression/forecast. After upload, drag columns into roles. Data stays in browser memory only — never sent to a server.")}</p>
          {mmmDropzone}
        </section>
      </div>
    );
  }

  // ── data present ── colMap 미완성 or 분석 전이면 매퍼+게이트만 노출(PRIMARY 매핑).
  if (!mmmAnalyzed) {
    return (
      <div className="tab-pane active" id="tab-response">
        <AnalyzingOverlay show={isAnalyzing} title={tx("분석 중…", "Analyzing…")} sub={tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)} />
        {renderTabs()}
        {mmmMapperSection()}
      </div>
    );
  }

  // ── analyzed: 매핑 완료 후에도 패널이 비면(엔진 오류·공선) 사유 표시 ──
  const panelEmpty = mmm && mmm.empty;

  return (
    <div className="tab-pane active" id="tab-response">
      <AnalyzingOverlay show={isAnalyzing} title={tx("분석 중…", "Analyzing…")} sub={tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)} />
      {/* 브레드크럼(타깃·플랫폼 토글)+통화 토글 — 페이지 맨 위 sticky(스테이지 카드보다
          위, top:48px 고정)로 이동. 예전엔 스테이지 카드·데모 배너 아래 본문에 있어
          "제일 위로 가야 한다"는 요청 반영(§유저 리포트, 스크롤 시 안 가려짐도 겸함). */}
      {!panelEmpty && (
        <div className="page-sticky-bar">
          <div className="page-sticky-row1">{controlBar()}</div>
          <AnalysisControlBar title={tx("표시 기준", "Display settings")} hint={tx("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>
        </div>
      )}
      {renderTabs()}

      {panelEmpty ? (
        <section className="block">
          {demoBanner}
          <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tx("MMM 패널을 만들 수 없습니다", "Can't build the MMM panel")}</strong><p>{mmm.reason}</p></div></div>
          <div style={{ marginTop: "12px" }}>{mmmMapperSection()}</div>
        </section>
      ) : (
        <>
          {demoBanner}

          {/* ③ LAB(회귀·미래예측)은 아래 §7 forecast 블록에서 렌더(mmmForecast 기반, stage==="lab"). */}

          {/* ── STAGE ① DIAGNOSE (MMM panel) ── */}
          {stage === "trend" && (
            <section className="block" id="s-trend">
              <h2 className="section-title">{tx("광고 전에: 자연 추세·계절성을 먼저 분리합니다", "Before ads: separate natural trend and seasonality")}</h2>
              <p className="muted" style={{ fontSize: "12px", marginBottom: "10px" }}>{tx("STL은 성과를 추세·계절성·불규칙 요인으로 나눕니다. 여기서 보인 추세는 카니발과 MMM이 광고 효과를 과대해석하지 않도록 하는 사전 점검입니다.", "STL separates outcome into trend, seasonality, and irregular movement. It is a pre-check so cannibalization and MMM do not over-credit ads.")}</p>
              {trend ? <>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <div className="stat-card"><div className="lbl">STL</div><div className="val">{trend.stl_pct >= 0 ? "+" : ""}{fmtOne(trend.stl_pct)}%</div></div>
                  <div className="stat-card"><div className="lbl">Mann-Kendall</div><div className="val">p={fmtOne(trend.mk_deseason?.[1])}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("판정", "Verdict")}</div><div className="val" style={{ fontSize: "13px" }}>{trend.verdict}</div></div>
                </div>
                <div className="chart-container" style={{ height: "280px" }}><canvas ref={trendRef}></canvas></div>
                <Card style={{ marginTop: "12px", fontSize: "12px", lineHeight: 1.55 }}>
                  {tx("다음 단계에서 카니발 4검증을 보세요. 그중 ②는 이 시간 추세를 다시 걷어낸 뒤 광고와 성과의 관계를 확인합니다.", "Continue to the four cannibalization checks. Check ② removes this time trend again before comparing spend and outcome.")}
                  <button className="ab-pill active" style={{ marginLeft: "10px" }} onClick={() => setStage("diagnose")}>{tx("카니발 진단으로", "Open cannibalization")}</button>
                </Card>
              </> : <p className="muted">{tx("추세 분석을 계산할 수 없습니다.", "Trend analysis is unavailable.")}</p>}
            </section>
          )}

          {stage === "diagnose" && (
            <>
              {/* ── 메인: 판정별 3버킷 칸반(그룹핑) + 짧은 평어 헤드라인 ── 통계는 아래 아코디언 ── */}
              {cannib && cannib.cannibRank && cannib.cannibRank.length ? (() => {
                const rk = cannib.cannibRank;
                // 엔진 5단계(lv) → 마케터용 3버킷: 잠식의심 / 애매함(데이터부족·공선) / 문제없음.
                const bucketOf = (r) => {
                  const L = mmmCannibLevel(r);
                  if (!r.eligible || L.lv === 1) return "unclear";
                  if (L.lv >= 4) return "danger"; // 카니발 + 신호 조금 → 점검 대상
                  return "ok"; // 신호 없음 / 거의 없음
                };
                const buckets = { danger: [], unclear: [], ok: [] };
                rk.forEach((r) => buckets[bucketOf(r)].push(r));
                const nD = buckets.danger.length;
                const headTone = nD > 0 ? "danger" : buckets.ok.length > 0 ? "ok" : "warn";
                const headBadge = nD > 0 ? tx("잠식 의심", "Cannibalization suspected") : buckets.ok.length > 0 ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headline = nD > 0
                  ? tx(`${rk.length}개 채널 중 ${nD}개에서 잠식이 의심돼요 — 빨간 칸부터 점검하세요.`, `${nD} of ${rk.length} channels show suspected cannibalization — check the red bucket first.`)
                  : buckets.ok.length > 0
                    ? tx(`${rk.length}개 채널 대체로 방어 양호 — 지금 뚜렷한 잠식 신호는 없어요.`, `${rk.length} channels are mostly well defended — no clear cannibalization signal right now.`)
                    : tx(`판정할 만큼 데이터가 충분한 채널이 적어요 — 애매함 칸을 확인하세요.`, `Too few channels have enough data to judge — check the unclear bucket.`);
                const col = (key, title, icon, tone) => {
                  const list = buckets[key];
                  const c = BADGE_TONE[tone];
                  return (
                    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginBottom: "8px" }}>{icon} {title} · {list.length}</div>
                      {list.length ? list.map((r) => (
                        <div key={r.key} onClick={() => setCannibChannel(r.key)}
                          style={{ background: "var(--bg-2)", border: `1px solid ${r.key === activeCannibCh ? "rgba(122,162,247,0.55)" : "var(--border)"}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px", cursor: "pointer" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{r.label}{r.brand ? " 🏷" : ""}</span>
                            <span style={{ fontSize: "11px", color: MUTED }}>›</span>
                          </div>
                          <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                            {key === "unclear"
                              ? (r.eligible ? tx("채널끼리 지출이 겹침(공선)", "Channels' spend overlaps (collinear)") : tx(`데이터 부족 (${r.nActive}/${r.total}주)`, `Insufficient data (${r.nActive}/${r.total} wk)`))
                              : mmmCannibActionShort(r)}
                          </div>
                        </div>
                      )) : <div style={{ fontSize: "11px", color: MUTED }}>{tx("없음", "None")}</div>}
                    </div>
                  );
                };
                return (
                  <>
                    <Card style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
                    </Card>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "10px" }}>
                      {col("danger", tx("잠식 의심", "Suspected"), "⚠", "danger")}
                      {col("unclear", tx("애매함", "Unclear"), "?", "neutral")}
                      {col("ok", tx("문제 없음", "No issue"), "✓", "ok")}
                    </div>
                    <p style={{ fontSize: "11px", color: MUTED, marginBottom: "14px" }}>
                      {tx("채널을 클릭하면 아래에 왜 그렇게 판정했는지(근거)가 열려요.", "Click a channel to see why it was judged that way, below.")}{rk.mde12 != null ? tx(` · 12주 실험 최소검출력 ≈ ${rk.mde12}%`, ` · 12-week experiment MDE ≈ ${rk.mde12}%`) : ""}
                    </p>
                  </>
                );
              })() : (
                <Card style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "13px", color: MUTED }}>{tx("카니발 판정을 계산할 수 없습니다 (데이터·매핑 확인).", "Can't compute a cannibalization verdict (check data/mapping).")}</span>
                </Card>
              )}

              {/* ── 채널 드릴다운: 4가지를 평어 질문으로, ①②③ 3열 균등, 헤드라인은 버킷과 일치 ── */}
              {activeCn && (() => {
                const cn = activeCn;
                const p = cn.precedence, d = cn.detrend_corr, ni = cn.net_incrementality;
                const chLabel = (cannib.rows.find((r) => r.channel.key === activeCannibCh) || {}).channel?.label || activeCannibCh;
                const g = cn.granger;
                const gate = cn.power_gate || { blocked: false, reasons: [] };
                // 헤드라인을 칸반 버킷과 동일 규칙으로 계산 → "문제없다는데 왜 잠식의심" 모순 제거.
                const rr = (cannib.cannibRank || []).find((x) => x.key === activeCannibCh);
                const lv = rr ? mmmCannibLevel(rr).lv : null;
                const bucket = !rr || !rr.eligible || lv === 1 ? "unclear" : lv >= 4 ? "danger" : "ok";
                const votes = [p.vote, d.vote, ni.vote];
                const nFor = votes.filter((v) => v === "FOR").length;
                const nAg = votes.filter((v) => v === "AGAINST").length;
                const nAb = votes.filter((v) => v === "ABSTAIN").length;
                const headTone = bucket === "danger" ? "danger" : bucket === "ok" ? "ok" : "warn";
                const headBadge = bucket === "danger" ? tx("잠식 의심", "Cannibalization suspected") : bucket === "ok" ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headWhy = bucket === "danger"
                  ? (cn.granger_cannibal
                      ? tx("같은 주 지표(①②③)는 대체로 괜찮은데, 몇 주 시차를 두고 광고비가 오가닉을 끌어내리는 신호(④)가 나왔어요. 그래서 의심으로 올렸습니다.", "Same-week metrics (①②③) mostly look fine, but a lagged signal (④) showed spend pulling organic down a few weeks later — so we flagged it as suspected.")
                      : tx("광고가 늘 때 오가닉이 줄어드는 신호가 나왔어요.", "A signal showed organic falling as ad spend rose."))
                  : bucket === "ok"
                    ? tx("네 방향으로 따져봐도 뚜렷한 잠식 신호가 없어요.", "Checking all four angles, there's no clear cannibalization signal.")
                    : tx("데이터가 부족하거나 채널끼리 지출이 겹쳐(공선) 판정하기 어려워요.", "Data is insufficient, or channels' spend overlaps (collinear), making a verdict hard.");
                const voteView = (v) => v === "FOR" ? { t: tx("괜찮음", "OK"), c: "#22c55e" } : v === "AGAINST" ? { t: tx("잠식 신호", "Cannibalization signal"), c: "#f87171" } : { t: tx("판단 보류", "Withheld"), c: MUTED };
                const signal = (key, num, q, help, v, tech) => {
                  const vv = voteView(v);
                  return (
                    <button onClick={() => setCannibQuestion(key)} style={{ background: cannibQuestion === key ? "rgba(122,162,247,0.10)" : "var(--bg-2)", border: `1px solid ${cannibQuestion === key ? "rgba(122,162,247,0.65)" : "var(--border)"}`, borderRadius: "10px", padding: "12px 14px", textAlign: "left", color: "inherit", cursor: "pointer", minHeight: "142px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4, minHeight: "34px" }}>{num} {q}</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: vv.c, margin: "8px 0 4px" }}>{vv.t}</div>
                      <div style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>{help}</div>
                      <div style={{ fontSize: "10px", color: MUTED, marginTop: "6px", opacity: 0.8 }} title={tx("통계 원값(전문가용)", "Raw statistics (for specialists)")}>{tech}</div>
                    </button>
                  );
                };
                return (
                  <section className="block" id="s-cannib-detail">
                    <h2 className="section-title">{tx("이 채널은 왜 이렇게 판정됐나?", "Why was this channel judged this way?")} — {chLabel}</h2>
                    <Card style={{ marginBottom: "12px", display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.6 }}>{headWhy}</div>
                        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{tx(`아래 4가지를 각각 따져본 결과예요 · 괜찮음 ${nFor} / 잠식 신호 ${nAg} / 판단 보류 ${nAb} · 확정은 holdout 실험(5-4)에서만.`, `Result of checking the 4 signals below · OK ${nFor} / cannibalization signal ${nAg} / withheld ${nAb} · confirmation only via a holdout experiment (5-4).`)}</div>
                      </div>
                    </Card>
                    {gate.blocked && (
                      <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginBottom: "10px" }}>
                        {tx('ⓘ 데이터가 적거나 지출 변동이 작아 ③을 신뢰하기 어려워요 — 이럴 땐 "문제 없음"으로 단정하지 않고 보류합니다.', 'ⓘ Data is limited or spend barely varies, so ③ can\'t be trusted — in that case we withhold rather than assert "no issue."')}
                      </div>
                    )}
                    <div className="cannib-reading-guide" aria-label={tx("카니발 차트 읽는 법", "How to read the cannibalization chart")}>
                      <div className="cannib-reading-guide__title">{tx("산점도는 이렇게 읽어요", "How to read the scatter plot")}</div>
                      <div className="cannib-reading-guide__cards">
                        <div className="cannib-reading-guide__card is-danger">
                          <strong>{tx("잠식 의심", "Suspected cannibalization")}</strong>
                          <span>{tx("오른쪽 아래로 기울면: 광고 지출↑ · 오가닉 성과↓", "Downward slope: spend ↑ · organic outcome ↓")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-ok">
                          <strong>{tx("증분 신호", "Incremental signal")}</strong>
                          <span>{tx("오른쪽 위로 기울면: 광고 지출↑ · 성과도↑", "Upward slope: spend ↑ · outcome ↑")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-neutral">
                          <strong>{tx("판단 보류", "Withhold verdict")}</strong>
                          <span>{tx("점이 흩어지면: 방향이 불분명해 추가 검증 필요", "Scattered points: direction unclear, more evidence needed")}</span>
                        </div>
                      </div>
                      <p>{tx("② 차트는 추세·계절을 걷어낸 뒤의 관계입니다. 기울기 하나만으로 확정하지 않고, 아래 4가지 신호를 함께 봅니다.", "Chart ② removes trend and seasonality first. One slope never decides the verdict; we combine all four signals below.")}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "10px" }}>
                      {signal("precedence", "①", tx("광고를 늘리기 전에 성과가 이미 줄고 있었나?", "Was outcome already declining before ad spend rose?"), tx("저지출 주의 시간 흐름을 봅니다. 이미 줄었다면 광고 탓으로 단정 못 해요.", "Checks the time path in low-spend weeks. A prior decline cannot be blamed on ads."), p.vote, tx(`저지출 기울기 ${p.kpi_slope_per_wk}/주 · ${p.kpi_change_over_window_pct}%`, `Low-spend slope ${p.kpi_slope_per_wk}/wk · ${p.kpi_change_over_window_pct}%`))}
                      {signal("detrend", "②", tx("추세·계절을 걷어내도 광고와 성과가 반대로 움직이나?", "After removing trend, do spend and outcome still move opposite?"), tx("시간 착시를 제거한 잔차와 전주 대비 변화를 함께 봅니다.", "Compares detrended residuals and week-over-week changes."), d.vote, tx(`잔차 상관 ${d.detrended} · 차분 상관 ${d.first_diff}`, `Residual corr ${d.detrended} · diff corr ${d.first_diff}`))}
                      {signal("net", "③", tx("광고를 늘리면 전체 성과는 순증가하나?", "Does more spend net-increase total outcome?"), tx("점추정과 신뢰구간이 0보다 어느 쪽에 있는지 봅니다.", "Checks point estimate and confidence interval against zero."), ni.vote, tx(`순증분 ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`, `Net effect ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`))}
                      {signal("lag", "④", tx("광고비가 몇 주 뒤 성과를 끌어내리나?", "Does spend pull outcome down weeks later?"), tx("광고 충격 뒤의 주별·누적 반응을 봅니다.", "Shows weekly and cumulative response after a spend shock."), cn.granger_cannibal ? "AGAINST" : cn.granger_help ? "FOR" : "ABSTAIN", g ? tx(`시차 ${g.spend_to_organic.lag}주 · p=${g.spend_to_organic.p}`, `Lag ${g.spend_to_organic.lag}wk · p=${g.spend_to_organic.p}`) : tx("데이터 부족", "Insufficient data"))}
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-1)", marginBottom: "3px" }}>
                        {cannibQuestion === "precedence" ? tx("① 저지출 주의 성과·지출 흐름", "① Outcome and spend in low-spend weeks") : cannibQuestion === "detrend" ? tx("② 추세 제거·전주 대비 관계", "② Detrended and week-over-week relationship") : cannibQuestion === "net" ? tx("③ 순증분 효과와 신뢰구간", "③ Net incremental effect and interval") : tx("④ 지출 충격 뒤 시차 반응", "④ Lagged response after a spend shock")}
                      </div>
                      <p className="muted" style={{ fontSize: "11px", margin: "0 0 5px" }}>{cannibQuestion === "net" ? tx("초록 막대가 아니라 순증분 탄력성의 점추정과 신뢰구간입니다. 0을 포함하면 결론은 보류합니다.", "This is a net-elasticity estimate and interval, not a green success bar. If it includes 0, verdict is withheld.") : cannibQuestion === "lag" ? tx("아래면 시차 잠식, 위면 시차 증분 신호입니다.", "Below zero suggests lagged cannibalization; above zero suggests incremental response.") : cannibQuestion === "detrend" ? tx("가로축은 광고 지출 변화, 세로축은 성과 변화입니다. 오른쪽 아래로 모이면 잠식 신호, 오른쪽 위로 모이면 증분 신호예요. 점이 흩어지면 보류합니다.", "Horizontal = spend change; vertical = outcome change. Down-right clustering signals cannibalization, up-right signals incrementality; scattered points mean withhold.") : tx("선택한 검증의 원자료를 직접 확인하세요. 단일 차트가 최종 인과 증명은 아닙니다.", "Inspect source evidence for the selected test. One chart is not causal proof.")}</p>
                      {cannibQuestion === "net" ? <NetEffectEvidence net={ni} locale={locale} /> : <div className="chart-container" style={{ height: "250px" }}><canvas ref={irfRef}></canvas></div>}
                    </div>
                  </section>
                );
              })()}

              {/* ── 통계 근거·방법론 전부 여기로 격리(기본 접힘) — 비전문 유저는 위 칸반·평어만 보면 됨 ── */}
              <details className="block" style={{ marginBottom: "14px" }} onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>
                  {tx("카니발이 뭐고, 이 판정은 어떻게 나온 건가요? — 추세·데이터 위생·단순모델 점검 (통계 상세)", "What is cannibalization, and how was this verdict reached? — trend, data hygiene, naive-model check (statistics detail)")}
                </summary>
                <div style={{ marginTop: "12px" }}>
                  <p className="muted" style={{ fontSize: "12px", lineHeight: 1.7, marginBottom: "10px" }}>
                    <strong>{tx("카니발리제이션(잠식)", "Cannibalization")}</strong>{tx("이란 유료 광고가 원래 공짜로 들어올 오가닉 유입을 빼앗는 현상입니다. 이 도구는 4가지 독립 신호(①시간 선행성 ②탈추세·차분 상관 ③순증분 탄력성 ④그랜저 인과)를 투표로 종합해 채널별로 판정합니다. 관측 검정은 용의자를 좁힐 뿐이며, 확정은 홀드아웃 실험(5-4)에서만 가능합니다.", " is when paid ads take away organic traffic that would have come for free. This tool combines 4 independent signals (① temporal precedence ② detrended/diff correlation ③ net-incremental elasticity ④ Granger causality) by vote to judge each channel. Observational tests only narrow down suspects — confirmation is only possible via a holdout experiment (5-4).")}
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    <button className="ab-pill" title={tx("채널 × 3-state 투표 + 게이트·탄력성·커버리지·그랜저 → CSV", "Channel × 3-state vote + gate/elasticity/coverage/Granger → CSV")}
                      onClick={() => cannib && csvDownload(`mmm_cannib_${mmm.target}_${_today()}.csv`, buildCannibCsv(cannib, mmm.effects, mmm.target))}>
                      {tx("⬇ 채널별 카니발 CSV", "⬇ Per-channel cannibalization CSV")}
                    </button>
                    <button className="ab-pill" title={tx("주별 타깃·채널별 ln(1+지출)·탈추세 잔차·1차차분 원자료", "Weekly target/channel ln(1+spend), detrended residuals, first-difference raw data")}
                      onClick={() => csvDownload(`mmm_cannib_series_${mmm.target}_${_today()}.csv`, buildCannibSeriesCsv(mmm.panel, mmm.target))}>
                      {tx("⬇ 검정 원자료 CSV", "⬇ Test raw-data CSV")}
                    </button>
                  </div>

              <section className="block" id="s-trend">
                <h2 className="section-title">{tx("성과에 광고와 무관한 '추세'가 있나요?", "Is there a 'trend' in performance unrelated to ads?")}</h2>
                <p className="muted" style={{ fontSize: "12px", marginBottom: "8px" }}>{tx("시간이 흐르며 성과가 저절로 오르내리는 흐름(추세)이 있는지 봐요. 추세가 크면, 광고 효과와 헷갈리지 않게 따로 떼어내야 해요.", "Checks whether performance rises/falls on its own over time (a trend). If the trend is large, it needs to be separated so it isn't confused with ad effect.")}</p>
                {trend ? (
                  <>
                    {(() => {
                      const isNo = trend.verdict.startsWith("NO");
                      const isYes = trend.verdict.startsWith("trend EXISTS");
                      const plain = isNo
                        ? tx("뚜렷한 추세는 없어요 — 성과 등락은 대부분 광고·계절 영향입니다.", "No clear trend — performance swings are mostly due to ads/season.")
                        : isYes
                          ? tx("추세가 있어요 — 광고를 걷어내도 시간 흐름 자체의 상승/하락이 남습니다.", "There's a trend — a rise/fall from time itself remains even after removing ads.")
                          : tx("추세가 조금 있지만 광고·계절과 얽혀 있어요.", "There's some trend, but it's entangled with ads/season.");
                      return (
                        <div className={`callout ${isNo ? "ok" : "warn"}`}>
                          <div className="ico">{isNo ? "✓" : "!"}</div>
                          <div className="body">
                            <strong>{plain}</strong>
                            <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }} title={trend.verdict}>{tx(`전 구간 추세 변화 ${trend.stl_pct}% · 판정 근거: ${trend.verdict}`, `Full-period trend change ${trend.stl_pct}% · basis: ${trend.verdict}`)}</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="chart-container" style={{ height: "240px", marginTop: "12px" }}>
                      <canvas ref={trendRef}></canvas>
                    </div>
                    <div className="table-wrap" style={{ marginTop: "12px" }}>
                      <table className="data" style={{ fontSize: "11.5px" }}>
                        <thead><tr><th>{tx("검정", "Test")}</th><th>{tx("결과", "Result")}</th><th>p</th></tr></thead>
                        <tbody>
                          <tr><td>Mann-Kendall (raw)</td><td>{trend.mk_raw[0]}</td><td className="tnum">{trend.mk_raw[1]}</td></tr>
                          <tr><td>{tx("MK (자기상관 보정)", "MK (autocorrelation-corrected)")}</td><td>{trend.mk_ac_robust[0]}</td><td className="tnum">{trend.mk_ac_robust[1]}</td></tr>
                          <tr><td>{tx("MK (계절 제거)", "MK (deseasonalized)")}</td><td>{trend.mk_deseason[0]}</td><td className="tnum">{trend.mk_deseason[1]}</td></tr>
                          <tr><td>{tx("ADF (추세정상성)", "ADF (trend stationarity)")}</td><td>—</td><td className="tnum">{trend.adf_ct_p}</td></tr>
                          <tr><td>KPSS</td><td>—</td><td className="tnum">{trend.kpss_ct_p}</td></tr>
                          <tr><td>{tx("media 제거 후 잔차 MK", "Residual MK after removing media")}</td><td>{trend.resid_after_media_mk[0]}</td><td className="tnum">{trend.resid_after_media_mk[1]}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: "12px" }}>{tx("추세 검정을 계산할 수 없습니다.", "Can't compute the trend test.")}</p>
                )}
              </section>

              {/* ── §1 데이터 위생 + 매크로 사실 (모델 독립) ── */}
              <section className="block" id="s-macro">
                <h2 className="section-title">{tx("데이터가 분석하기에 깨끗한가요?", "Is the data clean enough to analyze?")}</h2>
                <p className="muted" style={{ fontSize: "12px" }}>
                  {tx("분석 전에 데이터에 빠진 주·이상한 값이 없는지 점검하고, 작년 대비 지출·성과가 얼마나 변했는지(가장 단순하고 확실한 비교)를 봐요.", "Before analysis, checks for missing weeks/odd values in the data, and shows how much spend/performance changed vs. last year (the simplest, most certain comparison).")}
                </p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", margin: "8px 0" }}>
                  <div className="stat-card"><div className="lbl">{tx("주 수(n)", "Weeks (n)")}</div><div className="val">{mmm.derived.n}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("위생 경고", "Hygiene warnings")}</div><div className="val" style={{ color: mmm.validate?.warnings?.length ? "#f87171" : "#22c55e" }}>{mmm.validate?.warnings?.length || "OK"}</div></div>
                </div>
                {diag && Object.keys(diag.macro).length ? (
                  <div className="table-wrap" style={{ maxWidth: "420px", marginTop: "8px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("매크로 사실", "Macro fact")}</th><th>{tx("값", "Value")}</th></tr></thead>
                      <tbody>
                        {Object.entries(diag.macro).map(([k, v]) => (
                          <tr key={k}><td>{k}</td><td className="tnum" style={{ color: v < 0 ? POS : NEG }}>{v > 0 ? "+" : ""}{v}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                    {tx(`ⓘ 매크로 YoY(2024 vs 2025)는 날짜가 매핑된 데이터에서만 계산됩니다${diag && !diag.validDates ? " — 현재 데이터엔 유효 날짜 라벨이 없습니다." : " — 2024·2025 두 해가 모두 있어야 표시됩니다."}`, `ⓘ Macro YoY (2024 vs 2025) is only computed for data with a mapped date${diag && !diag.validDates ? " — the current data has no valid date labels." : " — both 2024 and 2025 must be present."}`)}
                  </p>
                )}
                {mmm.validate?.warnings?.length ? (
                  <details style={{ marginTop: "8px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "11px", color: "#fbbf24" }}>{tx(`⚠ 데이터 위생 경고 ${mmm.validate.warnings.length}건 (펼치기)`, `⚠ ${mmm.validate.warnings.length} data hygiene warnings (expand)`)}</summary>
                    <ul style={{ fontSize: "11px", color: "#e0af68", marginTop: "4px" }}>
                      {mmm.validate.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                    </ul>
                  </details>
                ) : null}
                {diag && diag.absorb && diag.absorb.notices.length > 0 && (
                  <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginTop: "10px" }}>
                    🔗 <strong>{tx("자동 흡수(공선)", "Auto-absorption (collinear)")}</strong> — {tx("채널 지출과 거의 동일하게 움직이는(|r|≥0.9) 구조변화 항목을 모델에서 제거해 계수 폭주를 막았습니다:", "regime-change items that move almost identically to channel spend (|r|≥0.9) were removed from the model to prevent coefficient blow-up:")}
                    <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                      {diag.absorb.notices.map((nt) => (
                        <li key={nt.key}>{nt.channelLabel} ~ {nt.step} (r={nt.corr}) → <strong>{nt.dropped}</strong> {tx(`흡수(유지: ${nt.kept})`, `absorbed (kept: ${nt.kept})`)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* ── §2 "단순 모델" audit — 흔한 함정 점검 (naive lumped 모델) ── */}
              {diag && diag.audit && (() => {
                const a = diag.audit;
                const f = (v, d = 2) => (v == null || !isFinite(v) ? "—" : (+v).toFixed(d));
                return (
                  <section className="block" id="s-audit">
                    <h2 className="section-title">{tx("'대충 뭉친 모델'은 왜 못 믿나요?", "Why can't you trust a 'crudely lumped model'?")}</h2>
                    <p className="muted" style={{ fontSize: "12px" }}>
                      {tx("모든 채널 지출을", "It shows common pitfalls of")} <strong>{tx("하나로 뭉쳐 대충 만든 모델", "a model crudely lumping all channel spend together")}</strong>{tx("이 흔히 빠지는 함정(자기상관을 무시해 과신하거나, 채널끼리 겹쳐 계수가 출렁이는 것)을 보여줘요 — 그래서 채널을 나누고 광고 잔효·수확체감을 반영한 제대로 된 MMM(② 기여 분해)이 필요합니다.", " (overconfidence from ignoring autocorrelation, or coefficients swinging because channels overlap) — which is why a proper MMM (② Contribution) that separates channels and models carryover/saturation is needed.")}
                    </p>
                    <p style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                      target=RR · n={a.n} · R²={f(a.r2, 4)} · adjR²={f(a.adj_r2, 4)} · HAC maxlags={a.hac_maxlags}
                    </p>
                    <div className="table-wrap" style={{ marginTop: "6px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>{tx("변수", "Variable")}</th><th>coef</th><th title={tx("일반 최소제곱 p — 자기상관 미보정(과신 가능)", "Plain OLS p — not autocorrelation-corrected (may overstate confidence)")}>OLS p</th><th title={tx("자기상관 보정(HAC) p — 보수적", "Autocorrelation-corrected (HAC) p — conservative")}>HAC p</th></tr></thead>
                        <tbody>
                          {a.coefficients.map((r) => (
                            <tr key={r.var}>
                              <td>{r.var}</td>
                              <td className="tnum">{f(r.coef)}</td>
                              <td className="tnum" style={{ color: MUTED }}>{f(r.ols_p, 4)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('① 브랜드 추가 시 R²가 내려가는가?', "① Does R² fall when brand is added?")} <span style={{ color: MUTED, fontSize: "11px" }}>{tx('(회귀변수 추가는 R²를 못 낮춤 → "브랜드 빼자" 논리 반박)', '(adding a regressor can\'t lower R² → this rebuts the "drop brand" argument)')}</span>
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("R²(브랜드 X)", "R² (no brand)")}</th><th>{tx("R²(브랜드 O)", "R² (with brand)")}</th><th>brand p</th></tr></thead>
                        <tbody>
                          {a.brand_test.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.R2_no_brand, 4)}</td>
                              <td className="tnum" style={{ color: NEG }}>{f(r.R2_with_brand, 4)}</td>
                              <td className="tnum">{f(r.brand_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('② 같은 스펙인데 target만 바꿔도 "총지출 계수"가 출렁인다 = 공선 신호', '② Same spec, but the "total-spend coefficient" swings just by changing target = a collinearity signal')}
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("총지출 coef", "Total-spend coef")}</th><th>HAC p</th><th>trend coef</th></tr></thead>
                        <tbody>
                          {a.channel_swing.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.ln_G_coef)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                              <td className="tnum" style={{ color: POS }}>{f(r.trend_coef)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                      {tx(`RR mean=${a.composite.mean_RR} = 구성요소 합 ${a.composite.components_mean_sum} (RR 정의 확인). ⚠ spend↔trend 공선 + 상쇄 계수 → 단순 모델 계수는 식별 불안정 → §5(채널분리·adstock·HAC)에서 제대로.`, `RR mean=${a.composite.mean_RR} = sum of components ${a.composite.components_mean_sum} (checks the RR definition). ⚠ spend↔trend collinearity + offsetting coefficients → naive-model coefficients are unstable to identify → done properly in §5 (channel separation, adstock, HAC).`)}
                    </p>
                  </section>
                );
              })()}
                </div>
              </details>

              {/* ── 맨 밑: 전 과정 상세 설명 문서 다운로드 ── */}
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <button className="ab-button"
                  onClick={() => textDownload(`${tx("카니발_진단_설명", "cannibalization_diagnosis_explained")}_${mmm.target}_${_today()}.md`, buildCannibGuideDoc(cannib, mmm.target === "Regs" ? tx("가입", "signup") : mmm.target === "React" ? tx("재활성", "reactivation") : mmm.target, locale))}>
                  {tx("📄 이 과정에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "📄 Want a detailed explanation of this process? — Get the detailed document")}
                </button>
              </div>
            </>
          )}

          {/* ── STAGE ② MMM ── */}
          {stage === "mmm" && (() => {
            const shRows = (mmm.run.shapley?.rows || []).slice().sort((a, b) => b.r2_share - a.r2_share);
            const PLAIN_DRV = locale === "en"
              ? { Trend: "Base demand · trend", Seasonality: "Season", Holidays: "Holidays/events", "Regime(steps)": "Regime change", Regime: "Regime change", baseline: "Baseline" }
              : { Trend: "기본 수요·추세", Seasonality: "시즌·계절", Holidays: "휴일·이벤트", "Holidays & Events": "휴일·이벤트", "Regime(steps)": "구조 변화", "Regime change": "구조 변화", Performance: "마케팅", Brand: "브랜딩", Regime: "구조 변화", baseline: "기본값" };
            const plainDrv = (nm) => PLAIN_DRV[nm] || nm;
            const isMediaDrv = (nm) => !MMM_NONMEDIA_GROUPS.includes(nm) && nm !== "baseline";
            const tgtKo = mmm.target === "Regs" ? tx("가입", "signups") : mmm.target === "React" ? tx("재활성", "reactivation") : mmm.target;
            const topDrv = shRows[0];
            const topMedia = shRows.find((r) => isMediaDrv(r.driver));
            const headline = shRows.length
              ? tx(
                  `${tgtKo} 성과를 움직인 건 대부분 ${plainDrv(topDrv.driver)}(${(topDrv.pct || 0).toFixed(0)}%)였고${topMedia ? `, 광고 중엔 ${topMedia.driver}가 가장 컸어요` : "예요"}.`,
                  `Most of the ${tgtKo} performance was driven by ${plainDrv(topDrv.driver)} (${(topDrv.pct || 0).toFixed(0)}%)${topMedia ? `, and among ads, ${topMedia.driver} was the largest` : ""}.`,
                )
              : tx("기여 분해 결과를 계산할 수 없어요.", "Can't compute the contribution breakdown.");
            const maxPct = Math.max(0.0001, ...shRows.map((r) => r.pct || 0));
            const barColor = (nm) => isMediaDrv(nm) ? "#7F77DD" : nm === "Seasonality" ? "#5DCAA5" : nm === "baseline" ? "var(--border-strong)" : "#85B7EB";
            const sat = mmm.run.saturationByChannel || {};
            // 한계효과(curMarg)는 "원본 통화로 +1000 늘렸을 때"의 실제 증가 인원 —
            // 이 실물량 자체는 표시 통화를 바꿔도 변하지 않는다(같은 실제 지출 증가분
            // 얘기이므로 나눗셈 금지, §전에 나눠서 "+0명"으로 언더플로우되던 버그).
            // 바뀌어야 하는 건 "그 +1000이 표시통화로 얼마인지" 라벨뿐이라 convAmt로
            // 스텝 크기만 환산(예: $1000 = ₩1,400,000 → "+₩1,400,000당").
            const spendLabel = (amount) => {
              const displayAmount = convAmt(amount);
              if (displayCurrency === "KRW") return `${fmtCompact(Math.round(displayAmount))}원`;
              return Math.abs(displayAmount) >= 1000
                ? `$${(displayAmount / 1000).toFixed(1)}k`
                : `$${displayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
            };
            const ranked = Object.values(sat)
              .map((s) => ({ ...s, curMarg: s.currentMarginal }))
              .filter((s) => s.posteriorPositive >= 0.8 && s.curMarg > 0)
              .sort((a, b) => b.curMarg - a.curMarg);
            // 음(−) 기여 알림 — 어떤 버킷이 특정 주에 성과를 크게 끌어내렸나. baseline(기본 수요)은 상수라 제외.
            const negAlert = (() => {
              if (!decomp || !decomp.weeks?.length) return null;
              let worst = null;
              decomp.weeks.forEach((w, i) => {
                const byB = {};
                decomp.groupNames.forEach((g) => { const b = decompBucketOf(g); byB[b] = (byB[b] || 0) + (w.contrib[g] || 0); });
                Object.entries(byB).forEach(([b, v]) => { if (v < 0 && (!worst || v < worst.val)) worst = { bucket: b, val: v, i }; });
              });
              const thr = -0.08 * Math.abs(decomp.baseline || 1);
              if (!worst || worst.val > thr) return null;
              const w = decomp.weeks[worst.i];
              let domG = null, domV = 0;
              decomp.groupNames.forEach((g) => { if (decompBucketOf(g) !== worst.bucket) return; const v = w.contrib[g] || 0; if (v < domV) { domV = v; domG = g; } });
              return { ...worst, domG, domV, lbl: mmm.panel.weekLabel?.[worst.i] || `주차 ${worst.i + 1}`, bLabel: bucketMeta[worst.bucket]?.label || worst.bucket };
            })();
            const groupPanelPalette = {
              "기본 수요": "#94a3b8",
              Trend: "#c9c2c0",
              Seasonality: "#f4d877",
              "Holidays & Events": "#f4b366",
              "Regime change": "#bda593",
              Performance: "#df8392",
              Brand: "#d5df8e",
            };
            const groupPanels = decomp
              ? [
                  { key: "기본 수요", values: decomp.weeks.map((w) => w.baseline) },
                  ...decomp.groupNames.map((key) => ({ key, values: decomp.weeks.map((w) => w.contrib[key] || 0) })),
                ].filter((g) => g.values.some((v) => Math.abs(v) > 1e-8))
              : [];
            return (
            <>
              <MmmEvidenceLedger
                locale={locale}
                priorView={priorView}
                onPriorView={setPriorView}
                evidence={priorEvidence}
                onEvidence={setPriorEvidence}
                onLoadDemo={handleLoadPriorDemo}
                appliedPriorCount={Object.keys(mmm.mediaPriors || {}).length}
                countryCandidates={mmm.countryCandidates || []}
              />
              {priorView !== "base" && (
                <div className="callout" style={{ marginBottom: "12px" }}>
                  <div className="ico">i</div><div className="body"><strong>{Object.keys(mmm.mediaPriors || {}).length ? tx(`${tgtKo}에는 ${Object.keys(mmm.mediaPriors).length}개 채널 prior 적용`, `${Object.keys(mmm.mediaPriors).length} channel priors applied to ${tgtKo}`) : tx(`${tgtKo}에 일치하는 prior 없음`, `No matching prior for ${tgtKo}`)}</strong><p>{Object.keys(mmm.mediaPriors || {}).length ? tx("같은 KPI 정의와 단위를 가진 근거만 반영했습니다.", "Only evidence with the same KPI definition and units is applied.") : tx("이 목표에는 기본 MMM만 사용합니다.", "This target continues to use the base MMM.")}</p></div>
                </div>
              )}
              {/* ── 메인: 평어 헤드라인 ── */}
              <Card style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <Badge color="#7aa2f7">{tx("기여 분해", "Contribution")}</Badge>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
              </Card>

              {/* ── 메인: 무엇이 성과를 움직였나 — 드라이버 기여 바 (Shapley %) ── */}
              <section className="block">
                <h2 className="section-title">{tx("무엇이 성과를 움직였나", "What moved performance")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· 설명력 비중", "· share of explained variance")}</span></h2>
                {shRows.length ? (
                  // 단일 grid — 라벨 열 폭을 전 행 공유(max-content)해 가장 긴 변수명에 맞춰 정렬, 막대 시작점 일치.
                  <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr 44px", alignItems: "center", columnGap: "10px", rowGap: "8px", marginTop: "6px" }}>
                    {shRows.map((r) => (
                      <React.Fragment key={r.driver}>
                        <span style={{ fontSize: "12.5px", textAlign: "left", color: "var(--text-1)", whiteSpace: "nowrap" }} title={r.driver}>{plainDrv(r.driver)}</span>
                        <div style={{ background: "var(--bg-1)", borderRadius: "6px", height: "20px", minWidth: 0 }}>
                          <div style={{ width: `${Math.round((r.pct || 0) / maxPct * 100)}%`, minWidth: "2px", background: barColor(r.driver), height: "100%", borderRadius: "6px" }}></div>
                        </div>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, textAlign: "right" }}>{(r.pct || 0).toFixed(0)}%</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : <p className="muted" style={{ fontSize: "12px" }}>{tx("계산할 수 없어요.", "Can't compute this.")}</p>}
                    <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{tx("posterior에서 각 드라이버 기여가 흔들린 크기를 비교한 결과예요. 진한 보라 = 광고 채널.", "Compares the posterior contribution variation of each driver. Dark purple = ad channels.")}</p>
              </section>

              {/* ── 메인: 다음 예산은 여기로 (액션 카드) ── */}
              {ranked.length > 0 && (
                <section className="block" style={{ border: "2px solid var(--primary, #adc6ff)" }}>
                  <h2 className="section-title">{tx("🎯 다음 예산은 여기로", "🎯 Where the next budget should go")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx(`· 지금 지출에서 +${spendLabel(1000)}당 늘어나는 ${tgtKo}`, `· extra ${tgtKo} per +${spendLabel(1000)} at current spend`)}</span></h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {ranked.map((s, i) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: i === 0 ? "rgba(122,162,247,0.1)" : "transparent", borderRadius: "8px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: i === 0 ? "#7aa2f7" : MUTED, minWidth: "20px" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: "14px", fontWeight: i === 0 ? 700 : 400 }}>{s.label}</span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e" }}>+{s.curMarg.toFixed(0)}{tx("명", "")}</span>
                        <span style={{ fontSize: "12px", color: MUTED }}>{tx(`현 ${spendLabel(s.recentMean || 0)}/주`, `now ${spendLabel(s.recentMean || 0)}/wk`)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{tx("많이 쓸수록 1달러당 효과는 줄어요(수확체감). 관측 회귀 기반 가설 — 단기 캠페인 배분은 예산 배분 도구(5-3)에서. 음(−)의 효율 채널은 노이즈라 제외했어요.", "The more you spend, the less each dollar returns (diminishing returns). This is an observational-regression hypothesis — for short-term campaign allocation use the Budget Allocation tool (5-3). Channels with negative efficiency were excluded as noise.")}</p>
                </section>
              )}

              {/* 기간 전체에서 실제로 집행된 주만 평균낸 채널별 모델 성과 — 상세 아코디언 밖에 고정. */}
              {weeklyChannelPerformance.length > 0 && (
                <section className="block mmm-weekly-performance" id="s-mmm-weekly-performance">
                  <div className="mmm-weekly-performance__head">
                    <div>
                      <h2 className="section-title">{tx("채널별 주 평균 성과", "Average weekly channel performance")}</h2>
                      <p>{tx(
                        "해당 기간 실제 집행액을 MMM 곡선에 넣어 계산한 채널별 평균입니다. 지출이 없던 채널은 제외합니다.",
                        "Each row applies the period's actual spend to the MMM curve. Channels without spend are excluded.",
                      )}</p>
                    </div>
                    <span className="mmm-weekly-performance__note">{tx("모델 예측치", "Model estimate")}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="data mmm-data-table">
                      <thead>
                        <tr>
                          <th>{tx("채널", "Channel")}</th>
                          <th>{tx("집행 주", "Active weeks")}</th>
                          <th>{tx("평균 지출/주", "Avg. spend/wk")}</th>
                          <th>{tx(`예측 ${tgtKo}/주`, `Predicted ${tgtKo}/wk`)}</th>
                          <th>{mmm.target === "Revenue" ? tx("예측 ROAS", "Predicted ROAS") : tx("예측 CPR", "Predicted CPR")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyChannelPerformance.map((row) => {
                          const efficiency = mmm.target === "Revenue"
                            ? row.avgWeeklySpend > 0 && row.avgWeeklyPredicted > 0 ? row.avgWeeklyPredicted / row.avgWeeklySpend : null
                            : row.predictedCpr;
                          return (
                            <tr key={row.key} style={row.posteriorPositive != null && row.posteriorPositive < 0.8 ? { opacity: 0.62 } : undefined}>
                              <td><strong>{row.label}</strong></td>
                              <td className="tnum">{row.activeWeeks}{tx("주", " wk")}</td>
                              <td className="tnum">{spendLabel(row.avgWeeklySpend)}</td>
                              <td className="tnum">{row.avgWeeklyPredicted > 0 ? `${fmtInt(row.avgWeeklyPredicted)}${tx("명", "")}` : "—"}</td>
                              <td className="tnum mmm-data-table__metric">
                                {efficiency == null ? "—" : mmm.target === "Revenue" ? `${fmtOne(efficiency)}x` : spendLabel(efficiency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mmm-weekly-performance__foot">{tx(
                    "예측 가입은 전체 가입을 채널마다 나눈 값이 아니라, 각 채널 지출이 모델에서 만든 기여도입니다. 관측 기반 추정이므로 증분 확정은 홀드아웃으로 확인하세요.",
                    "Predicted results are channel contributions, not the total outcome copied into every row. This is observational; confirm incrementality with a holdout.",
                  )}</p>
                </section>
              )}

              {/* ── 아코디언 A: 실제 vs 모델 (fit + 드라이버 분해 + 튀는 주) ── */}
              <details className="block" onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>{tx("실제 성과와 모델이 얼마나 맞나? — 실제 vs 모델 그래프 · 드라이버 분해 · 튀는 주", "How well does the model match actual performance? — actual vs. model graph · driver breakdown · spikes")}</summary>
                <div style={{ marginTop: "12px" }}>
                  <div className="ab-pillgroup" style={{ marginBottom: "10px" }}>
                    <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
                    <span className="ab-pill active">Bayesian MMM</span>
                  </div>
                  {decomp ? (
                    <>
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                        <div className="stat-card"><div className="lbl">{tx("평균 오차(RMSE)", "Average error (RMSE)")}</div><div className="val">±{decomp.rmse}{tx("명", "")}</div></div>
                        <div className="stat-card"><div className="lbl">{tx("평균 오차율(MAPE)", "Average error rate (MAPE)")}</div><div className="val">{decomp.mape}%</div></div>
                        {mmm.run.backtest && <div className="stat-card"><div className="lbl">{tx("시간순 OOS MAPE", "Time-ordered OOS MAPE")}</div><div className="val">{mmm.run.backtest.mape.toFixed(1)}%</div></div>}
                        <div className="stat-card"><div className="lbl">{tx("전체 기간 평균", "Full-period average")}</div><div className="val">{fmtInt(decomp.baseline)}</div></div>
                      </div>
                      <p className="muted" style={{ fontSize: "11px", marginBottom: "6px" }}>{tx('실제(회색)와 모델(파랑)이 가까울수록 잘 맞은 거예요. 점선(시즌·추세 등)은 광고와 무관한 부분만 뽑아낸 흐름이라 시간에 따라 움직여요 — "전체 기간 평균"(고정값)과는 다른 선입니다.', 'The closer actual (gray) and model (blue) are, the better the fit. The dashed line (season/trend etc.) is the ad-unrelated portion only and moves over time — different from the fixed "full-period average" line.')}</p>
                      <div className="chart-container" style={{ height: "240px", marginBottom: "12px" }}><canvas ref={fitRef}></canvas></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <h3 className="section-title" style={{ fontSize: "13.5px", margin: 0 }}>{tx("매주 성과는 무엇으로 이뤄졌나", "What made up each week's performance")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 자동 분류한 그룹별 기여", "· automatically classified contribution groups")}</span></h3>
                      </div>
                      <p className="muted" style={{ fontSize: "11px", marginBottom: "6px", lineHeight: 1.5 }}>
                        {tx("채널은 직접 노출하지 않고", "Channels are not shown directly. Instead,")} <b>{tx("마케팅·브랜딩", "Performance and Brand")}</b>{tx("으로 자동 묶습니다. 기본 수요·추세는 양수 레벨이 오르내리는 값이고, 휴일·이벤트·시즌·계절·구조 변화는 기준선 대비 음수도 표시합니다.", ", Performance and Brand. Base demand · trend is a positive level that rises or falls; Holidays & Events, Seasonality, and Regime change can be negative versus that level.")}
                      </p>
                      {negAlert && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "9px 12px", marginBottom: "8px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: "8px" }}>
                          <span style={{ fontSize: "15px" }}>⚠️</span>
                          <span style={{ fontSize: "12px", color: "var(--text-1)", lineHeight: 1.5 }}>
                            {tx("주", "In week")} <b>{String(negAlert.lbl)}</b>{tx(`에 `, ", ")}<b style={{ color: bucketMeta[negAlert.bucket]?.tone }}>{negAlert.bLabel}</b>{tx(`가 성과를 크게 끌어내렸어요 (약 ${fmtInt(negAlert.val)}명).`, ` pulled performance down significantly (about ${fmtInt(negAlert.val)}).`)}
                            {negAlert.domG && negAlert.domV < 0 ? <> {tx("주 원인은", "The main cause was")} <b>{plainDrv(negAlert.domG)}</b>{tx(`(${fmtInt(negAlert.domV)}명)예요.`, ` (${fmtInt(negAlert.domV)}).`)}</> : null}
                            {negAlert.bucket === "media" ? tx(" 광고가 오히려 마이너스로 잡히면 노이즈·공선일 수 있으니 아래 상세를 확인하세요.", " If ads register as negative, it could be noise or collinearity — check the detail below.") : ""}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {groupPanels.map((group) => (
                          <section key={group.key} style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                            <h4 style={{ margin: "0 0 3px", fontSize: "12px", color: "var(--text-1)" }}>{plainDrv(group.key)}</h4>
                            <ContributionGroupPanel
                              label={plainDrv(group.key)}
                              values={group.values}
                              labels={decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week)}
                              color={groupPanelPalette[group.key] || "#85B7EB"}
                              locale={locale}
                            />
                          </section>
                        ))}
                      </div>
                      <div className="table-wrap" style={{ marginTop: "12px" }}>
                        <table className="data mmm-data-table">
                          <thead><tr><th>{tx("성장 요인", "Driver")}</th><th>{decomp.level ? tx("평균 기여", "Average contribution") : tx("주별 변동", "Weekly swing")}</th><th>{tx("광고 변수", "Ad variable")}</th></tr></thead>
                          <tbody>
                            {decomp.driverStats.map((d) => (
                              <tr key={d.name}>
                                <td><strong>{plainDrv(d.name)}</strong></td>
                                <td className="tnum mmm-data-table__metric">{decomp.level ? `${d.avg >= 0 ? "+" : ""}${fmtInt(d.avg)}${tx("명", "")}` : `±${fmtInt(d.swing)}${tx("명/주", "/wk")}`}</td>
                                <td><span className={`mmm-data-table__tag ${d.media ? "is-media" : ""}`}>{d.media ? tx("광고", "Ad") : tx("비광고", "Non-ad")}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {decomp.spikes && decomp.spikes.length > 0 && (
                        <>
                          <h3 className="section-title" style={{ fontSize: "13.5px", marginTop: "16px" }}>{tx("🔎 튀는 구간", "🔎 Spikes")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 평소와 다르게 크게 벗어난 주 (메모 남기면 위 그래프에 번호로 표시)", "· weeks that deviate unusually far from normal (add a note to number them on the chart above)")}</span></h3>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "11.5px" }}>
                              <thead><tr><th>{tx("기간", "Period")}</th><th>{tx("기준선 대비", "vs. baseline")}</th><th>{tx("자동 진단", "Auto diagnosis")}</th><th>{tx("메모 (원인 기록)", "Note (record cause)")}</th></tr></thead>
                              <tbody>
                                {decomp.spikes.map((s) => {
                                  const lbl = mmm.panel.weekLabel && s.i != null ? mmm.panel.weekLabel[s.i] : null;
                                  const noteKey = `${mmm.target}|${s.week}`;
                                  const noteNum = decomp.spikes.filter((n) => (spikeNotes[`${mmm.target}|${n.week}`] || "").trim()).findIndex((n) => n.week === s.week) + 1;
                                  const clsLabel = s.cls === "channel"
                                    ? { txt: tx("채널 스파크", "Channel spike"), color: "#7aa2f7" }
                                    : s.cls === "baseline"
                                      ? { txt: tx("기준선·계절 변동", "Baseline/seasonal swing"), color: "#22c55e" }
                                      : { txt: tx("모델 밖(원인 입력 권장)", "Outside the model (please record a cause)"), color: "#fbbf24" };
                                  const driverTxt = s.cls === "unexplained"
                                    ? `${tx("잔차", "Residual")} ${s.residual >= 0 ? "+" : ""}${s.residual.toLocaleString()}${tx("명", "")}`
                                    : `${s.domDriver} ${s.domVal >= 0 ? "+" : ""}${s.domVal.toLocaleString()}${tx("명", "")}`;
                                  return (
                                    <tr key={s.week}>
                                      <td>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                          {noteNum > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "#f59e0b", color: "#fff", fontSize: "9px", fontWeight: 700, flexShrink: 0 }}>{noteNum}</span>}
                                          <b style={{ fontSize: "12px" }}>{lbl != null ? String(lbl) : tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</b>
                                        </span>
                                        {lbl != null && <span style={{ fontSize: "9px", color: MUTED, display: "block" }}>{tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</span>}
                                      </td>
                                      <td className="tnum" style={{ color: s.dev >= 0 ? POS : NEG }}>{s.dev >= 0 ? "+" : ""}{s.dev.toLocaleString()}{tx("명", "")}</td>
                                      <td>
                                        <span style={{ color: clsLabel.color, fontWeight: 600 }}>{clsLabel.txt}</span>
                                        <span style={{ fontSize: "10px", color: MUTED }}><br />{tx("주 원인:", "Main cause:")} {driverTxt}</span>
                                      </td>
                                      <td>
                                        <input
                                          value={spikeNotes[noteKey] || ""}
                                          onChange={(e) => setSpikeNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                                          placeholder={tx("이 주에 무슨 일? (예: 앱스토어 피처드, 경쟁사 이슈)", "What happened this week? (e.g. App Store feature, competitor issue)")}
                                          style={{ width: "100%", background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 7px", fontSize: "11px" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: "12px" }}>{tx("분해를 계산할 수 없습니다(ridge 특이·데이터 부족).", "Can't compute the decomposition (ridge singularity/insufficient data).")}</p>
                  )}
                </div>
              </details>

              {/* ── 아코디언 B: 이 숫자들은 어떻게 나왔나요? (adstock CV·탄력성·VIF·Shapley·수확체감·채널효과) ── */}
              <details className="block" onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>{tx("이 숫자들은 어떻게 나왔나요? — 계산 과정 자세히 보기", "How were these numbers computed? — see the calculation in detail")}</summary>
                <div style={{ marginTop: "12px" }}>
                  <StatHead title={tx("① 채널별 광고 여운·포화", "① Per-channel carryover and saturation")} hint={tx("채널마다 광고 효과가 남는 길이와 포화되는 지출점이 다르다고 두고, 데이터에서 가장 설명력 있는 변환을 고릅니다.", "Each channel has its own carryover and saturation point, selected from the transformation that best explains the data.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("잔효 α", "Carryover α")}</th><th>{tx("반포화 지출점", "Half-saturation")}</th><th>{tx("포화 곡선", "Hill slope")}</th><th>{tx("효과가 양수일 확률", "P(effect > 0)")}</th></tr></thead>
                      <tbody>{Object.values(mmm.run.saturationByChannel || {}).map((s) => (
                        <tr key={s.key}><td>{s.label}</td><td className="tnum">{s.params.alpha.toFixed(1)}</td><td className="tnum">{fmtInt(s.params.ec)}</td><td className="tnum">{s.params.slope.toFixed(1)}</td><td className="tnum" style={{ color: s.posteriorPositive >= 0.8 ? NEG : MUTED }}>{(s.posteriorPositive * 100).toFixed(0)}%</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <StatHead title={tx("② Bayesian 효과 신뢰도", "② Bayesian effect confidence")} hint={tx("양수 확률은 이 데이터에서 선택된 adstock·포화 파라미터를 고정한 조건부 posterior입니다. 80% 이상은 추천 후보일 뿐, holdout 검증 전 인과·증분 확정이 아닙니다.", "Positive probability is conditional on the adstock/saturation parameters selected from this data. ≥80% is a recommendation candidate, not causal or incremental proof before holdout validation.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("효과 양수 확률", "P(effect > 0)")}</th><th>{tx("효과 크기", "Effect size")}</th><th>{tx("90% 신뢰구간", "90% credible interval")}</th><th>{tx("예산 추천", "Budget use")}</th></tr></thead>
                      <tbody>{Object.values(mmm.run.saturationByChannel || {}).map((s) => {
                        const useBudget = s.posteriorPositive >= 0.8 && s.currentMarginal > 0;
                        return <tr key={s.key}>
                          <td><strong>{s.label}</strong></td>
                          <td className="tnum" style={{ color: useBudget ? NEG : MUTED }}>{fmtOne(s.posteriorPositive * 100)}%</td>
                          <td className="tnum">{fmtOne(s.ln_coef)}</td>
                          <td className="tnum">[{fmtOne(s.ci?.[0])}, {fmtOne(s.ci?.[1])}]</td>
                          <td style={{ color: useBudget ? NEG : MUTED, fontWeight: 600 }}>{useBudget ? tx("포함", "Included") : tx("보류", "Hold")}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <StatHead title={tx("③ posterior 기여 변동", "③ Posterior contribution variation")} hint={tx("각 드라이버가 posterior 예측에서 차지하는 기여 변동을 비교합니다. 인과 확정이나 OLS Shapley R²는 아닙니다.", "Compares each driver's contribution variation in the posterior prediction; it is not causal proof or OLS Shapley R².")} />
                  <div className="chart-container" style={{ height: "200px", marginBottom: "8px" }}><canvas ref={shapleyRef}></canvas></div>
                  <StatHead title={tx("④ 수확체감 — 더 쓰면 효과가 얼마나 꺾이나", "④ Diminishing returns — how much does effect fall as you spend more")} hint={tx("곡선이 평평해질수록 1달러당 효과가 줄어요(수확체감). ● = 지금 지출 위치. 이미 꺾인 뒤에 있으면 증액 효율이 낮다는 뜻. 점선 = 음수(노이즈).", "The flatter the curve, the less each dollar returns (diminishing returns). ● = current spend point. If it's already past the bend, added spend is less efficient. Dashed = negative (noise).")} />
                  {/* 커스텀 채널 토글 범례 — 클릭으로 곡선+현재지출점 함께 표시/숨김(§유저: 켠 채널 점만) */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {Object.entries(mmm.run.saturationByChannel || {}).map(([key, s], i) => {
                      const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
                      const off = !!satHidden[key];
                      return (
                        <button key={key} onClick={() => setSatHidden((h) => ({ ...h, [key]: !h[key] }))}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: off ? "transparent" : "var(--bg-1)", color: off ? MUTED : "var(--text-1)", fontSize: "10.5px", cursor: "pointer", opacity: off ? 0.5 : 1, textDecoration: off ? "line-through" : "none" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: s.posteriorPositive < 0.8 ? "transparent" : col, outline: s.posteriorPositive < 0.8 ? `1px dashed ${col}` : "none", display: "inline-block" }}></span>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <div className="chart-container" style={{ height: "340px", minHeight: "340px", marginBottom: "12px" }}><canvas ref={satRef}></canvas></div>
                    <div>
                      <div className="table-wrap">
                        <table className="data mmm-data-table mmm-marginal-table">
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("현재 지출에서", "At current spend")}<small>{tx(`추가 ${spendLabel(1000)}당`, `per +${spendLabel(1000)}`)}</small></th><th>{spendLabel(10000)}<small>{tx("지출일 때", "spend level")}</small></th><th>{spendLabel(35000)}<small>{tx("지출일 때", "spend level")}</small></th><th>{spendLabel(60000)}<small>{tx("지출일 때", "spend level")}</small></th></tr></thead>
                          <tbody>
                            {(() => {
                              const sbc = mmm.run.saturationByChannel || {};
                              const keys = Object.keys(sbc);
                              if (!keys.length) return <tr><td colSpan="5" style={{ color: MUTED }}>—</td></tr>;
                              // marginal_kpi_per_1k는 "원본 통화 +1000 늘렸을 때"의 실제 증가
                              // 인원 — 실물량이라 통화 토글로 나누면 안 됨(그 헤더 텍스트만
                              // convAmt로 환산해서 "+1000이 표시통화로 얼마인지" 보여줌).
                              const cell = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${fmtOne(v)}${tx("명", "")}`);
                              return keys.map((k) => {
                              const s = sbc[k], neg = s.posteriorPositive < 0.8;
                                const curMarg = s.recentMean > 0 ? +s.currentMarginal.toFixed(1) : null;
                                return (
                                  <tr key={k} style={neg ? { opacity: 0.55 } : undefined}>
                                    <td><strong>{s.label}</strong>{neg ? <span style={{ fontSize: "9px", color: "#fbbf24" }}> {tx("음수=노이즈", "negative=noise")}</span> : ""}</td>
                                    <td className="tnum" style={{ color: "#adc6ff" }}>{curMarg == null ? "—" : cell(curMarg)}{curMarg != null && <span style={{ fontSize: "9px", color: MUTED }}><br />@{spendLabel(s.recentMean)}</span>}</td>
                                    <td className="tnum">{cell(s.marginalAt(10000) * 1000)}</td>
                                    <td className="tnum">{cell(s.marginalAt(35000) * 1000)}</td>
                                    <td className="tnum">{cell(s.marginalAt(60000) * 1000)}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <StatHead title={mmm.target === "Revenue" ? tx("⑤ ROAS 곡선", "⑤ ROAS curve") : tx("⑤ CPA 곡선", "⑤ CPA curve")} hint={mmm.target === "Revenue" ? tx("지출이 늘수록 같은 광고비가 만드는 매출 비율(ROAS)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how revenue return per spend changes as spend grows. Interpret positive-effect channels only.") : tx("지출이 늘수록 결과 1건을 만드는 비용(CPA)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how cost per result changes as spend grows. Interpret positive-effect channels only.")} />
                      <div className="chart-container" style={{ height: "280px", minHeight: "280px", marginBottom: "12px" }}><canvas ref={efficiencyRef}></canvas></div>
                      <p className="muted" style={{ fontSize: "10.5px", marginTop: "4px" }}>
                        <strong>{tx('"+$1k당 N명"', '"+N per $1k"')}</strong> = {tx("그 지출 수준에서 1,000달러 더 쓸 때 늘어나는 결과(지출↑일수록 작아짐).", "the extra result from spending $1,000 more at that spend level (shrinks as spend rises).")} <strong>{tx("음수 채널은 노이즈", "Negative channels are noise")}</strong>. {tx("절대 인원은 holdout, 효율(CPR)은 비용 대비 따로.", "Absolute count needs a holdout; efficiency (CPR) is separate, relative to cost.")}
                      </p>
                    </div>
                  </div>
                  {/* 채널별 Bayesian 효과 요약 */}
                  <p style={{ fontSize: "12px", margin: "14px 0 4px" }}>{tx("채널별 효과 요약", "Per-channel effect summary")}</p>
                  <div className="table-wrap">
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("현재 지출", "Current spend")}</th><th>{tx("추가 지출 효과", "Marginal effect")}</th><th>{tx("양수 확률", "P(positive)")}</th><th>{tx("판정", "Verdict")}</th></tr></thead>
                      <tbody>
                        {Object.values(mmm.run.saturationByChannel || {}).map((s) => {
                          const useBudget = s.posteriorPositive >= 0.8 && s.currentMarginal > 0;
                          return (
                            <tr key={s.key} style={useBudget ? undefined : { opacity: 0.6 }}>
                              <td><strong>{s.label}</strong></td>
                              <td className="tnum">{spendLabel(s.recentMean)}</td>
                              <td className="tnum">{s.currentMarginal == null ? "—" : `${s.currentMarginal >= 0 ? "+" : ""}${fmtOne(s.currentMarginal)}${tx("명", "")}/${currencySym}${fmtOne(convAmt(1000))}`}</td>
                              <td className="tnum">{fmtOne(s.posteriorPositive * 100)}%</td>
                              <td style={{ color: useBudget ? NEG : MUTED, fontWeight: 600 }}>{useBudget ? tx("예산 추천", "Recommended") : tx("보류", "Hold")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>

              {/* ── 맨 밑: 상세 설명 문서 다운로드 ── */}
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <button className="ab-button"
                  onClick={() => textDownload(`${tx("MMM_기여분해_설명", "mmm_contribution_explained")}_${mmm.target}_${_today()}.md`, buildMmmGuideDoc(mmm, tgtKo, locale))}>
                  {tx("📄 이 과정에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "📄 Want a detailed explanation of this process? — Get the detailed document")}
                </button>
              </div>
            </>
            );
          })()}

          {/* ── STAGE ③ LAB — 회귀·미래예측(②와 같은 MMM 모델 계수로 과거 적합 + 미래 외삽) ── */}
          {stage === "lab" && (
            <section className="block" id="s-forecast">
              <h2 className="section-title">{tx("📈 회귀 · 미래 예측", "📈 Regression · Forecast")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· ②와 같은 모델로 과거 적합 + 미래 예산 시나리오 외삽", "· same model as ② — historical fit + future budget-scenario extrapolation")}</span></h2>
              <p style={{ fontSize: "12px", color: MUTED, marginBottom: "12px", lineHeight: 1.55 }}>
                {tx("①·②와", "Uses the")} <strong>{tx("같은 CSV·매핑", "same CSV/mapping")}</strong>{tx("을 그대로 씁니다(타깃·플랫폼 토글은 상단 breadcrumb에서). 아래 채널별 예산을 미래로 연장하면 그 시나리오의", " as ①·② (target/platform toggles are in the breadcrumb above). Extend the per-channel budgets below into the future to forecast that scenario's")} {mmm.target === "Regs" ? tx("가입", "signups") : mmm.target === "React" ? tx("재활성", "reactivation") : tx("성과", "performance")}{tx("을 예측합니다 — 회색=실측·파란선=모델/예측·음영=과거 잔차 기반 참고 범위(인과·확률 보장 아님).", " — gray=actual · blue line=model/forecast · shading=a reference range based on historical residuals, not a causal or probabilistic guarantee.")}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
                  <span className="ab-pill active">Bayesian MMM</span>
                </div>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("범위", "Range")}</span>
                  <span className="ab-pill active">{tx("참고용 잔차 범위", "Residual reference")}</span>
                </div>
                <label style={{ fontSize: "12px", color: MUTED }}>
                  {tx("예측 기간(주):", "Forecast horizon (wk):")}{" "}
                  <input type="number" min="1" max="52" value={fcHorizon} onChange={(e) => setFcHorizon(Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1)))} style={{ width: "60px" }} />
                </label>
              </div>
              {forecast ? (
                <>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {(() => {
                      const futAvg = forecast.predFut.reduce((a, b) => a + b, 0) / forecast.predFut.length;
                      const recentN = Math.min(8, forecast.actual.length);
                      const histAvg = forecast.actual.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
                      const chg = histAvg ? (futAvg / histAvg - 1) * 100 : 0;
                      return (
                        <>
                          <div className="stat-card"><div className="lbl">{tx("예측 평균/주", "Forecast avg/wk")}</div><div className="val">{fmtInt(futAvg)}</div></div>
                          <div className="stat-card"><div className="lbl">{tx(`최근 ${recentN}주 평균`, `Recent ${recentN}wk avg`)}</div><div className="val">{fmtInt(histAvg)}</div></div>
                          <div className="stat-card"><div className="lbl">{tx("변화", "Change")}</div><div className="val" style={{ color: chg >= 0 ? NEG : POS }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</div></div>
                          <div className="stat-card"><div className="lbl">{tx("모델 적합 R²", "Model fit R²")}</div><div className="val">{forecast.r2}</div></div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="chart-container" style={{ height: "300px", marginBottom: "12px" }}><canvas ref={forecastRef}></canvas></div>
                  <p style={{ fontSize: "11px", color: MUTED, marginBottom: "10px" }}>
                    {tx("과거 잔차 기반 참고 범위", "Historical-residual reference range")} · {tx("채널별 미래 예산을 수정하면 그 시나리오로 즉시 재예측됩니다(주 평균). 실제 배분·시나리오는 5-3 예산 배분 시뮬레이터를 사용하세요.", "Editing per-channel future budgets instantly re-forecasts that scenario (weekly average). For actual allocation/scenarios, use the Budget Allocation simulator (5-3).")}
                  </p>

                  {/* ── 채널별 미래 예산 편집 (수정 시 즉시 재예측) ── */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                    <button className="ab-pill" onClick={() => { setFcBudget({}); setFcStepOff({}); }}>{tx("↺ 최근 평균으로 초기화", "↺ Reset to recent average")}</button>
                    <button
                      className="ab-pill"
                      style={{ background: "#7aa2f7", color: "#0b0d12", fontWeight: 700, borderColor: "#7aa2f7" }}
                      title={tx("계수·계산식·실측·예측을 살아있는 엑셀 수식으로 — spend 칸을 바꾸면 adstock·ln·예측이 자동 연쇄 재계산", "Coefficients/formulas/actual/forecast as live Excel formulas — change a spend cell and adstock/ln/forecast auto-recalculate in a chain")}
                      onClick={() => csvDownload(`mmm_forecast_${mmm.target}_${forecast.model}_${_today()}.csv`, buildForecastCsv(forecast, mmm.target, locale))}
                    >
                      {tx("⬇ 전체 예측 CSV (계수·계산식·실측·예측)", "⬇ Full forecast CSV (coefficients/formulas/actual/forecast)")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", alignItems: "start" }}>
                    {/* 좌: 채널별 미래 예산 */}
                    <div>
                      <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("채널별 미래 예산 (주 평균)", "Future budget per channel (weekly average)")}{" "}
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("— 기본값 = 최근 8주 평균. 수정하면 즉시 재예측.", "— default = recent 8-week average. Edit to re-forecast instantly.")}</span>
                      </h3>
                      <div className="table-wrap">
                        <table className="data" style={{ fontSize: "12px" }}>
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("최근평균/주", "Recent avg/wk")}</th><th>{tx("미래 예산/주", "Future budget/wk")}</th></tr></thead>
                          <tbody>
                            {forecast.chans.map((ch) => {
                              const rec = forecast.recentMean[ch.key] || 0;
                              const cur = fcBudget[ch.key];
                              const val = cur != null && isFinite(cur) ? cur : Math.round(rec);
                              return (
                                <tr key={ch.key}>
                                  <td>{ch.label}</td>
                                  <td className="tnum" style={{ color: MUTED }}>{fmtInt(rec)}</td>
                                  <td>
                                    <CommaNumberInput
                                      value={val}
                                      onCommit={(n) => setFcBudget((prev) => {
                                        const next = { ...prev };
                                        if (n == null) delete next[ch.key];
                                        else next[ch.key] = Math.max(0, n);
                                        return next;
                                      })}
                                      style={{ width: "120px", textAlign: "right" }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 우: 이벤트·구조변화·휴일더미 미래 처리 */}
                    <div>
                      <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("이벤트 · 구조변화 · 휴일더미 미래 처리", "Future handling of events · regime change · holiday dummies")}{" "}
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("— 비우면 ", "— leave empty to ")}<strong>{tx("지속", "persist")}</strong>{tx(", N주 뒤 끔(0=즉시)", ", or turn off N weeks later (0=immediately)")}</span>
                      </h3>
                      {forecast.steps && forecast.steps.length ? (
                        <>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "12px" }}>
                              <thead><tr><th>{tx("항목", "Item")}</th><th>{tx("종류", "Type")}</th><th>{tx("현재", "Current")}</th><th>{tx("켜둘 미래 주", "Weeks to keep on")}</th></tr></thead>
                              <tbody>
                                {forecast.steps.map((s) => {
                                  const cur = fcStepOff[s.key];
                                  return (
                                    <tr key={s.key}>
                                      <td>{s.label}</td>
                                      <td style={{ fontSize: "11px", color: MUTED }}>{s.kind === "step" ? tx("구조변화", "Regime change") : tx("이벤트/휴일", "Event/holiday")}</td>
                                      <td style={{ color: s.lastOn ? "#22c55e" : MUTED, fontSize: "11px" }}>{s.lastOn ? "ON" : "OFF"}</td>
                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={tx("지속", "persist")}
                                          value={cur != null && isFinite(cur) ? cur : ""}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setFcStepOff((prev) => {
                                              const next = { ...prev };
                                              if (v === "") delete next[s.key];
                                              else next[s.key] = Math.max(0, parseInt(v, 10) || 0);
                                              return next;
                                            });
                                          }}
                                          style={{ width: "100px", textAlign: "right" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                            {tx("매핑한 휴일/이벤트 더미는", "Mapped holiday/event dummies are")} <strong>{tx("모델에 포함", "included in the model")}</strong>{tx("·미래엔", ", and in the future")} <strong>{tx("마지막 값 지속", "persist their last value")}</strong>{tx(". 종료는 N주로 지정(예: 12). 영구 구조변화는 비워두세요.", ". Specify an end as N weeks (e.g. 12). Leave permanent regime changes blank.")}
                          </p>
                        </>
                      ) : (
                        <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{tx("매핑된 이벤트·구조변화·휴일더미가 없습니다.", "No mapped events/regime changes/holiday dummies.")}</p>
                      )}
                    </div>
                  </div>

                  <details style={{ marginTop: "12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>{tx("미래 예측 상세 (기간별)", "Forecast detail (by period)")}</summary>
                    <div className="table-wrap" style={{ marginTop: "8px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead>
                          <tr><th>{tx("기간", "Period")}</th><th>{tx("예측", "Forecast")}</th><th>{tx("하한", "Lower")}</th><th>{tx("상한", "Upper")}</th>{forecast.chans.map((c) => (<th key={c.key}>{c.label}</th>))}</tr>
                        </thead>
                        <tbody>
                          {forecast.futLabels.map((lb, i) => (
                            <tr key={lb + i}>
                              <td>{lb}</td>
                              <td className="tnum">{fmtInt(forecast.predFut[i])}</td>
                              <td className="tnum">{fmtInt(forecast.lo[i])}</td>
                              <td className="tnum">{fmtInt(forecast.hi[i])}</td>
                              {forecast.chans.map((c) => (<td key={c.key} className="tnum">{fmtInt(forecast.futSpendByKey[c.key]?.[i])}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <div className="callout warn"><div className="ico">!</div><div className="body">
                  <strong>{tx("예측 불가", "Can't forecast")}</strong>
                  <p>{tx("MMM 모델이 적합되지 않았거나 데이터가 변수 수보다 적습니다. 기간을 늘리거나 채널을 줄이세요.", "The MMM model didn't fit, or the data has fewer rows than variables. Extend the period or reduce channels.")}</p>
                </div></div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
