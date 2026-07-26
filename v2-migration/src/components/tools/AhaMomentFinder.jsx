"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { AHA_STATS, ahaCoverageBuckets } from "@/utils/ahaMath";
import { downloadChartAsPNG, CHART_THEME } from "@/utils/chartUtils";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { showToast } from "@/utils/toast";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import { buildDemoCsv } from "@/utils/demoData";
import AhaColumnMapper, { ahaAutoMapColumns } from "@/components/tools/AhaColumnMapper";
import { resolveAhaCopy } from "@/utils/contentDomain";
import { trackProductEvent } from "@/lib/analytics";

// EN 번역팩 — domain(performance/content)별 AHA_COPY(ko)를 locale="en"일 때만 오버레이.
// contentDomain.js(SSOT, 5-20/9-2 공용)는 절대 불변 — 여기서 로컬 병합만 수행(CampaignPvm.jsx 패턴과 동일).
const AHA_COPY_EN = {
  performance: {
    demoGroup: "aha",
    guideToolId: "5-20",
    missingTarget: "1 target (0/1)",
    missingFeature: "1+ leading behavior (feature) columns",
    heroQ: "Which early action leads users to stick?",
    heroSub:
      "Among the actions users take right after signup, we found the one with the strongest signal for reaching the target (\"sticking\").",
    statAll: "All users",
    statTarget: "Users who reached target",
    statRate: "Average target rate",
    leadPhrase: (winHtml, actionHtml, k, liftHtml) =>
      `Users who did <strong>${actionHtml}</strong> at least <strong>${k} times</strong> within <strong>${winHtml}</strong> of signup are <strong>${liftHtml}</strong> as likely as average to reach the target.`,
    causationTitle: "Association, not causation",
    causationBody:
      "Users who are already highly engaged tend to do everything more (a common cause), so we can't conclude a specific action \"causes\" the target. This tool only narrows down hypotheses (suspects).",
    kanbanTitle: "Candidate actions by signal strength",
    kanbanHeadStrong: (total, nS) =>
      `${nS} of ${total} candidates are strong Aha signals — try the green-column actions first in onboarding/experiments.`,
    drillTitle: "Selected action in detail",
    drillHeadline: (winHtml, actionHtml, k, support, pPct, rPct) =>
      `Of the <strong>${support} users</strong> who did <strong>${actionHtml}</strong> at least <strong>${k} times</strong> within <strong>${winHtml}</strong> of signup, <strong>${pPct}%</strong> reached the target, and this action covers <strong>${rPct}%</strong> of all users who reached target.`,
    metricQAll: "How often do all users do this action?",
    metricQPrecision: "Does meeting this condition predict reaching target?",
    metricAPrecision: (p) => `${p}% reached target`,
    metricQRecall: "How much of the target group does this capture?",
    docTitle: "Aha-Moment Finder — Detailed Explanation",
    docSummary:
      'Finds the **early actions** users commonly take right before "sticking" (reaching the target). It automatically searches the data for rules like "users who did a specific action K+ times within N days of signup are more likely to reach the target."',
    docWhy:
      'Knowing the Aha-moment lets you steer onboarding, push notifications, and recommendations toward that action to lift the target rate. Example: if "invite 3 friends within 7 days" is the Aha-moment, design onboarding that strongly nudges new users toward inviting up to 3 friends.',
    docDataLine: (cache) =>
      `- ${cache.n.toLocaleString()} total users · ${Math.round(cache.baseRate * cache.n).toLocaleString()} reached target · average target rate (base rate) ${(cache.baseRate * 100).toFixed(1)}%`,
    docLimit:
      "These results are all **association**, not **causation**. Users who are already highly engaged tend to do everything more (a common cause), so we can't conclude a specific action \"causes\" the target. This tool's role is to **narrow down hypotheses (suspects)** — confirmation must come from a **holdout experiment (5-4 Experiment Analysis)**. Prioritize experiments with actions in the strong-signal column.",
    docFileStem: "aha_moment",
  },
  content: {
    demoGroup: "content_aha",
    guideToolId: "9-2",
    missingTarget: "1 conversion flag (subscribed, 0/1)",
    missingFeature: "1+ consumed content (feature) columns",
    heroQ: "Which content converts readers into subscribers?",
    heroSub:
      "Among the content readers consumed early on, we found the one with the strongest signal for \"subscription conversion.\"",
    statAll: "All readers",
    statTarget: "Readers who converted",
    statRate: "Average conversion rate",
    leadPhrase: (winHtml, actionHtml, k, liftHtml) =>
      `Readers who viewed <strong>${actionHtml}</strong> at least <strong>${k} times</strong> within <strong>${winHtml}</strong> of their first visit are <strong>${liftHtml}</strong> as likely as average to subscribe.`,
    causationTitle: "Association, not causation",
    causationBody:
      "Readers who are already highly interested tend to consume a lot of content overall (a common cause), so we can't conclude a specific piece of content \"causes\" subscription. This tool only narrows down hypotheses (killer-content candidates).",
    kanbanTitle: "Candidate content by signal strength",
    kanbanHeadStrong: (total, nS) =>
      `${nS} of ${total} candidates are strong conversion signals — try the green-column content first in recommendations, email, and curated entry points.`,
    drillTitle: "Selected content in detail",
    drillHeadline: (winHtml, actionHtml, k, support, pPct, rPct) =>
      `Of the <strong>${support} readers</strong> who viewed <strong>${actionHtml}</strong> at least <strong>${k} times</strong> within <strong>${winHtml}</strong> of their first visit, <strong>${pPct}%</strong> subscribed, and this content covers <strong>${rPct}%</strong> of all subscribers.`,
    metricQAll: "How often do all readers view this content?",
    metricQPrecision: "Does viewing this content predict subscribing?",
    metricAPrecision: (p) => `${p}% subscribed`,
    metricQRecall: "How much of the subscriber group does this capture?",
    docTitle: "Killer Content & Loyal Reader Finder — Detailed Explanation",
    docSummary:
      'Finds the **content** readers commonly consume right before "subscription conversion" (signup, recurring subscription, repeat visit). It automatically searches the data for rules like "readers who viewed specific content K+ times within N days of their first visit are more likely to subscribe."',
    docWhy:
      'Knowing the Aha-Content (killer content) lets you steer recommendations, email, and curation toward that content to lift conversion. Example: if "[GA4 Setup Guide]" is the killer content, design onboarding curation that strongly exposes new readers to that article.',
    docDataLine: (cache) =>
      `- ${cache.n.toLocaleString()} total readers · ${Math.round(cache.baseRate * cache.n).toLocaleString()} converted · average conversion rate (base rate) ${(cache.baseRate * 100).toFixed(1)}%`,
    docLimit:
      "These results are all **association**, not **causation**. Readers who are already highly interested tend to consume a lot of content overall (a common cause), so we can't conclude a specific piece of content \"causes\" subscription. This tool's role is to **narrow down hypotheses (killer-content candidates)** — confirmation must come from an **A/B test or holdout experiment (5-4)**. Prioritize experiments with content in the strong-signal column.",
    docFileStem: "killer_content",
  },
};

function localizeAhaCopy(domain, locale) {
  const ko = resolveAhaCopy(domain);
  if (locale !== "en") return ko;
  const en = AHA_COPY_EN[domain] || AHA_COPY_EN.performance;
  return { ...ko, ...en };
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* colMap 자동추정(ahaAutoMapColumns)은 AhaColumnMapper.jsx에서 import(DnD 매퍼와
   동일 로직 공유 — 컴포넌트 분리 시 두 곳에 흩어지면 드리프트 위험). */

/* colMap에서 role=feature인 컬럼들을 액션별로 그룹핑 → { action: [{header, window}] } */
function ahaGroupedActions(colMap) {
  const groups = {};
  for (const [h, def] of Object.entries(colMap || {})) {
    if (!def || def.role !== "feature") continue;
    const a = def.action || h;
    const w = def.window != null ? def.window : Infinity;
    if (!groups[a]) groups[a] = [];
    groups[a].push({ header: h, window: w });
  }
  for (const a in groups) groups[a].sort((x, y) => x.window - y.window);
  return groups;
}

function ahaTargetColumn(colMap) {
  for (const [h, def] of Object.entries(colMap || {}))
    if (def && def.role === "target") return h;
  return null;
}

/* colMap에서 role=segment인 컬럼 목록 (성별·플랫폼·국가 등 나눠보기 차원) */
function ahaSegmentColumns(colMap) {
  return Object.entries(colMap || {})
    .filter(([, def]) => def && def.role === "segment")
    .map(([h]) => h);
}

function confidenceDots(f1Val) {
  const n =
    f1Val >= 0.7
      ? 5
      : f1Val >= 0.5
        ? 4
        : f1Val >= 0.3
          ? 3
          : f1Val >= 0.15
            ? 2
            : 1;
  return "●".repeat(n) + "○".repeat(5 - n);
}

/* 결과 CSV 다운로드 — long-format: 액션 × 윈도우(D1/D7/전체) × 구간(k) 전 조합.
 * 외부 편집이 쉽도록 요약(액션당 1행)이 아니라 **모든 윈도우·모든 임계값 k**를 한 행씩 펼침.
 * 윈도우별 전 k는 AHA_STATS.thresholdSweep으로 스윕(학습셋 P/R/F1·표본 + 전체 커버리지, 결정론).
 * is_optimal=1 행만 필터하면 예전 요약(윈도우별 최적)과 동일. holdout 재평가값은 요약행에서만
 * 신뢰(자동선택 지점)라 여기선 학습셋 기준으로 통일(차트·드릴다운 구간표와 동일 기준).
 * (index.html downloadAhaCsv 계열: BOM + CRLF + text/csv;charset=utf-8, §7) */
function downloadAhaCsv(sorted, cache) {
  const q = (s) => {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = [
    "action",
    "window",       // d1 / d7 / all
    "k",            // 최소 실행 횟수(임계값)
    "all_users_support",
    "all_users_pct",
    "precision",
    "recall",
    "f1",
    "support",
    "lift",
    "gated",        // 표본 부족으로 게이팅됐는지
    "is_optimal",   // 자동 선택된 최적(윈도우·k) 지점이면 1
  ];
  const lines = [header.join(",")];
  const baseRate = cache?.baseRate || 0;
  const canSweep = cache && Array.isArray(cache.targets) && Array.isArray(cache.trainIdx);
  for (const r of sorted) {
    const wcs = (r.windowCols || []).slice().sort((a, b) => a.window - b.window);
    for (const wc of wcs) {
      // 윈도우별 전 k 스윕(구간별 데이터). cache 없으면(방어) grid의 최적 한 점만.
      const sweep = canSweep
        ? AHA_STATS.thresholdSweep(wc.valuesAll, cache.targets, cache.trainIdx, cache.minSupport || 1)
        : [];
      for (const s of sweep) {
        const lift = baseRate > 0 ? s.P / baseRate : null;
        const isOpt = wc.window === r.bestWindow && s.k === r.bestK;
        lines.push(
          [
            r.action,
            wc.window === Infinity ? "all" : "d" + wc.window,
            s.k,
            s.allSupport,
            (s.allPct * 100).toFixed(2),
            s.P.toFixed(4),
            s.R.toFixed(4),
            s.F1.toFixed(4),
            s.support,
            lift == null ? "" : lift.toFixed(4),
            s.gated ? "1" : "0",
            isOpt ? "1" : "0",
          ]
            .map(q)
            .join(","),
        );
      }
    }
  }
  const fileName = `aha_moment_${new Date().toISOString().slice(0, 10)}.csv`;
  const content = "﻿" + lines.join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* 매핑 시그니처: colMap + fileName (index.html ahaAnalyzeSig 이식) */
function ahaAnalyzeSig(colMap, fileName) {
  return JSON.stringify(colMap || {}) + "|" + (fileName || "");
}

const MUTED = "var(--text-muted)";
/* 상태 배지 톤 (5-18 BADGE_TONE 규칙 재사용 — 위험=red 아니라 여기선 강함=green) */
const AHA_TONE = {
  strong: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.45)", color: "#22c55e" },
  maybe: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.4)", color: "#fbbf24" },
  weak: { bg: "var(--surface-container-low)", border: "var(--border)", color: MUTED },
};

/* 엔진 지표(lift·support·train/holdout F1) → 마케터용 3버킷 (렌더층 판정, 엔진 불변).
   강함 = 표본 충분 + 강한 연관(lift≥1.5) + 과적합 아님. 약함 = 표본 부족. 나머지 애매. */
function ahaBucketOf(r, minSupport) {
  if (r.holdout.support < minSupport) return "weak";
  const overfit = r.train.F1 - r.holdout.F1 > 0.2;
  const strongLift = r.lift != null && r.lift >= 1.5;
  const decentF1 = r.holdout.F1 >= 0.3;
  if (strongLift && decentF1 && !overfit) return "strong";
  return "maybe";
}

/* 액션 1개를 평어 한 줄로: "7일 내 invite 3번 이상 · 2.1배" */
function ahaActionPhrase(r, locale = "ko") {
  const en = locale === "en";
  const win = r.bestWindow === Infinity ? (en ? "the whole period" : "전체 기간") : en ? `day ${r.bestWindow}` : `${r.bestWindow}일`;
  const liftTxt = r.lift == null ? "" : en ? ` · ${r.lift.toFixed(1)}x` : ` · ${r.lift.toFixed(1)}배`;
  return en
    ? `${r.action} ${r.bestK}+ times within ${win}${liftTxt}`
    : `${win} 내 ${r.action} ${r.bestK}번 이상${liftTxt}`;
}

const _today = () => new Date().toISOString().slice(0, 10);
function textDownload(name, text) {
  const blob = new Blob(["﻿" + text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* 전 과정 상세 설명 .md (claude-ux.md §6 탈출구): 평어 먼저 → 왜 중요 → 지표 평어 → 판정 규칙 → 현재 데이터 요약 → 한계 */
function buildAhaGuideDoc(cache, sorted, minSupport, C, locale = "ko") {
  const en = locale === "en";
  const L = [];
  L.push(`# ${C.docTitle}`);
  L.push(``);
  L.push(en ? `## One-line summary` : `## 한 줄 요약`);
  L.push(C.docSummary);
  L.push(``);
  L.push(en ? `## Why it matters` : `## 왜 중요한가`);
  L.push(C.docWhy);
  L.push(``);
  if (en) {
    L.push(`## What each number is asking (plain language)`);
    L.push(`- **Best window (technical: best window)**: How far out did the signal stay strongest for that action (e.g. 7 days after signup).`);
    L.push(`- **Threshold count (technical: best k)**: How many times within that period counts as a "retained" signal (e.g. 3+ times).`);
    L.push(`- **Precision**: Of users who met the condition, the share that actually retained. Higher means "meeting this condition almost guarantees retention".`);
    L.push(`- **Recall**: Of users who actually retained, the share that met this condition. Higher means "most retained users went through this action".`);
    L.push(`- **F1 score**: A single score combining precision and recall (0–1). Higher is better.`);
    L.push(`- **Lift**: How many times higher than the plain average retention rate. 1.5x or higher is a strong association.`);
    L.push(`- **Support (sample size)**: Number of users meeting the condition. If small (< ${minSupport}), it could be chance, lowering confidence.`);
    L.push(``);
    L.push(`## Strong / worth a look / weak — decision rule`);
    L.push(`- **Strong Aha signal**: Sufficient sample (≥ ${minSupport}), 1.5x+ lift, F1 ≥ 0.3, and no big gap between train and holdout scores (not overfit).`);
    L.push(`- **Worth a look**: Some signal, but lift is weak or accuracy is low.`);
    L.push(`- **Weak · low sample**: Fewer than ${minSupport} users met the condition, so judgment is withheld.`);
    L.push(`- **Suspected overfitting**: Train score is high but the holdout (separate validation set) drops sharply (gap > 0.2) — likely coincidence.`);
    L.push(``);
    L.push(`## Verdict summary for the current data`);
  } else {
    L.push(`## 각 숫자가 무엇을 묻나 (평어)`);
    L.push(`- **최적 윈도우 (전문: best window)**: 그 행동을 "언제까지" 봤을 때 신호가 가장 강했나 (예: 가입 후 7일).`);
    L.push(`- **기준 횟수 (전문: best k)**: 그 기간 안에 "몇 번 이상" 하면 정착 신호로 볼지 (예: 3번 이상).`);
    L.push(`- **정밀도 (전문: Precision)**: 조건을 충족한 유저 중 실제로 정착한 비율. 높을수록 "이 조건을 채우면 거의 정착한다".`);
    L.push(`- **재현율 (전문: Recall)**: 실제 정착한 유저 중 이 조건을 충족한 비율. 높을수록 "정착자 대부분이 이 행동을 거쳤다".`);
    L.push(`- **예측 정확도 (전문: F1)**: 정밀도·재현율을 하나로 합친 점수(0~1). 클수록 좋습니다.`);
    L.push(`- **평균 대비 배수 (전문: Lift)**: 아무 조건 없는 평균 정착률 대비 몇 배인지. 1.5배 이상이면 강한 연관.`);
    L.push(`- **표본 (전문: support)**: 그 조건을 충족한 유저 수. 적으면(< ${minSupport}) 우연일 수 있어 신뢰를 낮춥니다.`);
    L.push(``);
    L.push(`## 강함/애매/약함 판정 규칙`);
    L.push(`- **강한 Aha 신호**: 표본이 충분(≥ ${minSupport})하고, 평균 대비 1.5배 이상, 예측 정확도(F1)가 0.3 이상, 학습셋과 홀드아웃 점수 차이가 크지 않음(과적합 아님).`);
    L.push(`- **살펴볼 만함**: 신호는 있으나 배수가 약하거나 정확도가 낮은 경우.`);
    L.push(`- **약함 · 표본 부족**: 조건 충족 유저가 ${minSupport}명 미만이라 판단을 보류.`);
    L.push(`- **과적합 의심**: 학습셋 점수는 높은데 홀드아웃(따로 떼어둔 검증셋)에서 뚝 떨어지면(차이 > 0.2) 우연에 가깝습니다.`);
    L.push(``);
    L.push(`## 현재 데이터 판정 요약`);
  }
  L.push(C.docDataLine(cache));
  if (sorted.length) {
    for (const r of sorted) {
      const b = ahaBucketOf(r, minSupport);
      const tag = en
        ? b === "strong" ? "Strong Aha signal" : b === "maybe" ? "Worth a look" : "Weak · low sample"
        : b === "strong" ? "강한 Aha 신호" : b === "maybe" ? "살펴볼 만함" : "약함·표본 부족";
      L.push(
        en
          ? `- **${r.action}** → ${tag} · ${ahaActionPhrase(r, locale)} · accuracy (F1) ${r.holdout.F1.toFixed(2)} · sample ${r.holdout.support.toLocaleString()}`
          : `- **${r.action}** → ${tag} · ${ahaActionPhrase(r, locale)} · 정확도(F1) ${r.holdout.F1.toFixed(2)} · 표본 ${r.holdout.support.toLocaleString()}`,
      );
    }
  } else {
    L.push(en ? `- No analyzable actions — check the column mapping.` : `- 분석 가능한 액션이 없습니다 — 컬럼 매핑을 확인하세요.`);
  }
  L.push(``);
  L.push(en ? `## Limitations (please read)` : `## 한계 (꼭 읽어주세요)`);
  L.push(C.docLimit);
  L.push(``);
  L.push(en ? `_Generated: ${_today()}_` : `_생성: ${_today()}_`);
  return L.join("\n");
}

/* 무거운 Aha 분석 캐시 계산 (index.html buildAhaCache 이식). 원래 useMemo였으나 colMap이
   바뀔 때마다 20만행을 재계산해 UI가 멈추던 문제(§7) 때문에 모듈 순수 함수로 추출 →
   "분석하기" 클릭 시에만 rAF 디퍼로 호출(매핑 편집 중엔 미실행). 수학·반환 shape 불변. */
function computeAhaCache(rows, colMap, minSupport, holdoutOn) {
  const empty = { n: 0, baseRate: 0, results: [], targetCol: null, groups: {} };
  if (!rows || !rows.length) return empty;
  const targetCol = ahaTargetColumn(colMap);
  const groups = ahaGroupedActions(colMap);
  const n = rows.length;
  if (!targetCol || !Object.keys(groups).length || !n)
    return { ...empty, n, targetCol, groups };

  const targets = rows.map((r) => {
    const v = parseFloat(r[targetCol]);
    return isFinite(v) && v >= 0.5 ? 1 : 0;
  });
  const baseRate = targets.reduce((s, t) => s + t, 0) / n;
  const ms = Math.max(1, minSupport || 1);

  let trainIdx, holdoutIdx;
  if (holdoutOn) {
    const sp = AHA_STATS.splitDeterministic(n, 20260620);
    trainIdx = sp.train;
    holdoutIdx = sp.holdout;
  } else {
    trainIdx = rows.map((_, i) => i);
    holdoutIdx = trainIdx;
  }

  const results = [];
  for (const [action, cols] of Object.entries(groups)) {
    const windowCols = cols.map((c) => ({
      header: c.header,
      window: c.window,
      valuesAll: rows.map((r) => {
        const v = parseFloat(r[c.header]);
        return isFinite(v) ? v : 0;
      }),
    }));
    const gs = AHA_STATS.gridSearch(windowCols, targets, trainIdx, holdoutIdx, ms);
    if (!gs) continue;
    results.push({
      action,
      bestWindow: gs.bestWindow,
      bestHeader: gs.bestHeader,
      bestK: gs.bestK,
      train: gs.train,
      holdout: gs.holdout,
      allSupport: gs.allSupport,
      allPct: gs.allPct,
      gated: gs.gated,
      lift: AHA_STATS.lift(gs.holdout.P, baseRate),
      grid: gs.grid,
      windowCols,
    });
  }
  return { n, baseRate, results, targetCol, groups, targets, trainIdx, minSupport: ms };
}

export default function AhaMomentFinder({ domain = "performance", locale = "ko" } = {}) {
  // 도메인 라벨팩(§contentDomain): performance=기존 문구(출력 불변) / content=콘텐츠 번역.
  // locale="en"이면 AHA_COPY_EN 오버레이(§contentDomain SSOT는 불변, 로컬 병합만).
  const C = localizeAhaCopy(domain, locale);
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const router = useRouter();
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const demoDisabled = useAppStore((state) => state.demoDisabled);
  const requestAd = useAppStore((state) => state.requestAd);
  const ahaFileRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false);
  const handleAhaFile = (file) => {
    if (!file) return;
    setIsParsing(true);
    // worker:true → 파싱을 워커 스레드에서 수행해 큰 파일(10~20만행) 업로드 시 메인 스레드
    // 멈춤 방지(§7 성능). complete는 메인에서 콜백.
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        setIsParsing(false);
        if (!res.data || !res.data.length) return;
        setCsvData({ raw: res.data, headers: res.meta.fields || [], mapping: {}, fileName: file.name });
      },
      error: () => setIsParsing(false),
    });
  };
  // Demo: load sample event data + auto-confirm the analyze gate (see reseed below).
  // State (not ref) because the reseed reads it during render.
  const [demoPending, setDemoPending] = useState(false);
  const handleLoadDemo = () => {
    setDemoPending(true);
    setCsvData(buildDemoCsv(C.demoGroup, locale));
  };
  const resetCsv = () => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" });
  const [minSupport, setMinSupport] = useState(30);
  const [holdoutOn, setHoldoutOn] = useState(true);
  const [sortBy, setSortBy] = useState("f1");
  const [drilldownAction, setDrilldownAction] = useState(null);
  // 전문가 뷰: 산점도에 표시할 이벤트 선택(null=전체) + 표에서 달성률 구간 펼침
  const [selectedActions, setSelectedActions] = useState(null);
  const [expandedActions, setExpandedActions] = useState(() => new Set());
  // 편집 가능한 컬럼 역할 매핑 (index.html AHA_STATE.colMap — 자동추정 시드 후 사용자 편집)
  const [colMap, setColMap] = useState({});
  // 나눠보기(세그먼트): null=전체, {col,value}=그 세그먼트 값만. minSupport처럼 탐색
  // 토글이라 게이트 시그니처엔 안 들어감 → 전환 시 재분석 없이 자동 재계산(§12.5).
  const [activeSeg, setActiveSeg] = useState(null);
  // 분석 게이트: 마지막으로 "분석하기"를 눌렀을 때의 매핑 시그니처
  const [analyzedSig, setAnalyzedSig] = useState(null);
  const analysisEventRef = useRef(null);

  const hasData = csvData?.raw?.length > 0;
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));

  // 첫 진입(데이터 없음) 시 샘플 데이터 자동 로드(CsvUploader와 동일 패턴, SEO·첫인상).
  useEffect(() => {
    // 마운트 1회성 초기 로드(다중 setState 의도적 — 데모 데이터+게이트 상태 세팅).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasData && !demoDisabled) handleLoadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const sweepChartRef = useRef(null);
  const sweepChartInstance = useRef(null);
  const [seededKey, setSeededKey] = useState(null);

  const headers = useMemo(() => {
    if (!hasData) return [];
    return csvData?.headers?.length > 0
      ? csvData.headers
      : Object.keys(csvData?.raw?.[0] || {});
  }, [hasData, csvData]);

  // 데이터/파일이 바뀌면 자동추정으로 colMap 재시드 + 게이트 리셋 (render-time reseed
  // — setState-in-effect/ref 접근 회피, React "이전 렌더 정보로 상태 조정" 패턴).
  const fileName = csvData?.fileName || "data.csv";
  const seedKey = hasData ? `${fileName}|${headers.join(",")}|${csvData.raw.length}` : "";
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    const cm = hasData ? ahaAutoMapColumns(headers, csvData.raw) : {};
    setColMap(cm);
    // Demo load auto-confirms the gate so results show instantly (matches other tools).
    setAnalyzedSig(demoPending && hasData ? ahaAnalyzeSig(cm, fileName) : null);
    if (demoPending) setDemoPending(false);
    setDrilldownAction(null);
    setActiveSeg(null);
  }

  // 현재 매핑 시그니처가 분석된 시그니처와 일치할 때만 결과 노출 (게이트)
  const analyzed = analyzedSig != null && analyzedSig === ahaAnalyzeSig(colMap, fileName);
  const runAhaAnalysis = () => {
    trackProductEvent("analysis_started", { tool_id: C.guideToolId, source: isDemo ? "demo" : "csv", row_count: csvData?.raw?.length || 0, analysis_type: "aha" });
    requestAd(() => setAnalyzedSig(ahaAnalyzeSig(colMap, fileName)));
  };

  // 세그먼트 차원(성별·플랫폼 등)별 값 목록 — 분석 후에만 raw 1패스 순회(매핑 편집 중엔
  // 미실행, §7 큰데이터 멈춤 방지). 값이 너무 많은(>20) 컬럼은 세그먼트로 부적합 → 잘라 표기.
  const segMeta = useMemo(() => {
    if (!hasData || !analyzed) return [];
    const cols = ahaSegmentColumns(colMap);
    if (!cols.length) return [];
    return cols.map((col) => {
      const freq = new Map();
      for (const r of csvData.raw || []) {
        const v = r[col];
        if (v == null || String(v).trim() === "") continue;
        const key = String(v);
        freq.set(key, (freq.get(key) || 0) + 1);
      }
      const all = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      return { col, values: all.slice(0, 20).map(([value, count]) => ({ value, count })), truncated: all.length > 20 };
    });
  }, [hasData, analyzed, colMap, csvData.raw]);

  // 현재 activeSeg가 여전히 유효한 세그먼트 컬럼·값인지 검증(매핑 변경 시 잔상 방지).
  const validSeg = useMemo(() => {
    if (!activeSeg) return null;
    const m = segMeta.find((s) => s.col === activeSeg.col);
    if (!m || !m.values.some((v) => v.value === activeSeg.value)) return null;
    return activeSeg;
  }, [activeSeg, segMeta]);

  // --- 분석 결과 캐시: "분석하기"(analyzed) 후에만 계산. colMap 변경으론 재계산 안 함 ---
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const rafRef = useRef(0);
  useEffect(() => {
    if (!hasData || !analyzed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalysisData(null);
      setIsAnalyzing(false);
      return undefined;
    }
    // 로딩 오버레이를 먼저 페인트한 뒤(더블 rAF) 무거운 계산 실행 → "멈춤"이 아닌 "분석 중".
    setIsAnalyzing(true);
    let cancelled = false;
    // 세그먼트 선택 시 그 값의 행만 필터해 엔진에 넘김(수학 불변, 행 부분집합만 좁힘).
    const segRows = validSeg
      ? (csvData.raw || []).filter((r) => String(r[validSeg.col]) === validSeg.value)
      : csvData.raw;
    const raf1 = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (cancelled) return;
        const data = computeAhaCache(segRows, colMap, minSupport, holdoutOn);
        if (cancelled) return;
        setAnalysisData(data);
        setIsAnalyzing(false);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasData, analyzed, colMap, csvData, minSupport, holdoutOn, validSeg]);

  // 다운스트림 공용 캐시 — 분석 전/중엔 빈 결과(+ 매핑 UI용 live 역할값, 행 순회 없이 colMap만으로 파생).
  const cache = useMemo(
    () => analysisData || { n: 0, baseRate: 0, results: [], targetCol: ahaTargetColumn(colMap), groups: ahaGroupedActions(colMap) },
    [analysisData, colMap],
  );

  // D1/D7 구간 토글 — null(해제)이면 액션별 자동 선택된 최적 윈도우(기존 동작).
  // 특정 윈도우 선택 시 각 액션의 grid에서 그 윈도우 행(자체 홀드아웃 재평가값)만
  // 뽑아 보여줌 — 그 윈도우 데이터가 없는 액션은 목록에서 제외.
  const [windowFilter, setWindowFilter] = useState(null);
  const availWindows = useMemo(() => {
    const set = new Set();
    (cache.results || []).forEach((r) => (r.grid || []).forEach((g) => { if (isFinite(g.window)) set.add(g.window); }));
    return [...set].sort((a, b) => a - b);
  }, [cache]);

  const viewResults = useMemo(() => {
    if (windowFilter == null) return cache.results;
    return cache.results
      .map((r) => {
        const g = (r.grid || []).find((x) => x.window === windowFilter);
        if (!g) return null;
        return {
          ...r,
          bestWindow: g.window,
          bestHeader: g.header,
          bestK: g.k,
          train: { P: g.P, R: g.R, F1: g.F1, support: g.support },
          holdout: g.holdout,
          allSupport: g.allSupport,
          allPct: g.allPct,
          gated: g.gated,
          lift: AHA_STATS.lift(g.holdout.P, cache.baseRate),
        };
      })
      .filter(Boolean);
  }, [cache, windowFilter]);

  const sortedResults = useMemo(() => {
    const by = sortBy;
    const key = (r) =>
      by === "lift"
        ? r.lift == null
          ? -Infinity
          : r.lift
        : by === "precision"
          ? r.holdout.P
          : r.holdout.F1;
    return [...viewResults].sort((a, b) => {
      const ga = a.holdout.support >= minSupport;
      const gb = b.holdout.support >= minSupport;
      if (ga !== gb) return ga ? -1 : 1;
      return key(b) - key(a);
    });
  }, [viewResults, sortBy, minSupport]);

  const topAction = sortedResults.length ? sortedResults[0] : null;

  // 이벤트별 고정 색상 — cache.results 삽입 순서 기준이라 정렬/선택이 바뀌어도 색이 안 흔들림.
  const actionColorMap = useMemo(() => {
    const m = {};
    (cache.results || []).forEach((r, i) => {
      m[r.action] = CHART_THEME.colors[i % CHART_THEME.colors.length];
    });
    return m;
  }, [cache.results]);

  // 이벤트별 달성률(전체 유저 중 비율) 5% 구간 대표점 — 각 이벤트의 최적 윈도우에서 k를
  // 스윕한 뒤 ahaCoverageBuckets로 접음. §2 드릴다운 곡선과 같은 학습셋(trainIdx) 기준이라
  // 최적 임계값(bestK)이 항상 포함됨. 산점도·표 브레이크다운 공용 데이터.
  const bucketsByAction = useMemo(() => {
    const out = {};
    if (!cache.trainIdx || !cache.targets) return out;
    for (const r of viewResults) {
      const wc = (r.windowCols || []).find((w) => w.window === r.bestWindow);
      if (!wc) continue;
      const sweep = AHA_STATS.thresholdSweep(wc.valuesAll, cache.targets, cache.trainIdx, cache.minSupport);
      out[r.action] = ahaCoverageBuckets(sweep, { stepPct: 5, bestK: r.bestK, baseRate: cache.baseRate });
    }
    return out;
  }, [viewResults, cache]);

  // 선택 상태: null=전체 표시. 토글 시 현재 유효집합을 실체화한 뒤 가감.
  const allActionNames = useMemo(() => sortedResults.map((r) => r.action), [sortedResults]);
  const isSel = (a) => (selectedActions ? selectedActions.has(a) : true);
  const selectedCount = selectedActions ? allActionNames.filter((a) => selectedActions.has(a)).length : allActionNames.length;
  const allSelected = selectedCount === allActionNames.length && allActionNames.length > 0;
  const toggleSel = (a) =>
    setSelectedActions((prev) => {
      const base = prev ? new Set(prev) : new Set(allActionNames);
      if (base.has(a)) base.delete(a);
      else base.add(a);
      return base;
    });
  const setAllSel = (on) => setSelectedActions(on ? new Set(allActionNames) : new Set());
  const toggleExpand = (a) =>
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });

  // 전문가 뷰 아코디언 열릴 때 산점도 재측정 (claude-ux.md §5: 접힌 <details> 안 차트는 폭 0으로 마운트)
  const onExpertToggle = (e) => {
    if (e.currentTarget.open && chartInstance.current) {
      requestAnimationFrame(() => {
        try {
          chartInstance.current && chartInstance.current.resize();
        } catch {
          /* noop */
        }
      });
    }
  };

  // 버블 차트 PNG 다운로드 (index.html data-pngdownload="aha-scatter" 이식)
  const handleScatterPng = () => {
    if (!chartRef.current) {
      showToast({ variant: "warn", title: tr("차트를 찾을 수 없음", "Chart not found"), body: "aha-scatter" });
      return;
    }
    downloadChartAsPNG(chartRef.current, "aha_scatter");
  };

  const actionCount = Object.keys(cache.groups || {}).length;
  const totalTargets = cache.results.length
    ? Math.round(cache.baseRate * cache.n)
    : 0;

  // 드릴다운 대상: 사용자가 고른 액션 or Top (윈도우 필터 적용된 목록 기준)
  const drillTarget =
    drilldownAction && viewResults.some((r) => r.action === drilldownAction)
      ? drilldownAction
      : (topAction || {}).action || null;
  const drillResult = drillTarget
    ? viewResults.find((r) => r.action === drillTarget)
    : null;

  // "300회 vs 100회 vs 50회면 어느 정도?" — 선택된 행동·윈도우 안에서 k(최소
  // 횟수)를 바꿔가며 F1/전체유저비중이 어떻게 변하는지 전 구간 스윕(§드릴다운 곡선).
  const kSweep = useMemo(() => {
    if (!drillResult || !drillResult.windowCols) return [];
    const wc = drillResult.windowCols.find((w) => w.window === drillResult.bestWindow);
    if (!wc) return [];
    return AHA_STATS.thresholdSweep(wc.valuesAll, cache.targets, cache.trainIdx, cache.minSupport);
  }, [drillResult, cache]);

  useEffect(() => {
    if (!hasData || !analyzed || !chartRef.current || !sortedResults.length) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // 이벤트마다 고유 색상 1개 + 달성률 5% 구간 대표점들을 선으로 이은 궤적.
    // 선택된(체크된) 이벤트만 그린다. 점은 작게(겹쳐도 서로 안 가림) — 최적 임계값은
    // 색을 안 바꾸고(이벤트 색 유지, 어느 곡선인지 계속 구분) 마지막에 별도 오버레이
    // 데이터셋으로 금색 링을 그 위에 얹어 다른 곡선/점에 절대 가려지지 않게 함.
    const shown = sortedResults.filter((r) => (selectedActions ? selectedActions.has(r.action) : true));
    const optimalOverlay = [];
    const datasets = shown.map((r) => {
      const color = actionColorMap[r.action] || "#94a3b8";
      const win = r.bestWindow === Infinity ? tr("전체", "All") : "d" + r.bestWindow;
      const bks = bucketsByAction[r.action] || [];
      const data = bks.map((b) => ({
        x: b.P,
        y: b.R,
        action: r.action,
        win,
        k: b.k,
        F1: b.F1,
        P: b.P,
        R: b.R,
        lift: b.lift,
        allSupport: b.allSupport,
        allPct: b.allPct,
        support: b.support,
        gated: b.gated,
        isOptimal: b.isOptimal,
      }));
      data.forEach((p) => {
        if (p.isOptimal) optimalOverlay.push({ ...p, _color: color });
      });
      return {
        label: r.action,
        data,
        showLine: true,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.5,
        tension: 0.25,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointBorderWidth: 1,
        pointRadius: data.map((p) => Math.max(2, Math.min(6, Math.sqrt(p.allSupport || 1) * 0.28))),
        pointHoverRadius: 6,
      };
    });
    if (optimalOverlay.length) {
      datasets.push({
        label: tr("★ 최적", "★ Optimal"),
        data: optimalOverlay,
        showLine: false,
        pointBackgroundColor: optimalOverlay.map((p) => p._color),
        pointBorderColor: "#facc15",
        pointBorderWidth: 3,
        pointRadius: 7,
        pointHoverRadius: 9,
      });
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: tr("Precision (정밀도)", "Precision"), color: CHART_THEME.text },
            min: 0,
            max: 1,
            ticks: { color: CHART_THEME.text },
            grid: { color: CHART_THEME.grid },
          },
          y: {
            title: { display: true, text: tr("Recall (재현율)", "Recall"), color: CHART_THEME.text },
            min: 0,
            max: 1,
            ticks: { color: CHART_THEME.text },
            grid: { color: CHART_THEME.grid },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "right",
            labels: {
              color: CHART_THEME.text,
              boxWidth: 12,
              font: { size: 11 },
              usePointStyle: true,
              filter: (item) => item.text !== tr("★ 최적", "★ Optimal"),
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const p = items?.[0]?.raw;
                return p ? `${p.action} (${p.win}, k≥${p.k})${p.isOptimal ? tr(" ★ 최적", " ★ optimal") : ""}` : "";
              },
              label: (ctx) => {
                const p = ctx.raw;
                if (!p) return [];
                return locale === "en"
                  ? [
                      `Reach ${(p.allPct * 100).toFixed(1)}% · ${p.allSupport?.toLocaleString()} users`,
                      `Precision ${(p.P * 100).toFixed(0)}% · Recall ${(p.R * 100).toFixed(0)}% · F1 ${p.F1?.toFixed(3)}`,
                      `Lift ${p.lift == null ? "—" : p.lift.toFixed(2) + "x"} · sample ${p.support?.toLocaleString()}${p.gated ? " ⊘low" : ""}`,
                    ]
                  : [
                      `달성률 ${(p.allPct * 100).toFixed(1)}% · ${p.allSupport?.toLocaleString()}명`,
                      `정밀도 ${(p.P * 100).toFixed(0)}% · 재현율 ${(p.R * 100).toFixed(0)}% · F1 ${p.F1?.toFixed(3)}`,
                      `평균 대비 ${p.lift == null ? "—" : p.lift.toFixed(2) + "배"} · 표본 ${p.support?.toLocaleString()}${p.gated ? " ⊘부족" : ""}`,
                    ];
              },
            },
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
  }, [hasData, analyzed, sortedResults, bucketsByAction, actionColorMap, selectedActions, minSupport, holdoutOn, locale, tr]);

  // 선택된 행동의 k-스윕 곡선(§"300회 vs 100회 vs 50회면 어느 정도?").
  useEffect(() => {
    if (sweepChartInstance.current) {
      sweepChartInstance.current.destroy();
      sweepChartInstance.current = null;
    }
    if (!hasData || !analyzed || !sweepChartRef.current || !kSweep.length) return undefined;

    const labels = kSweep.map((s) => `≥${s.k}`);
    sweepChartInstance.current = new Chart(sweepChartRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: tr("F1 (예측 정확도)", "F1 (accuracy)"),
            data: kSweep.map((s) => s.F1),
            borderColor: "#7aa2f7",
            backgroundColor: "rgba(122,162,247,0.15)",
            yAxisID: "y",
            tension: 0.25,
            pointRadius: kSweep.map((s) => (s.k === drillResult?.bestK ? 5 : 2)),
            pointBackgroundColor: kSweep.map((s) => (s.k === drillResult?.bestK ? "#facc15" : "#7aa2f7")),
          },
          {
            label: tr("전체 유저 중 비율(%)", "% of all users"),
            data: kSweep.map((s) => (s.allPct || 0) * 100),
            borderColor: "#9ece6a",
            borderDash: [4, 3],
            yAxisID: "y1",
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: "var(--text-muted)", maxTicksLimit: 12 }, grid: { color: "rgba(255,255,255,0.06)" } },
          y: { min: 0, max: 1, position: "left", title: { display: true, text: "F1", color: "var(--text-muted)" }, ticks: { color: "var(--text-muted)" }, grid: { color: "rgba(255,255,255,0.06)" } },
          y1: { min: 0, max: 100, position: "right", title: { display: true, text: tr("전체 유저 %", "% of all users"), color: "var(--text-muted)" }, ticks: { color: "var(--text-muted)", callback: (v) => v + "%" }, grid: { display: false } },
        },
        plugins: {
          legend: { labels: { color: "var(--text-muted)", font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = kSweep[ctx.dataIndex];
                if (ctx.dataset.yAxisID === "y1")
                  return locale === "en"
                    ? `${s.allSupport.toLocaleString()} users (${(s.allPct * 100).toFixed(1)}%) did it ≥${s.k} times`
                    : `전체 유저 중 ${s.allSupport.toLocaleString()}명(${(s.allPct * 100).toFixed(1)}%)이 ≥${s.k}회`;
                return locale === "en"
                  ? `F1 ${s.F1.toFixed(3)} · Precision ${s.P.toFixed(3)} · Recall ${s.R.toFixed(3)} · sample ${s.support.toLocaleString()}${s.gated ? " ⊘low sample" : ""}`
                  : `F1 ${s.F1.toFixed(3)} · Precision ${s.P.toFixed(3)} · Recall ${s.R.toFixed(3)} · 표본 ${s.support.toLocaleString()}${s.gated ? " ⊘표본부족" : ""}`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (sweepChartInstance.current) {
        sweepChartInstance.current.destroy();
        sweepChartInstance.current = null;
      }
    };
  }, [hasData, analyzed, kSweep, drillResult, locale, tr]);

  const analysisResultState = cache.results?.length > 0 ? "ready" : "insufficient";
  useEffect(() => {
    if (!analyzed) return;
    const signature = `${analyzedSig}|${activeSeg?.col || ""}|${activeSeg?.value || ""}`;
    if (analysisEventRef.current === signature) return;
    analysisEventRef.current = signature;
    trackProductEvent("analysis_completed", {
      tool_id: C.guideToolId,
      source: isDemo ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: "aha",
      result_state: analysisResultState,
    });
  }, [analyzed, analyzedSig, activeSeg, analysisResultState, C.guideToolId, isDemo, csvData?.raw?.length]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-aha">
        <section className="block" id="s-prep">
          <h2 className="section-title">{tr("데이터 준비", "Data setup")}</h2>
          <CsvGuide toolId={C.guideToolId} locale={locale} />
          <div
            className="csv-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleAhaFile(e.dataTransfer.files[0]); }}
            onClick={() => ahaFileRef.current?.click()}
            style={{ cursor: "pointer" }}
          >
            <div className="csv-drop-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div className="csv-drop-text">{tr("CSV 파일 드래그 & 드롭", "Drag & drop a CSV file")}</div>
            <div className="csv-drop-sub">{tr("또는 클릭하여 파일 선택", "or click to choose a file")}</div>
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={ahaFileRef}
              onChange={(e) => { if (e.target.files?.[0]) handleAhaFile(e.target.files[0]); e.target.value = null; }} />
          </div>
          <DemoLoadButton onLoad={handleLoadDemo} locale={locale} />
        </section>
        <AnalyzingOverlay show={isParsing} title={tr("데이터 불러오는 중…", "Loading data…")} sub={tr("큰 파일은 몇 초 걸릴 수 있어요", "Large files may take a few seconds")} />
      </div>
    );
  }

  const targetCol = cache.targetCol;
  const missing = [];
  if (!targetCol) missing.push(C.missingTarget);
  if (!actionCount) missing.push(C.missingFeature);

  const showResults = missing.length === 0 && analyzed && cache.results.length > 0;

  return (
    <div className="tab-pane active" id="tab-aha">
      <AnalyzingOverlay show={isParsing} title={tr("데이터 불러오는 중…", "Loading data…")} sub={tr("큰 파일은 몇 초 걸릴 수 있어요", "Large files may take a few seconds")} />
      <AnalyzingOverlay show={isAnalyzing} title={tr("분석 중…", "Analyzing…")} sub={tr(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)} />
      {/* 세그먼트는 이 결과에만 적용되는 로컬 제어다. 전역 sticky 헤드 대신 결과 직전에서 고른다. */}
      {segMeta.length > 0 && (
        <section className="analysis-local-controls" id="s-aha-segment" aria-label={tr("결과 나눠보기", "Break down results")}>
          <div className="analysis-local-controls__inner">
            <span className="analysis-local-controls__label">{tr("결과 나눠보기", "Break down results")}</span>
            <button className={`ab-pill ${validSeg == null ? "active" : ""}`} onClick={() => setActiveSeg(null)} title={tr("전체 데이터로 분석", "Analyze the whole dataset")}>{tr("전체", "All")}</button>
            {segMeta.map((s) => (
              <React.Fragment key={s.col}>
                <span style={{ width: "1px", height: "18px", background: "var(--border)" }}></span>
                <span style={{ fontSize: "11.5px", color: MUTED }}>{s.col}:</span>
                {s.values.map((v) => {
                  const on = validSeg && validSeg.col === s.col && validSeg.value === v.value;
                  return (
                    <button key={v.value} className={`ab-pill ${on ? "active" : ""}`}
                      onClick={() => setActiveSeg(on ? null : { col: s.col, value: v.value })}
                      title={tr(`${v.count.toLocaleString()}행`, `${v.count.toLocaleString()} rows`)}>
                      {v.value} <span style={{ color: MUTED, fontSize: "10px" }}>{v.count.toLocaleString()}</span>
                    </button>
                  );
                })}
                {s.truncated && <span style={{ fontSize: "10.5px", color: "#f59e0b" }}>⚠ {tr("상위 20개만", "top 20 only")}</span>}
              </React.Fragment>
            ))}
            {validSeg && (
              <span style={{ fontSize: "11px", color: MUTED, marginLeft: "auto" }}>
                {tr("현재", "Currently analyzing")} <strong style={{ color: "var(--text-1)" }}>{validSeg.col}={validSeg.value}</strong>{tr("만 분석 중", " only")}
              </span>
            )}
          </div>
        </section>
      )}
      {isDemo && (
        <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <strong>🧪 {tr("지금 보고 있는 화면은 샘플(예시) 데이터입니다", "You're viewing sample (demo) data")}</strong>
            <p style={{ margin: "0.25rem 0 0" }}>{tr("실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.", "This isn't your real data and nothing is sent to a server. Upload your own CSV to replace it instantly.")}</p>
          </div>
          <button className="ab-button" onClick={resetCsv}>📁 {tr("내 CSV 업로드하기", "Upload my CSV")}</button>
        </div>
      )}
      <section className="block" id="s-aha-map">
        <h2 className="section-title"><span className="ix">§0</span>{tr("컬럼 역할 매핑", "Column role mapping")}</h2>
        <div className="csv-loaded-bar">
          <div className="csv-loaded-info">
            <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
            {isDemo ? <strong>{tr("샘플 데이터로 미리보기 중", "Previewing sample data")}</strong> : <strong>{csvData.fileName || "data.csv"}</strong>}
            <span className="csv-loaded-stats tnum">
              {tr(
                `${csvData.raw.length.toLocaleString()}행 · ${headers.length}컬럼 · 후보 액션 ${actionCount}개${isDemo ? " · 실제 데이터 아님" : ""}`,
                `${csvData.raw.length.toLocaleString()} rows · ${headers.length} columns · ${actionCount} candidate actions${isDemo ? " · not real data" : ""}`,
              )}
            </span>
          </div>
          {!isDemo && <button className="ab-pill csv-change-btn" onClick={resetCsv}>⟳ {tr("CSV 변경", "Change CSV")}</button>}
        </div>
        <details open={!analyzed} style={{ marginTop: "10px" }}>
          <summary style={{ cursor: "pointer", fontSize: "12.5px", fontWeight: 600, color: analyzed ? "var(--text-muted)" : "#adc6ff" }}>🗂 {tr("컬럼 역할 매핑", "Column role mapping")} {analyzed ? tr("(분석 완료 — 펼쳐서 수정)", "(analysis done — expand to edit)") : tr("(자동 추정 — 틀리면 수정)", "(auto-detected — edit if wrong)")}</summary>
          <p className="muted" style={{ fontSize: "12px", margin: "8px 0" }}>
            {locale === "en" ? (
              <>
                <strong>If headers look like <code className="inline">{"{action}_d{N}"}</code>, the action and window are auto-parsed</strong> (e.g. <code className="inline">invite_d7</code> → action invite, window d7). The target column is auto-guessed from 0/1 values — pick it manually if wrong. If a revenue column like <code className="inline">revenue_d7</code> was wrongly picked up as a candidate, exclude it via &quot;unused&quot;.
              </>
            ) : (
              <>
                <strong>헤더가 <code className="inline">{"{action}_d{N}"}</code> 형태면 액션·윈도우가 자동 파싱</strong>됩니다(예: <code className="inline">invite_d7</code> → 액션 invite, 윈도우 d7). target 컬럼은 0/1 값으로 자동 추정 — 틀리면 직접 선택하세요. <code className="inline">revenue_d7</code> 같은 매출 컬럼이 잘못 후보로 잡혔으면 &quot;사용 안 함&quot;으로 제외하세요.
              </>
            )}
          </p>
          <AhaColumnMapper headers={headers} rows={csvData.raw} colMap={colMap} onChange={setColMap} locale={locale} />
        </details>
        {missing.length > 0 ? (
          <div className="required-banner" style={{ marginTop: "12px" }}>
            <strong>⚠ {tr("필수 역할이 비어 있습니다", "Required roles are not mapped")}</strong>
            <p style={{ margin: ".25rem 0 0" }}>
              {missing.map((m) => (
                <code key={m} className="inline" style={{ marginRight: "6px" }}>{m}</code>
              ))}
            </p>
          </div>
        ) : analyzed ? (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>✓ {tr("분석 완료", "Analysis complete")}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr('매핑을 바꾸면 결과가 숨겨지고 다시 "분석하기"를 눌러야 합니다.', 'Changing the mapping hides results until you click "Analyze" again.')}</span>
            <button className="ab-pill" style={{ marginLeft: "auto" }} onClick={runAhaAnalysis}>↻ {tr("다시 분석", "Re-analyze")}</button>
          </div>
        ) : (
          <div style={{ marginTop: "12px", background: "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))", border: "1px solid rgba(122,162,247,0.3)", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12.5px", color: "var(--text-1)" }}>✅ {tr("필수 역할 매핑 완료.", "Required roles are mapped.")} <strong>{tr("매핑이 맞는지 확인한 뒤 분석을 실행하세요.", "Confirm the mapping looks right, then run the analysis.")}</strong></div>
            <button className="ab-pill" style={{ background: "#7aa2f7", color: "#0b0d12", fontWeight: 700, borderColor: "#7aa2f7", fontSize: "13px", padding: "8px 18px" }} onClick={runAhaAnalysis}>▶ {tr("분석하기", "Analyze")}</button>
          </div>
        )}
      </section>

      {showResults && (
        <>
          {/* ── §0 한눈에 보기 — 여정 질문 + 평어 결론 (통계는 흐린 글씨로 강등) ── */}
          <section className="block" id="s-aha-hero" style={{ background: "linear-gradient(135deg, rgba(122,162,247,0.12), rgba(192,132,252,0.05))", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "14px", padding: "18px 20px" }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>{C.heroQ}</h2>
            <p className="muted" style={{ fontSize: "12px", marginTop: "-4px", marginBottom: "14px" }}>
              {C.heroSub}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "12px", marginBottom: "14px" }}>
              {[
                [C.statAll, cache.n.toLocaleString(), null],
                [C.statTarget, totalTargets.toLocaleString(), null],
                [C.statRate, (cache.baseRate * 100).toFixed(1) + "%", tr("아무 조건 없을 때 기준 (base rate)", "baseline with no conditions (base rate)")],
              ].map(([label, val, sub]) => (
                <div key={label} style={{ background: "var(--surface-container-low)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "11px", color: MUTED }}>{label}</div>
                  <div className="tnum" style={{ fontSize: "20px", fontWeight: 700 }}>{val}</div>
                  {sub ? <div style={{ fontSize: "10px", color: MUTED, marginTop: "2px" }}>{sub}</div> : null}
                </div>
              ))}
            </div>
            {topAction ? (
              <div style={{ background: "var(--surface-container-low)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", color: MUTED, marginBottom: "4px" }}>🏆 {tr("가장 강한 신호", "Strongest signal")}</div>
                <div
                  style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{
                    __html: C.leadPhrase(
                      topAction.bestWindow === Infinity ? "전체 기간" : topAction.bestWindow + "일",
                      escapeHtml(topAction.action),
                      topAction.bestK,
                      topAction.lift == null ? "—" : topAction.lift.toFixed(1) + "배",
                    ),
                  }}
                />
                <div style={{ fontSize: "10.5px", color: MUTED, marginTop: "6px", opacity: 0.85 }} title={tr("통계 원값(전문가용): 홀드아웃 F1 = 정밀도·재현율 조화평균", "Raw statistic (expert): holdout F1 = harmonic mean of precision and recall")}>
                  {tr("예측력(F1)", "Predictive strength (F1)")} {topAction.holdout.F1.toFixed(2)} · {tr("예측력 표시", "predictive strength")} {confidenceDots(topAction.holdout.F1)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: MUTED, marginBottom: "12px" }}>{tr("분석 가능한 액션이 없습니다 — 매핑을 확인하세요.", "No analyzable actions — check the column mapping.")}</div>
            )}
            <div className="callout warn" style={{ margin: 0 }}>
              <div className="ico">⚠</div>
              <div className="body">
                <strong>{C.causationTitle}</strong>
                <p style={{ margin: ".25rem 0 0" }}>{C.causationBody}</p>
                <p style={{ margin: ".25rem 0 0" }}>{tr("확정은", "Confirm it with a")}{" "}
                  <a
                    href={
                      locale === "en" && hasEnVersion("5-4")
                        ? `/en${idToSlug["5-4"] || ""}`
                        : idToSlug["5-4"] || "/tools/experiment-analysis"
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(
                        locale === "en" && hasEnVersion("5-4")
                          ? `/en${idToSlug["5-4"] || ""}`
                          : idToSlug["5-4"] || "/tools/experiment-analysis"
                      );
                    }}
                    style={{ color: "#adc6ff", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {tr("홀드아웃 실험(5-4)", "holdout experiment (5-4)")}
                  </a>
                  {tr("으로 검증하세요.", ".")}</p>
              </div>
            </div>
          </section>

          {/* ── §1 칸반 그룹핑 — 신호 세기별 3버킷(배지 반복 대신 칼럼 헤더가 곧 상태) ── */}
          {(() => {
            const buckets = { strong: [], maybe: [], weak: [] };
            sortedResults.forEach((r) => buckets[ahaBucketOf(r, minSupport)].push(r));
            const nS = buckets.strong.length;
            const headTone = nS > 0 ? "strong" : buckets.maybe.length > 0 ? "maybe" : "weak";
            const headline = nS > 0
              ? C.kanbanHeadStrong(sortedResults.length, nS)
              : buckets.maybe.length > 0
                ? tr(`뚜렷하게 강한 신호는 없지만 ${buckets.maybe.length}개는 살펴볼 만해요.`, `No clearly strong signal, but ${buckets.maybe.length} are worth a look.`)
                : tr(`표본이 충분한 후보가 적어요 — 전문가 뷰에서 최소 표본을 낮추거나 데이터를 더 모아보세요.`, `Few candidates have enough sample — lower the minimum sample in the expert view or collect more data.`);
            const col = (key, title, icon) => {
              const list = buckets[key];
              const c = AHA_TONE[key];
              return (
                <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginBottom: "8px" }}>{icon} {title} · {list.length}</div>
                  {list.length ? list.map((r) => (
                    <div key={r.action} onClick={() => setDrilldownAction(r.action)}
                      style={{ background: "var(--surface-container-low)", border: `1px solid ${r.action === drillTarget ? "rgba(122,162,247,0.55)" : "var(--border)"}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px", cursor: "pointer" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                        <span>{r.action}</span><span style={{ fontSize: "11px", color: MUTED }}>›</span>
                      </div>
                      <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>{ahaActionPhrase(r, locale)}</div>
                    </div>
                  )) : <div style={{ fontSize: "11px", color: MUTED }}>{tr("없음", "None")}</div>}
                </div>
              );
            };
            return (
              <section className="block" id="s-aha-kanban">
                <h2 className="section-title"><span className="ix">§1</span>{C.kanbanTitle}</h2>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", background: AHA_TONE[headTone].bg, border: `1px solid ${AHA_TONE[headTone].border}`, borderRadius: "10px", padding: "10px 14px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "10px" }}>
                  {col("strong", tr("강한 Aha 신호", "Strong Aha signal"), "✓")}
                  {col("maybe", tr("살펴볼 만함", "Worth a look"), "?")}
                  {col("weak", tr("약함 · 표본 부족", "Weak · low sample"), "⊘")}
                </div>
                <p style={{ fontSize: "11px", color: MUTED, marginTop: "10px" }}>{tr("행동 칩을 클릭하면 아래에서 자세한 근거(윈도우×횟수)를 볼 수 있어요. 강함/애매/약함 기준은 맨 아래 상세 문서에 설명돼 있어요.", "Click an action chip to see the detailed evidence (window × count) below. The strong/maybe/weak criteria are explained in the detailed doc at the bottom.")}</p>
              </section>
            );
          })()}

          {/* ── §2 드릴다운 — 평어 해석(디테일화) + 윈도우×k 히트맵 ── */}
          <section className="block" id="s-aha-drill">
            <h2 className="section-title"><span className="ix">§2</span>{C.drillTitle}{drillTarget ? ` — ${drillTarget}` : ""}</h2>
            {drillResult && viewResults.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <select className="map-select" value={drillTarget} onChange={(e) => setDrilldownAction(e.target.value)}>
                  {viewResults.map((x) => (
                    <option key={x.action} value={x.action}>{x.action}</option>
                  ))}
                </select>
              </div>
            )}
            {drillResult && (() => {
              const bucket = ahaBucketOf(drillResult, minSupport);
              const c = AHA_TONE[bucket];
              const badge = bucket === "strong" ? tr("강한 Aha 신호", "Strong Aha signal") : bucket === "maybe" ? tr("살펴볼 만함", "Worth a look") : tr("약함 · 표본 부족", "Weak · low sample");
              const win = drillResult.bestWindow === Infinity ? "전체 기간" : `${drillResult.bestWindow}일`;
              const P = drillResult.holdout.P, R = drillResult.holdout.R;
              const overfit = drillResult.train.F1 - drillResult.holdout.F1 > 0.2;
              const metric = (q, ans, help, tech) => (
                <div style={{ background: "var(--surface-container-low)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4, minHeight: "34px" }}>{q}</div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-1)", margin: "6px 0 4px" }}>{ans}</div>
                  <div style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>{help}</div>
                  <div style={{ fontSize: "10px", color: MUTED, marginTop: "6px", opacity: 0.8 }} title={tr("통계 원값(전문가용)", "Raw statistic (expert)")}>{tech}</div>
                </div>
              );
              return (
                <>
                  <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "12px", display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "999px", background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, fontSize: "11.5px", whiteSpace: "nowrap" }}>{badge}</span>
                    <div style={{ flex: 1, minWidth: "240px" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{
                          __html: C.drillHeadline(
                            win,
                            escapeHtml(drillResult.action),
                            drillResult.bestK,
                            drillResult.holdout.support.toLocaleString(),
                            (P * 100).toFixed(0),
                            (R * 100).toFixed(0),
                          ),
                        }}
                      />
                      {overfit && (
                        <div style={{ fontSize: "11.5px", color: "#fbbf24", marginTop: "6px" }}>⚠ {tr("학습셋에선 잘 맞는데 검증셋(홀드아웃)에서 뚝 떨어져요 — 우연일 수 있으니 표본을 더 확인하세요.", "It fit well on the training set but dropped sharply on the validation set (holdout) — this could be coincidence, so check the sample further.")}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "10px", marginBottom: "14px" }}>
                    {metric(C.metricQAll, tr(`${(drillResult.allPct * 100).toFixed(0)}% (${(drillResult.allSupport || 0).toLocaleString()}명)`, `${(drillResult.allPct * 100).toFixed(0)}% (${(drillResult.allSupport || 0).toLocaleString()} users)`), tr("정착 여부와 무관하게, 전체 중 이 조건(윈도우×횟수)을 채운 비율.", "Regardless of retention, the share of everyone who met this condition (window × count)."), `${tr("전체 대비", "vs. total")} support ${drillResult.allSupport || 0} / n`)}
                    {metric(C.metricQPrecision, C.metricAPrecision((P * 100).toFixed(0)), tr("조건을 충족한 대상 중 실제 전환 비율. 높을수록 확실한 신호.", "The actual conversion rate among those who met the condition. Higher means a more certain signal."), `${tr("정밀도", "Precision")}(Precision) ${P.toFixed(3)}`)}
                    {metric(C.metricQRecall, tr(`${(R * 100).toFixed(0)}% 포함`, `${(R * 100).toFixed(0)}% covered`), tr("실제 전환한 대상 중 이 조건을 거친 비율. 높을수록 폭넓게 설명.", "The share of actual converters who went through this condition. Higher means broader coverage."), `${tr("재현율", "Recall")}(Recall) ${R.toFixed(3)}`)}
                    {metric(tr("평균보다 몇 배 잘 맞나?", "How many times better than average?"), drillResult.lift == null ? "—" : tr(`${drillResult.lift.toFixed(1)}배`, `${drillResult.lift.toFixed(1)}x`), tr("아무 조건 없는 평균 정착률 대비 배수. 1.5배↑ 강한 연관.", "Multiple vs. the plain average retention rate. 1.5x+ is a strong association."), `Lift ${drillResult.lift == null ? "—" : drillResult.lift.toFixed(3)}`)}
                  </div>
                </>
              );
            })()}
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)", marginTop: "4px" }}>{tr("어떤 기간·횟수 조합이 가장 강했나?", "Which period × count combination was strongest?")} <span style={{ color: MUTED, fontWeight: 400 }}>{tr("(윈도우 × 횟수 히트맵)", "(window × count heatmap)")}</span></div>
            <p className="muted" style={{ fontSize: "11.5px", margin: "2px 0 8px" }}>{tr("진할수록 예측 정확도(F1)가 높고, 굵은 테두리 = 자동으로 고른 최적 조합.", "Darker means higher accuracy (F1), and the bold border = the auto-selected optimal combination.")} <strong>{tr("한 칸만 튀고 주변이 흐리면 우연(과적합) 의심", "If only one cell stands out while neighbors are faint, suspect coincidence (overfitting)")}</strong>{tr("이에요.", ".")}</p>
            <div className="table-wrap">
              {(() => {
                if (!drillResult || !drillResult.grid.length) {
                  return (
                    <table className="data" style={{ fontSize: "12px" }}>
                      <thead><tr><th>{tr("횟수 \\ 기간", "Count \\ period")}</th></tr></thead>
                      <tbody>
                        <tr><td colSpan="1" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("선택된 행동이 없습니다", "No action selected")}</td></tr>
                      </tbody>
                    </table>
                  );
                }
                const grid = drillResult.grid;
                const windows = [...new Set(grid.map((g) => g.window))].sort((a, b) => a - b);
                const ks = [...new Set(grid.map((g) => g.k))].sort((a, b) => a - b);
                const cellFor = (w, k) => grid.find((g) => g.window === w && g.k === k);
                const maxF1 = Math.max(...grid.map((g) => g.F1), 0.0001);
                return (
                  <table className="data" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th title={tr("가로=관측 기간(윈도우), 세로=최소 실행 횟수", "Columns = observation period (window), rows = minimum count")}>{tr("횟수 \\ 기간", "Count \\ period")}</th>
                        {windows.map((w) => (
                          <th key={w} className="tnum">{w === Infinity ? tr("전체", "All") : "d" + w}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ks.map((k) => (
                        <tr key={k}>
                          <td className="tnum">≥{k}</td>
                          {windows.map((w) => {
                            const cell = cellFor(w, k);
                            if (!cell) return <td key={w} className="tnum" style={{ color: "var(--text-muted)" }}>—</td>;
                            const isBest = cell.window === drillResult.bestWindow && cell.k === drillResult.bestK;
                            const intensity = Math.round((cell.F1 / maxF1) * 100);
                            return (
                              <td
                                key={w}
                                className="tnum"
                                title={tr(`정확도(F1) ${cell.F1.toFixed(2)}`, `Accuracy (F1) ${cell.F1.toFixed(2)}`)}
                                style={{
                                  background: `rgba(122,162,247,${((intensity / 100) * 0.45).toFixed(2)})`,
                                  outline: isBest ? "2px solid #7aa2f7" : undefined,
                                  fontWeight: isBest ? 700 : undefined,
                                }}
                              >
                                {cell.F1.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {kSweep.length > 0 && (
              <div style={{ marginTop: "18px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)" }}>
                  {tr("횟수(k)를 바꾸면 어떻게 달라지나?", "What changes if you vary the count (k)?")} <span style={{ color: MUTED, fontWeight: 400 }}>({drillResult.bestWindow === Infinity ? tr("전체 기간", "the whole period") : `d${drillResult.bestWindow}`} {tr("고정, k 스윕", "fixed, k sweep")})</span>
                </div>
                <p className="muted" style={{ fontSize: "11.5px", margin: "2px 0 8px" }}>
                  {tr(
                    <>파랑 실선 = 그 횟수를 기준으로 잡았을 때 예측 정확도(F1) · 초록 점선 = 전체 유저 중 그 횟수 이상을 실제로 하는 비율(%). <span style={{ color: "#facc15" }}>●</span> 금색 점 = 자동으로 고른 최적 횟수(≥{drillResult.bestK}). 300회처럼 기준을 높이면 F1은 오르내릴 수 있지만 그만큼 해당하는 유저(초록선)는 줄어들어요.</>,
                    <>Blue solid line = accuracy (F1) when using that count as the threshold · green dashed line = % of all users who actually did it that many times or more. <span style={{ color: "#facc15" }}>●</span> Gold dot = the auto-selected optimal count (≥{drillResult.bestK}). Raising the bar (e.g. to 300) can move F1 up or down, but the users who qualify (green line) shrink accordingly.</>,
                  )}
                </p>
                <div className="chart-container" style={{ height: "220px" }}>
                  <canvas ref={sweepChartRef}></canvas>
                </div>
              </div>
            )}
          </section>

          {/* ── 2층: 전문가 뷰(기본 접힘) — 정렬·표본 설정, 산점도, 전체 지표 표 ── */}
          <details className="block" onToggle={onExpertToggle}>
            <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>
              📊 {tr("전문가 뷰 — 정밀도·재현율 산점도, 전체 지표 표, 정렬·표본 설정", "Expert view — precision/recall scatter, full metrics table, sort & sample settings")}
            </summary>
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: MUTED }}>{tr("정렬:", "Sort:")}</span>
                  <button className={`ab-pill ${sortBy === "f1" ? "active" : ""}`} onClick={() => setSortBy("f1")}>F1</button>
                  <button className={`ab-pill ${sortBy === "lift" ? "active" : ""}`} onClick={() => setSortBy("lift")}>Lift</button>
                  <button className={`ab-pill ${sortBy === "precision" ? "active" : ""}`} onClick={() => setSortBy("precision")}>Precision</button>
                </div>
                {availWindows.length > 1 && (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }} title={tr("켜면 액션마다 자동 선택된 최적 윈도우 대신, 고른 구간(D1/D7 등) 기준으로만 비교합니다.", "When on, compares actions using the chosen window (D1/D7, etc.) instead of each action's auto-selected optimal window.")}>
                    <span style={{ fontSize: "12px", color: MUTED }}>{tr("구간:", "Window:")}</span>
                    <button className={`ab-pill ${windowFilter == null ? "active" : ""}`} onClick={() => setWindowFilter(null)}>{tr("자동(최적)", "Auto (optimal)")}</button>
                    {availWindows.map((w) => (
                      <button key={w} className={`ab-pill ${windowFilter === w ? "active" : ""}`} onClick={() => setWindowFilter(w)}>D{w}</button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: MUTED }}>{tr("최소 표본(support):", "Min. sample (support):")}</span>
                  <input type="number" min="1" step="1" value={minSupport} onChange={(e) => setMinSupport(Number(e.target.value))} style={{ width: "70px" }} className="map-select" />
                </div>
                <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "12px", color: MUTED, cursor: "pointer" }}>
                  <input type="checkbox" checked={holdoutOn} onChange={(e) => setHoldoutOn(e.target.checked)} /> Train/Holdout 50:50 split
                </label>
              </div>
              <p className="muted" style={{ fontSize: "11.5px", marginBottom: "14px" }}>{tr("윈도우는 그리드에서 자동 선택됩니다. train에서 k를 고르고 holdout에서 재평가해 낙관 편향(overfitting)을 줄입니다.", "The window is auto-selected from the grid. k is chosen on the training set and re-evaluated on the holdout to reduce optimism bias (overfitting).")}</p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>{tr("정밀도 × 재현율 산점도 — 이벤트별 달성률 곡선", "Precision × recall scatter — reach curve by event")}</div>
                <button className="ab-pill" onClick={handleScatterPng}>⬇ PNG</button>
              </div>
              <p className="muted">{tr(
                <>X=정밀도, Y=재현율. <strong>이벤트마다 색이 다르고</strong>, 각 점은 <strong>달성률(전체 유저 중 그 조건을 채운 비율) 5% 구간</strong>이에요 — 점을 이은 선을 따라가면 기준을 느슨/빡빡하게 했을 때 정밀도·재현율이 어떻게 바뀌는지 보입니다. 점 크기 = 해당 인원, <span style={{ color: "#facc15" }}>●</span> 금색 큰 점 = 자동으로 고른 최적 지점. <strong>아래 표의 체크박스로 표시할 이벤트를 고르세요.</strong></>,
                <>X=precision, Y=recall. <strong>Each event has its own color</strong>, and each point is a <strong>5% reach bucket</strong> (share of all users meeting that condition) — follow the line to see how precision/recall change as the bar is loosened/tightened. Point size = number of users, <span style={{ color: "#facc15" }}>●</span> large gold point = the auto-selected optimal point. <strong>Use the checkboxes in the table below to choose which events to show.</strong></>,
              )}</p>
              {allActionNames.length > 0 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11.5px", color: MUTED }}>{tr(`표시: ${selectedCount}/${allActionNames.length}개`, `Showing: ${selectedCount}/${allActionNames.length}`)}</span>
                  <button className="ab-pill" onClick={() => setAllSel(true)}>{tr("전체 선택", "Select all")}</button>
                  <button className="ab-pill" onClick={() => setAllSel(false)}>{tr("전체 해제", "Deselect all")}</button>
                </div>
              )}
              <div className="chart-container" style={{ height: "380px", marginBottom: "16px" }}>
                {selectedCount === 0 ? (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: "12.5px" }}>{tr("표시할 이벤트를 아래 표에서 체크하세요.", "Check events to display in the table below.")}</div>
                ) : null}
                <canvas ref={chartRef} style={{ display: selectedCount === 0 ? "none" : undefined }}></canvas>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>{tr("전체 지표 표", "Full metrics table")}</div>
                <button className="ab-pill" onClick={() => downloadAhaCsv(sortedResults, cache)} disabled={sortedResults.length === 0} title={tr("액션 × 윈도우(D1/D7) × 구간(k) 전 조합 long-format — is_optimal=1이 최적 지점", "Long-format: every action × window (D1/D7) × threshold (k) combination — is_optimal=1 marks the optimal point")}>⬇ CSV</button>
              </div>
              <p className="muted" style={{ fontSize: "11.5px" }}>{tr(
                <><strong>체크박스</strong> = 위 산점도에 표시 · <strong>행(▸) 클릭</strong> = 달성률 구간별 상세 펼치기. 초록 lift = 강한 연관(≥1.5×). 빨강 F1 = train≫holdout(과적합 의심). 색 = 산점도 이벤트 색.</>,
                <><strong>Checkbox</strong> = show in the scatter above · <strong>click row (▸)</strong> = expand reach-bucket detail. Green lift = strong association (≥1.5x). Red F1 = train≫holdout (suspected overfitting). Color = matches the scatter event color.</>,
              )}</p>
              <div className="table-wrap">
                <table className="data" style={{ fontSize: "12.5px" }}>
                  <thead><tr><th style={{ width: "30px", textAlign: "center" }}><input type="checkbox" checked={allSelected} onChange={(e) => setAllSel(e.target.checked)} title={tr("전체 표시 토글", "Toggle show all")} /></th><th style={{ width: "22px" }}></th><th>{tr("액션", "Action")}</th><th title={tr("가장 강한 연관을 보인 관측 기간", "Observation period with the strongest association")}>{tr("최적 윈도우", "Best window")}</th><th title={tr("그 기간 내 최소 실행 횟수 (≥k)", "Minimum count within that period (≥k)")}>{tr("기준 횟수", "Threshold count")}</th><th title={tr("타겟 달성 여부와 무관하게, 전체 유저 중 이 조건을 채운 인원·비율", "Regardless of target achievement, the number/share of all users meeting this condition")}>{tr("전체 유저 중", "% of all users")}</th><th title={tr("홀드아웃 F1 = 정밀도·재현율 조화평균", "Holdout F1 = harmonic mean of precision and recall")}>{tr("홀드아웃 F1", "Holdout F1")}</th><th title={tr("Precision — 조건 충족 유저 중 실제 타겟 달성 비율", "Precision — actual target-achievement rate among users meeting the condition")}>{tr("정밀도", "Precision")}</th><th title={tr("Recall — 타겟 달성 유저 중 조건 충족 비율", "Recall — share of target-achieving users who met the condition")}>{tr("재현율", "Recall")}</th><th title={tr("Lift — base rate 대비 정밀도 배수", "Lift — precision multiple vs. base rate")}>Lift</th><th title={tr("조건 충족 유저 수", "Number of users meeting the condition")}>{tr("표본", "Sample")}</th><th title={tr("학습셋 F1 (홀드아웃과 큰 차이 = 과적합)", "Training-set F1 (large gap vs. holdout = overfitting)")}>{tr("학습 F1", "Train F1")}</th></tr></thead>
                  <tbody>
                    {sortedResults.length === 0 ? (
                      <tr><td colSpan="12" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("분석 가능한 액션이 없습니다", "No analyzable actions")}</td></tr>
                    ) : (
                      sortedResults.map((r) => {
                        const lowSupport = r.holdout.support < minSupport;
                        const overfit = r.train.F1 - r.holdout.F1 > 0.2;
                        const liftStrong = r.lift != null && r.lift >= 1.5;
                        const color = actionColorMap[r.action] || "#94a3b8";
                        const isExpanded = expandedActions.has(r.action);
                        const bks = bucketsByAction[r.action] || [];
                        return (
                          <React.Fragment key={r.action}>
                            <tr style={{ color: lowSupport ? "var(--text-muted)" : undefined }}>
                              <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={isSel(r.action)} onChange={() => toggleSel(r.action)} title={tr("산점도에 표시", "Show in scatter")} />
                              </td>
                              <td style={{ cursor: "pointer", textAlign: "center", color: MUTED }} onClick={() => toggleExpand(r.action)} title={tr("달성률 구간별 상세", "Reach-bucket detail")}>{isExpanded ? "▾" : "▸"}</td>
                              <td style={{ cursor: "pointer" }} onClick={() => toggleExpand(r.action)}>
                                <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "2px", background: color, marginRight: "6px", verticalAlign: "middle" }}></span>
                                {r.action}{lowSupport ? " ⊘" : ""}
                              </td>
                              <td className="tnum">{r.bestWindow === Infinity ? tr("전체", "All") : "d" + r.bestWindow}</td>
                              <td className="tnum">≥{r.bestK}</td>
                              <td className="tnum">{(r.allSupport || 0).toLocaleString()}{tr("명", "")} <span style={{ color: MUTED, fontSize: "10.5px" }}>({((r.allPct || 0) * 100).toFixed(1)}%)</span></td>
                              <td className="tnum" style={{ color: overfit ? "#f87171" : undefined }}>{r.holdout.F1.toFixed(3)}</td>
                              <td className="tnum">{r.holdout.P.toFixed(3)}</td>
                              <td className="tnum">{r.holdout.R.toFixed(3)}</td>
                              <td className="tnum" style={{ color: liftStrong ? "#22c55e" : undefined, fontWeight: liftStrong ? 600 : undefined }}>{r.lift == null ? "—" : r.lift.toFixed(2) + "×"}</td>
                              <td className="tnum">{r.holdout.support.toLocaleString()}{lowSupport ? " ⊘" : ""}</td>
                              <td className="tnum">{r.train.F1.toFixed(3)}</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan="12" style={{ padding: "0", background: "var(--surface-container-low)" }}>
                                  <div style={{ padding: "10px 12px 12px 40px", borderLeft: `3px solid ${color}` }}>
                                    <div style={{ fontSize: "11.5px", color: MUTED, marginBottom: "6px" }}>
                                      {tr(
                                        <><strong style={{ color: "var(--text-1)" }}>{r.action}</strong> — 기준({r.bestWindow === Infinity ? "전체 기간" : `d${r.bestWindow}`})을 느슨하게(달성률↑)~빡빡하게(달성률↓) 바꿨을 때 구간별 데이터. <span style={{ color: "#facc15" }}>★</span> = 자동으로 고른 최적 지점.</>,
                                        <><strong style={{ color: "var(--text-1)" }}>{r.action}</strong> — bucketed data as the threshold ({r.bestWindow === Infinity ? "the whole period" : `d${r.bestWindow}`}) is loosened (reach↑) to tightened (reach↓). <span style={{ color: "#facc15" }}>★</span> = the auto-selected optimal point.</>,
                                      )}
                                    </div>
                                    {bks.length === 0 ? (
                                      <div style={{ fontSize: "11.5px", color: MUTED }}>{tr("구간을 만들 데이터가 부족합니다.", "Not enough data to build buckets.")}</div>
                                    ) : (
                                      <table className="data" style={{ fontSize: "11.5px", margin: 0 }}>
                                        <thead>
                                          <tr>
                                            <th title={tr("전체 유저 중 이 조건을 채운 비율", "Share of all users meeting this condition")}>{tr("달성률", "Reach")}</th>
                                            <th title={tr("그 달성률을 만드는 최소 실행 횟수", "Minimum count producing that reach")}>{tr("기준 횟수", "Threshold count")}</th>
                                            <th title={tr("이 조건을 채운 인원", "Users meeting this condition")}>{tr("해당 인원", "Users")}</th>
                                            <th title={tr("조건 충족 유저 중 실제 전환 비율", "Actual conversion rate among users meeting the condition")}>{tr("정밀도", "Precision")}</th>
                                            <th title={tr("실제 전환 유저 중 조건 충족 비율", "Share of actual converters meeting the condition")}>{tr("재현율", "Recall")}</th>
                                            <th title={tr("정밀도·재현율 조화평균", "Harmonic mean of precision and recall")}>F1</th>
                                            <th title={tr("평균 정착률 대비 배수", "Multiple vs. average retention rate")}>{tr("평균 대비", "vs. average")}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {bks.map((b) => (
                                            <tr key={b.k} style={{ background: b.isOptimal ? "rgba(250,204,21,0.14)" : undefined, fontWeight: b.isOptimal ? 700 : undefined }}>
                                              <td className="tnum">{b.isOptimal ? "★ " : ""}{(b.allPct * 100).toFixed(0)}%</td>
                                              <td className="tnum">≥{b.k}</td>
                                              <td className="tnum">{(b.allSupport || 0).toLocaleString()}{tr("명", "")}</td>
                                              <td className="tnum">{(b.P * 100).toFixed(0)}%</td>
                                              <td className="tnum">{(b.R * 100).toFixed(0)}%</td>
                                              <td className="tnum">{b.F1.toFixed(3)}</td>
                                              <td className="tnum" style={{ color: b.lift != null && b.lift >= 1.5 ? "#22c55e" : undefined }}>{b.lift == null ? "—" : b.lift.toFixed(2) + "×"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          {/* ── 맨 밑: 전 과정 상세 설명 문서 다운로드 (claude-ux.md §6 탈출구) ── */}
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <button className="ab-pill" style={{ fontSize: "12.5px", padding: "9px 18px" }}
              onClick={() => textDownload(
                tr(`${C.docFileStem}_설명_${_today()}.md`, `${C.docFileStem}_explainer_${_today()}.md`),
                buildAhaGuideDoc(cache, sortedResults, minSupport, C, locale),
              )}>
              📄 {tr("이 분석에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "Want a detailed explanation of this analysis? — Get the detailed doc")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
