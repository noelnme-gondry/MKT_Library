"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { CREATIVE_FATIGUE, CREATIVE_STATS } from "@/utils/creativeMath";
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { resolveCreativeCopy } from "@/utils/contentDomain";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { downloadChartAsPNG } from "@/utils/chartUtils";
import CsvUploader from "@/components/CsvUploader";
import ResultActionCard from "@/components/ds/ResultActionCard";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { localizedTool } from "@/lib/toolConnections";
import Chart from "chart.js/auto";

// EN 번역팩 — domain(performance/content)별 CREATIVE_COPY(ko)를 locale="en"일 때만 오버레이.
// contentDomain.js(SSOT, 5-6/9-6 공용)는 절대 불변 — 여기서 로컬 병합만 수행 (CampaignPvm.jsx PVM_COPY_EN 패턴 동일).
const CREATIVE_COPY_EN = {
  performance: {
    uploaderToolId: "5-6",
    entity: "creative",
    noDataDesc: "Upload creative performance data to analyze fatigue and concepts.",
    heroTitle: "Which creatives are winning, and when should you swap them?",
    heroSub:
      "For each creative (video, image, etc.), see what's working, why it's working, and when it's time to replace it — all in one place.",
    heroJourney: [
      ["🏆", "Which creatives are winning", "Win-rate · swap velocity · lifespan"],
      ["🔍", "Which attributes drive performance", "Effect by hook type, format, etc."],
      ["🔋", "Is any creative fatigued right now", "Fatigue diagnosis · swap timing recommendation"],
      ["🧪", "What should we test next", "Candidate recommendations based on combination performance"],
    ],
    heroCausationBody:
      "Effects of creative attributes (hook, format, etc.) are estimated using impression-weighted least squares (WLS) and multiple-testing correction (BH). This decomposition includes selection bias from the platform's delivery algorithm, so it should be read as correlation, not causal effect — final confirmation is recommended via the experiment tool (5-4).",
    healthTitle: "Operational Health (Win-rate · Velocity · Lifecycle)",
    healthDescPre: "Three questions to check if creative operations are healthy — how often new creatives ",
    healthDescS1: "win (Win-rate)",
    healthDescS2: "get swapped (Velocity)",
    healthDescS3: "survive (Lifecycle)",
    statCtrLabel: "Share of creatives with good clicks (CTR Win-rate)",
    statCtrTitle: "Share of creatives that beat the median CTR of other creatives",
    statCvrLabel: "Share of creatives with good conversion (CVR Win-rate)",
    statCvrTitle: "Share of creatives that beat the median CVR of other creatives",
    statSpendLabel: "Spend share on winning creatives",
    statSpendHint: "Spend share on CTR-winning creatives",
    statVelLabel: "New creatives launched per week (Velocity)",
    statVelTitle: "Average number of newly appearing creatives per week",
    statLifeLabel: "Average lifespan of a creative",
    statFatLabel: "Share of fatigued creatives (Fatigue)",
    statFatTitle: "Share of creatives diagnosed as fatigued (declining performance)",
    healthCalloutT1: "If well below 50%, creative planning hit-rate is low — diversify concepts (see §9 next-test recommendations).",
    healthCalloutS2: "New creatives launched per week",
    healthCalloutT2: " — if too low, you can't keep up with fatiguing creatives (benchmark: 20–30% of active creatives / week).",
    healthCalloutS3: "Spend share on winning creatives",
    healthCalloutT3: " — if low, budget isn't flowing to your best creatives.",
    metricsTitle: "Creative Performance Table",
    metricsDesc: "See raw metrics like impressions, clicks, installs alongside computed efficiency metrics like CTR, CVR, cost per install. Hover over abbreviations for definitions.",
    filterActiveLabel: "Concept Matrix filter applied:",
    colCreativeId: "Creative ID",
    decomposeDescPre: "How creative attributes like hook type, message concept, and format ",
    decomposeBiasSource: "platform algorithm",
    decomposeUnavailBody: "Missing creative attribute column mapping (hook_type, format, etc.) or insufficient rows (need 30+).",
    fatigueTitle: "Creative Fatigue Diagnosis (Fatigue Detection)",
    fatigueDesc: (total, count) => `${total} creatives analyzed · ${count} fatigued`,
    fatiguedBadge: "Fatigued",
    fatigueEmpty: "No fatigued creatives detected (healthy)",
    fatigueAlertTitle: "Fatigue Alert (Ad Fatigue Alert)",
    fatigueAlertDesc: (total, alertNow) => `${total} creatives analyzed · ${alertNow} alerting now`,
    fatigueAlertEmpty: (minDays) => `No analyzable creatives (running period under ${minDays} days)`,
    plannerTitle: "Swap Schedule Recommendation (Auto-Planner)",
    plannerDesc: "Enter how many new creatives you can produce per week, and we'll automatically assign the most urgently fatigued creatives to swap weeks.",
    plannerVelocityLabel: "New creatives supplied per week",
    plannerStatUrgentLabel: "Urgent swaps needed",
    plannerStatUrgentTitle: "Number of creatives classified as alerting now or at imminent risk",
    plannerStatWeeksTitle: "Time needed to swap all urgent creatives at the current supply rate",
    plannerStatRecLabel: "Recommended weekly swap rate",
    plannerStatRecTitle: "New creatives needed per week to clear the urgent backlog within 1 week",
    plannerUndersupplyBody: (u, v, r) =>
      `There are ${u} creatives needing urgent swap, but the current weekly supply (${v}) can't clear them within 1 week. Increase supply to ${r}+/week or delay swapping lower-urgency creatives.`,
    plannerOkBody: (v) => `Current supply (${v}/week) is enough to clear the urgent backlog.`,
    plannerGanttTitle: (weeks) => `Swap Timeline (Gantt) — next ${weeks} weeks`,
    plannerFootnote: "Swap order is [alerting now first → soonest to reach risk → highest fatigue score], allocated to weeks at the entered per-week rate.",
    plannerEmpty: "No creatives need swapping.",
    matrixDesc1: "Cross two creative attributes to see at a glance which combinations are proven and which need more testing. Click a cell to filter §3's performance table to that combination.",
  },
  content: {
    uploaderToolId: "9-6",
    entity: "content",
    noDataDesc: "Upload content performance data to analyze freshness decline and response decay.",
    heroTitle: "Which content is resonating, and when should you publish new content?",
    heroSub:
      "For each piece of content (article, video, post, etc.), see what's working, why it's working, and when it's time to publish something new — all in one place.",
    heroJourney: [
      ["🏆", "Which content is resonating", "Win-rate · publishing pace · lifespan"],
      ["🔍", "Which attributes drive performance", "Effect by hook type, format, etc."],
      ["🔋", "Is any content losing freshness right now", "Freshness decline diagnosis · republish timing recommendation"],
      ["🧪", "What should we test next", "Candidate recommendations based on combination performance"],
    ],
    heroCausationBody:
      "Effects of content attributes (hook type, format, etc.) are estimated using impression-weighted least squares (WLS) and multiple-testing correction (BH). This decomposition includes selection bias from the delivery/recommendation algorithm, so it should be read as correlation, not causal effect — final confirmation is recommended via the experiment tool (5-4).",
    healthTitle: "Content Operational Health (Win-rate · Publishing Pace · Lifecycle)",
    healthDescPre: "Three questions to check if content operations are healthy — how often new content ",
    healthDescS1: "resonates (Win-rate)",
    healthDescS2: "gets published (Velocity)",
    healthDescS3: "survives (Lifecycle)",
    statCtrLabel: "Share of content with good clicks (CTR Win-rate)",
    statCtrTitle: "Share of content that beats the median CTR of other content",
    statCvrLabel: "Share of content with good conversion (CVR Win-rate)",
    statCvrTitle: "Share of content that beats the median CVR of other content",
    statSpendLabel: "Spend share on winning content",
    statSpendHint: "Spend share on CTR-leading content",
    statVelLabel: "New content published per week (Velocity)",
    statVelTitle: "Average number of newly published content pieces per week",
    statLifeLabel: "Average lifespan of a piece of content",
    statFatLabel: "Share of content losing freshness (Freshness)",
    statFatTitle: "Share of content diagnosed as aging (declining response)",
    healthCalloutT1: "If well below 50%, content planning hit-rate is low — diversify concepts (see §9 next-test recommendations).",
    healthCalloutS2: "New content published per week",
    healthCalloutT2: " — if too low, you can't keep up with content losing freshness (benchmark: 20–30% of active content / week).",
    healthCalloutS3: "Spend share on winning content",
    healthCalloutT3: " — if low, budget isn't flowing to your best content.",
    metricsTitle: "Content Performance Table",
    metricsDesc: "See raw metrics like impressions, clicks, conversions alongside computed efficiency metrics like CTR, CVR, cost per conversion. Hover over abbreviations for definitions.",
    filterActiveLabel: "Concept Matrix filter applied:",
    colCreativeId: "Content ID",
    decomposeDescPre: "How content attributes like hook type, message angle, and format ",
    decomposeBiasSource: "delivery/recommendation algorithm",
    decomposeUnavailBody: "Missing content attribute column mapping (hook_type, format, etc.) or insufficient rows (need 30+).",
    fatigueTitle: "Content Freshness Decline Diagnosis (Response Decay Detection)",
    fatigueDesc: (total, count) => `${total} pieces analyzed · ${count} losing freshness`,
    fatiguedBadge: "Aging",
    fatigueEmpty: "No content losing freshness detected (healthy)",
    fatigueAlertTitle: "Freshness Decline Alert (Content Fatigue Alert)",
    fatigueAlertDesc: (total, alertNow) => `${total} pieces analyzed · ${alertNow} alerting now`,
    fatigueAlertEmpty: (minDays) => `No analyzable content (publishing period under ${minDays} days)`,
    plannerTitle: "Publishing Schedule Recommendation (Auto-Planner)",
    plannerDesc: "Enter how many new pieces you can produce per week, and we'll automatically assign the most urgently aging content to republish weeks.",
    plannerVelocityLabel: "New content published per week",
    plannerStatUrgentLabel: "Urgent republish needed",
    plannerStatUrgentTitle: "Number of content pieces classified as alerting now or at imminent risk",
    plannerStatWeeksTitle: "Time needed to swap all urgent content at the current publishing rate",
    plannerStatRecLabel: "Recommended weekly publishing rate",
    plannerStatRecTitle: "New content needed per week to clear the urgent backlog within 1 week",
    plannerUndersupplyBody: (u, v, r) =>
      `There are ${u} pieces needing urgent republish, but the current weekly publishing rate (${v}) can't clear them within 1 week. Increase to ${r}+/week or delay republishing lower-urgency content.`,
    plannerOkBody: (v) => `Current publishing rate (${v}/week) is enough to clear the urgent backlog.`,
    plannerGanttTitle: (weeks) => `Publishing Timeline (Gantt) — next ${weeks} weeks`,
    plannerFootnote: "Publishing order is [alerting now first → soonest to reach risk → highest freshness-decline score], allocated to weeks at the entered per-week rate.",
    plannerEmpty: "No content needs republishing.",
    matrixDesc1: "Cross two content attributes to see at a glance which combinations are proven and which need more testing. Click a cell to filter §3's performance table to that combination.",
  },
};

function localizeCreativeCopy(domain, locale) {
  const ko = resolveCreativeCopy(domain);
  if (locale !== "en") return ko;
  const en = CREATIVE_COPY_EN[domain] || CREATIVE_COPY_EN.performance;
  return { ...ko, ...en };
}

// 영문 보조명은 한 덩어리로 이동시킨다. 카드 폭이 좁으면 "(CTR Win-rate)" 전체가
// 다음 줄로 내려가고, CTR / WIN-RATE처럼 어색하게 쪼개지지 않는다.
function renderStatLabel(label) {
  const text = String(label || "");
  const metaStart = text.lastIndexOf(" (");
  if (metaStart < 0 || !text.endsWith(")")) return text;
  return <>{text.slice(0, metaStart)} <span className="ab-stat-label__meta">{text.slice(metaStart + 1)}</span></>;
}

// 소재 분석 설정 (index.html CREATIVE_CONFIG 이식 — 순수 config, 엔진에 파라미터로 주입)
// Concept Matrix 셀 status → 색·라벨 (index.html renderCreativeMatrix 이식)
const MATRIX_STATUS_COLOR = {
  validated: "rgba(34,197,94,0.20)",
  promising: "rgba(251,191,36,0.20)",
  insufficient: "rgba(248,113,113,0.12)",
  empty: "rgba(255,255,255,0.03)",
};
const MATRIX_STATUS_LABEL = {
  ko: { validated: "충분히 관측", promising: "유망", insufficient: "부족", empty: "미관측" },
  en: { validated: "Enough data", promising: "Promising", insufficient: "Insufficient", empty: "Unobserved" },
};

// Next-Test 유형 아이콘·라벨 (index.html renderCreativeNextTest 이식)
const NEXT_TEST_ICON = { explore: "🔍", exploit: "🎯", kill: "❌" };
const NEXT_TEST_LABEL = {
  ko: { explore: "탐색", exploit: "최적화", kill: "제거" },
  en: { explore: "Explore", exploit: "Exploit", kill: "Kill" },
};

// Auto-Planner 긴급도 색·라벨 (index.html renderCreativeAutoPlanner 이식)
const URGENCY_COLOR = { urgent: "#f87171", soon: "#fbbf24", planned: "#60a5fa" };
const URGENCY_LABEL = {
  ko: { urgent: "긴급", soon: "곧", planned: "예정" },
  en: { urgent: "Urgent", soon: "Soon", planned: "Planned" },
};

// Next-test 가설 생성 (index.html generateNextTestHypotheses page-level 이식)
function generateNextTestHypotheses(matrix, decompose, locale = "ko") {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const hyps = [];
  for (const row of matrix.grid) {
    for (const cell of row) {
      if (cell.status === "empty") {
        hyps.push({
          type: "explore",
          cell: `${cell.row} × ${cell.col}`,
          arms: 2,
          rationale: tr("관측 데이터 없음 — 신규 컨셉 탐색", "No observed data — explore a new concept"),
          sampleSize: CREATIVE_STATS.sampleSize({ p0: 0.02, mde: 0.005 }) || 5000,
          gates: ["impressions ≥ minImpressions × 3", "stage 1 CTR p < 0.05"],
        });
      } else if (cell.status === "promising" && cell.ctr) {
        hyps.push({
          type: "exploit",
          cell: `${cell.row} × ${cell.col}`,
          arms: 2,
          rationale: tr(
            `n=${cell.n}, 추가 변형으로 효과 확정 필요`,
            `n=${cell.n}, needs additional variants to confirm the effect`,
          ),
          sampleSize:
            CREATIVE_STATS.sampleSize({
              p0: cell.ctr || 0.02,
              mde: (cell.ctr || 0.02) * 0.2,
            }) || 5000,
          gates: ["BH-adjusted p < 0.05", "P(B>A) ≥ 0.95"],
        });
      }
    }
  }
  for (const [m, res] of Object.entries(decompose || {})) {
    for (const e of res.effects || []) {
      if (e.pAdj < 0.05 && e.coef < 0) {
        hyps.push({
          type: "kill",
          cell: `${e.factor}=${e.level}`,
          arms: 0,
          rationale: tr(
            `${m} 음의 효과 (β=${e.coef.toFixed(4)}, p=${e.pAdj.toFixed(4)})`,
            `${m} negative effect (β=${e.coef.toFixed(4)}, p=${e.pAdj.toFixed(4)})`,
          ),
          gates: [tr("다음 라운드에서 해당 attribute 제외", "Exclude this attribute in the next round")],
        });
      }
    }
  }
  return hyps.slice(0, CREATIVE_CONFIG.test.batchSize);
}

// 운영 건강도 (Win-rate·Velocity·라이프사이클) 계산 — index.html renderCreativeVelocity 이식
function computeCreativeHealth(metrics, fatigue, rows) {
  if (!metrics || !metrics.length) return null;
  const minImp = CREATIVE_CONFIG.minImpressions;
  const median = (arr) => {
    const v = arr.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const elig = metrics.filter((m) => (m.impressions || 0) >= minImp);
  const medCtr = median(elig.map((m) => m.ctr));
  const medCvr = median(elig.map((m) => m.cvr));
  const ctrWinners = elig.filter(
    (m) => m.ctr != null && medCtr != null && m.ctr > medCtr,
  );
  const cvrWinners = elig.filter(
    (m) => m.cvr != null && medCvr != null && m.cvr > medCvr,
  );
  const totalSpend = metrics.reduce((s, m) => s + (m.spend || 0), 0);
  const winnerSpend = ctrWinners.reduce((s, m) => s + (m.spend || 0), 0);

  const withLife = (fatigue || []).filter((f) => f.lifespanDays != null);
  const avgLife = withLife.length
    ? withLife.reduce((s, f) => s + f.lifespanDays, 0) / withLife.length
    : null;
  const fatiguedN = (fatigue || []).filter((f) => f.fatigued).length;

  // Velocity: creative_id별 첫 등장일 → ISO주별 신규 소재 수
  const firstDate = new Map();
  for (const r of rows) {
    if (!r.creative_id || !r.date) continue;
    const cur = firstDate.get(r.creative_id);
    if (!cur || r.date < cur) firstDate.set(r.creative_id, r.date);
  }
  const weekCount = new Map();
  for (const d of firstDate.values()) {
    const wk = CREATIVE_STATS.isoWeek(d);
    weekCount.set(wk, (weekCount.get(wk) || 0) + 1);
  }
  const weeks = [...weekCount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const avgPerWeek = weeks.length
    ? [...weekCount.values()].reduce((a, b) => a + b, 0) / weeks.length
    : 0;

  return {
    minImp,
    medCvr,
    eligN: elig.length,
    ctrWinnersN: ctrWinners.length,
    cvrWinnersN: cvrWinners.length,
    winnerSpend,
    totalSpend,
    avgPerWeek,
    weeksN: weeks.length,
    avgLife,
    fatiguedN,
    fatigueN: (fatigue || []).length,
  };
}

// decompose 지표별 표시 메타 (index.html decomposeMetricMeta 이식 — ctr/cvr만). locale별 desc/단위 분기.
function buildDecomposeMeta(locale = "ko") {
  const en = locale === "en";
  return {
  ctr: {
    label: "CTR",
    desc: en ? "click-through rate (CTR)" : "클릭률(CTR)",
    weightLabel: en ? "impressions" : "노출수(impressions)",
    betterWhenHigher: true,
    axisUnit: "%p",
    chartScale: (v) => v * 100,
    axisTick: (v) => v.toFixed(2) + "%p",
    fmtVal: (v) =>
      v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%p",
  },
  cvr: {
    label: "CVR",
    desc: en ? "conversion rate (CVR)" : "전환율(CVR)",
    weightLabel: en ? "clicks" : "클릭수(clicks)",
    betterWhenHigher: true,
    axisUnit: "%p",
    chartScale: (v) => v * 100,
    axisTick: (v) => v.toFixed(2) + "%p",
    fmtVal: (v) =>
      v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%p",
  },
  cpa: {
    label: "CPA",
    desc: en ? "cost per acquisition (CPA)" : "획득당 비용(CPA)",
    weightLabel: en ? "actions" : "액션수(actions)",
    betterWhenHigher: false,
    axisUnit: en ? "KRW" : "원",
    chartScale: (v) => v,
    axisTick: (v) => Math.round(v).toLocaleString(),
    fmtVal: (v) =>
      v == null || !isFinite(v)
        ? "—"
        : (v >= 0 ? "+" : "−") + Math.round(Math.abs(v)).toLocaleString() + (en ? " KRW" : "원"),
  },
  roas: {
    label: "ROAS",
    desc: en ? "return on ad spend (ROAS)" : "광고비 대비 매출(ROAS)",
    weightLabel: en ? "spend" : "지출액(spend)",
    betterWhenHigher: true,
    axisUnit: en ? "x" : "배",
    chartScale: (v) => v,
    axisTick: (v) => v.toFixed(2),
    fmtVal: (v) =>
      v == null || !isFinite(v)
        ? "—"
        : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3) + (en ? "x" : "배"),
  },
  };
}

function decomposeEffectIsGood(coef, meta) {
  return meta.betterWhenHigher ? coef > 0 : coef < 0;
}

// 결정론 hash (FNV-1a 32-bit) — snapshotHash 생성용 (index.html creativeHashStr 이식).
function creativeHashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// §3 지표 CSV export (index.html exportCreativeMetricsCSV 이식 — BOM + q() 이스케이프).
function exportCreativeMetricsCSV(metrics, snapshotHash, version, locale = "ko") {
  if (typeof document === "undefined" || !metrics || !metrics.length) return;
  const lines = [
    locale === "en" ? `# Creative Analysis · Metrics Export` : `# 소재 분석 · Metrics Export`,
    `# Generated,${new Date().toISOString()}`,
    `# Snapshot,${snapshotHash}`,
    `# Config version,${version}`,
    "",
    "creative_id,channel,campaign_id,days,impressions,clicks,installs,actions,spend,ctr,cvr,ipm,cpi,cpa,hook_rate,completion,roas,hook_type,message_angle,first_3s,format,has_text_overlay,cta_style,duration_bucket",
  ];
  for (const m of metrics) {
    lines.push(
      [
        m.creative_id,
        m.channel || "",
        m.campaign_id || "",
        m.days,
        m.impressions,
        m.clicks,
        m.installs,
        m.actions,
        m.spend,
        m.ctr != null ? m.ctr.toFixed(6) : "",
        m.cvr != null ? m.cvr.toFixed(6) : "",
        m.ipm != null ? m.ipm.toFixed(4) : "",
        m.cpi != null ? m.cpi.toFixed(2) : "",
        m.cpa != null ? m.cpa.toFixed(2) : "",
        m.hook_rate != null ? m.hook_rate.toFixed(6) : "",
        m.completion != null ? m.completion.toFixed(6) : "",
        m.roas != null ? m.roas.toFixed(4) : "",
        m.hook_type || "",
        m.message_angle || "",
        m.first_3s || "",
        m.format || "",
        m.has_text_overlay || "",
        m.cta_style || "",
        m.duration_bucket || "",
      ]
        .map((v) =>
          /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v,
        )
        .join(","),
    );
  }
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creative_metrics_${snapshotHash}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function fmtNum(v, d = 4) {
  return v == null || !isFinite(v) ? "—" : v.toFixed(d);
}
function fmtPct(v) {
  return v == null || !isFinite(v) ? "—" : (v * 100).toFixed(2) + "%";
}
function fmtPctDay(v, locale = "ko") {
  return v == null || !isFinite(v)
    ? "—"
    : (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + (locale === "en" ? "%/day" : "%/일");
}

export default function CreativeAnalyzer({ domain = "performance", locale = "ko" } = {}) {
  // CREATIVE_COPY[domain]은 모듈 상수라 매 렌더 동일 참조. performance=기존 문자열
  // 그대로(byte-동일), content=콘텐츠 도메인 라벨. 엔진·CSV 필드명은 불변(§12.21).
  // locale은 domain과 독립 축 — domain(퍼포먼스/콘텐츠 리라벨)과 절대 혼용하지 말 것.
  const C = localizeCreativeCopy(domain, locale);
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  // 엔진(creativeMath, §2.1 불변)이 반환하는 한국어 진단 문자열(dropped·diag.error)을
  // EN일 때만 렌더층에서 치환. 엣지(다중공선·특이행렬·데이터부족)에서만 노출.
  const localizeEngineMsg = (s) => (locale !== "en" ? s : String(s ?? "")
    .replace("데이터 부족 (<30 row)", "Insufficient data (<30 rows)")
    .replace("campaign_id와 완전 공선 — 분산 0", "perfectly collinear with campaign_id — zero variance")
    .replace("행렬 특이값 — control 매핑 부족", "Singular matrix — insufficient control mapping")
    .replace("데이터 부족", "Insufficient data")
    .replace("추정 불가", "Cannot estimate")
    .replace("행렬 특이값", "Singular matrix")
    .replace("악화 추세 없음", "No worsening trend")
    .replace(/horizon\((\d+)일\) 밖/, "outside horizon ($1d)")
    .replace("추세 외삽", "Trend extrapolation"));
  const decMetaAll = useMemo(() => buildDecomposeMeta(locale), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const [metric, setMetric] = useState("ctr");
  const [activeProblem, setActiveProblem] = useState("swaps");
  // §8 Concept Matrix 셀 클릭 → §2 성과표 필터 (index CREATIVE_STATE.selectedCell)
  const [selectedCell, setSelectedCell] = useState(null); // {row, col} | null
  // §7 Auto-Planner: 주당 신규 소재 공급량 + Gantt 표시 주수
  const [weeklyVelocity, setWeeklyVelocity] = useState(
    CREATIVE_CONFIG.autoPlanner.defaultWeeklyVelocity,
  );
  const ganttWeeks = 8;

  const fatigueChartRef = useRef(null);
  const conceptChartRef = useRef(null);
  const chartInstances = useRef({});

  const hasData = csvData?.raw?.length > 0;

  // 매핑된 표준 필드 키 감지 (§8: 없는 컬럼은 하위 분석 숨김, crash X)
  const mappedKeys = useMemo(
    () =>
      new Set(
        Object.values(csvData?.mapping || {}).filter((v) => v && v !== "__ignore__"),
      ),
    [csvData],
  );
  const hasCvrInputs = mappedKeys.has("clicks") && mappedKeys.has("installs");
  // CPA=spend/actions, ROAS=revenue_d7/spend — 각자 분모 컬럼 매핑돼야 의미. spend는 cost 별칭.
  const hasSpend = mappedKeys.has("spend") || mappedKeys.has("cost");
  const hasCpaInputs = hasSpend && mappedKeys.has("actions");
  const hasRoasInputs = hasSpend && mappedKeys.has("revenue_d7");

  // === REAL 엔진 파이프라인 (index.html buildCreativeCache 이식) ===
  const analysis = useMemo(() => {
    if (!hasData) return null;
    const rows = getMappedRows(csvData);
    const validation = { errors: [], droppedRows: 0 };
    const cleanRows = [];
    for (const r of rows) {
      if (!r.creative_id || !r.date) {
        validation.droppedRows++;
        continue;
      }
      const imp = Number(r.impressions) || 0;
      const clk = Number(r.clicks) || 0;
      if (imp < 0 || clk < 0) {
        validation.errors.push(
          tr(
            `음수 값: creative_id=${r.creative_id} date=${r.date}`,
            `Negative value: creative_id=${r.creative_id} date=${r.date}`,
          ),
        );
        validation.droppedRows++;
        continue;
      }
      if (clk > imp) {
        validation.errors.push(
          `clicks > impressions: ${r.creative_id} ${r.date} (${clk}/${imp})`,
        );
      }
      cleanRows.push(r);
    }

    const metrics = CREATIVE_STATS.deriveMetrics(cleanRows);

    // 소재 속성 컬럼 자동 감지
    const activeAttrs = [
      "hook_type",
      "message_angle",
      "first_3s",
      "format",
      "has_text_overlay",
      "cta_style",
      "duration_bucket",
    ].filter((a) => cleanRows.some((r) => r[a] != null && r[a] !== ""));

    // WLS 속성별 효과 분해 (ctr/cvr, 데이터 있을 때만)
    const decompose = {};
    if (activeAttrs.length > 0 && cleanRows.length >= 30) {
      for (const m of CREATIVE_CONFIG.decompose.metrics) {
        decompose[m] = CREATIVE_STATS.decompose(
          cleanRows,
          { metric: m, attributes: activeAttrs },
          CREATIVE_CONFIG,
        );
      }
    }

    const fatigue = CREATIVE_STATS.fatigueDetect(cleanRows, "ctr", CREATIVE_CONFIG);
    const fatigueAlerts = CREATIVE_FATIGUE.buildAlerts(
      cleanRows,
      CREATIVE_CONFIG.fatigueAlert,
    );
    const fatigueRisk = CREATIVE_FATIGUE.buildRiskAnalysis(
      cleanRows,
      CREATIVE_CONFIG.fatigueRisk,
    );

    // §2 운영 건강도 (Win-rate · Velocity · 라이프사이클)
    const health = computeCreativeHealth(metrics, fatigue, cleanRows);

    // §8 Concept Matrix (기본 axes message_angle × format) — 양 축 매핑 시에만
    const axesCfg = CREATIVE_CONFIG.matrix;
    const hasRow = metrics.some((m) => m[axesCfg.rows]);
    const hasCol = metrics.some((m) => m[axesCfg.cols]);
    const matrix =
      hasRow && hasCol
        ? CREATIVE_STATS.conceptMatrix(metrics, axesCfg, CREATIVE_CONFIG)
        : null;

    // §9 다음 테스트 후보 (matrix 기반)
    const nextTest = matrix ? generateNextTestHypotheses(matrix, decompose, locale) : null;

    // 결정론 snapshot hash (매핑 시그 + 행 수 + config version) — export/칩 표시용.
    const mapping = csvData?.mapping || {};
    const sig = Object.entries(mapping)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join("|");
    const snapshotHash = creativeHashStr(
      `${sig}|${cleanRows.length}|cfg:${CREATIVE_CONFIG.version}`,
    );

    return {
      cleanRows,
      validation,
      metrics,
      activeAttrs,
      decompose,
      fatigue,
      fatigueAlerts,
      fatigueRisk,
      health,
      matrix,
      nextTest,
      snapshotHash,
    };
  }, [csvData, hasData, locale, tr]);

  // §7 Auto-Planner: weeklyVelocity(state)만 바뀌면 재계산 — 무거운 analysis는 재실행 X
  const autoPlan = useMemo(() => {
    if (!analysis) return null;
    return CREATIVE_FATIGUE.buildPlan(
      analysis.fatigueAlerts,
      weeklyVelocity,
      CREATIVE_CONFIG.autoPlanner,
    );
  }, [analysis, weeklyVelocity]);

  // decompose 결과가 없는 지표로 토글돼 있으면 ctr로 폴백
  const curMetricKey =
    analysis && analysis.decompose[metric] ? metric : "ctr";
  const curDecompose = analysis ? analysis.decompose[curMetricKey] : null;

  // === 차트 렌더 (REAL 데이터) ===
  useEffect(() => {
    if (!hasData || !analysis) return;

    if (chartInstances.current["fatigue"]) chartInstances.current["fatigue"].destroy();
    if (chartInstances.current["concept"]) chartInstances.current["concept"].destroy();

    // 1. Fatigue Decay Chart — 하락률 상위 5개 fatigued 소재의 일별 rolling CTR
    if (fatigueChartRef.current) {
      const fatigued = (analysis.fatigue || [])
        .filter((f) => f.fatigued)
        .sort((a, b) => b.dropPct - a.dropPct)
        .slice(0, 5);

      if (fatigued.length) {
        const byId = new Map();
        for (const r of analysis.cleanRows) {
          if (!r.creative_id || !r.date) continue;
          if (!byId.has(r.creative_id)) byId.set(r.creative_id, []);
          byId.get(r.creative_id).push(r);
        }
        const W = CREATIVE_CONFIG.fatigue.decayWindow;
        const palette = ["#adc6ff", "#22c55e", "#f87171", "#fbbf24", "#a78bfa"];
        const datasets = [];
        const allDateSet = new Set();
        fatigued.forEach((f, idx) => {
          const series = (byId.get(f.creative_id) || [])
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date));
          const vals = series.map((r) => CREATIVE_STATS.safeDiv(r.clicks, r.impressions));
          const rolling = vals.map((_, i) => {
            const start = Math.max(0, i - W + 1);
            const slice = vals
              .slice(start, i + 1)
              .filter((v) => v != null && isFinite(v));
            return slice.length
              ? (slice.reduce((a, b) => a + b, 0) / slice.length) * 100
              : null;
          });
          series.forEach((s) => allDateSet.add(s.date));
          const color = palette[idx % palette.length];
          datasets.push({
            label: `${String(f.creative_id).slice(0, 16)}`,
            data: series.map((s, i) => ({ x: s.date, y: rolling[i] })),
            borderColor: color,
            backgroundColor: color + "30",
            borderWidth: 1.8,
            pointRadius: 1.5,
            tension: 0.25,
          });
        });
        const labels = [...allDateSet].sort();
        chartInstances.current["fatigue"] = new Chart(fatigueChartRef.current, {
          type: "line",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            plugins: {
              legend: { labels: { font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: (c) =>
                    `${c.dataset.label}: ${c.parsed.y != null ? c.parsed.y.toFixed(2) + "%" : "—"}`,
                },
              },
            },
            scales: {
              x: { type: "category", ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
              y: { title: { display: true, text: "7d Rolling CTR (%)" } },
            },
          },
        });
      }
    }

    // 2. Forest Plot — decompose β + 95% CI (REAL)
    if (conceptChartRef.current && curDecompose && (curDecompose.effects || []).length) {
      const meta = decMetaAll[curMetricKey] || decMetaAll.ctr;
      const eff = [...curDecompose.effects].sort((a, b) => a.pAdj - b.pAdj);
      const sc = meta.chartScale;
      const labels = eff.map((e) => `${e.factor} = ${String(e.level).slice(0, 16)}`);
      const barData = eff.map((e) => [sc(e.ciLow), sc(e.ciHigh)]);
      const barColors = eff.map((e) => {
        if (e.pAdj < 0.05)
          return decomposeEffectIsGood(e.coef, meta) ? "#22c55eAA" : "#f87171AA";
        return "rgba(150,150,150,0.4)";
      });
      const pointData = eff.map((e, i) => ({ x: sc(e.coef), y: i }));

      chartInstances.current["concept"] = new Chart(conceptChartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "95% CI",
              data: barData,
              backgroundColor: barColors,
              borderWidth: 0,
              barThickness: 16,
            },
            {
              type: "scatter",
              label: tr("β (효과)", "β (effect)"),
              data: pointData,
              backgroundColor: "#ffffff",
              borderColor: "#000",
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (c) => {
                  const e = eff[c.dataIndex];
                  if (!e) return "";
                  return `β=${meta.fmtVal(e.coef)} · CI=[${meta.fmtVal(e.ciLow)}, ${meta.fmtVal(e.ciHigh)}] · BH-p=${e.pAdj.toFixed(4)} · n=${e.n}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: tr(
                  `${meta.label} 효과 (${meta.axisUnit}, 0 = 기준 level)`,
                  `${meta.label} effect (${meta.axisUnit}, 0 = reference level)`,
                ),
              },
              ticks: { callback: (v) => meta.axisTick(v) },
            },
          },
        },
      });
    }

    const currentCharts = chartInstances.current;
    return () => {
      if (currentCharts["fatigue"]) currentCharts["fatigue"].destroy();
      if (currentCharts["concept"]) currentCharts["concept"].destroy();
    };
  }, [analysis, hasData, curMetricKey, curDecompose, locale, decMetaAll, tr]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-creative">
        <section className="block" id="s-prep">
          <h2 className="section-title">{tr("데이터 준비", "Data setup")}</h2>
          <div className="callout warning">
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr("CSV 업로드 대기", "Waiting for CSV upload")}</strong>
              <p>{C.noDataDesc}</p>
              <div style={{ marginTop: "1rem" }}>
                <ToolTemplateAction
                  toolId={C.uploaderToolId}
                  locale={locale}
                  reason={tr("소재 성과·속성 컬럼을 먼저 맞춘 뒤 업로드하세요", "Align creative performance and attribute columns before uploading")}
                  source="creative_empty_state"
                />
                <CsvUploader toolId={C.uploaderToolId} locale={locale} />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { validation, metrics, decompose, fatigue, fatigueAlerts, fatigueRisk, health, matrix, nextTest, snapshotHash } =
    analysis;
  const hasValidationIssues = validation.errors.length > 0 || validation.droppedRows > 0;

  // §2 소재별 지표: Concept Matrix 필터 적용 후 노출수 내림차순 상위 50
  const rowAttr = CREATIVE_CONFIG.matrix.rows;
  const colAttr = CREATIVE_CONFIG.matrix.cols;
  const filteredMetrics = selectedCell
    ? metrics.filter(
        (m) => m[rowAttr] === selectedCell.row && m[colAttr] === selectedCell.col,
      )
    : metrics;
  const sortedMetrics = [...filteredMetrics]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 50);
  const pctOf = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(0) + "%" : "—");

  // §3 decompose effects (pAdj 오름차순)
  const decMeta = decMetaAll[curMetricKey] || decMetaAll.ctr;
  const effRows = curDecompose
    ? [...(curDecompose.effects || [])].sort((a, b) => a.pAdj - b.pAdj)
    : [];
  const hasDecompose = decompose && Object.keys(decompose).length > 0;

  // §4 fatigue (fatigued만, 하락률 내림차순 상위 30)
  const fatiguedRows = (fatigue || [])
    .filter((f) => f.fatigued)
    .sort((a, b) => b.dropPct - a.dropPct)
    .slice(0, 30);
  const fatiguedCount = (fatigue || []).filter((f) => f.fatigued).length;

  // §5 fatigue alert (score 내림차순 상위 30)
  const alertRows = (fatigueAlerts || [])
    .slice()
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 30);
  const alertNowN = (fatigueAlerts || []).filter((a) => a.alert).length;
  const riskZoneRows = (fatigueRisk?.current || [])
    .filter((item) => item.isInRiskZone)
    .sort((a, b) => {
      if (Boolean(a.signalDate) !== Boolean(b.signalDate)) return a.signalDate ? -1 : 1;
      if (a.enteredDimensions !== b.enteredDimensions) return b.enteredDimensions - a.enteredDimensions;
      return (b.dropPct || 0) - (a.dropPct || 0);
    });
  const riskProfiles = [
    fatigueRisk?.profiles?.overall,
    ...Object.values(fatigueRisk?.profiles?.channels || {}),
  ].filter(Boolean);
  const riskBacktest3 = fatigueRisk?.backtest?.[3] || null;
  const riskBacktest7 = fatigueRisk?.backtest?.[7] || null;
  const fmtRiskRange = (dist, formatter) =>
    dist?.median == null
      ? "—"
      : `${formatter(dist.q25)}–${formatter(dist.q75)} (${tr("중앙", "median")} ${formatter(dist.median)})`;
  const fmtRiskRate = (result) =>
    result?.hitRate == null
      ? "—"
      : `${(result.hitRate * 100).toFixed(0)}% (${result.hits}/${result.eligible})`;
  const fatigueTone = alertNowN > 0 || (autoPlan && autoPlan.isUndersupplied) ? "bad" : fatiguedCount > 0 ? "neutral" : "good";
  const fatigueHeadline = alertNowN > 0
    ? tr(`지금 교체가 필요한 소재가 ${alertNowN}개입니다. 이번 주 교체 계획부터 확정하세요.`, `${alertNowN} creatives need replacement now. Lock this week's swap plan first.`)
    : fatiguedCount > 0
      ? tr(`피로 신호가 있는 소재가 ${fatiguedCount}개입니다. 교체 시점을 미리 잡아 두세요.`, `${fatiguedCount} creatives show fatigue signals. Plan their replacements before they become urgent.`)
      : tr("현재 즉시 교체 경고는 없습니다. 성과 좋은 소재의 특징을 다음 제작에 재사용하세요.", "There are no immediate replacement alerts. Reuse what is working in the next creative batch.");
  const fatiguePoints = [
    autoPlan?.isUndersupplied
      ? { cls: "bad", text: tr(`현재 제작 속도(${weeklyVelocity}개/주)로는 긴급 교체 물량을 제때 처리하기 어렵습니다. 최소 ${autoPlan.recommendedWeeklyVelocity}개/주를 권장합니다.`, `At ${weeklyVelocity}/week, you cannot clear urgent replacements in time. Target at least ${autoPlan.recommendedWeeklyVelocity}/week.`) }
      : { cls: fatigueTone === "good" ? "good" : "muted", text: tr("교체 순서는 ‘지금 경고 → 위험 임박 → 피로 점수’ 기준으로 아래 일정에 정렬했습니다.", "The schedule below orders swaps by alert now, then risk soon, then fatigue score.") },
    analysis.nextTest?.length
      ? { text: tr(`다음 제작 실험 후보 ${analysis.nextTest.length}개를 제안했습니다. 성과가 좋았던 조합을 반복하기보다 검증 가능한 한 가지 변수만 바꿔 보세요.`, `${analysis.nextTest.length} next-test candidates are ready. Change one testable variable rather than blindly repeating the best combination.`) }
      : null,
    fatigueRisk?.profiles?.overall
      ? { text: tr(`과거 신호 발생 시점과 비교해 현재 위험 구간에 들어온 소재는 ${riskZoneRows.length}개입니다.`, `${riskZoneRows.length} creatives are now in the observed risk zone based on past signal timing.`) }
      : null,
  ].filter(Boolean);
  const problemChoices = [
    { id: "swaps", icon: "↻", label: tr("교체 필요", "Needs swapping"), count: alertNowN, desc: tr("이번 주 빼야 할 소재", "Creatives to remove this week") },
    { id: "production", icon: "✦", label: tr("새 소재 제작", "Next production"), count: nextTest?.length || 0, desc: tr("다음 실험 후보", "Next test candidates") },
    { id: "drivers", icon: "⌁", label: tr("성과가 바뀐 이유", "What changed performance"), count: effRows.length, desc: tr("속성별 관측 신호", "Observed attribute signals") },
    { id: "operations", icon: "◫", label: tr("운영 병목", "Operating bottleneck"), count: health?.fatiguedN || 0, desc: tr("제작 속도·수명·집행", "Velocity · lifecycle · delivery") },
  ];

  return (
    <div className="tab-pane active" id="tab-creative">
      {/* 도구 소개는 한 줄만 유지한다. 실제 판단은 바로 아래 결론·컨트롤룸이 담당한다. */}
      <section
        className="block"
        id="s-creative-hero"
        style={{
          background: "linear-gradient(135deg, rgba(122,162,247,0.12), rgba(192,132,252,0.05))",
          border: "1px solid rgba(122,162,247,0.25)",
          borderRadius: "14px",
          padding: "18px 20px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: "6px" }}>{C.heroTitle}</h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, maxWidth: "660px" }}>
              {tr("교체할 소재, 다음 제작 후보, 성과 변화 신호를 한 번에 정리합니다.", "See what to replace, what to produce next, and what changed performance.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className="chip ok"><span className="dot"></span>{C.entity} {metrics.length}{tr("개", "")}</span>
            <span className="chip"><span className="dot"></span>config {CREATIVE_CONFIG.version}</span>
            <DownloadHub
              toolId={domain === "content" ? "9-6" : "5-6"}
              label={tr("실행 정보", "Run details")}
              manifest={buildResultManifest({
                toolId: domain === "content" ? "9-6" : "5-6",
                mode: domain,
                source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
                inputSignature: `${csvData?.fileName || "dataset"}|${csvData?.raw?.length || 0}`,
                mappingSignature: Object.entries(csvData?.mapping || {}).sort().map(([k, v]) => `${k}=${v}`).join("|"),
                filter: { metric, selectedCell: selectedCell ? `${selectedCell.row}|${selectedCell.col}` : "all" },
                grain: "creative",
                metricDefinitions: ["CTR", "CVR", "CPA", "fatigue", "attribute-effect"].map((key) => ({ key, aggregation: "custom" })),
                engineVersion: CREATIVE_CONFIG.version,
                status: metrics.length ? "COMPLETE" : "ABSTAIN",
                warnings: ["Observed association is not causal", ...(metrics.length < 30 ? ["Sparse creative sample"] : [])],
              })}
            />
          </div>
        </div>

        <details style={{ marginTop: "9px", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}>
          <summary>{tr("⚠️ 통계 분석 및 해석 한계 (상관 ≠ 인과)", "⚠️ Statistical analysis & interpretation limits (correlation ≠ causation)")}</summary>
          <div style={{ marginTop: "6px", padding: "8px 10px", background: "var(--bg-1)", borderLeft: "3px solid var(--primary)", lineHeight: 1.6 }}>
            {C.heroCausationBody}
          </div>
        </details>
      </section>

      <ResultActionCard
        toolId="9-6"
        locale={locale}
        tone={fatigueTone}
        title={tr("결론 — 소재 교체와 다음 제작", "Conclusion — creative swaps and next production")}
        headline={fatigueHeadline}
        points={fatiguePoints}
        stats={[
          { label: tr("즉시 교체", "Replace now"), value: `${alertNowN}${tr("개", "")}` },
          { label: tr("피로 신호", "Fatigue signals"), value: `${fatiguedCount}${tr("개", "")}` },
          { label: tr("권장 제작 속도", "Recommended production"), value: autoPlan ? `${autoPlan.recommendedWeeklyVelocity}${tr("개/주", "/wk")}` : "—" },
        ]}
        analysisDetails={(
          <AnalysisDetails
            locale={locale}
            statusLabel={tr("관측 신호", "Observed signal")}
            statusTone={fatigueTone === "bad" ? "warning" : "neutral"}
            metric={tr("소재 피로·운영 신호", "Creative fatigue and operations signal")}
            unit="creative-level"
            meaning={tr("소재별 관측 성과를 이용한 운영 우선순위이며 인과효과가 아닙니다.", "An operational priority from observed creative performance; not a causal effect.")}
            sampleSize={{ value: metrics.length, label: tr("소재 수", "Creative count") }}
            method="creative-fatigue-and-attribute-analysis"
            version={CREATIVE_CONFIG.version}
            metricDefinition={tr("소재별 성과·피로·속성 신호를 결합한 운영 판정", "Operational verdict combining creative performance, fatigue, and attribute signals")}
            warnings={[tr("희소 소재·짧은 집행 기간·공선 속성은 판정 신뢰도를 낮춥니다.", "Sparse creatives, short flighting, and collinear attributes reduce confidence.")]}
          />
        )}
      />

      <section className="creative-control-room" aria-label={tr("소재 운영 실행 패널", "Creative operations action panel")}>
        <div className="creative-control-room__head">
          <div>
            <span className="creative-control-room__eyebrow">{tr("THIS WEEK'S CONTROL ROOM", "THIS WEEK'S CONTROL ROOM")}</span>
            <h2>{tr("지금 해결할 문제", "Choose the problem to solve")}</h2>
          </div>
          <p>{tr("한 가지 문제를 고르면 필요한 실행 정보만 먼저 보여줍니다.", "Choose one problem to see only the action information you need first.")}</p>
        </div>
        <div className="creative-control-room__choices" role="tablist" aria-label={tr("소재 운영 문제", "Creative operations problem") }>
          {problemChoices.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={activeProblem === item.id} className={activeProblem === item.id ? "is-active" : ""} onClick={() => setActiveProblem(item.id)}>
              <span className="creative-control-room__icon" aria-hidden>{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.desc}</small></span>
              <b>{item.count}</b>
            </button>
          ))}
        </div>

        <div className="creative-control-room__panel" role="tabpanel">
          {activeProblem === "swaps" && (
            <>
              <div className="creative-control-room__panel-title">
                <div><span>{tr("01 · 이번 주 교체 큐", "01 · This week's swap queue")}</span><h3>{alertNowN ? tr(`오늘 교체 ${alertNowN}개부터 확정하세요`, `Lock ${alertNowN} immediate swap(s) first`) : tr("즉시 교체 경고는 없습니다", "No immediate swap alert")}</h3></div>
                {autoPlan && <strong className={autoPlan.isUndersupplied ? "is-danger" : ""}>{tr(`제작 필요 ${autoPlan.recommendedWeeklyVelocity}개/주`, `Need ${autoPlan.recommendedWeeklyVelocity}/wk`)}</strong>}
              </div>
              {alertRows.length ? <ol className="creative-control-room__queue">{alertRows.slice(0, 5).map((item, index) => <li key={item.creative_id}><b>#{index + 1}</b><code>{String(item.creative_id).slice(0, 24)}</code><span>{item.alert ? tr("오늘 교체", "Swap now") : item.etaDays != null ? tr(`${item.etaDays}일 내 점검`, `Review in ${item.etaDays}d`) : tr("추세 관찰", "Monitor trend")}</span><small>{tr(`CTR ${fmtPctDay(item.ctrTrendPctPerDay, locale)} · 피로 ${item.score == null ? "—" : (item.score * 100).toFixed(0) + "%"}`, `CTR ${fmtPctDay(item.ctrTrendPctPerDay, locale)} · fatigue ${item.score == null ? "—" : (item.score * 100).toFixed(0) + "%"}`)}</small></li>)}</ol> : <p className="creative-control-room__empty">{tr("교체 큐가 비어 있습니다. 성과 좋은 소재의 변형 제작을 준비하세요.", "Swap queue is empty. Prepare variants of winning creatives.")}</p>}
            </>
          )}
          {activeProblem === "production" && (
            <>
              <div className="creative-control-room__panel-title"><div><span>{tr("02 · 다음 제작 브리프", "02 · Next production briefs")}</span><h3>{tr("한 번에 한 변수만 바꾸세요", "Change one variable at a time")}</h3></div><strong>{tr(`${nextTest?.length || 0}개 후보`, `${nextTest?.length || 0} candidates`)}</strong></div>
              {nextTest?.length ? <div className="creative-control-room__briefs">{nextTest.slice(0, 3).map((item, index) => <article key={`${item.type}-${index}`}><span>{NEXT_TEST_ICON[item.type]} {(NEXT_TEST_LABEL[locale] || NEXT_TEST_LABEL.ko)[item.type]}</span><h4>{item.cell}</h4><p>{item.rationale}</p><small>{tr("성공 판단 표본", "Sample to judge")}: {item.sampleSize ? item.sampleSize.toLocaleString() : "—"}</small></article>)}</div> : <p className="creative-control-room__empty">{tr("제작 추천을 만들기엔 속성 조합 데이터가 부족합니다. hook_type·format 매핑을 확인하세요.", "Attribute-combination data is insufficient. Check hook_type and format mapping.")}</p>}
            </>
          )}
          {activeProblem === "drivers" && (
            <>
              <div className="creative-control-room__panel-title"><div><span>{tr("03 · 성과 변화 신호", "03 · Performance-change signals")}</span><h3>{tr(`${decMeta.desc}에 크게 연결된 속성`, `Attributes most associated with ${decMeta.desc}`)}</h3></div><strong>{tr("관측 상관", "Observational")}</strong></div>
              {effRows.length ? <div className="creative-control-room__briefs">{effRows.slice(0, 3).map((item, index) => <article key={`${item.factor}-${item.level}-${index}`}><span>{item.factor}</span><h4>{item.level}</h4><p>{tr(`기준 대비 ${decMeta.fmtVal(item.coef)} · 보정 p=${fmtNum(item.pAdj)}`, `${decMeta.fmtVal(item.coef)} vs baseline · adjusted p=${fmtNum(item.pAdj)}`)}</p></article>)}</div> : <p className="creative-control-room__empty">{tr("통계적으로 읽을 수 있는 속성 신호가 없습니다. 데이터 30행 이상과 속성 매핑이 필요합니다.", "No readable attribute signal. Map attributes and provide at least 30 rows.")}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <Link className="ab-pill" href={localizedTool("5-4", locale).href}>
                  {tr("이 가설을 실험으로 검증하기 →", "Validate this hypothesis in an experiment →")}
                </Link>
              </div>
            </>
          )}
          {activeProblem === "operations" && health && (
            <>
              <div className="creative-control-room__panel-title"><div><span>{tr("04 · 운영 병목", "04 · Operating bottleneck")}</span><h3>{autoPlan?.isUndersupplied ? tr("제작 공급이 교체 수요를 못 따라갑니다", "Production supply cannot keep up with swaps") : tr("운영 속도와 집행 상태를 점검하세요", "Check velocity and delivery")}</h3></div><strong>{tr(`${health.weeksN}주 기준`, `${health.weeksN} weeks`)}</strong></div>
              <div className="creative-control-room__ops"><div><span>{tr("신규 제작 속도", "New creative velocity")}</span><strong>{health.avgPerWeek.toFixed(1)}{tr("개/주", "/wk")}</strong><small>{tr("피로 소재를 대체할 수 있는가", "Can it replace fatigued creative?")}</small></div><div><span>{tr("평균 수명", "Average lifespan")}</span><strong>{health.avgLife != null ? `${health.avgLife.toFixed(0)}${tr("일", "d")}` : "—"}</strong><small>{tr("교체 계획의 기준선", "Baseline for swap timing")}</small></div><div><span>{tr("승자 지출 비중", "Winner spend share")}</span><strong>{pctOf(health.winnerSpend, health.totalSpend)}</strong><small>{tr("잘 되는 소재에 예산이 가는가", "Is spend reaching winners?")}</small></div></div>
            </>
          )}
        </div>
      </section>

      <details className="block" id="s-prep" style={{ padding: "13px 16px" }}>
        <summary style={{ cursor: "pointer", fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)", outline: "none" }}>{tr("🗂 데이터 매핑 설정 (펼쳐서 변경)", "🗂 Data mapping settings (expand to change)")}</summary>
        <div style={{ marginTop: "10px" }}>
          <ToolTemplateAction
            toolId={C.uploaderToolId}
            locale={locale}
            compact
            reason={tr("현재 매핑을 원본 팀과 공유할 템플릿", "Template to share the expected mapping with your source team")}
            source="creative_mapping_panel"
          />
          <CsvUploader toolId={C.uploaderToolId} locale={locale} />
        </div>
      </details>

      <section className="block" id="s-validation">
        <h2 className="section-title"><span className="ix">§1</span>{tr("관측 충분성", "Data sufficiency")}</h2>
        {hasValidationIssues ? (
          <div className="callout warning">
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr(`${validation.droppedRows}개 row 제외 / ${validation.errors.length}개 이슈`, `${validation.droppedRows} row(s) excluded / ${validation.errors.length} issue(s)`)}</strong>
              {validation.errors.length > 0 && (
                <details style={{ marginTop: "6px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "12px" }}>{tr("상세", "Details")}</summary>
                  <ul style={{ margin: "6px 0 0 18px", fontSize: "11px", color: "var(--text-muted)" }}>
                    {validation.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {validation.errors.length > 20 && <li>... +{validation.errors.length - 20}{tr("개", " more")}</li>}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ) : (
          <div className="callout ok">
            <div className="ico">✓</div>
            <div className="body">
              <strong>{tr("모든 row 통과", "All rows passed")}</strong>
              <p>{tr("음수·grain 위반 없음.", "No negative values or grain violations.")}</p>
            </div>
          </div>
        )}
      </section>

      {health && (
        <section className="block" id="s-velocity">
          <h2 className="section-title"><span className="ix">§2</span>{C.healthTitle}</h2>
          <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            {C.healthDescPre}<strong>{C.healthDescS1}</strong>{tr(", 얼마나 빠르게 ", ", how fast we're ")}<strong>{C.healthDescS2}</strong>{tr(", 하나가 얼마나 ", ", and how long one lasts before it ")}<strong>{C.healthDescS3}</strong>.
          </p>
          <div className="ab-stat-row" style={{ margin: "8px 0 12px" }}>
            <div className="ab-stat">
              <div className="ab-stat-label" title={C.statCtrTitle}>{renderStatLabel(C.statCtrLabel)}</div>
              <div className="ab-stat-value tnum">{pctOf(health.ctrWinnersN, health.eligN)}</div>
              <div className="ab-stat-hint">{tr(`중앙값 초과 ${health.ctrWinnersN}/${health.eligN} (≥${health.minImp.toLocaleString()} impr)`, `Above median ${health.ctrWinnersN}/${health.eligN} (≥${health.minImp.toLocaleString()} impr)`)}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label" title={C.statCvrTitle}>{renderStatLabel(C.statCvrLabel)}</div>
              <div className="ab-stat-value tnum">{pctOf(health.cvrWinnersN, health.eligN)}</div>
              <div className="ab-stat-hint">{tr(`중앙값 ${fmtPct(health.medCvr)} 초과`, `Above median ${fmtPct(health.medCvr)}`)}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label">{C.statSpendLabel}</div>
              <div className="ab-stat-value tnum">{pctOf(health.winnerSpend, health.totalSpend)}</div>
              <div className="ab-stat-hint">{C.statSpendHint}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label" title={C.statVelTitle}>{renderStatLabel(C.statVelLabel)}</div>
              <div className="ab-stat-value tnum">{health.avgPerWeek.toFixed(1)}</div>
              <div className="ab-stat-hint">{tr(`${health.weeksN}주 평균`, `avg over ${health.weeksN} weeks`)}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label">{C.statLifeLabel}</div>
              <div className="ab-stat-value tnum">{health.avgLife != null ? health.avgLife.toFixed(0) + tr("일", "d") : "—"}</div>
            </div>
            <div className="ab-stat">
              <div className="ab-stat-label" title={C.statFatTitle}>{C.statFatLabel}</div>
              <div className={`ab-stat-value tnum ${health.fatiguedN > 0 ? "neg" : "pos"}`}>{pctOf(health.fatiguedN, health.fatigueN)}</div>
              <div className="ab-stat-hint">{health.fatiguedN}/{health.fatigueN}</div>
            </div>
          </div>
          <div className="callout"><div className="ico">i</div><div className="body"><p style={{ margin: 0, fontSize: "12px" }}>
            <strong>{tr("이긴 비율(Win-rate)", "Win-rate")}</strong>{C.healthCalloutT1}
            {" "}<strong>{C.healthCalloutS2}</strong>{C.healthCalloutT2}
            {" "}<strong>{C.healthCalloutS3}</strong>{C.healthCalloutT3}
          </p></div></div>
        </section>
      )}

      <section className="block" id="s-metrics">
        <h2 className="section-title"><span className="ix">§3</span>{C.metricsTitle} {selectedCell ? tr("(필터됨)", "(filtered)") : tr("(상위 50, 노출수 순)", "(top 50, by impressions)")}</h2>
        <p className="muted" style={{ marginBottom: "6px", color: "var(--text-muted)", fontSize: "12px" }}>{C.metricsDesc}</p>
        {selectedCell && (
          <div className="callout" style={{ marginBottom: "8px" }}>
            <div className="ico">i</div>
            <div className="body">
              <strong>{C.filterActiveLabel}</strong> {rowAttr}=<code className="inline">{selectedCell.row}</code> × {colAttr}=<code className="inline">{selectedCell.col}</code> ({filteredMetrics.length}{tr("개", "")} {C.entity})
              <button className="ab-pill" style={{ marginLeft: "8px" }} onClick={() => setSelectedCell(null)}>{tr("필터 해제", "Clear filter")}</button>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>{C.colCreativeId}</th><th>Channel</th><th title={tr("데이터가 존재하는 일수", "Number of days with data")}>Days</th>
                <th title={tr("노출수 (Impressions)", "Impressions")}>Impr</th><th title={tr("클릭수 (Clicks)", "Clicks")}>Clicks</th><th title={tr("설치수 (Installs)", "Installs")}>Inst</th><th title={tr("지출 비용 (Spend)", "Spend")}>Spend</th>
                <th title={tr("클릭률 — 노출 대비 클릭 비율 (CTR)", "Click-through rate — clicks per impression (CTR)")}>CTR</th><th title={tr("전환율 — 클릭 대비 설치 비율 (CVR)", "Conversion rate — installs per click (CVR)")}>CVR</th><th title={tr("노출 1,000회당 설치수 (Installs Per Mille)", "Installs per 1,000 impressions (Installs Per Mille)")}>IPM</th><th title={tr("설치 1건당 비용 (Cost Per Install)", "Cost per install (CPI)")}>CPI</th>
                <th title={tr("3초 이상 시청 비율 (Hook Rate)", "Share viewed 3s+ (Hook Rate)")}>Hook %</th><th title={tr("영상 완주율 (Completion Rate)", "Video completion rate")}>Comp %</th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.length ? (
                sortedMetrics.map((m) => (
                  <tr key={m.creative_id}>
                    <td><code className="inline" style={{ fontSize: "10px" }}>{String(m.creative_id).slice(0, 24)}</code></td>
                    <td>{String(m.channel || "")}</td>
                    <td className="tnum">{m.days}</td>
                    <td className="tnum">{(m.impressions || 0).toLocaleString()}</td>
                    <td className="tnum">{(m.clicks || 0).toLocaleString()}</td>
                    <td className="tnum">{(m.installs || 0).toLocaleString()}</td>
                    <td className="tnum">{fmtNum(m.spend, 0)}</td>
                    <td className="tnum">{fmtPct(m.ctr)}</td>
                    <td className="tnum">{fmtPct(m.cvr)}</td>
                    <td className="tnum">{fmtNum(m.ipm, 2)}</td>
                    <td className="tnum">{fmtNum(m.cpi, 0)}</td>
                    <td className="tnum">{fmtPct(m.hook_rate)}</td>
                    <td className="tnum">{fmtPct(m.completion)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="13" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("데이터가 없습니다", "No data")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign: "right", marginTop: "8px" }}>
          <button
            className="ab-pill"
            id="creative-export-metrics"
            onClick={() => exportCreativeMetricsCSV(metrics, snapshotHash, CREATIVE_CONFIG.version, locale)}
          >
            {tr("⬇ 지표 CSV 다운로드", "⬇ Download metrics CSV")}
          </button>
        </div>
      </section>

      <section className="block" id="s-decompose">
        <h2 className="section-title">
          <span className="ix">§4</span>{tr("어떤 특징이 효과적인가 (속성별 효과 분석 · WLS 분해)", "Which attributes work (attribute effect analysis · WLS decomposition)")}
          {hasDecompose && (
            <span
              className="section-help"
              tabIndex="0"
              title={`${C.decomposeDescPre}${decMeta.desc}${tr("에 실제로 영향을 주는지 통계적으로 분석합니다. 아래 버튼으로 분석 기준 지표(CTR·CVR·CPA·ROAS)를 바꿀 수 있습니다.", " statistically. Use the buttons below to switch the metric being analyzed (CTR·CVR·CPA·ROAS).")}`}
              aria-label={tr("속성별 효과 분석 도움말", "Attribute effect analysis help")}
            >ⓘ</span>
          )}
        </h2>
        {hasDecompose ? (
          <>
            <details style={{ marginBottom: "8px", fontSize: "11.5px", color: "var(--text-muted)", cursor: "pointer" }}>
              <summary>{tr("어떻게 계산하나요? (분석 방법 펼치기)", "How is this calculated? (expand methodology)")}</summary>
              <div style={{ marginTop: "6px", padding: "8px 10px", background: "var(--bg-1)", borderLeft: "3px solid var(--primary)", lineHeight: 1.6 }}>
                {tr(
                  <>{decMeta.weightLabel}로 가중한 선형회귀(weighted least squares)로 {decMeta.desc}를 추정하며, 캠페인별 차이는 자동으로 보정합니다(campaign_id within-transformation). 가중치를 {decMeta.weightLabel}로 두는 이유는 분모가 큰(=추정이 정밀한) {C.entity}에 더 큰 비중을 주기 위함입니다. 여러 속성을 동시에 검정하므로 다중검정 보정(BH)을 적용합니다.
                  {" "}⚠ 실제 운영 데이터를 관찰해서 분석한 결과라 {C.decomposeBiasSource}의 노출 편향(selection bias)이 섞여 있을 수 있습니다 — 상관관계로만 참고하고, 확정은 실험 분석 도구(5-4)로 검증하는 것을 권장합니다.</>,
                  <>We estimate {decMeta.desc} with a weighted least squares regression weighted by {decMeta.weightLabel}, auto-correcting for campaign-level differences (campaign_id within-transformation). Weighting by {decMeta.weightLabel} gives more weight to {C.entity} with a larger denominator (=more precise estimate). Because multiple attributes are tested at once, a multiple-testing correction (BH) is applied.
                  {" "}⚠ This is observational analysis of live operating data, so it may contain selection bias from {C.decomposeBiasSource}&apos;s exposure — treat it as correlational only; confirm with the experiment analysis tool (5-4).</>,
                )}
              </div>
            </details>
            <div className="analysis-local-controls" aria-label={tr("속성 효과 분석 조건", "Attribute-effect analysis settings")}>
              <div className="analysis-local-controls__inner">
                <span className="analysis-local-controls__label">{tr("분석 조건", "Analysis settings")}</span>
              <div className="ab-pillgroup">
                <span className="ab-pillgroup-label">{tr("분석 기준 지표", "Metric analyzed")}</span>
                <button className={`ab-pill ${curMetricKey === "ctr" ? "active" : ""}`} onClick={() => setMetric("ctr")}>CTR</button>
                <button
                  className={`ab-pill ${curMetricKey === "cvr" ? "active" : ""}`}
                  disabled={!decompose.cvr || !hasCvrInputs}
                  title={!decompose.cvr || !hasCvrInputs ? tr("clicks·installs 컬럼 매핑 + 데이터 30행 이상 필요", "Requires clicks·installs columns mapped + 30+ rows of data") : ""}
                  style={{ opacity: !decompose.cvr || !hasCvrInputs ? 0.4 : 1 }}
                  onClick={() => setMetric("cvr")}
                >
                  CVR
                </button>
                <button
                  className={`ab-pill ${curMetricKey === "cpa" ? "active" : ""}`}
                  disabled={!decompose.cpa || !hasCpaInputs}
                  title={!decompose.cpa || !hasCpaInputs ? tr("spend(또는 cost)·actions 컬럼 매핑 + 데이터 30행 이상 필요", "Requires spend (or cost)·actions columns mapped + 30+ rows of data") : tr("획득당 비용(CPA)은 낮을수록 좋음 — 색 방향 반전", "Lower cost per acquisition (CPA) is better — color direction is reversed")}
                  style={{ opacity: !decompose.cpa || !hasCpaInputs ? 0.4 : 1 }}
                  onClick={() => setMetric("cpa")}
                >
                  CPA
                </button>
                <button
                  className={`ab-pill ${curMetricKey === "roas" ? "active" : ""}`}
                  disabled={!decompose.roas || !hasRoasInputs}
                  title={!decompose.roas || !hasRoasInputs ? tr("spend(또는 cost)·revenue_d7 컬럼 매핑 + 데이터 30행 이상 필요", "Requires spend (or cost)·revenue_d7 columns mapped + 30+ rows of data") : ""}
                  style={{ opacity: !decompose.roas || !hasRoasInputs ? 0.4 : 1 }}
                  onClick={() => setMetric("roas")}
                >
                  ROAS
                </button>
              </div>
              </div>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-6px" }}>
              {tr("분석에 쓰인 행 수(n)", "Rows used in analysis (n)")}={curDecompose?.diag?.n || 0} · <span title={tr("모델이 데이터를 얼마나 잘 설명하는지 (0~1, 높을수록 설명력 높음)", "How well the model explains the data (0~1, higher = better fit)")}>{tr("설명력(R²)", "Explanatory power (R²)")}</span>={fmtNum(curDecompose?.diag?.R2)}
              {(curDecompose?.dropped || []).length ? tr(` · 제외(다중공선성): ${curDecompose.dropped.map(localizeEngineMsg).join(", ")}`, ` · Dropped (multicollinearity): ${curDecompose.dropped.map(localizeEngineMsg).join(", ")}`) : ""}
              {curDecompose?.diag?.error ? tr(` · 추정 불가: ${localizeEngineMsg(curDecompose.diag.error)}`, ` · Cannot estimate: ${localizeEngineMsg(curDecompose.diag.error)}`) : ""}
            </p>
            {effRows.length ? (
              <>
                <div className="alloc-card" style={{ margin: "12px 0" }}>
                  <div className="cann-card-header">
                    <div className="alloc-card-title">{tr("속성별 영향력 그림 (Forest plot — β + 95% 신뢰구간)", "Attribute effect chart (forest plot — β + 95% CI)")}</div>
                    <button
                      className="ab-pill"
                      title={tr("PNG 다운로드", "Download PNG")}
                      onClick={() => downloadChartAsPNG(conceptChartRef.current, `creative_forest_${curMetricKey}`)}
                    >
                      ⬇ PNG
                    </button>
                  </div>
                  <p className="muted">{tr(<>막대 길이 = 영향력 크기(β), 양옆 점선 = 신뢰구간(95% CI). 막대가 0선에 안 걸치고 보정된 유의확률(BH-adj p){"<"}0.05면 통계적으로 의미있는 효과입니다.</>, <>Bar length = effect size (β), dashed ends = 95% confidence interval. If the bar doesn&apos;t cross 0 and the adjusted p-value (BH-adj p){"<"}0.05, the effect is statistically significant.</>)}</p>
                  <div style={{ position: "relative", height: `${Math.max(280, Math.min(800, effRows.length * 26 + 80))}px` }}>
                    <canvas id="chart-creative-concept" ref={conceptChartRef}></canvas>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data" style={{ fontSize: "11.5px" }}>
                    <thead>
                      <tr>
                        <th title={tr("비교 대상 속성", "Attribute being compared")}>{tr("속성 (Factor)", "Attribute (Factor)")}</th>
                        <th title={tr("속성 안의 구체적인 값", "Specific value within the attribute")}>{tr("값 (Level)", "Value (Level)")}</th>
                        <th title={tr("기준값(가장 흔한 값)", "Reference value (most common value)")}>{tr("기준값 (Ref)", "Reference (Ref)")}</th>
                        <th title={tr(`기준값 대비 ${decMeta.desc} 변화량`, `Change in ${decMeta.desc} vs. the reference value`)}>{tr("영향력", "Effect")} (β, {decMeta.axisUnit})</th>
                        <th title={tr("계수를 표준오차로 나눈 표준화 통계량", "Coefficient divided by standard error")}>z-value</th>
                        <th title={tr("여러 속성을 동시에 검정할 때 보정한 유의확률", "P-value adjusted for testing multiple attributes at once")}>{tr("보정된 유의확률 (BH-adj p)", "Adjusted p-value (BH-adj p)")}</th>
                        <th title={tr("같은 방식으로 표본을 반복 수집할 때 계산된 구간의 95%가 실제 계수를 포함하도록 만든 범위", "A range constructed so 95% of intervals from repeated samples would contain the true coefficient")}>{tr("신뢰구간 (95% CI)", "Confidence interval (95% CI)")}</th>
                        <th title={tr("표본 수", "Sample size")}>N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effRows.map((e, i) => {
                        const isGood = decomposeEffectIsGood(e.coef, decMeta);
                        const color = e.pAdj < 0.05 ? (isGood ? "#22c55e" : "#f87171") : "var(--text-1)";
                        return (
                          <tr key={i}>
                            <td>{e.factor}</td>
                            <td><strong>{e.level}</strong> <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>vs {e.ref}</span></td>
                            <td className="tnum">{e.ref}</td>
                            <td className="tnum"><strong style={{ color }}>{decMeta.fmtVal(e.coef)}</strong></td>
                            <td className="tnum">{fmtNum(e.z, 2)}</td>
                            <td className="tnum"><strong>{fmtNum(e.pAdj)}</strong></td>
                            <td className="tnum" style={{ fontSize: "11px", color: "var(--text-muted)" }}>[{decMeta.fmtVal(e.ciLow)}, {decMeta.fmtVal(e.ciHigh)}]</td>
                            <td className="tnum">{e.n}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="muted" style={{ color: "var(--text-muted)" }}>{tr("통계적으로 의미있는 효과가 발견되지 않았습니다.", "No statistically significant effects were found.")}</p>
            )}
          </>
        ) : (
          <div className="callout warning">
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr("분석 불가", "Analysis unavailable")}</strong>
              <p>{C.decomposeUnavailBody}</p>
            </div>
          </div>
        )}
      </section>

      <section className="block" id="s-fatigue">
        <h2 className="section-title"><span className="ix">§5</span>{C.fatigueTitle}</h2>
        <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
          {C.fatigueDesc((fatigue || []).length, fatiguedCount)}
        </p>
        {fatiguedRows.length > 0 && (
          <div className="alloc-card" style={{ marginBottom: "12px" }}>
            <div className="cann-card-header">
              <div className="alloc-card-title">{tr(`클릭률 하락 추이 — 하락률 상위 ${Math.min(5, fatiguedRows.length)}개 (Decay 라인)`, `CTR decline trend — top ${Math.min(5, fatiguedRows.length)} by drop rate (decay line)`)}</div>
              <button
                className="ab-pill"
                title={tr("PNG 다운로드", "Download PNG")}
                onClick={() => downloadChartAsPNG(fatigueChartRef.current, "creative_fatigue_decay")}
              >
                ⬇ PNG
              </button>
            </div>
            <p className="muted">{tr("최근 7일 평균 클릭률(rolling CTR). 가장 좋았던 시점(peak) 대비 하락 추세를 봅니다.", "7-day rolling average CTR. Shows the decline trend versus the best (peak) point.")}</p>
            <div style={{ position: "relative", height: "300px" }}>
              <canvas id="chart-creative-fatigue" ref={fatigueChartRef}></canvas>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>{tr("상태", "Status")}</th>
                <th>{C.colCreativeId}</th>
                <th>{tr("Peak 일자", "Peak date")}</th>
                <th>{tr("Peak 지표", "Peak value")}</th>
                <th>{tr("현재 지표", "Current value")}</th>
                <th>{tr("하락률", "Drop rate")}</th>
                <th>{tr("수명(일)", "Lifespan (days)")}</th>
              </tr>
            </thead>
            <tbody>
              {fatiguedRows.length ? (
                fatiguedRows.map((f, i) => (
                  <tr key={i}>
                    <td><span className="chip" style={{ fontSize: "11px", padding: "2px 8px", color: "#f87171" }}><span className="dot" style={{ background: "#f87171" }}></span>{C.fatiguedBadge}</span></td>
                    <td><code className="inline" style={{ fontSize: "10px" }}>{String(f.creative_id).slice(0, 24)}</code></td>
                    <td className="tnum" style={{ fontSize: "11px" }}>{f.peakDate || ""}</td>
                    <td className="tnum">{fmtPct(f.peakValue)}</td>
                    <td className="tnum">{fmtPct(f.currentValue)}</td>
                    <td className="tnum"><strong style={{ color: "#f87171" }}>−{(f.dropPct * 100).toFixed(1)}%</strong></td>
                    <td className="tnum">{f.lifespanDays}{tr("일", "d")}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{C.fatigueEmpty}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="block" id="s-fatigue-alert">
        <h2 className="section-title"><span className="ix">§6</span>{C.fatigueAlertTitle}</h2>
        <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
          {C.fatigueAlertDesc((fatigueAlerts || []).length, alertNowN)}
        </p>
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>{tr("상태", "Status")}</th>
                <th>{C.colCreativeId}</th>
                <th>{tr("수명(일)", "Lifespan (days)")}</th>
                <th>Fatigue Score</th>
                <th>{tr("최근 CTR 추세", "Recent CTR trend")}</th>
                <th>{tr("최근 노출량 추세", "Recent impression trend")}</th>
                <th>{tr("최근 CPM 추세", "Recent CPM trend")}</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {alertRows.length ? (
                alertRows.map((a, i) => {
                  const scoreColor =
                    a.score == null
                      ? "var(--text-muted)"
                      : a.alert
                        ? "#f87171"
                        : a.score >= 0.3
                          ? "#fbbf24"
                          : "#22c55e";
                  return (
                    <tr key={i}>
                      <td>{a.alert ? <span className="chip" style={{ fontSize: "11px", padding: "2px 8px", color: "#f87171" }}><span className="dot" style={{ background: "#f87171" }}></span>{tr("경고", "Alert")}</span> : <span style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>—</span>}</td>
                      <td><code className="inline" style={{ fontSize: "10px" }}>{String(a.creative_id).slice(0, 24)}</code></td>
                      <td className="tnum">{a.days}{tr("일", "d")}</td>
                      <td className="tnum"><strong style={{ color: scoreColor }}>{a.score == null ? "—" : (a.score * 100).toFixed(0) + "%"}</strong></td>
                      <td className="tnum" style={{ color: (a.ctrTrendPctPerDay || 0) < 0 ? "#f87171" : "var(--text-muted)" }}>{fmtPctDay(a.ctrTrendPctPerDay, locale)}</td>
                      <td className="tnum" style={{ color: (a.impressionTrendPctPerDay || 0) > 0 ? "#f87171" : "var(--text-muted)" }}>{fmtPctDay(a.impressionTrendPctPerDay, locale)}</td>
                      <td className="tnum" style={{ color: (a.cpmTrendPctPerDay || 0) > 0 ? "#f87171" : "var(--text-muted)" }}>{fmtPctDay(a.cpmTrendPctPerDay, locale)}</td>
                      <td className="tnum">
                        {a.etaDays == null ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>{localizeEngineMsg(a.etaReason) || "—"}</span>
                        ) : a.etaDays === 0 ? (
                          <strong style={{ color: "#f87171" }}>{tr("즉시", "Immediate")}</strong>
                        ) : (
                          <strong>{tr(`${a.etaDays}일 후`, `in ${a.etaDays}d`)}</strong>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{C.fatigueAlertEmpty(CREATIVE_CONFIG.fatigueAlert.minDays)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="block" id="s-fatigue-risk">
        <h2 className="section-title">
          <span className="ix">§6.1</span>
          {tr("누적 집행 위험 구간 · 과거 신호 적중률", "Cumulative delivery risk zone · historical signal hit rate")}
        </h2>
        <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.6 }}>
          {tr(
            `빈도나 고유 도달을 추정하지 않습니다. ${CREATIVE_CONFIG.fatigueRisk.rollingWindow}일 CTR이 고점 대비 ${(CREATIVE_CONFIG.fatigueRisk.dropPct * 100).toFixed(0)}% 이상 낮은 상태가 ${CREATIVE_CONFIG.fatigueRisk.confirmDays}일 이어진 최초 시점의 집행일수·누적 노출·누적 비용을 과거 ${domain === "content" ? "콘텐츠" : "소재"}와 비교합니다.`,
            `This does not estimate frequency or unique reach. It compares age, cumulative impressions, and cumulative spend at the first point where ${CREATIVE_CONFIG.fatigueRisk.rollingWindow}-day CTR stayed at least ${(CREATIVE_CONFIG.fatigueRisk.dropPct * 100).toFixed(0)}% below its peak for ${CREATIVE_CONFIG.fatigueRisk.confirmDays} days.`,
          )}
        </p>

        <div className="ab-stat-row" style={{ margin: "10px 0 12px" }}>
          <div className="ab-stat">
            <div className="ab-stat-label" title={tr("최대 예측기간 이후 데이터까지 존재하는 과거 최초 신호", "Historical first signals with complete follow-up")}>{tr("과거 신호 표본", "Historical signals")}</div>
            <div className="ab-stat-value tnum">{fatigueRisk?.historicalSignals?.length || 0}</div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-label" title={tr(`신호 이후 3일 CTR이 신호 시점보다 ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% 이상 추가 하락한 비율`, `Share whose next 3-day CTR fell at least ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% further`)}>
              {tr("3일 적중률", "3-day hit rate")}
            </div>
            <div className="ab-stat-value tnum">{fmtRiskRate(riskBacktest3)}</div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-label" title={tr(`신호 이후 7일 CTR이 신호 시점보다 ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% 이상 추가 하락한 비율`, `Share whose next 7-day CTR fell at least ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% further`)}>
              {tr("7일 적중률", "7-day hit rate")}
            </div>
            <div className="ab-stat-value tnum">{fmtRiskRate(riskBacktest7)}</div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-label" title={tr("과거 신호 구간의 하단값 3개 중 2개 이상을 지난 현재 항목", "Current items past at least 2 of 3 historical lower bounds")}>{tr("현재 위험 구간", "In risk zone now")}</div>
            <div className={`ab-stat-value tnum ${riskZoneRows.length ? "neg" : "pos"}`}>{riskZoneRows.length}</div>
          </div>
        </div>

        {riskProfiles.length ? (
          <>
            <div className="table-wrap" style={{ marginBottom: "12px" }}>
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    <th>{tr("비교 기준", "Comparison scope")}</th>
                    <th>{tr("신호 표본", "Signals")}</th>
                    <th>{tr("집행일수 위험 구간", "Age risk range")}</th>
                    <th>{tr("누적 노출 위험 구간", "Cumulative impression range")}</th>
                    <th>{tr("누적 비용 위험 구간", "Cumulative spend range")}</th>
                  </tr>
                </thead>
                <tbody>
                  {riskProfiles.map((profile) => (
                    <tr key={profile.scope}>
                      <td><strong>{profile.scope === "all" ? tr("전체 데이터", "All data") : profile.scope}</strong></td>
                      <td className="tnum">{profile.sampleSize}</td>
                      <td className="tnum">{fmtRiskRange(profile.ageDays, (v) => tr(`${Math.round(v)}일`, `${Math.round(v)}d`))}</td>
                      <td className="tnum">{fmtRiskRange(profile.cumulativeImpressions, (v) => Math.round(v).toLocaleString())}</td>
                      <td className="tnum">{fmtRiskRange(profile.cumulativeSpend, (v) => fmtNum(v, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    <th>{tr("상태", "Status")}</th>
                    <th>{C.colCreativeId}</th>
                    <th>{tr("채널", "Channel")}</th>
                    <th>{tr("집행일수", "Age")}</th>
                    <th>{tr("누적 노출", "Cumulative impressions")}</th>
                    <th>{tr("누적 비용", "Cumulative spend")}</th>
                    <th>{tr("비교 기준", "Scope")}</th>
                    <th>{tr("진입 조건", "Bounds crossed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {riskZoneRows.length ? (
                    riskZoneRows.slice(0, 30).map((item) => (
                      <tr key={item.seriesKey}>
                        <td>
                          <span className="chip" style={{ fontSize: "11px", padding: "2px 8px", color: item.signalDate ? "#f87171" : "#fbbf24" }}>
                            <span className="dot" style={{ background: item.signalDate ? "#f87171" : "#fbbf24" }}></span>
                            {item.signalDate ? tr("하락 신호 발생", "Decline signaled") : tr("위험 구간 진입", "Entered risk zone")}
                          </span>
                        </td>
                        <td><code className="inline" style={{ fontSize: "10px" }}>{String(item.creative_id).slice(0, 24)}</code></td>
                        <td>{item.channel || tr("미분류", "Unclassified")}</td>
                        <td className="tnum">{tr(`${item.ageDays}일`, `${item.ageDays}d`)}</td>
                        <td className="tnum">{Math.round(item.cumulativeImpressions).toLocaleString()}</td>
                        <td className="tnum">{fmtNum(item.cumulativeSpend, 0)}</td>
                        <td>{item.profile?.scope === "all" ? tr("전체 데이터", "All data") : item.profile?.scope}</td>
                        <td className="tnum">{item.enteredDimensions}/{item.availableDimensions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("현재 과거 위험 구간에 들어온 항목이 없습니다.", "No current item has entered the historical risk zone.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="callout warning">
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr("아직 위험 구간을 추정할 수 없습니다", "Risk zone cannot be estimated yet")}</strong>
              <p>
                {tr(
                  `최초 하락 신호가 발생한 뒤 ${Math.max(...CREATIVE_CONFIG.fatigueRisk.horizons)}일 이상 추적된 과거 ${domain === "content" ? "콘텐츠" : "소재"}가 최소 ${CREATIVE_CONFIG.fatigueRisk.minProfileSignals}개 필요합니다. 표본이 쌓이기 전에는 기존 CTR 하락 신호만 사용합니다.`,
                  `At least ${CREATIVE_CONFIG.fatigueRisk.minProfileSignals} historical items need a first decline signal plus ${Math.max(...CREATIVE_CONFIG.fatigueRisk.horizons)} days of follow-up. Until then, use the existing CTR decline signal only.`,
                )}
              </p>
            </div>
          </div>
        )}
        <p className="muted" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "10px", lineHeight: 1.6 }}>
          {tr(
            `위험 구간은 과거 최초 신호 시점의 25~75백분위이며, 현재 판정은 하단값 3개 중 2개 이상 진입했을 때 표시합니다. 적중은 신호 이후 CTR이 추가 ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% 이상 하락한 경우입니다. 관측 우선순위이지 피로의 인과 판정은 아닙니다.`,
            `Risk ranges are the 25th–75th percentiles at historical first-signal points. Current items are flagged after crossing at least 2 of 3 lower bounds. A hit means CTR fell at least ${(CREATIVE_CONFIG.fatigueRisk.outcomeDropPct * 100).toFixed(0)}% further after the signal. This is an observed priority, not a causal fatigue verdict.`,
          )}
        </p>
      </section>

      <section className="block" id="s-auto-planner">
        <h2 className="section-title"><span className="ix">§7</span>{C.plannerTitle}</h2>
        {autoPlan && autoPlan.plan.length ? (
          (() => {
            const buckets = CREATIVE_FATIGUE.ganttBuckets(autoPlan.plan, ganttWeeks);
            return (
              <>
                <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  {C.plannerDesc}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "8px 0 12px", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{C.plannerVelocityLabel}</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={weeklyVelocity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setWeeklyVelocity(isFinite(v) && v > 0 ? v : CREATIVE_CONFIG.autoPlanner.defaultWeeklyVelocity);
                    }}
                    style={{ width: "70px", padding: "4px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-1)", fontSize: "12px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("개/주", "/wk")}</span>
                </div>
                <div className="ab-stat-row" style={{ margin: "8px 0 12px" }}>
                  <div className="ab-stat">
                    <div className="ab-stat-label" title={C.plannerStatUrgentTitle}>{C.plannerStatUrgentLabel}</div>
                    <div className={`ab-stat-value tnum ${autoPlan.urgentCount > 0 ? "neg" : "pos"}`}>{autoPlan.urgentCount}</div>
                  </div>
                  <div className="ab-stat">
                    <div className="ab-stat-label" title={C.plannerStatWeeksTitle}>{tr("긴급 물량 처리 기간", "Time to clear urgent backlog")}</div>
                    <div className="ab-stat-value tnum">{autoPlan.weeksNeededForUrgent == null ? "—" : tr(`${autoPlan.weeksNeededForUrgent}주`, `${autoPlan.weeksNeededForUrgent}wk`)}</div>
                  </div>
                  <div className="ab-stat">
                    <div className="ab-stat-label" title={C.plannerStatRecTitle}>{C.plannerStatRecLabel}</div>
                    <div className="ab-stat-value tnum">{autoPlan.recommendedWeeklyVelocity}{tr("개", "")}</div>
                  </div>
                </div>
                {autoPlan.isUndersupplied ? (
                  <div className="callout warning"><div className="ico">!</div><div className="body"><strong>{tr("공급 부족", "Undersupplied")}</strong><p>{C.plannerUndersupplyBody(autoPlan.urgentCount, autoPlan.weeklyVelocity, autoPlan.recommendedWeeklyVelocity)}</p></div></div>
                ) : (
                  <div className="callout"><div className="ico">i</div><div className="body"><p style={{ margin: 0, fontSize: "12px" }}>{C.plannerOkBody(autoPlan.weeklyVelocity)}</p></div></div>
                )}
                <div className="alloc-card" style={{ marginTop: "12px" }}>
                  <div className="cann-card-header"><div className="alloc-card-title">{C.plannerGanttTitle(ganttWeeks)}</div></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                    {buckets.map((b) => (
                      <div key={b.week} style={{ display: "flex", alignItems: "stretch", gap: "8px" }}>
                        <div style={{ width: "54px", flexShrink: 0, fontSize: "11px", color: "var(--text-muted)", paddingTop: "4px" }}>W+{b.week}</div>
                        <div style={{ flex: 1, display: "flex", gap: "3px", flexWrap: "wrap", minHeight: "26px", alignItems: "center", background: "var(--bg-2)", borderRadius: "6px", padding: "4px 6px" }}>
                          {b.items.length === 0 ? (
                            <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>—</span>
                          ) : (
                            b.items.map((p) => (
                              <span
                                key={p.queueRank}
                                title={`${String(p.creative_id)} · ${(URGENCY_LABEL[locale] || URGENCY_LABEL.ko)[p.urgency]} · score=${p.score == null ? "—" : (p.score * 100).toFixed(0) + "%"}`}
                                style={{ display: "inline-block", padding: "2px 7px", borderRadius: "4px", fontSize: "10px", background: URGENCY_COLOR[p.urgency] + "33", border: `1px solid ${URGENCY_COLOR[p.urgency]}88`, color: "var(--text-1)" }}
                              >
                                #{p.queueRank} {String(p.creative_id).slice(0, 12)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "2px", background: URGENCY_COLOR.urgent, marginRight: "4px" }}></span>{tr(`긴급(즉시 경고 또는 ${CREATIVE_CONFIG.autoPlanner.urgentDays}일 내)`, `Urgent (immediate alert or within ${CREATIVE_CONFIG.autoPlanner.urgentDays}d)`)}
                    <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "2px", background: URGENCY_COLOR.soon, margin: "0 4px 0 12px" }}></span>{tr(`곧(${CREATIVE_CONFIG.autoPlanner.soonDays}일 내)`, `Soon (within ${CREATIVE_CONFIG.autoPlanner.soonDays}d)`)}
                    <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "2px", background: URGENCY_COLOR.planned, margin: "0 4px 0 12px" }}></span>{tr("예정", "Planned")}
                  </div>
                </div>
                <p className="muted" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "8px" }}>{C.plannerFootnote}</p>
              </>
            );
          })()
        ) : (
          <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{C.plannerEmpty}</p>
        )}
      </section>

      <section className="block" id="s-matrix">
        <h2 className="section-title"><span className="ix">§8</span>{tr("조합별 성과표 (Concept Matrix)", "Combination performance grid (Concept Matrix)")}{matrix ? ` — ${rowAttr} × ${colAttr}` : ""}</h2>
        {matrix && matrix.grid.length ? (
          <>
            <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{C.matrixDesc1}</p>
            <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {tr("셀 상태:", "Cell status:")} <span style={{ background: MATRIX_STATUS_COLOR.validated, padding: "2px 8px", borderRadius: "4px" }} title={tr("효과가 검증됐다는 뜻이 아니라 판단에 필요한 관측량이 충분한 조합", "Enough observations to evaluate; this does not mean the effect is validated")}>{tr("충분히 관측", "Enough data")}</span> ·{" "}
              <span style={{ background: MATRIX_STATUS_COLOR.promising, padding: "2px 8px", borderRadius: "4px" }} title={tr("좋아 보이지만 아직 데이터가 적어 확정하기 어려운 조합", "Looks promising but too little data to confirm yet")}>{tr("유망", "Promising")}</span> ·{" "}
              <span style={{ background: MATRIX_STATUS_COLOR.insufficient, padding: "2px 8px", borderRadius: "4px" }} title={tr("시도는 했지만 판단하기엔 데이터가 너무 적은 조합", "Tried, but too little data to judge")}>{tr("데이터 부족", "Insufficient data")}</span> ·{" "}
              <span style={{ background: MATRIX_STATUS_COLOR.empty, padding: "2px 8px", borderRadius: "4px" }} title={tr("아직 한 번도 시도하지 않은 조합 — 다음 테스트 후보", "Never tried yet — candidate for the next test")}>{tr("미관측 (탐색 후보)", "Unobserved (explore candidate)")}</span>
            </p>
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11px" }}>
                <tbody>
                  <tr>
                    <th style={{ background: "var(--bg-2)", textAlign: "left", whiteSpace: "nowrap" }}><strong>{rowAttr}</strong> ↓ \ <strong>{colAttr}</strong> →</th>
                    {matrix.cols.map((c) => (
                      <th key={c} style={{ background: "var(--bg-2)", textAlign: "left", whiteSpace: "nowrap" }}>{c}</th>
                    ))}
                  </tr>
                  {matrix.grid.map((row, ri) => (
                    <tr key={matrix.rows[ri]}>
                      <th style={{ background: "var(--bg-2)", textAlign: "left" }}>{matrix.rows[ri]}</th>
                      {row.map((cell) => {
                        const isSel = selectedCell && selectedCell.row === cell.row && selectedCell.col === cell.col;
                        const clickable = cell.status !== "empty";
                        return (
                          <td
                            key={`${cell.row}|${cell.col}`}
                            onClick={
                              clickable
                                ? () =>
                                    setSelectedCell(
                                      isSel ? null : { row: cell.row, col: cell.col },
                                    )
                                : undefined
                            }
                            style={{
                              background: MATRIX_STATUS_COLOR[cell.status],
                              padding: "8px",
                              fontSize: "11px",
                              lineHeight: 1.5,
                              textAlign: "left",
                              verticalAlign: "top",
                              cursor: clickable ? "pointer" : "default",
                              outline: isSel ? "2px solid var(--primary, #adc6ff)" : "none",
                              outlineOffset: isSel ? "-2px" : undefined,
                            }}
                          >
                            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                              {(MATRIX_STATUS_LABEL[locale] || MATRIX_STATUS_LABEL.ko)[cell.status]}{cell.n ? ` · n=${cell.n}` : ""}{isSel ? tr(" ★ 선택됨", " ★ selected") : ""}
                            </div>
                            {cell.status !== "empty" ? (
                              <>
                                <div className="tnum">CTR {fmtPct(cell.ctr)}</div>
                                <div className="tnum" style={{ color: "var(--text-muted)" }}>CVR {fmtPct(cell.cvr)}</div>
                              </>
                            ) : (
                              <div style={{ color: "var(--text-muted)" }}>—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="callout warning"><div className="ico">!</div><div className="body"><strong>{tr("성과표 생성 불가", "Cannot generate performance grid")}</strong><p>{tr(`${rowAttr} 컬럼과 ${colAttr} 컬럼이 모두 매핑되어야 합니다.`, `Both the ${rowAttr} and ${colAttr} columns must be mapped.`)}</p></div></div>
        )}
      </section>

      <section className="block" id="s-next">
        <h2 className="section-title"><span className="ix">§9</span>{tr("다음 테스트 추천", "Next test recommendations")}</h2>
        {nextTest && nextTest.length ? (
          <>
            <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px", lineHeight: 1.5 }}>
              {tr(
                `지금까지의 분석을 바탕으로 다음에 무엇을 테스트하면 좋을지 제안합니다. 아직 집행한 적 없는 조합(🔍 탐색), 가능성이 보이지만 확증이 더 필요한 조합(🎯 최적화), 통계적으로 효과가 뚜렷하게 나빠서 배제를 권장하는 속성(❌ 제거)을 자동으로 골라줍니다. (한 번에 최대 ${CREATIVE_CONFIG.test.batchSize}개)`,
                `Based on the analysis so far, we suggest what to test next: combinations never run before (🔍 explore), promising combinations that need more confirmation (🎯 exploit), and attributes with a clearly negative statistical effect that should be excluded (❌ kill). (up to ${CREATIVE_CONFIG.test.batchSize} at a time)`,
              )}
            </p>
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    <th>{tr("유형", "Type")}</th>
                    <th>{tr("대상", "Target")}</th>
                    <th title={tr("비교해볼 변형 개수", "Number of variants to compare")}>{tr("테스트 그룹 수 (arms)", "Test groups (arms)")}</th>
                    <th>{tr("근거", "Rationale")}</th>
                    <th title={tr("결론을 믿을 수 있으려면 필요한 데이터 양", "Data needed to trust the conclusion")}>{tr("필요 샘플 수", "Required sample size")}</th>
                    <th title={tr("이 추천이 유효하려면 만족해야 하는 조건", "Conditions that must hold for this recommendation to be valid")}>{tr("확인 조건 (게이트)", "Check conditions (gate)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {nextTest.map((h, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className={`chip ${h.type === "kill" ? "danger" : h.type === "exploit" ? "ok" : "warn"}`}
                          style={{ fontSize: "11px", padding: "2px 8px" }}
                        >
                          <span className="dot"></span>{NEXT_TEST_ICON[h.type]} {(NEXT_TEST_LABEL[locale] || NEXT_TEST_LABEL.ko)[h.type]}
                        </span>
                      </td>
                      <td><strong>{h.cell}</strong></td>
                      <td className="tnum">{h.arms}</td>
                      <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{h.rationale}</td>
                      <td className="tnum">{h.sampleSize ? h.sampleSize.toLocaleString() : "—"}</td>
                      <td style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                        {(h.gates || []).map((g, gi) => (
                          <div key={gi}>· {g}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "8px" }}>{tr("⚠ 이 추천은 실제 운영 데이터를 관찰해서 만든 가설입니다. 확정은 실험 분석 도구(5-4)에서 A/B 테스트로 검증하는 것을 권장합니다.", "⚠ This recommendation is a hypothesis derived from observing live operating data. Confirm it with an A/B test in the experiment analysis tool (5-4).")}</p>
          </>
        ) : (
          <p className="muted" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{tr("추천할 다음 테스트가 없습니다 (모든 조합이 충분히 관측되었거나 데이터가 부족합니다).", "No test recommendations available (all combinations have enough observations or there isn't enough data).")}</p>
        )}
      </section>
    </div>
  );
}
