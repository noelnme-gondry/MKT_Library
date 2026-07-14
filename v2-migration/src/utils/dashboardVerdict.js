// 운영 대시보드(5-2/9-7) 결론 카드용 WoW 판정 — 렌더층 헬퍼(골든 대상 아님).
// ScorecardTab의 WoW 집계(최근 w일 vs 직전 w일)와 동일한 aggregator 프리미티브를
// 재사용해 "효율이 좋아지는 중/나빠지는 중/큰 변화 없음"을 평어로 판정한다.
// 수학 엔진 불변 — dashboardAggregator의 순수 함수만 소비(§8 날조 금지: 데이터
// 부족하면 insufficient로 정직 처리).
import { getMonFilteredRows, aggregateByKey, effectiveDenomBasis, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";

const SIG = 0.05; // 유의미한 변화 임계(±5%)

function pct(cur, prev) {
  if (prev == null || prev === 0 || cur == null) return null;
  return (cur - prev) / prev;
}

function arrow(d) {
  if (d == null) return "";
  return d > 0 ? "▲" : d < 0 ? "▼" : "—";
}

function fmtPctDelta(d) {
  if (d == null) return "—";
  const s = (Math.abs(d) * 100).toFixed(1);
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${s}%`;
}

// csvData·filterState·denomBasis·displayCurrency는 store에서 그대로 주입.
export function buildDashboardVerdict({
  csvData,
  filterState = {},
  denomBasis = "installs",
  displayCurrency = "KRW",
  windowDays = 7,
  locale = "ko",
} = {}) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const fc = (v) => (v == null ? "—" : fmtCurrencyPrecise(v, displayCurrency));

  if (!csvData || !csvData.raw || csvData.raw.length === 0) {
    return { insufficient: true };
  }

  const rows = getMonFilteredRows(csvData, filterState);
  const daily = aggregateByKey(rows, "date", [
    "cost", "impressions", "clicks", "installs", "actions", "revenue_d7",
  ]).sort((a, b) => (a._key > b._key ? 1 : -1));

  const w = windowDays;
  const recentRows = daily.slice(-w);
  const prevRows = daily.slice(-2 * w, -w);

  // 최소 2주(직전 비교주)치 없으면 정직하게 판정 생략.
  if (recentRows.length === 0 || prevRows.length === 0) {
    return { insufficient: true, days: daily.length, windowDays: w };
  }

  const mapped = new Set(Object.values(csvData.mapping || {}));
  const basis = effectiveDenomBasis(csvData, denomBasis);
  const sum = (arr, k) => arr.reduce((s, d) => s + (d[k] || 0), 0);
  const agg = (arr) => {
    const cost = sum(arr, "cost"), inst = sum(arr, "installs"), act = sum(arr, "actions"), rev = sum(arr, "revenue_d7");
    return {
      cost, inst, act, rev,
      cpi: inst > 0 ? cost / inst : null,
      cpa: act > 0 ? cost / act : null,
      roas: cost > 0 && rev > 0 ? rev / cost : null,
    };
  };
  const R = agg(recentRows), P = agg(prevRows);

  // 핵심 효율 지표: 분모 기준 따라 CPA(actions) 우선, 없으면 CPI(installs).
  const useCpa = basis === "actions" && mapped.has("actions");
  const effKey = useCpa ? "cpa" : mapped.has("installs") ? "cpi" : null;
  const effLabel = useCpa ? tr("전환당 비용(CPA)", "cost per action (CPA)") : tr("설치당 비용(CPI)", "cost per install (CPI)");
  const convKey = useCpa ? "act" : "inst";
  const convLabel = useCpa ? tr("전환", "actions") : tr("설치", "installs");

  const dEff = effKey ? pct(R[effKey], P[effKey]) : null;
  const dConv = pct(R[convKey], P[convKey]);
  const dCost = pct(R.cost, P.cost);
  const dRoas = mapped.has("revenue_d7") ? pct(R.roas, P.roas) : null;

  // tone: 효율(비용/성과)이 좋아졌나. eff↓(비용 하락)=개선, eff↑=악화.
  // 매출 있으면 ROAS↑도 개선 신호로 함께 본다.
  let tone = "neutral";
  const effImproved = dEff != null && dEff <= -SIG;
  const effWorsened = dEff != null && dEff >= SIG;
  const roasImproved = dRoas != null && dRoas >= SIG;
  const roasWorsened = dRoas != null && dRoas <= -SIG;
  if (effImproved || (roasImproved && !effWorsened)) tone = "good";
  else if (effWorsened || (roasWorsened && !effImproved)) tone = "bad";

  // 헤드라인 — 통계용어 없이 평어.
  const period = tr(`최근 ${w}일`, `last ${w} days`);
  let headline;
  if (tone === "good") {
    headline = tr(
      `${period}, ${convLabel}은 ${fmtPctDelta(dConv)}, ${effLabel}은 ${fmtPctDelta(dEff)} — 효율이 좋아지는 중입니다. 잘 되는 곳에 예산을 더 실을 여지가 있습니다.`,
      `Over the ${period}, ${convLabel} ${fmtPctDelta(dConv)} and ${effLabel} ${fmtPctDelta(dEff)} — efficiency is improving. Consider putting more budget where it's working.`
    );
  } else if (tone === "bad") {
    headline = tr(
      `${period}, ${effLabel}이 ${fmtPctDelta(dEff)}로 올랐습니다 — 효율이 나빠지는 중입니다. 어디서 비용이 새는지 아래 탭에서 점검하세요.`,
      `Over the ${period}, ${effLabel} rose ${fmtPctDelta(dEff)} — efficiency is worsening. Check the tabs below to see where cost is leaking.`
    );
  } else {
    headline = tr(
      `${period} 효율은 직전 기간과 큰 차이가 없습니다(${effLabel} ${fmtPctDelta(dEff)}). 현 상태 유지 중 — 세부 탭에서 채널·소재별 변화를 확인하세요.`,
      `Over the ${period}, efficiency is roughly flat vs. the prior period (${effLabel} ${fmtPctDelta(dEff)}). Holding steady — check the tabs for channel/creative-level shifts.`
    );
  }

  // 다음 액션 불릿.
  const points = [];
  if (dCost != null && Math.abs(dCost) >= SIG) {
    points.push({
      text: tr(
        `지출이 ${fmtPctDelta(dCost)} ${dCost > 0 ? "늘었" : "줄었"}습니다 (${fc(P.cost)} → ${fc(R.cost)}).`,
        `Spend ${dCost > 0 ? "rose" : "fell"} ${fmtPctDelta(dCost)} (${fc(P.cost)} → ${fc(R.cost)}).`
      ),
    });
  }
  if (tone === "good") {
    points.push({ cls: "good", text: tr("증액 여력 점검: 예산 배분(5-3)에서 한계효율이 살아있는 채널을 확인하세요.", "Room to scale: check Budget Allocation (5-3) for channels with headroom.") });
  } else if (tone === "bad") {
    points.push({ cls: "bad", text: tr("이상 감지 탭에서 급변한 날·채널을 먼저 확인하세요.", "Start with the Anomaly tab to find the day/channel that spiked.") });
  }

  // 핵심 수치 스트립.
  const stats = [
    { label: tr("지출", "Spend"), value: `${fc(P.cost)} → ${fc(R.cost)} (${fmtPctDelta(dCost)})` },
    { label: convLabel, value: `${Math.round(P[convKey]).toLocaleString()} → ${Math.round(R[convKey]).toLocaleString()} (${fmtPctDelta(dConv)})` },
  ];
  if (effKey) stats.push({ label: effLabel, value: `${fc(P[effKey])} → ${fc(R[effKey])} (${fmtPctDelta(dEff)})` });
  if (dRoas != null) stats.push({ label: "ROAS", value: `${P.roas != null ? (P.roas * 100).toFixed(0) + "%" : "—"} → ${R.roas != null ? (R.roas * 100).toFixed(0) + "%" : "—"} (${fmtPctDelta(dRoas)})` });

  // 다운로드 페이로드 — 핵심 요약 CSV/텍스트(BOM+CRLF §7).
  const rowsForExport = [
    { metric: tr("지출", "Spend"), prev: P.cost, recent: R.cost, wow: dCost },
    { metric: convLabel, prev: P[convKey], recent: R[convKey], wow: dConv },
  ];
  if (effKey) rowsForExport.push({ metric: effLabel, prev: P[effKey], recent: R[effKey], wow: dEff });
  if (dRoas != null) rowsForExport.push({ metric: "ROAS", prev: P.roas, recent: R.roas, wow: dRoas });

  const q = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const csvHeader = tr("지표,직전,최근,WoW", "Metric,Prior,Recent,WoW");
  const csv =
    "﻿" +
    [csvHeader, ...rowsForExport.map((r) => [q(r.metric), r.prev ?? "", r.recent ?? "", r.wow == null ? "" : (r.wow * 100).toFixed(1) + "%"].join(","))].join("\r\n") +
    "\r\n";

  const text =
    tr(`# 운영 대시보드 핵심 요약 (${period})\n\n`, `# Operations Dashboard Summary (${period})\n\n`) +
    `${headline}\n\n` +
    tr("## 핵심 지표 (직전 → 최근, WoW)\n", "## Key metrics (prior → recent, WoW)\n") +
    rowsForExport
      .map((r) => `- ${r.metric}: ${arrow(r.wow)} ${fmtPctDelta(r.wow)}`)
      .join("\n") +
    "\n\n" +
    points.map((p) => `- ${p.text}`).join("\n") +
    "\n";

  return {
    insufficient: false,
    tone,
    headline,
    points,
    stats,
    export: { csv, text },
    windowDays: w,
  };
}
