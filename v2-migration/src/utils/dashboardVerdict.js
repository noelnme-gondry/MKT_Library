// 운영 대시보드(5-2/9-7) 결론 카드 + 다운로드 — 도구가 "계산한" 인사이트만 준다
// (업로드 원천 데이터 되돌려주기 금지). WoW 최근 vs 직전 기간의 증감을 CPA·CPI·
// CTR·CVR·ROAS·리텐션·이익까지 파생지표 전부 포함해 판정+표로 제공.
// 렌더층 헬퍼(골든 아님) — dashboardAggregator 순수함수만 소비. 데이터 부족·컬럼
// 미매핑이면 정직하게 생략(§8 날조 금지). WoW는 5-2류 시계열 전용 판정.
import { getMonFilteredRows, getMappedRows, aggregateByKey, effectiveDenomBasis, computeWeightedRetention, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { resolveRetentionSnapshot } from "@/utils/retentionSnapshot";
import { buildCreativeQuickSummary } from "@/lib/analysis-results/creativeQuickSummary";
import { buildPvmQuickSummary } from "@/lib/analysis-results/pvmQuickSummary";

const SIG = 0.05; // 유의미한 변화 임계(±5%)

function pct(cur, prev) {
  if (prev == null || prev === 0 || cur == null) return null;
  return (cur - prev) / prev;
}
function arrow(d) {
  return d == null ? "" : d > 0 ? "▲" : d < 0 ? "▼" : "—";
}
function fmtPctDelta(d) {
  if (d == null) return "—";
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${(Math.abs(d) * 100).toFixed(1)}%`;
}

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

  if (!csvData || !csvData.raw || csvData.raw.length === 0) return { insufficient: true };

  const rows = getMonFilteredRows(csvData, filterState);
  // 추천 카드가 리텐션을 앞에 세울 때는 "현재 날짜"가 아니라 파일의 관측 기준일을
  // 함께 확인한다. 기준일을 알 수 없는 파일은 코호트 추천 후보에서 제외된다.
  const retentionSnapshot = resolveRetentionSnapshot({
    rows: getMappedRows(csvData),
    fileName: csvData.fileName,
    fileModifiedAt: csvData.fileModifiedAt,
    manualDate: csvData.retentionSnapshotOverride,
  });
  const daily = aggregateByKey(rows, "date", ["cost"]) // 날짜 목록만 필요
    .map((d) => d._key)
    .sort();

  const w = windowDays;
  if (daily.length < 2) return { insufficient: true, days: daily.length, windowDays: w };
  const recentDates = new Set(daily.slice(-w));
  const prevDates = new Set(daily.slice(-2 * w, -w));
  if (recentDates.size === 0 || prevDates.size === 0) return { insufficient: true, days: daily.length, windowDays: w };

  const recentRaw = rows.filter((r) => recentDates.has(r.date));
  const prevRaw = rows.filter((r) => prevDates.has(r.date));

  const mapped = new Set(Object.values(csvData.mapping || {}));
  const basis = effectiveDenomBasis(csvData, denomBasis);
  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const agg = (arr) => {
    const cost = sum(arr, "cost"), imp = sum(arr, "impressions"), clk = sum(arr, "clicks");
    const inst = sum(arr, "installs"), act = sum(arr, "actions"), rev = sum(arr, "revenue_d7");
    return {
      cost, imp, clk, inst, act, rev,
      cpi: inst > 0 ? cost / inst : null,
      cpa: act > 0 ? cost / act : null,
      ctr: imp > 0 ? clk / imp : null,
      cvr: clk > 0 ? inst / clk : null,
      roas: cost > 0 && rev > 0 ? rev / cost : null,
      profit: mapped.has("revenue_d7") ? rev - cost : null,
      ret: computeWeightedRetention(arr, 7, basis).rate,
    };
  };
  const R = agg(recentRaw), P = agg(prevRaw);

  // 핵심 효율 지표(tone 판정용): 분모 기준 따라 CPA 우선, 없으면 CPI.
  const useCpa = basis === "actions" && mapped.has("actions");
  const effKey = useCpa ? "cpa" : mapped.has("installs") ? "cpi" : null;
  const effLabel = useCpa ? tr("전환당 비용(CPA)", "cost per action (CPA)") : tr("설치당 비용(CPI)", "cost per install (CPI)");
  const convKey = useCpa ? "act" : "inst";
  const convLabel = useCpa ? tr("전환", "actions") : tr("설치", "installs");

  const dEff = effKey ? pct(R[effKey], P[effKey]) : null;
  const dConv = pct(R[convKey], P[convKey]);
  const dCost = pct(R.cost, P.cost);
  const dRoas = mapped.has("revenue_d7") ? pct(R.roas, P.roas) : null;

  // "원인"을 인과처럼 단정하지 않고, 관측상 가장 크게 움직인 채널·신규 소재를
  // 바로 제시한다. 정확한 비용효율 귀속은 PVM 도구의 무잔차 분해로 이어진다.
  const byChannel = new Map();
  for (const [period, periodRows] of [["prev", prevRaw], ["recent", recentRaw]]) {
    periodRows.forEach((row) => {
      const key = row.channel || tr("미지정 채널", "Unspecified channel");
      const item = byChannel.get(key) || { key, prev: { cost: 0, result: 0 }, recent: { cost: 0, result: 0 } };
      item[period].cost += Number(row.cost) || 0;
      item[period].result += Number(row[convKey]) || 0;
      byChannel.set(key, item);
    });
  }
  const primaryDriver = [...byChannel.values()]
    .map((item) => ({ ...item, costDelta: item.recent.cost - item.prev.cost, resultDelta: item.recent.result - item.prev.result }))
    .sort((a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta))[0] || null;
  let newCreativeSignal = null;
  if (mapped.has("creative_id")) {
    const previous = new Set(prevRaw.map((row) => row.creative_id).filter(Boolean));
    const newRows = recentRaw.filter((row) => row.creative_id && !previous.has(row.creative_id));
    if (newRows.length) newCreativeSignal = { count: new Set(newRows.map((row) => row.creative_id)).size, cost: sum(newRows, "cost"), result: sum(newRows, convKey) };
  }
  const creativeSummary = mapped.has("creative_id") ? buildCreativeQuickSummary(csvData) : null;
  const pvmSummary = buildPvmQuickSummary({ csvData, dashboardFilter: filterState, denomBasis });

  let tone = "neutral";
  const effImproved = dEff != null && dEff <= -SIG;
  const effWorsened = dEff != null && dEff >= SIG;
  const roasImproved = dRoas != null && dRoas >= SIG;
  const roasWorsened = dRoas != null && dRoas <= -SIG;
  if (effImproved || (roasImproved && !effWorsened)) tone = "good";
  else if (effWorsened || (roasWorsened && !effImproved)) tone = "bad";

  const period = tr(`최근 ${w}일`, `last ${w} days`);
  let headline;
  if (tone === "good") {
    headline = tr(
      `${period}: ${effLabel} ${fmtPctDelta(dEff)}. 효율 개선 중입니다.`,
      `Over the ${period}: ${effLabel} ${fmtPctDelta(dEff)} — efficiency is improving.`
    );
  } else if (tone === "bad") {
    headline = tr(
      `${period}: ${effLabel} ${fmtPctDelta(dEff)}. 효율 악화 중입니다.`,
      `Over the ${period}: ${effLabel} ${fmtPctDelta(dEff)} — efficiency is worsening.`
    );
  } else {
    headline = tr(
      `${period}: ${effLabel} ${fmtPctDelta(dEff)}. 큰 변화 없습니다.`,
      `Over the ${period}: ${effLabel} ${fmtPctDelta(dEff)} — efficiency is roughly flat.`
    );
  }

  const points = [];
  const keyPoints = [];
  if (dCost != null && Math.abs(dCost) >= SIG) {
    points.push({
      text: tr(
        `지출이 ${fmtPctDelta(dCost)} ${dCost > 0 ? "늘었" : "줄었"}습니다 (${fc(P.cost)} → ${fc(R.cost)}).`,
        `Spend ${dCost > 0 ? "rose" : "fell"} ${fmtPctDelta(dCost)} (${fc(P.cost)} → ${fc(R.cost)}).`
      ),
    });
  }
  if (primaryDriver && Math.abs(primaryDriver.costDelta) > 0) {
    const point = {
      kind: "largest-observed-change",
      cls: primaryDriver.costDelta > 0 && tone === "bad" ? "bad" : "muted",
      text: tr(
        `가장 크게 변한 곳: ${primaryDriver.key}. 지출 ${fc(primaryDriver.prev.cost)} → ${fc(primaryDriver.recent.cost)} (${primaryDriver.costDelta >= 0 ? "+" : "−"}${fc(Math.abs(primaryDriver.costDelta))}), ${convLabel} ${primaryDriver.resultDelta >= 0 ? "+" : "−"}${Math.abs(primaryDriver.resultDelta).toLocaleString()}건.`,
        `Largest observed change: ${primaryDriver.key}. Spend ${fc(primaryDriver.prev.cost)} → ${fc(primaryDriver.recent.cost)} (${primaryDriver.costDelta >= 0 ? "+" : "−"}${fc(Math.abs(primaryDriver.costDelta))}); ${convLabel} ${primaryDriver.resultDelta >= 0 ? "+" : "−"}${Math.abs(primaryDriver.resultDelta).toLocaleString()}.`
      ),
    };
    points.push(point);
    keyPoints.push(point);
  }
  if (newCreativeSignal) {
    points.push({ text: tr(`신규 소재 ${newCreativeSignal.count}개가 최근 기간에 추가되어 ${convLabel} ${newCreativeSignal.result.toLocaleString()}건을 만들었습니다. 소재 분석에서 피로도·교체 우선순위를 확인하세요.`, `${newCreativeSignal.count} new creatives appeared in the recent period and produced ${newCreativeSignal.result.toLocaleString()} ${convLabel}. Check Creative Analysis for fatigue and replacement priority.`) });
  }
  if (creativeSummary?.available) {
    points.push({ cls: creativeSummary.alertNowCount ? "bad" : creativeSummary.fatiguedCount ? "muted" : "good", text: tr(
      creativeSummary.alertNowCount ? `소재 피로도: 즉시 교체 경고 ${creativeSummary.alertNowCount}개, 피로 신호 ${creativeSummary.fatiguedCount}개입니다. 소재 분석에서 교체 일정을 확인하세요.` : creativeSummary.fatiguedCount ? `소재 피로도: 피로 신호 ${creativeSummary.fatiguedCount}개가 있습니다. 소재 분석에서 교체 우선순위를 확인하세요.` : `소재 피로도: 현재 즉시 교체 경고는 없습니다. 소재 분석에서 다음 테스트 후보를 확인하세요.`,
      creativeSummary.alertNowCount ? `Creative fatigue: ${creativeSummary.alertNowCount} immediate replacement alert(s), ${creativeSummary.fatiguedCount} fatigue signal(s). Check the swap schedule in Creative Analysis.` : creativeSummary.fatiguedCount ? `Creative fatigue: ${creativeSummary.fatiguedCount} fatigue signal(s). Check replacement priority in Creative Analysis.` : `Creative fatigue: no immediate replacement alerts. Check next-test candidates in Creative Analysis.`
    ) });
  }
  if (pvmSummary.available) {
    const deltaSign = pvmSummary.delta >= 0 ? "+" : "−";
    const driverSign = pvmSummary.driver.contribution >= 0 ? "+" : "−";
    const point = { kind: "largest-performance-impact", cls: pvmSummary.delta > 0 ? "bad" : "good", text: tr(
      `성과 분석상 최대 영향: ${pvmSummary.driver.key} ${driverSign}${fc(Math.abs(pvmSummary.driver.contribution))}. ${pvmSummary.metric} ${fc(pvmSummary.prior)} → ${fc(pvmSummary.current)} (${deltaSign}${fc(Math.abs(pvmSummary.delta))}).`,
      `Largest performance-analysis impact: ${pvmSummary.driver.key} ${driverSign}${fc(Math.abs(pvmSummary.driver.contribution))}. ${pvmSummary.metric} ${fc(pvmSummary.prior)} → ${fc(pvmSummary.current)} (${deltaSign}${fc(Math.abs(pvmSummary.delta))}).`
    ) };
    points.push(point);
    keyPoints.push(point);
  }
  if (tone === "good") points.push({ cls: "good", text: tr("증액 여력 점검: 예산 배분(5-3)에서 한계효율이 살아있는 채널을 확인하세요.", "Room to scale: check Budget Allocation (5-3) for channels with headroom.") });
  else if (tone === "bad") points.push({ cls: "bad", text: tr("이상 감지 탭에서 급변한 날·채널을 먼저 확인하세요.", "Start with the Anomaly tab to find the day/channel that spiked.") });

  // 지표 표(직전→최근, WoW). 컬럼 매핑된 것만(정직). type=값 포맷 방식.
  const asPctStr = (v) => (v == null ? "—" : (v * 100).toFixed(2) + "%");
  const asRoasStr = (v) => (v == null ? "—" : (v * 100).toFixed(0) + "%");
  const asInt = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
  const M = [
    { key: "cost", label: tr("지출", "Spend"), fmt: fc, csv: (v) => v },
    mapped.has("impressions") && { key: "imp", label: tr("노출", "Impressions"), fmt: asInt, csv: (v) => Math.round(v) },
    mapped.has("clicks") && { key: "clk", label: tr("클릭", "Clicks"), fmt: asInt, csv: (v) => Math.round(v) },
    mapped.has("installs") && { key: "inst", label: tr("설치", "Installs"), fmt: asInt, csv: (v) => Math.round(v) },
    mapped.has("actions") && { key: "act", label: tr("전환", "Actions"), fmt: asInt, csv: (v) => Math.round(v) },
    mapped.has("installs") && { key: "cpi", label: "CPI", fmt: fc, csv: (v) => v },
    mapped.has("actions") && { key: "cpa", label: "CPA", fmt: fc, csv: (v) => v },
    mapped.has("impressions") && mapped.has("clicks") && { key: "ctr", label: "CTR", fmt: asPctStr, csv: asPctStr },
    mapped.has("clicks") && mapped.has("installs") && { key: "cvr", label: "CVR", fmt: asPctStr, csv: asPctStr },
    mapped.has("revenue_d7") && { key: "roas", label: "ROAS", fmt: asRoasStr, csv: asRoasStr },
    mapped.has("revenue_d7") && { key: "rev", label: tr("매출(D7)", "Revenue (D7)"), fmt: fc, csv: (v) => v },
    mapped.has("revenue_d7") && { key: "profit", label: tr("이익", "Profit"), fmt: fc, csv: (v) => v },
    mapped.has("ret_d7") && { key: "ret", label: tr("리텐션(D7)", "Retention (D7)"), fmt: asPctStr, csv: asPctStr },
  ].filter(Boolean);

  const metricRows = M.map((m) => ({ ...m, prev: P[m.key], recent: R[m.key], wow: pct(R[m.key], P[m.key]) }));

  // 카드 상단 스트립 = 핵심 4~5개만(지출·전환·효율·ROAS). 나머지는 다운로드로.
  const stripKeys = ["cost", convKey, effKey, "roas"].filter(Boolean);
  const stats = stripKeys
    .map((k) => metricRows.find((m) => m.key === k))
    .filter(Boolean)
    .map((m) => ({
      label: m.label,
      value: m.fmt(m.recent),
      detail: tr(`직전 ${m.fmt(m.prev)} · ${fmtPctDelta(m.wow)}`, `Prior ${m.fmt(m.prev)} · ${fmtPctDelta(m.wow)}`),
    }));

  // 다운로드 — 계산된 인사이트만(BOM+CRLF §7). 원천 업로드 데이터는 주지 않는다.
  const qc = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const csvHead = tr("지표,직전,최근,증감(WoW %)", "Metric,Prior,Recent,Change (WoW %)");
  const csv =
    "﻿" +
    [
      csvHead,
      ...metricRows.map((m) =>
        [qc(m.label), m.prev == null ? "" : m.csv(m.prev), m.recent == null ? "" : m.csv(m.recent), m.wow == null ? "" : (m.wow * 100).toFixed(1) + "%"].join(",")
      ),
    ].join("\r\n") +
    "\r\n";

  const text =
    tr(`# 운영 대시보드 핵심 요약 (${period})\n\n`, `# Operations Dashboard Summary (${period})\n\n`) +
    `${headline}\n\n` +
    tr("## 지표 증감 (직전 → 최근, WoW)\n", "## Metric change (prior → recent, WoW)\n") +
    metricRows.map((m) => `- ${m.label}: ${m.fmt(m.prev)} → ${m.fmt(m.recent)}  (${arrow(m.wow)} ${fmtPctDelta(m.wow)})`).join("\n") +
    "\n\n" +
    points.map((p) => `- ${p.text}`).join("\n") +
    "\n";

  return { insufficient: false, tone, headline, points, keyPoints, stats, metricRows, primaryDriver, newCreativeSignal, creativeSummary, pvmSummary, export: { csv, text }, windowDays: w, days: daily.length, conversionKey: convKey, efficiencyKey: effKey, retentionSnapshot };
}
