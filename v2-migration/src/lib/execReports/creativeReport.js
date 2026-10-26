// 9-6 소재 피로도 — 임원 보고형 결론·수치·표(docs/product-ssot.md §5.5).
// 엔진(creativeMath: fatigueDetect·buildAlerts·buildRiskAnalysis·buildPlan) 출력만 묶는다.
// 새 계산은 합계·비율뿐: 교체 대상의 집행비 비중(기간 합), 롤링 CTR 고점 → 현재 변화.
// 정직성(§8): 피로 판정은 관측 감소 추세다 — 경쟁·시즌 영향과 분리되지 않는다는 점을 확인할 점에 남긴다.
import { fmtCurrencyCompact } from "@/utils/format";

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

export const CREATIVE_STATUS_ORDER = Object.freeze({ replace: 0, soon: 1, watch: 2 });

const changeFromPeak = (row) => (row && row.peakValue > 0 && Number.isFinite(row.currentValue) ? row.currentValue / row.peakValue - 1 : null);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

/** 소재별 상태 행: 교체(지금 알림) · 임박(위험 구역 또는 임계까지 남은 날이 추정됨) · 관찰(피로 신호). */
export function creativeStatusRows({ metrics = [], fatigue = [], fatigueAlerts = [], riskZoneRows = [] }) {
  const spendById = new Map(metrics.map((row) => [String(row.creative_id), Number(row.spend) || 0]));
  const fatigueById = new Map(fatigue.map((row) => [String(row.creative_id), row]));
  const alertById = new Map(fatigueAlerts.map((row) => [String(row.creative_id), row]));
  const riskIds = new Set(riskZoneRows.map((row) => String(row.creative_id)));
  const ids = new Set([
    ...fatigueAlerts.filter((row) => row.alert).map((row) => String(row.creative_id)),
    ...riskIds,
    ...fatigue.filter((row) => row.fatigued).map((row) => String(row.creative_id)),
  ]);
  const rows = [...ids].map((id) => {
    const alert = alertById.get(id) || null;
    const fat = fatigueById.get(id) || null;
    const status = alert?.alert ? "replace" : riskIds.has(id) || (alert?.etaDays != null && alert.etaDays > 0) ? "soon" : "watch";
    return {
      id,
      status,
      spend: spendById.get(id) ?? null,
      peak: fat?.peakValue ?? null,
      current: fat?.currentValue ?? null,
      change: changeFromPeak(fat),
      etaDays: alert?.etaDays ?? null,
      score: alert?.score ?? null,
    };
  });
  return rows.sort((a, b) => CREATIVE_STATUS_ORDER[a.status] - CREATIVE_STATUS_ORDER[b.status]
    || (b.spend || 0) - (a.spend || 0)
    || (a.change ?? 0) - (b.change ?? 0)
    || a.id.localeCompare(b.id));
}

export function creativeReport({ metrics = [], fatigue = [], fatigueAlerts = [], riskZoneRows = [], autoPlan = null, weeklyVelocity, hasSpend = false, hasFatigueEvidence = true, minImpressions, droppedRows = 0, entity, domain = "performance", locale = "ko", currency = "KRW" }) {
  const content = domain === "content";
  const noun = entity || tr(locale, content ? "콘텐츠" : "소재", content ? "content items" : "creatives");
  const money = (value) => fmtCurrencyCompact(value, { currency, locale });
  const rows = creativeStatusRows({ metrics, fatigue, fatigueAlerts, riskZoneRows });
  const replace = rows.filter((row) => row.status === "replace");
  const soon = rows.filter((row) => row.status === "soon");
  const watch = rows.filter((row) => row.status === "watch");
  const fatiguedCount = fatigue.filter((row) => row.fatigued).length;
  const totalSpend = metrics.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
  const replaceSpend = replace.reduce((sum, row) => sum + (row.spend || 0), 0);
  const share = hasSpend && totalSpend > 0 ? replaceSpend / totalSpend : null;
  const focus = replace.length ? replace : fatigue.filter((row) => row.fatigued).map((row) => ({ change: changeFromPeak(row) }));
  const avgChange = mean(focus.map((row) => row.change).filter((value) => value != null && Number.isFinite(value)));
  const pct = (value) => `${Math.round(Math.abs(value) * 100)}%`;
  const signedPct = (value) => (Math.round(value * 100) === 0 ? "0%" : `${value > 0 ? "+" : "−"}${pct(value)}`);

  let lines;
  let tone = "neutral";
  if (!hasFatigueEvidence) {
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, "노출·관측 기간 근거 부족", "not enough exposure or history"), tr(locale, `(노출 ${Number(minImpressions || 0).toLocaleString()} 이상 ${noun} 필요)`, `(${noun} with ${Number(minImpressions || 0).toLocaleString()}+ impressions needed)`)] }];
  } else if (replace.length) {
    tone = "bad";
    lines = [
      { kind: "main", chunks: [tr(locale, `이번 주 ${noun} ${replace.length}개 교체`, `Replace ${replace.length} ${noun} this week`), ...(share != null ? [tr(locale, `— 집행비의 ${pct(share)}`, `— ${pct(share)} of spend`)] : [])] },
      { kind: "effect", chunks: [
        ...(avgChange != null ? [tr(locale, `CTR 고점 대비 평균 ${signedPct(avgChange)}`, `CTR ${signedPct(avgChange)} from peak on average`)] : []),
        ...(autoPlan ? [tr(locale, `${avgChange != null ? "· " : ""}대체 ${noun} 주 ${autoPlan.recommendedWeeklyVelocity}개 제작 필요`, `${avgChange != null ? "· " : ""}produce ${autoPlan.recommendedWeeklyVelocity} replacements per week`)] : []),
      ] },
    ];
  } else if (fatiguedCount) {
    lines = [
      { kind: "main", chunks: [tr(locale, `즉시 교체 0개 · 피로 신호 ${noun} ${fatiguedCount}개`, `0 to replace now · ${fatiguedCount} ${noun} showing fatigue`)] },
      { kind: "effect", chunks: [...(avgChange != null ? [tr(locale, `CTR 고점 대비 평균 ${signedPct(avgChange)}`, `CTR ${signedPct(avgChange)} from peak on average`)] : []), tr(locale, "— 교체 시점을 미리 계획", "— plan swaps before they become urgent")] },
    ];
  } else {
    tone = "good";
    lines = [{ kind: "main", chunks: [tr(locale, `즉시 교체 ${noun} 0개 · 피로 신호 0개`, `0 ${noun} to replace · 0 fatigue signals`)] }];
  }
  lines = lines.filter((line) => line.chunks.length);
  const text = lines.map((line) => line.chunks.join(" ")).join(" · ");

  const reviewable = fatigue.filter((row) => row.qualityStatus === "reviewable").length;
  const stats = !hasFatigueEvidence ? [
    { id: "reviewable", label: tr(locale, "판정 가능", "Judgeable"), value: `${reviewable} / ${metrics.length}`, detail: tr(locale, "노출·기간 기준 통과", "Passed exposure and history checks") },
    { id: "threshold", label: tr(locale, "노출 기준", "Exposure threshold"), value: Number(minImpressions || 0).toLocaleString(), detail: tr(locale, "이 노출 미만은 판정 제외", "Below this, not judged") },
  ] : [
    { id: "replace", label: tr(locale, "교체 대상", "Replace now"), value: tr(locale, `${replace.length}개`, String(replace.length)), detail: tr(locale, `임박 ${soon.length} · 관찰 ${watch.length}`, `Soon ${soon.length} · watch ${watch.length}`) },
    hasSpend
      ? { id: "replace-spend", label: tr(locale, "교체 대상 집행비", "Spend on swaps"), value: money(replaceSpend), detail: share != null ? tr(locale, `전체의 ${pct(share)} · 기간 합`, `${pct(share)} of total · period sum`) : undefined }
      : { id: "fatigued", label: tr(locale, "피로 신호", "Fatigue signals"), value: tr(locale, `${fatiguedCount}개`, String(fatiguedCount)), detail: tr(locale, "롤링 CTR 고점 대비 하락", "Rolling CTR below its peak") },
    { id: "velocity", label: tr(locale, "필요 제작 속도", "Production needed"), value: autoPlan ? tr(locale, `주 ${autoPlan.recommendedWeeklyVelocity}개`, `${autoPlan.recommendedWeeklyVelocity}/wk`) : "—", detail: tr(locale, `현재 주 ${weeklyVelocity}개`, `Now ${weeklyVelocity}/wk`) },
  ];

  const held = fatigue.filter((row) => row.qualityStatus && row.qualityStatus !== "reviewable").length;
  const issues = [
    hasFatigueEvidence ? { kind: tr(locale, "해석 한계", "Limits"), target: tr(locale, "전체", "All"), text: tr(locale, "관측 감소 추세 — 경쟁·시즌·예산 변화와 분리되지 않음", "Observed decline — not separated from competition, season, or budget changes") } : null,
    held ? { kind: tr(locale, "근거 부족", "Thin evidence"), target: tr(locale, `${noun} ${held}개`, `${held} ${noun}`), text: tr(locale, `노출 ${Number(minImpressions || 0).toLocaleString()} 미만 또는 기간 부족 — 판정 제외`, `Under ${Number(minImpressions || 0).toLocaleString()} impressions or short history — not judged`) } : null,
    autoPlan?.isUndersupplied ? { kind: tr(locale, "제작 부족", "Under-supply"), target: tr(locale, "제작 계획", "Production"), text: tr(locale, `주 ${weeklyVelocity}개로는 교체 수요를 못 따라감 — 최소 주 ${autoPlan.recommendedWeeklyVelocity}개`, `${weeklyVelocity}/wk cannot keep up — need at least ${autoPlan.recommendedWeeklyVelocity}/wk`) } : null,
    droppedRows ? { kind: tr(locale, "제외 행", "Excluded rows"), target: tr(locale, `${droppedRows}행`, `${droppedRows} rows`), text: tr(locale, "소재 ID·날짜 없음 또는 음수 값", "Missing creative ID or date, or negative values") } : null,
  ].filter(Boolean);

  return { tone, lines, text, stats, issues, rows, counts: { replace: replace.length, soon: soon.length, watch: watch.length, fatigued: fatiguedCount }, share };
}
