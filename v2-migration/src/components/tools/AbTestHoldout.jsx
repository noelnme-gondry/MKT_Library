"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { STATS } from "@/utils/abTestMath";
import { CREATIVE_STATS } from "@/utils/creativeMath";
import CsvUploader from "@/components/CsvUploader";
import { getMappedRows } from "@/utils/dashboardAggregator";
import DataTable from "@/components/ds/DataTable";

const CURRENCY_SYMBOLS = { KRW: "₩", USD: "$" };

/* 5-4 전용 템플릿 CSV (DataFeatureMatrix는 효율 스키마라 부적합 → 자체 제공).
   BOM+CRLF (§7). 헤더 + 예시 1~N행. */
function downloadCsv(fileName, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function downloadAbTemplate() {
  const rows = [
    "arm_id,is_control,numerator,denominator",
    "Control,1,400,8000",
    "Variant A,0,496,8000",
    "Variant B,0,424,8000",
  ];
  downloadCsv("template_5-4_ab.csv", rows.join("\r\n") + "\r\n");
}

/* 통화 포맷 — index.html fmtCurrency 포팅 (통화 토글 반영) */
function fmtCurrency(value, currency) {
  if (value == null || !isFinite(value)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] || "₩";
  const digits = currency === "USD" ? 2 : 0;
  return sym + value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const isTruthy = (v) =>
  v === true || v === 1 || /^(1|true|yes|y)$/i.test(String(v ?? "").trim());

/* p-value 배지 (index.html tier-1/2/3 → 색상 span으로) */
function PvBadge({ p, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (!isFinite(p)) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  if (p < 0.01)
    return <span className="pill tier-1" style={{ color: "#22c55e" }}>p &lt; 0.01</span>;
  if (p < 0.05)
    return <span className="pill tier-2" style={{ color: "#22c55e" }}>p &lt; 0.05</span>;
  return <span className="pill tier-3" style={{ color: "var(--text-muted)" }}>{tr("p ≥ 0.05 (비유의)", "p ≥ 0.05 (not significant)")}</span>;
}

/* verdict 색: sig+ green / sig- red / non-sig gray */
function verdictColor(p, liftPositive) {
  if (!isFinite(p) || p >= 0.05) return "var(--text-muted)";
  return liftPositive ? "#22c55e" : "#ef4444";
}

export default function AbTestHoldout({ locale = "ko" } = {}) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [activeTab, setActiveTab] = useState("design");
  const [mode, setMode] = useState("plan");
  const [testType, setTestType] = useState("binary");
  // 전역 통화(design-system §1.2) — 이 도구엔 다른 토글 UI가 없어 여기 단독 배치.
  const currency = useAppStore((s) => s.displayCurrency);
  const setDisplayCurrency = useAppStore((s) => s.setDisplayCurrency);
  const { csvData } = useAppStore();

  const sym = CURRENCY_SYMBOLS[currency] || "₩";

  // ---- Plan mode inputs ----
  const [planBaseline, setPlanBaseline] = useState("5");
  const [planMde, setPlanMde] = useState("10");
  const [planMean, setPlanMean] = useState("3500");
  const [planSigma, setPlanSigma] = useState("1200");
  const [planAlpha, setPlanAlpha] = useState("0.05");
  const [planPower, setPlanPower] = useState("0.80");
  const [planCprA, setPlanCprA] = useState("2500");
  const [planCprB, setPlanCprB] = useState("");

  // ---- Analyze mode inputs ----
  const [anNa, setAnNa] = useState("10000");
  const [anXa, setAnXa] = useState("500");
  const [anNb, setAnNb] = useState("10000");
  const [anXb, setAnXb] = useState("560");
  const [ancNa, setAncNa] = useState("2000");
  const [ancMa, setAncMa] = useState("3500");
  const [ancSa, setAncSa] = useState("1200");
  const [ancNb, setAncNb] = useState("2000");
  const [ancMb, setAncMb] = useState("3850");
  const [ancSb, setAncSb] = useState("1250");

  // ---- Power curve inputs ----
  const [pcBaseline, setPcBaseline] = useState("5");
  const [pcAlpha, setPcAlpha] = useState("0.05");
  const [pcPower, setPcPower] = useState("0.80");

  const abChartRef = useRef(null);
  const powerChartRef = useRef(null);

  // ============================================================
  //  Plan mode compute (§2)
  // ============================================================
  const planResult = useMemo(() => {
    const alpha = num(planAlpha);
    const power = num(planPower);
    if (testType === "binary") {
      const baseline = num(planBaseline) / 100;
      const mde = num(planMde) / 100;
      if (!(baseline > 0) || !(mde > 0)) return null;
      const r = STATS.sampleSizePerArm({ baseline, mdeRelative: mde, alpha, power });
      if (!isFinite(r.n)) return { invalid: true };
      return { ...r, kind: "binary", totalN: r.n * 2 };
    }
    const mean = num(planMean);
    const mde = num(planMde) / 100;
    const sigma = num(planSigma);
    if (!(mean > 0) || !(mde > 0) || !(sigma > 0)) return null;
    const r = STATS.sampleSizeContinuous({
      baselineMean: mean,
      mdeRelative: mde,
      sigma,
      alpha,
      power,
    });
    if (!isFinite(r.n)) return { invalid: true };
    return { ...r, kind: "continuous", totalN: r.n * 2, mean, mde, cv: sigma / mean };
  }, [testType, planBaseline, planMde, planMean, planSigma, planAlpha, planPower]);

  const budgetResult = useMemo(() => {
    if (!planResult || planResult.invalid || !isFinite(planResult.n)) return null;
    const cprA = num(planCprA);
    if (!(cprA >= 0)) return null;
    const cprBraw = String(planCprB).trim();
    const cprB = cprBraw === "" ? null : num(cprBraw);
    return STATS.budgetForTest({ nPerArm: planResult.n, cprA, cprB });
  }, [planResult, planCprA, planCprB]);

  // ============================================================
  //  Analyze mode compute (§2)
  // ============================================================
  const analyzeBinary = useMemo(() => {
    if (mode !== "analyze" || testType !== "binary") return null;
    const nA = parseInt(anNa, 10);
    const xA = parseInt(anXa, 10);
    const nB = parseInt(anNb, 10);
    const xB = parseInt(anXb, 10);
    if (!nA || !nB || !(xA >= 0) || !(xB >= 0) || xA > nA || xB > nB)
      return { invalid: true };
    const freq = STATS.twoPropZTest(nA, xA, nB, xB);
    // bayesianAB uses Math.random internally (engine behavior — not touched here)
    const bayes = STATS.bayesianAB({ nA, xA, nB, xB, sims: 10000 });
    return { freq, bayes };
  }, [mode, testType, anNa, anXa, anNb, anXb]);

  const analyzeContinuous = useMemo(() => {
    if (mode !== "analyze" || testType !== "continuous") return null;
    const nA = parseInt(ancNa, 10);
    const mA = num(ancMa);
    const sA = num(ancSa);
    const nB = parseInt(ancNb, 10);
    const mB = num(ancMb);
    const sB = num(ancSb);
    if (!nA || !nB || !isFinite(mA) || !isFinite(mB) || sA < 0 || sB < 0)
      return { invalid: true };
    return { r: STATS.continuousTest(nA, mA, sA, nB, mB, sB), smallSample: nA < 30 || nB < 30 };
  }, [mode, testType, ancNa, ancMa, ancSa, ancNb, ancMb, ancSb]);

  // ============================================================
  //  Threshold mode matrix (§2 ③)
  // ============================================================
  const thresholdMatrix = useMemo(() => {
    if (testType === "binary") {
      const baselines = [0.01, 0.02, 0.05, 0.1, 0.2];
      const mdes = [0.05, 0.1, 0.15, 0.2, 0.3];
      const cells = baselines.map((b) =>
        mdes.map((m) => STATS.sampleSizePerArm({ baseline: b, mdeRelative: m }).n),
      );
      return { kind: "binary", baselines, mdes, cells };
    }
    const cvs = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0];
    const mdes = [0.05, 0.1, 0.15, 0.2, 0.3];
    const cells = cvs.map((cv) =>
      mdes.map(
        (m) =>
          STATS.sampleSizeContinuous({ baselineMean: 1, mdeRelative: m, sigma: cv }).n,
      ),
    );
    return { kind: "continuous", cvs, mdes, cells };
  }, [testType]);

  // ============================================================
  //  Readout aggregation (CSV) — 2-arm significance + optional mass
  // ============================================================
  const readoutData = useMemo(() => {
    // 매핑 적용 행(표준키) — 사용자가 임의 헤더를 매핑해도 엔진이 읽게. 데모/템플릿은
    // 헤더가 이미 표준키라 identity 매핑.
    const rows = getMappedRows(csvData);
    if (!rows || rows.length === 0) return null;

    // Detect an arm dimension for mass readout
    const hasArm = rows.some((r) => r?.arm_id != null && String(r.arm_id).trim() !== "");

    // 2-arm aggregation (control vs test) via is_control
    let cNum = 0, cDen = 0, tNum = 0, tDen = 0;
    rows.forEach((row) => {
      const isControl = isTruthy(row.is_control);
      const n = num(row.numerator) || 0;
      const d = num(row.denominator) || 0;
      if (isControl) { cNum += n; cDen += d; }
      else { tNum += n; tDen += d; }
    });

    const cRate = cDen > 0 ? (cNum / cDen) * 100 : 0;
    const tRate = tDen > 0 ? (tNum / tDen) * 100 : 0;

    let sig = null;
    if (cDen > 0 && tDen > 0) {
      sig = STATS.twoPropZTest(cDen, cNum, tDen, tNum);
    }

    // Mass readout: group by arm_id
    let mass = null;
    if (hasArm) {
      const armMap = new Map();
      rows.forEach((row) => {
        const name = String(row.arm_id).trim();
        if (!name) return;
        if (!armMap.has(name))
          armMap.set(name, { name, n: 0, x: 0, isControl: false });
        const a = armMap.get(name);
        a.x += num(row.numerator) || 0;
        a.n += num(row.denominator) || 0;
        if (isTruthy(row.is_control)) a.isControl = true;
      });
      const arms = [...armMap.values()].filter((a) => a.n > 0);
      if (arms.length >= 2) {
        if (!arms.some((a) => a.isControl)) arms[0].isControl = true;
        mass = STATS.massReadout(arms, CREATIVE_STATS);
      }
    }

    return {
      cNum, cDen, tNum, tDen, cRate, tRate, sig, mass,
    };
  }, [csvData]);

  // ============================================================
  //  Readout bar chart
  // ============================================================
  useEffect(() => {
    if (abChartRef.current) { abChartRef.current.destroy(); abChartRef.current = null; }
    if (activeTab !== "readout" || !readoutData) return;
    const ctx = document.getElementById("ab-bar");
    if (!ctx) return;
    abChartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Control", "Test"],
        datasets: [{
          label: tr("전환율 (%)", "Conversion rate (%)"),
          data: [readoutData.cRate, readoutData.tRate],
          backgroundColor: ["#fbbf24", "#22c55e"],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    return () => {
      if (abChartRef.current) { abChartRef.current.destroy(); abChartRef.current = null; }
    };
  }, [activeTab, readoutData, locale]);

  // ============================================================
  //  Power curve chart (§4)
  // ============================================================
  useEffect(() => {
    if (powerChartRef.current) { powerChartRef.current.destroy(); powerChartRef.current = null; }
    if (activeTab !== "design") return;
    const baseline = num(pcBaseline) / 100;
    if (!(baseline > 0) || baseline >= 1) return;
    const ctx = document.getElementById("ab-power-chart");
    if (!ctx) return;
    const curve = STATS.powerCurve({
      baseline,
      alpha: num(pcAlpha),
      power: num(pcPower),
    });
    const pts = curve.filter((p) => p.mdePct != null);
    powerChartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: `MDE (%) · ${tr("baseline", "baseline")} ${pcBaseline}%`,
          data: pts.map((p) => ({ x: p.n, y: p.mdePct })),
          borderColor: "#7aa2f7",
          backgroundColor: "rgba(122,162,247,0.12)",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              label: (c) =>
                `n=${Math.round(c.parsed.x).toLocaleString()} → MDE ${c.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: tr("표본 사이즈 (그룹당)", "Sample size (per arm)") },
          },
          y: { title: { display: true, text: "MDE (%)" } },
        },
      },
    });
    return () => {
      if (powerChartRef.current) { powerChartRef.current.destroy(); powerChartRef.current = null; }
    };
  }, [activeTab, mode, pcBaseline, pcAlpha, pcPower, locale]);

  return (
    <div className="tab-pane active" id="tab-ab">
      <div className="ab-tabs" style={{ marginBottom: "8px" }}>
        <button className={`ab-tab ${activeTab === "design" ? "active" : ""}`} onClick={() => setActiveTab("design")}>
          {tr("① 설계 · 얼마나 모아야 하나?", "① Design · How much data do I need?")}
        </button>
        <button className={`ab-tab ${activeTab === "readout" ? "active" : ""}`} onClick={() => setActiveTab("readout")}>
          {tr("② A/B 판독 · 어느 쪽이 이겼나?", "② A/B readout · Which side won?")}
        </button>
      </div>
      {/* 탭별 한 줄 평어 안내 (claude-ux §1 여정=질문) */}
      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 18px", lineHeight: 1.6 }}>
        {activeTab === "design" && tr("실험을 시작하기 전에 — 얼마나 많은 표본(사람 수)을 모아야 결과를 믿을 수 있는지 계산합니다.", "Before you launch the test — calculate how many samples (people) you need to trust the result.")}
        {activeTab === "readout" && tr("두 안(A vs B)을 모두 노출한 뒤 — 어느 쪽 전환율이 더 높고, 그 차이가 우연이 아닌지 판정합니다.", "After exposing both variants (A vs B) — determine which conversion rate is higher and whether the difference is more than chance.")}
      </p>
      {activeTab === "readout" && (
        <div className="callout" style={{ marginBottom: "16px" }}><div className="ico">i</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
          {tr(
            <><strong>광고가 없었어도 일어났을 전환(증분)</strong>을 보려면? → 왼쪽 메뉴 <strong>증분 분석</strong> 도구(홀드아웃·전후 비교)를 쓰세요. A/B는 &quot;둘 중 뭐가 나은가&quot;, 증분 분석은 &quot;광고를 한 것 자체가 값어치였나&quot;를 봅니다.</>,
            <>Want to see <strong>conversions that would have happened anyway (incrementality)</strong>? → Use the <strong>Incrementality Analysis</strong> tool in the left menu (holdout, before/after). A/B answers &quot;which one is better&quot;, incrementality answers &quot;was running the ad itself worth it&quot;.</>,
          )}
        </p></div></div>
      )}

      {activeTab === "design" && (
        <>
          <section className="block" id="s-mode">
            <h2 className="section-title"><span className="ix">§1</span>{tr("모드 선택", "Select mode")}</h2>
            <div className="ab-tabs">
              <button className={`ab-tab ${mode === "plan" ? "active" : ""}`} onClick={() => setMode("plan")}>{tr("① 모수 계산 (Plan)", "① Parameter calc (Plan)")}</button>
              <button className={`ab-tab ${mode === "analyze" ? "active" : ""}`} onClick={() => setMode("analyze")}>{tr("② 결과 분석 (Analyze)", "② Result analysis (Analyze)")}</button>
              <button className={`ab-tab ${mode === "threshold" ? "active" : ""}`} onClick={() => setMode("threshold")}>{tr("③ 신뢰수준 가이드", "③ Confidence level guide")}</button>
            </div>

            <div className="ab-pillgroup" style={{ marginTop: "10px" }}>
              <span className="ab-pillgroup-label">{tr("테스트 유형", "Test type")}</span>
              <button className={`ab-pill ${testType === "binary" ? "active" : ""}`} onClick={() => setTestType("binary")}>{tr("Binary · CVR (전환율)", "Binary · CVR (conversion rate)")}</button>
              <button className={`ab-pill ${testType === "continuous" ? "active" : ""}`} onClick={() => setTestType("continuous")}>Continuous · CPR / ARPPU / Revenue</button>
            </div>

            {/* 이 도구는 CSV 없이 수동 계산이라 효율 패밀리의 "토글 기준" 필터줄이
                없음 — 통화 표시가 실제 쓰이는(§2 예산·평균값) 이 자리에 단독 토글.
                다른 페이지와 달리 중복 아님(이 페이지엔 이거 하나뿐). */}
            <div className="ab-pillgroup" style={{ marginTop: "10px" }}>
              <span className="ab-pillgroup-label">{tr("통화", "Currency")}</span>
              <button className={`ab-pill ${currency === "KRW" ? "active" : ""}`} onClick={() => setDisplayCurrency("KRW")}>₩ KRW</button>
              <button className={`ab-pill ${currency === "USD" ? "active" : ""}`} onClick={() => setDisplayCurrency("USD")}>$ USD</button>
            </div>

          </section>

          <section className="block" id="s-body">
            {/* ===== Plan mode ===== */}
            {mode === "plan" && (
              <div>
                <h2 className="section-title"><span className="ix">§2</span>{tr("① 테스트 시작 전 모수 계산", "① Parameter calc before launching the test")}</h2>
                <p style={{ color: "var(--text-secondary)" }}>
                  {testType === "binary"
                    ? tr("현재 전환율과 탐지하고 싶은 최소 lift(MDE)를 입력하면, 그룹당 필요한 샘플 사이즈가 계산됩니다.", "Enter the current conversion rate and the minimum lift (MDE) you want to detect, and the required sample size per arm is calculated.")
                    : tr("현재 평균값(μ), MDE, 과거 표준편차(σ)를 입력하면 연속 데이터(CPR, ARPPU, Revenue) 테스트에 필요한 샘플 사이즈가 계산됩니다.", "Enter the current mean (μ), MDE, and historical standard deviation (σ) to calculate the sample size needed for a continuous-data test (CPR, ARPPU, Revenue).")}
                </p>
                <div className="ab-form-grid">
                  {testType === "binary" ? (
                    <>
                      <div className="ab-field">
                        <label>{tr("현재 전환율 (%) · baseline", "Current conversion rate (%) · baseline")}</label>
                        <input type="number" step="0.01" min="0.01" max="99.99" value={planBaseline} onChange={(e) => setPlanBaseline(e.target.value)} />
                        <span className="ab-field-hint">{tr("예: 5% = 5", "e.g. 5% = 5")}</span>
                      </div>
                      <div className="ab-field">
                        <label>{tr("탐지할 최소 lift (%) · MDE (relative)", "Minimum lift to detect (%) · MDE (relative)")}</label>
                        <input type="number" step="0.1" min="0.1" max="500" value={planMde} onChange={(e) => setPlanMde(e.target.value)} />
                        <span className="ab-field-hint">{tr("예: baseline 대비 10% 상승 = 10", "e.g. a 10% rise over baseline = 10")}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ab-field">
                        <label>{tr("현재 평균값 (μ) · baseline mean", "Current mean (μ) · baseline mean")}</label>
                        <input type="number" step="0.01" min="0" value={planMean} onChange={(e) => setPlanMean(e.target.value)} />
                        <span className="ab-field-hint">{tr(`예: ARPPU ${sym}3,500 / 평균 CPR ${sym}2,800`, `e.g. ARPPU ${sym}3,500 / average CPR ${sym}2,800`)}</span>
                      </div>
                      <div className="ab-field">
                        <label>{tr("탐지할 최소 lift (%) · MDE (relative)", "Minimum lift to detect (%) · MDE (relative)")}</label>
                        <input type="number" step="0.1" min="0.1" max="500" value={planMde} onChange={(e) => setPlanMde(e.target.value)} />
                        <span className="ab-field-hint">{tr("μ 대비 10% 변동 = 10", "a 10% change over μ = 10")}</span>
                      </div>
                      <div className="ab-field">
                        <label>{tr("표준편차 (σ) · 과거 데이터", "Standard deviation (σ) · historical data")}</label>
                        <input type="number" step="0.01" min="0.01" value={planSigma} onChange={(e) => setPlanSigma(e.target.value)} />
                        <span className="ab-field-hint">{tr("σ가 클수록 더 많은 샘플 필요", "Larger σ needs more samples")}</span>
                      </div>
                    </>
                  )}
                  <div className="ab-field">
                    <label>{tr("유의수준 α", "Significance level α")}</label>
                    <select value={planAlpha} onChange={(e) => setPlanAlpha(e.target.value)}>
                      <option value="0.10">{tr("0.10 (90% 신뢰)", "0.10 (90% confidence)")}</option>
                      <option value="0.05">{tr("0.05 (95% 신뢰)", "0.05 (95% confidence)")}</option>
                      <option value="0.01">{tr("0.01 (99% 신뢰)", "0.01 (99% confidence)")}</option>
                    </select>
                  </div>
                  <div className="ab-field">
                    <label>{tr("검정력 (Power)", "Statistical power")}</label>
                    <select value={planPower} onChange={(e) => setPlanPower(e.target.value)}>
                      <option value="0.70">0.70</option>
                      <option value="0.80">0.80</option>
                      <option value="0.90">0.90</option>
                    </select>
                  </div>
                </div>

                <div className="ab-result" id="ab-plan-result">
                  {!planResult ? (
                    <div className="ab-field-hint" style={{ color: "var(--text-muted)" }}>{tr("입력값을 채우면 샘플 사이즈가 계산됩니다.", "Fill in the inputs to calculate sample size.")}</div>
                  ) : planResult.invalid ? (
                    <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("입력값 확인 필요", "Please check your inputs")}</strong><p>{testType === "binary" ? tr("baseline × (1 + MDE) 가 1을 초과하거나 음수입니다.", "baseline × (1 + MDE) exceeds 1 or is negative.") : tr("mean·MDE·σ가 모두 양수여야 합니다.", "mean, MDE, and σ must all be positive.")}</p></div></div>
                  ) : (
                    <>
                      <div className="ab-stats-grid">
                        <div className="ab-stat"><div className="ab-stat-label">{tr("그룹당 필요 샘플", "Required samples per arm")}</div><div className="ab-stat-value tnum">{planResult.n.toLocaleString()}</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("2그룹 합산", "Combined (2 arms)")}</div><div className="ab-stat-value tnum">{planResult.totalN.toLocaleString()}</div></div>
                        {planResult.kind === "binary" ? (
                          <div className="ab-stat"><div className="ab-stat-label">{tr("기대 전환율 A → B", "Expected conversion rate A → B")}</div><div className="ab-stat-value tnum">{(planResult.p1 * 100).toFixed(2)}% → {(planResult.p2 * 100).toFixed(2)}%</div></div>
                        ) : (
                          <>
                            <div className="ab-stat"><div className="ab-stat-label">{tr("기대 평균 A → B", "Expected mean A → B")}</div><div className="ab-stat-value tnum">{fmtCurrency(planResult.mean, currency)} → {fmtCurrency(planResult.mean * (1 + planResult.mde), currency)}</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">{tr("변동계수 (CV = σ/μ)", "Coefficient of variation (CV = σ/μ)")}</div><div className="ab-stat-value tnum">{planResult.cv.toFixed(3)}</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">{tr("절대 효과 (δ)", "Absolute effect (δ)")}</div><div className="ab-stat-value tnum">{fmtCurrency(planResult.delta, currency)}</div></div>
                          </>
                        )}
                        <div className="ab-stat"><div className="ab-stat-label">z_α/2 + z_β</div><div className="ab-stat-value tnum">{planResult.zA.toFixed(3)} + {planResult.zB.toFixed(3)}</div></div>
                      </div>
                      <p style={{ marginTop: "0.75rem", fontSize: "13px", color: "var(--text-secondary)" }}>
                        {tr(
                          <>일평균 트래픽이 5,000명이면 약 <strong>{Math.ceil(planResult.totalN / 5000)}일</strong>, 10,000명이면 약 <strong>{Math.ceil(planResult.totalN / 10000)}일</strong>의 운영이 필요합니다.</>,
                          <>At 5,000 people/day of average traffic, you&apos;ll need about <strong>{Math.ceil(planResult.totalN / 5000)} days</strong>; at 10,000/day, about <strong>{Math.ceil(planResult.totalN / 10000)} days</strong>.</>,
                        )}
                      </p>
                    </>
                  )}
                </div>

                <h3 className="sub-title" style={{ marginTop: "1.5rem" }}>{tr("예산 계산기", "Budget calculator")}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  {tr("예상 CPR(Cost Per Result)을 입력하면, 위 샘플 사이즈 기준 필요한 총 예산이 계산됩니다. CPR_B를 비우면 A와 동일하다고 가정합니다.", "Enter the expected CPR (Cost Per Result) to calculate the total budget needed for the sample size above. Leaving CPR_B blank assumes it equals A.")}
                </p>
                <div className="ab-form-grid">
                  <div className="ab-field">
                    <label>{tr(`예상 CPR · Arm A (${sym})`, `Expected CPR · Arm A (${sym})`)}</label>
                    <input type="number" step="1" min="0" value={planCprA} onChange={(e) => setPlanCprA(e.target.value)} />
                    <span className="ab-field-hint">{tr("전환 1건당 비용", "Cost per conversion")}</span>
                  </div>
                  <div className="ab-field">
                    <label>{tr(`예상 CPR · Arm B (${sym}, 선택)`, `Expected CPR · Arm B (${sym}, optional)`)}</label>
                    <input type="number" step="1" min="0" placeholder={tr("비우면 A와 동일", "Leave blank to match A")} value={planCprB} onChange={(e) => setPlanCprB(e.target.value)} />
                    <span className="ab-field-hint">{tr("CPR이 다른 변형 운영 시", "When the variant has a different CPR")}</span>
                  </div>
                </div>
                <div className="ab-result" id="ab-plan-budget-result">
                  {!budgetResult ? (
                    <div className="ab-field-hint" style={{ color: "var(--text-muted)" }}>{tr("CPR A 입력 시 예산이 계산됩니다.", "Enter CPR A to calculate the budget.")}</div>
                  ) : (
                    <>
                      <div className="ab-stats-grid">
                        <div className="ab-stat"><div className="ab-stat-label">{tr("Arm A 예산", "Arm A budget")}</div><div className="ab-stat-value tnum">{fmtCurrency(budgetResult.costA, currency)}</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("Arm B 예산", "Arm B budget")}</div><div className="ab-stat-value tnum">{fmtCurrency(budgetResult.costB, currency)}</div></div>
                        <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("총 필요 예산", "Total budget needed")}</div><div className="ab-stat-value tnum">{fmtCurrency(budgetResult.total, currency)}</div></div>
                      </div>
                      <p style={{ marginTop: "0.5rem", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        CPR A = {fmtCurrency(budgetResult.cprA, currency)} · CPR B = {fmtCurrency(budgetResult.cprB, currency)} · n_per_arm = {planResult.n.toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ===== Analyze mode ===== */}
            {mode === "analyze" && testType === "binary" && (
              <div>
                <h2 className="section-title"><span className="ix">§2</span>{tr("② Binary (CVR) 결과 분석", "② Binary (CVR) result analysis")}</h2>
                <p style={{ color: "var(--text-secondary)" }}>{tr("각 그룹의 노출 수와 전환 수를 입력하면 Frequentist(z-test)와 Bayesian 결과를 동시에 보여줍니다.", "Enter each arm's exposure count and conversion count to see Frequentist (z-test) and Bayesian results side by side.")}</p>
                <div className="ab-form-grid ab-form-grid-2col">
                  <div>
                    <div className="ab-arm-title">Arm A · Control</div>
                    <div className="ab-field"><label>{tr("노출 수 (n_A)", "Exposures (n_A)")}</label><input type="number" min="1" value={anNa} onChange={(e) => setAnNa(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("전환 수 (x_A)", "Conversions (x_A)")}</label><input type="number" min="0" value={anXa} onChange={(e) => setAnXa(e.target.value)} /></div>
                  </div>
                  <div>
                    <div className="ab-arm-title">Arm B · Variant</div>
                    <div className="ab-field"><label>{tr("노출 수 (n_B)", "Exposures (n_B)")}</label><input type="number" min="1" value={anNb} onChange={(e) => setAnNb(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("전환 수 (x_B)", "Conversions (x_B)")}</label><input type="number" min="0" value={anXb} onChange={(e) => setAnXb(e.target.value)} /></div>
                  </div>
                </div>
                <div className="ab-result" id="ab-an-result">
                  {!analyzeBinary ? null : analyzeBinary.invalid ? (
                    <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("입력값 확인 필요", "Please check your inputs")}</strong><p>{tr("각 그룹 노출 수는 1 이상, 전환 수는 0 ~ 노출 수 범위여야 합니다.", "Each arm's exposure count must be 1 or more, and conversions must be between 0 and the exposure count.")}</p></div></div>
                  ) : (() => {
                    const { freq, bayes } = analyzeBinary;
                    const liftPositive = freq.liftRel >= 0;
                    const winner = bayes.probBWins >= 0.95 ? tr("B 우세 (강한 증거)", "B wins (strong evidence)") : bayes.probBWins >= 0.8 ? tr("B 우세 (보통 증거)", "B wins (moderate evidence)") : bayes.probBWins >= 0.5 ? tr("약한 B 우세", "Weak B lean") : bayes.probBWins >= 0.2 ? tr("약한 A 우세", "Weak A lean") : tr("A 우세 (강한 증거)", "A wins (strong evidence)");
                    return (
                      <div className="ab-result-split">
                        <div className="ab-result-block">
                          <div className="ab-result-block-title">Frequentist · z-test</div>
                          <div className="ab-stats-grid">
                            <div className="ab-stat"><div className="ab-stat-label">{tr("전환율 A / B", "Conversion rate A / B")}</div><div className="ab-stat-value tnum">{(freq.pA * 100).toFixed(2)}% / {(freq.pB * 100).toFixed(2)}%</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">{tr("상대 Lift", "Relative lift")}</div><div className="ab-stat-value tnum" style={{ color: liftPositive ? undefined : "#ef4444" }}>{(freq.liftRel * 100).toFixed(2)}%</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">z-score</div><div className="ab-stat-value tnum">{freq.z.toFixed(3)}</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">p-value</div><div className="ab-stat-value tnum">{freq.pValue.toFixed(4)} <PvBadge p={freq.pValue} locale={locale} /></div></div>
                            <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("절대 차이 95% CI", "Absolute difference 95% CI")}</div><div className="ab-stat-value tnum">[ {(freq.ciLow95 * 100).toFixed(2)}% , {(freq.ciHigh95 * 100).toFixed(2)}% ]</div></div>
                            <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("판정", "Verdict")}</div><div className="ab-stat-value" style={{ color: verdictColor(freq.pValue, liftPositive), fontWeight: 700 }}>{freq.pValue < 0.05 ? (liftPositive ? tr("유의미한 개선 (Ship)", "Significant improvement (Ship)") : tr("유의미한 악화 (Kill)", "Significant decline (Kill)")) : tr("비유의 (Inconclusive)", "Not significant (Inconclusive)")}</div></div>
                          </div>
                        </div>
                        <div className="ab-result-block">
                          <div className="ab-result-block-title">Bayesian · Beta-Binomial</div>
                          <div className="ab-stats-grid">
                            <div className="ab-stat"><div className="ab-stat-label">P(B &gt; A)</div><div className="ab-stat-value tnum">{(bayes.probBWins * 100).toFixed(2)}%</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">{tr("기대 Lift", "Expected lift")}</div><div className="ab-stat-value tnum">{(bayes.expectedLift * 100).toFixed(2)}%</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">A 95% CI</div><div className="ab-stat-value tnum">[ {(bayes.ciA[0] * 100).toFixed(2)} , {(bayes.ciA[1] * 100).toFixed(2)} ]</div></div>
                            <div className="ab-stat"><div className="ab-stat-label">B 95% CI</div><div className="ab-stat-value tnum">[ {(bayes.ciB[0] * 100).toFixed(2)} , {(bayes.ciB[1] * 100).toFixed(2)} ]</div></div>
                            <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("의사결정 권고", "Recommended decision")}</div><div className="ab-stat-value">{winner}</div></div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {mode === "analyze" && testType === "continuous" && (
              <div>
                <h2 className="section-title"><span className="ix">§2</span>{tr("② Continuous (CPR/ARPPU/Revenue) 결과 분석", "② Continuous (CPR/ARPPU/Revenue) result analysis")}</h2>
                <p style={{ color: "var(--text-secondary)" }}>{tr("각 그룹의 표본 수(n), 평균(mean), 표준편차(sd)를 입력하면 Welch 근사 기반으로 평균 차이의 유의성을 검정합니다.", "Enter each arm's sample size (n), mean, and standard deviation (sd) to test the significance of the mean difference using the Welch approximation.")}</p>
                <div className="ab-form-grid ab-form-grid-2col">
                  <div>
                    <div className="ab-arm-title">Arm A · Control</div>
                    <div className="ab-field"><label>{tr("표본 수 (n_A)", "Sample size (n_A)")}</label><input type="number" min="1" value={ancNa} onChange={(e) => setAncNa(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("평균 (μ_A)", "Mean (μ_A)")}</label><input type="number" step="0.01" value={ancMa} onChange={(e) => setAncMa(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("표준편차 (s_A)", "Standard deviation (s_A)")}</label><input type="number" step="0.01" min="0" value={ancSa} onChange={(e) => setAncSa(e.target.value)} /></div>
                  </div>
                  <div>
                    <div className="ab-arm-title">Arm B · Variant</div>
                    <div className="ab-field"><label>{tr("표본 수 (n_B)", "Sample size (n_B)")}</label><input type="number" min="1" value={ancNb} onChange={(e) => setAncNb(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("평균 (μ_B)", "Mean (μ_B)")}</label><input type="number" step="0.01" value={ancMb} onChange={(e) => setAncMb(e.target.value)} /></div>
                    <div className="ab-field"><label>{tr("표준편차 (s_B)", "Standard deviation (s_B)")}</label><input type="number" step="0.01" min="0" value={ancSb} onChange={(e) => setAncSb(e.target.value)} /></div>
                  </div>
                </div>
                <div className="ab-result" id="ab-anc-result">
                  {!analyzeContinuous ? null : analyzeContinuous.invalid ? (
                    <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("입력값 확인 필요", "Please check your inputs")}</strong><p>{tr("n ≥ 1, mean / sd는 숫자, sd ≥ 0 이어야 합니다.", "n must be ≥ 1, mean/sd must be numeric, and sd must be ≥ 0.")}</p></div></div>
                  ) : (() => {
                    const { r, smallSample } = analyzeContinuous;
                    const liftPositive = r.liftRel >= 0;
                    return (
                      <>
                        {smallSample && (
                          <div className="callout warn" style={{ marginBottom: "0.75rem" }}><div className="ico">!</div><div className="body"><strong>{tr("샘플 크기가 작습니다 (n < 30)", "Sample size is small (n < 30)")}</strong><p>{tr("근사 신뢰성 낮음. 표본을 더 모으거나 t-분포 기반 검정을 권장합니다.", "The approximation is less reliable. Consider collecting more samples or using a t-distribution based test.")}</p></div></div>
                        )}
                        <div className="ab-result-split">
                          <div className="ab-result-block" style={{ gridColumn: "1 / -1" }}>
                            <div className="ab-result-block-title">{tr("Welch 근사 · 평균 비교", "Welch approximation · mean comparison")}</div>
                            <div className="ab-stats-grid">
                              <div className="ab-stat"><div className="ab-stat-label">{tr("평균 A / B", "Mean A / B")}</div><div className="ab-stat-value tnum">{fmtCurrency(r.meanA, currency)} / {fmtCurrency(r.meanB, currency)}</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">{tr("표준편차 A / B", "Standard deviation A / B")}</div><div className="ab-stat-value tnum">{fmtCurrency(r.sdA, currency)} / {fmtCurrency(r.sdB, currency)}</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">{tr("절대 차이 (B - A)", "Absolute difference (B - A)")}</div><div className="ab-stat-value tnum" style={{ color: liftPositive ? undefined : "#ef4444" }}>{fmtCurrency(r.liftAbs, currency)}</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">{tr("상대 Lift", "Relative lift")}</div><div className="ab-stat-value tnum" style={{ color: liftPositive ? undefined : "#ef4444" }}>{(r.liftRel * 100).toFixed(2)}%</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">t-score</div><div className="ab-stat-value tnum">{r.z.toFixed(3)}</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">p-value</div><div className="ab-stat-value tnum">{r.pValue.toFixed(4)} <PvBadge p={r.pValue} locale={locale} /></div></div>
                              <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("평균차 95% CI", "Mean difference 95% CI")}</div><div className="ab-stat-value tnum">[ {fmtCurrency(r.ciLow95, currency)} , {fmtCurrency(r.ciHigh95, currency)} ]</div></div>
                              <div className="ab-stat"><div className="ab-stat-label">Welch-Satterthwaite df</div><div className="ab-stat-value tnum">{r.df.toFixed(1)}</div></div>
                              <div className="ab-stat" style={{ gridColumn: "1 / -1" }}><div className="ab-stat-label">{tr("판정", "Verdict")}</div><div className="ab-stat-value" style={{ color: verdictColor(r.pValue, liftPositive), fontWeight: 700 }}>{r.pValue < 0.05 ? (liftPositive ? tr("유의미한 개선", "Significant improvement") : tr("유의미한 악화", "Significant decline")) : tr("비유의 (Inconclusive)", "Not significant (Inconclusive)")}</div></div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ===== Threshold mode ===== */}
            {mode === "threshold" && (
              <div>
                <h2 className="section-title"><span className="ix">§2</span>{tr("③ 모수 크기별 추천 신뢰수준 가이드", "③ Recommended confidence level guide by parameter size")}</h2>
                <p style={{ color: "var(--text-secondary)" }}>
                  {tr(
                    <>α = 0.05, Power = 0.80 기준 그룹당 필요 샘플 사이즈 매트릭스 ({thresholdMatrix.kind === "binary" ? "Binary · CVR" : "Continuous · CV = σ/μ 사용, baseline 값에 무관"}). 일평균 트래픽으로 나누면 테스트 기간 산정 가능.</>,
                    <>Required sample size per arm at α = 0.05, Power = 0.80 ({thresholdMatrix.kind === "binary" ? "Binary · CVR" : "Continuous · uses CV = σ/μ, independent of the baseline value"}). Divide by average daily traffic to estimate test duration.</>,
                  )}
                </p>
                <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{thresholdMatrix.kind === "binary" ? "Baseline CVR ↓ \\ MDE →" : "CV (σ/μ) ↓ \\ MDE →"}</th>
                        {thresholdMatrix.mdes.map((m) => <th key={m}>{(m * 100).toFixed(0)}%</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(thresholdMatrix.kind === "binary" ? thresholdMatrix.baselines : thresholdMatrix.cvs).map((rowKey, i) => (
                        <tr key={rowKey}>
                          <td><strong>{thresholdMatrix.kind === "binary" ? `${(rowKey * 100).toFixed(0)}%` : rowKey.toFixed(2)}</strong></td>
                          {thresholdMatrix.cells[i].map((n, j) => <td key={j} className="tnum">{isFinite(n) ? n.toLocaleString() : "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {thresholdMatrix.kind === "continuous" && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                    {tr(
                      <>예시: ARPPU 평균 {sym}3,500, σ {sym}1,200 → CV ≈ 0.34 → MDE 10% 탐지에 그룹당 약 {STATS.sampleSizeContinuous({ baselineMean: 1, mdeRelative: 0.1, sigma: 0.34 }).n.toLocaleString()}명 필요.</>,
                      <>Example: ARPPU average {sym}3,500, σ {sym}1,200 → CV ≈ 0.34 → detecting a 10% MDE needs about {STATS.sampleSizeContinuous({ baselineMean: 1, mdeRelative: 0.1, sigma: 0.34 }).n.toLocaleString()} per arm.</>,
                    )}
                  </p>
                )}
                <h3 className="sub-title">{tr("권장 사항", "Recommendations")}</h3>
                <ul>
                  <li><strong>{tr("샘플 부족 (그룹당 1,000 미만)", "Insufficient sample (under 1,000 per arm)")}</strong> → {tr("검정 신뢰성 낮음. MDE 상향 또는 기간 연장", "Low test reliability. Raise the MDE or extend the duration")}</li>
                  <li><strong>{tr("샘플 충분 (10,000+)", "Sufficient sample (10,000+)")}</strong> → {tr("α=0.05, Power=0.80 표준. 엄격한 결정엔 α=0.01", "α=0.05, Power=0.80 is standard. Use α=0.01 for stricter decisions")}</li>
                  <li><strong>{tr("매우 큰 샘플 (100,000+)", "Very large sample (100,000+)")}</strong> → {tr("작은 차이도 유의. 실질적 의미(practical significance) 별도 판단", "Even tiny differences become significant. Judge practical significance separately")}</li>
                  <li><strong>{tr("멀티 변형 (A/B/C/D…)", "Multiple variants (A/B/C/D…)")}</strong> → {tr("Bonferroni 보정: α를 변형 수로 나눔", "Bonferroni correction: divide α by the number of variants")}</li>
                  <li><strong>{tr("조기 종료(peeking) 금지", "No early stopping (peeking)")}</strong> → {tr("사전 계산 샘플 도달 전 중단 시 1종 오류율 폭증", "Stopping before reaching the pre-calculated sample size inflates the Type I error rate")}</li>
                  {thresholdMatrix.kind === "continuous" && <li><strong>{tr("연속 데이터 σ 추정", "Estimating σ for continuous data")}</strong> → {tr("과거 동일 지표의 표준편차 사용. 없으면 1주 파일럿으로 추정", "Use the standard deviation from the same historical metric. If unavailable, estimate with a 1-week pilot")}</li>}
                </ul>
              </div>
            )}
          </section>

          <section className="block" id="s-powercurve">
            <h2 className="section-title"><span className="ix">§3</span>{tr("MDE vs Sample Size 파워 커브", "MDE vs Sample Size power curve")}</h2>
            <p style={{ color: "var(--text-secondary)" }}>{tr("표본 수(그룹당)가 커질수록 통계적으로 탐지 가능한 최소 효과 크기(MDE)가 줄어듭니다. baseline 전환율이 낮을수록 더 많은 표본이 필요합니다.", "As the sample size (per arm) grows, the minimum detectable effect (MDE) shrinks. A lower baseline conversion rate needs more samples.")}</p>
            <div className="ab-form-grid">
              <div className="ab-field">
                <label>{tr("현재 전환율 (%) · baseline", "Current conversion rate (%) · baseline")}</label>
                <input type="number" step="0.01" min="0.01" max="99.99" value={pcBaseline} onChange={(e) => setPcBaseline(e.target.value)} />
              </div>
              <div className="ab-field">
                <label>{tr("유의수준 α", "Significance level α")}</label>
                <select value={pcAlpha} onChange={(e) => setPcAlpha(e.target.value)}>
                  <option value="0.10">{tr("0.10 (90% 신뢰)", "0.10 (90% confidence)")}</option>
                  <option value="0.05">{tr("0.05 (95% 신뢰)", "0.05 (95% confidence)")}</option>
                  <option value="0.01">{tr("0.01 (99% 신뢰)", "0.01 (99% confidence)")}</option>
                </select>
              </div>
              <div className="ab-field">
                <label>{tr("검정력 (Power)", "Statistical power")}</label>
                <select value={pcPower} onChange={(e) => setPcPower(e.target.value)}>
                  <option value="0.70">0.70</option>
                  <option value="0.80">0.80</option>
                  <option value="0.90">0.90</option>
                </select>
              </div>
            </div>
            <div className="chart-container" style={{ height: "340px" }}>
              <canvas id="ab-power-chart"></canvas>
            </div>
          </section>

          <section className="block" id="s-notes">
            <h2 className="section-title"><span className="ix">§4</span>{tr("통계 노트", "Statistical notes")}</h2>
            <ul>
              <li><strong>Binary (CVR) · z-test</strong>: <code className="inline">z = (p̂_B - p̂_A) / √(p̄(1-p̄)(1/n_A + 1/n_B))</code>. {tr("p-value < α 시 귀무가설 기각.", "Reject the null hypothesis when p-value < α.")}</li>
              <li><strong>Binary · Sample Size</strong>: <code className="inline">n = 2 × (z_α/2 + z_β)² × p̄(1-p̄) / δ²</code></li>
              <li><strong>Continuous · Welch</strong>: <code className="inline">z = (μ̂_B - μ̂_A) / √(s_A²/n_A + s_B²/n_B)</code>. {tr("n > 30 per arm일 때 정확.", "Accurate when n > 30 per arm.")}</li>
              <li><strong>Bayesian</strong>: {tr("Binary 전용. 사전 Beta(1,1). 사후 Beta(1+x, 1+n-x). Monte Carlo 10,000 sim.", "Binary only. Prior Beta(1,1). Posterior Beta(1+x, 1+n-x). Monte Carlo, 10,000 sims.")}</li>
              <li><strong>{tr("예산 계산", "Budget calculation")}</strong>: <code className="inline">Total Budget = n_per_arm × (CPR_A + CPR_B)</code>.</li>
              <li><strong>{tr("파워 커브", "Power curve")}</strong>: {tr("sample size 기준으로 역산(이분 탐색)하여 탐지 가능한 최소 MDE 도출.", "Derived by inverting sample size (binary search) to find the minimum detectable MDE.")}</li>
            </ul>
          </section>
        </>
      )}

      {activeTab === "readout" && (
        <>
          <section className="block" id="s-prep">
            <h2 className="section-title">{tr("데이터 준비", "Data setup")}</h2>
            {!readoutData ? (
              <div className="callout warning">
                <div className="ico">!</div>
                <div className="body">
                  <strong>{tr("실험 결과 CSV 업로드 대기", "Waiting for experiment result CSV upload")}</strong>
                  <p style={{ margin: "2px 0 6px" }}>{tr(
                    <>그룹별 1행. <strong>필수</strong>: 대조군 여부(is_control) · 전환수(numerator) · 그룹 인원(denominator). <strong>옵션</strong>: 변형 그룹(arm_id)이 있으면 Variant A/B/C… 대량검정.</>,
                    <>One row per arm. <strong>Required</strong>: control flag (is_control) · conversions (numerator) · arm size (denominator). <strong>Optional</strong>: with a variant column (arm_id), run mass tests across Variant A/B/C…</>,
                  )}</p>
                  <div style={{ margin: "6px 0 4px" }}>
                    <button className="ab-pill" onClick={downloadAbTemplate}>{tr("⬇ A/B 템플릿 CSV (예시 포함)", "⬇ A/B template CSV (with examples)")}</button>
                  </div>
                  <div style={{ marginTop: "1rem" }}><CsvUploader toolId="5-4" showMatrix={false} locale={locale} /></div>
                </div>
              </div>
            ) : (
              <div className="callout"><div className="ico">i</div><div className="body"><p style={{ margin: 0 }}>{csvData?.fileName ? <strong>{csvData.fileName}</strong> : tr("업로드된 데이터", "Uploaded data")} · {tr(`${csvData?.raw?.length?.toLocaleString?.()}행`, `${csvData?.raw?.length?.toLocaleString?.()} rows`)}. {tr("Control/Test 집계 후 two-proportion z-test로 유의성 검정.", "Aggregates Control/Test then tests significance with a two-proportion z-test.")}</p></div></div>
            )}
          </section>

          {readoutData && (
            <>
              <section className="block" id="s-readout-sig">
                <h2 className="section-title">{tr("유의성 검정 (Control vs Test)", "Significance test (Control vs Test)")}</h2>
                {readoutData.sig ? (() => {
                  const s = readoutData.sig;
                  const liftPositive = s.liftRel >= 0;
                  return (
                    <div className="alloc-card" style={{ borderLeft: `3px solid ${verdictColor(s.pValue, liftPositive)}` }}>
                      <div className="ab-stat-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("Control 전환율", "Control conversion rate")}</div><div className="ab-stat-value tnum">{readoutData.cRate.toFixed(2)}%</div><div className="ab-stat-hint">{readoutData.cNum.toLocaleString()}/{readoutData.cDen.toLocaleString()}</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("Test 전환율", "Test conversion rate")}</div><div className="ab-stat-value tnum">{readoutData.tRate.toFixed(2)}%</div><div className="ab-stat-hint">{readoutData.tNum.toLocaleString()}/{readoutData.tDen.toLocaleString()}</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("상대 Lift", "Relative lift")}</div><div className="ab-stat-value tnum" style={{ color: liftPositive ? undefined : "#ef4444" }}>{(s.liftRel * 100).toFixed(2)}%</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">z-score</div><div className="ab-stat-value tnum">{s.z.toFixed(3)}</div></div>
                        <div className="ab-stat"><div className="ab-stat-label">p-value</div><div className="ab-stat-value tnum">{s.pValue.toFixed(4)} <PvBadge p={s.pValue} locale={locale} /></div></div>
                        <div className="ab-stat"><div className="ab-stat-label">{tr("절대차 95% CI", "Absolute difference 95% CI")}</div><div className="ab-stat-value tnum">[ {(s.ciLow95 * 100).toFixed(2)}% , {(s.ciHigh95 * 100).toFixed(2)}% ]</div></div>
                      </div>
                      <div style={{ marginTop: "12px", fontWeight: 700, color: verdictColor(s.pValue, liftPositive) }}>
                        {s.pValue < 0.05 ? (liftPositive ? tr("✓ 유의미한 개선 (Ship 후보)", "✓ Significant improvement (Ship candidate)") : tr("✗ 유의미한 악화 (Kill)", "✗ Significant decline (Kill)")) : tr("— 비유의 (Inconclusive — 더 많은 데이터 필요)", "— Not significant (Inconclusive — need more data)")}
                      </div>
                      <div className="callout" style={{ marginTop: "10px" }}><div className="ico">💡</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
                        {tr(
                          <><strong>쉽게 말하면:</strong> Test안이 Control보다 전환율이 <strong>{s.liftRel >= 0 ? "+" : ""}{(s.liftRel * 100).toFixed(1)}%</strong> {s.liftRel >= 0 ? "높습니다" : "낮습니다"}.
                          {" "}<strong>p-value {s.pValue.toFixed(4)}</strong> = 이 차이가 순전히 우연일 확률 {(s.pValue * 100).toFixed(2)}%.
                          {s.pValue < 0.05 ? " 0.05(5%)보다 작으니, 우연이 아닌 진짜 차이로 볼 수 있어요." : " 0.05(5%)보다 크니 아직 우연일 수 있어요 — 표본을 더 모으세요."}
                          {" "}괄호 안 z·CI는 통계 원값(전문가용)입니다.</>,
                          <><strong>In plain terms:</strong> Test&apos;s conversion rate is <strong>{s.liftRel >= 0 ? "+" : ""}{(s.liftRel * 100).toFixed(1)}%</strong> {s.liftRel >= 0 ? "higher" : "lower"} than Control.
                          {" "}<strong>p-value {s.pValue.toFixed(4)}</strong> = the probability this difference is pure chance is {(s.pValue * 100).toFixed(2)}%.
                          {s.pValue < 0.05 ? " That's below 0.05 (5%), so it can be treated as a real difference, not chance." : " That's above 0.05 (5%), so it could still be chance — collect more samples."}
                          {" "}The z and CI in parentheses are the raw statistics (for experts).</>,
                        )}
                      </p></div></div>
                    </div>
                  );
                })() : (
                  <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("Control/Test 양쪽 데이터가 필요합니다", "Data for both Control and Test is required")}</strong><p>{tr("is_control 컬럼으로 대조군을 구분하고 numerator/denominator를 채우세요.", "Use the is_control column to mark the control arm and fill in numerator/denominator.")}</p></div></div>
                )}
              </section>

              {readoutData.mass && readoutData.mass.control && (
                <section className="block" id="s-readout-mass">
                  <h2 className="section-title">{tr("대량 검정 (arm_id별)", "Mass test (by arm_id)")}</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "6px 0 10px" }}>
                    {tr(
                      <>대조군: <strong>{readoutData.mass.control.name}</strong> (n={readoutData.mass.control.n.toLocaleString()}, 전환율 {((readoutData.mass.control.x / readoutData.mass.control.n) * 100).toFixed(2)}%)</>,
                      <>Control: <strong>{readoutData.mass.control.name}</strong> (n={readoutData.mass.control.n.toLocaleString()}, conversion rate {((readoutData.mass.control.x / readoutData.mass.control.n) * 100).toFixed(2)}%)</>,
                    )}
                  </p>
                  <DataTable
                    rows={readoutData.mass.rows}
                    rowKey={(r, i) => i}
                    columns={[
                      { key: "name", label: "Arm", align: "left", fmt: (_, r) => <>{r.name}{r.isControl ? <span style={{ color: "var(--text-muted)", fontSize: "11px" }}> (control)</span> : ""}</> },
                      { key: "n", label: tr("표본수", "Sample size"), align: "right", fmt: (v) => v.toLocaleString() },
                      { key: "rate", label: tr("전환율", "Conv. rate"), align: "right", fmt: (v) => (v * 100).toFixed(2) + "%" },
                      { key: "liftRel", label: tr("대조군 대비 Lift", "Lift vs control"), align: "right", fmt: (_, r) => r.isControl ? "—" : <span style={{ color: r.liftRel >= 0 ? undefined : "#ef4444" }}>{(r.liftRel * 100).toFixed(2)}%</span> },
                      { key: "z", label: "z", align: "right", fmt: (_, r) => r.isControl ? "—" : r.z.toFixed(3) },
                      { key: "pValue", label: "p-value", align: "right", fmt: (_, r) => r.isControl ? "—" : r.pValue.toFixed(4) },
                      { key: "ci", label: tr("95% CI (절대차)", "95% CI (abs. diff.)"), align: "right", fmt: (_, r) => r.isControl ? "—" : `[${(r.ciLow95 * 100).toFixed(2)}%, ${(r.ciHigh95 * 100).toFixed(2)}%]` },
                      { key: "probBWins", label: "P(B>A)", align: "right", fmt: (_, r) => r.isControl ? "—" : isNaN(r.probBWins) ? "—" : (r.probBWins * 100).toFixed(1) + "%" },
                      { key: "sigv", label: tr("유의성", "Significance"), align: "left", fmt: (_, r) => r.isControl ? <span className="pill tier-3">{tr("대조군", "Control")}</span> : r.pValue < 0.01 ? <span className="pill tier-1">p &lt; 0.01</span> : r.pValue < 0.05 ? <span className="pill tier-2">p &lt; 0.05</span> : <span className="pill tier-3">{tr("비유의", "Not sig.")}</span> },
                    ]}
                  />
                </section>
              )}

              <section className="block" id="s-readout-chart">
                <h2 className="section-title">{tr("판독 결과 차트", "Readout result chart")}</h2>
                <div className="chart-container" style={{ height: "300px", marginTop: "20px" }}>
                  <canvas id="ab-bar"></canvas>
                </div>
              </section>
            </>
          )}
        </>
      )}

    </div>
  );
}
