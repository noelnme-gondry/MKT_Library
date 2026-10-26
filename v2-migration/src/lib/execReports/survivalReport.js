// 5-28 액션 생존·이탈 — 임원 보고형 결론·수치(docs/product-ssot.md §5.5).
// 엔진(subscriptionSurvivalMath: Kaplan–Meier · 이산 위험 · 증거 상태) 출력만 묶는다.
// 정직성(§8): 유지율은 언제나 중도절단을 반영한 KM 추정이다 — "N명 중 M명 남음"처럼 관측 인원 비율로 말하지 않는다.
// 최고 위험 구간의 값은 그 구간 직전까지 남은 대상 중 이탈한 비율(조건부 위험)이지 전체 이탈률이 아니다.
import { fmtNum, fmtPct } from "@/utils/format";

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

export function survivalUnitLabel(unit, locale) {
  return unit === "month" ? tr(locale, "개월", "months") : unit === "week" ? tr(locale, "주", "weeks") : tr(locale, "일", "days");
}

/** 구간 이름: 3개월차 · 3주차 · 3일차 / month 3 · week 3 · day 3. */
export function survivalIntervalLabel(time, unit, locale) {
  if (locale === "en") return `${unit === "month" ? "month" : unit === "week" ? "week" : "day"} ${time}`;
  return `${time}${unit === "month" ? "개월" : unit === "week" ? "주" : "일"}차`;
}

/** KM 표에서 horizon 시점의 유지율과 95% 구간(관측 전이면 1). */
export function survivalAtHorizonWithCi(table, horizon) {
  if (!table?.length || !(horizon >= 0)) return null;
  const row = table.filter((point) => point.time <= horizon).at(-1);
  if (!row) return { survival: 1, ciLow: null, ciHigh: null };
  return { survival: row.survival, ciLow: row.ciLow ?? null, ciHigh: row.ciHigh ?? null };
}

const pctRange = (low, high) => (low == null || high == null ? null : `${Math.round(low * 100)} ~ ${Math.round(high * 100)}%`);

/**
 * result: SubscriptionSurvivalAnalysis의 결과 묶음({ evidence, hazard, table, horizon, timeUnit, median, ... }).
 */
export function survivalReport(result, { locale = "ko" } = {}) {
  const unit = survivalUnitLabel(result.timeUnit, locale);
  const atHorizon = survivalAtHorizonWithCi(result.table, result.horizon);
  const horizonLabel = tr(locale, `${result.horizon}${unit} 유지율`, `Survival at ${result.horizon} ${unit}`);
  const survivalText = atHorizon ? fmtPct(atHorizon.survival) : "—";
  const peak = result.hazard?.maxHazard || null;
  const status = result.evidence?.status;

  let lines;
  let resultState = "ready";
  let tone = "neutral";
  if (status === "ABSTAIN") {
    resultState = "withheld";
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, "관측된 이탈·종료 이벤트 없음", "no dropout or exit event observed")] },
      { kind: "effect", chunks: [tr(locale, `${horizonLabel} ${survivalText} (KM)`, `${horizonLabel} ${survivalText} (KM)`)] }];
  } else if (status === "INSUFFICIENT_DATA" || !peak) {
    resultState = "withheld";
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), status === "INSUFFICIENT_DATA"
      ? tr(locale, "유효한 관측 행 또는 확인 기간 없음", "no valid rows or evaluation horizon")
      : tr(locale, "위험 구간 계산 불가", "risk interval not estimable")] }];
  } else {
    const directional = status !== "READY" || result.hazard.hasSmallRiskSet;
    if (!directional) tone = "bad";
    if (status !== "READY") resultState = "withheld";
    lines = [
      { kind: "main", chunks: [
        tr(locale, `${survivalIntervalLabel(peak.time, result.timeUnit, locale)} 이탈 위험`, `Exit risk peaks in ${survivalIntervalLabel(peak.time, result.timeUnit, locale)}`),
        tr(locale, `${fmtPct(peak.hazard)}로 가장 높음`, `at ${fmtPct(peak.hazard)}`),
        ...(directional ? [tr(locale, `(직전 관측 ${fmtNum(peak.atRisk)}건 — 방향만 참고)`, `(${fmtNum(peak.atRisk)} at risk — directional only)`)] : []),
      ] },
      { kind: "effect", chunks: [
        ...(directional ? [] : [tr(locale, "→ 이 구간 직전 유지 개입을 A/B로 검증 ·", "→ Test a retention step just before it with A/B ·")]),
        tr(locale, `${horizonLabel} ${survivalText} (KM)`, `${horizonLabel} ${survivalText} (KM)`),
      ] },
    ];
  }
  const text = lines.map((line) => line.chunks.join(" ")).reduce((acc, line, index) => (index === 0 ? line : line.startsWith("→") ? `${acc} ${line}` : `${acc} · ${line}`), "");

  const stats = [
    { id: "survival-horizon", label: horizonLabel, value: survivalText, detail: [tr(locale, "KM 추정", "KM estimate"), atHorizon && pctRange(atHorizon.ciLow, atHorizon.ciHigh) ? `95% ${pctRange(atHorizon.ciLow, atHorizon.ciHigh)}` : null].filter(Boolean).join(" · ") },
    { id: "peak-hazard", label: tr(locale, "구간 이탈 위험(조건부)", "Interval exit risk (conditional)"), value: peak ? tr(locale, `${survivalIntervalLabel(peak.time, result.timeUnit, locale)} ${fmtPct(peak.hazard)}`, `${survivalIntervalLabel(peak.time, result.timeUnit, locale)} ${fmtPct(peak.hazard)}`) : "—", detail: peak ? tr(locale, `직전 관측 ${fmtNum(peak.atRisk)}건 중 ${fmtNum(peak.events)}건 이탈`, `${fmtNum(peak.events)} exits of ${fmtNum(peak.atRisk)} at risk`) : tr(locale, "이탈 구간 추정 불가", "Exit timing not estimable") },
    { id: "median", label: tr(locale, "중앙 유지기간", "Median survival"), value: result.median == null ? tr(locale, "관측 내 미도달", "Not reached") : `${fmtNum(result.median)} ${unit}`, detail: tr(locale, "KM 추정 유지율 50% 시점", "When KM survival reaches 50%") },
  ];

  const issues = [
    peak && result.hazard.hasSmallRiskSet ? { kind: tr(locale, "작은 위험 집합", "Small risk set"), target: survivalIntervalLabel(peak.time, result.timeUnit, locale), text: tr(locale, `직전 관측 ${fmtNum(peak.atRisk)}건 — 다음 코호트에서 재확인`, `${fmtNum(peak.atRisk)} at risk — recheck with the next cohort`) } : null,
    result.evidence?.reason === "sparse_risk_set" ? { kind: tr(locale, "표본", "Sample"), target: tr(locale, `${result.horizon}${unit} 시점`, `At ${result.horizon} ${unit}`), text: tr(locale, "대상 10건·이탈 3건·남은 대상 5건 중 하나 미만 — 방향만 참고", "Fewer than 10 rows, 3 events, or 5 at risk — directional only") } : null,
    result.evidence?.reason === "no_censored_rows" ? { kind: tr(locale, "중도절단 없음", "No censoring"), target: tr(locale, "전체", "All"), text: tr(locale, "모든 에피소드가 이탈로 끝남 — 관측 종료 규칙 확인", "Every episode ended in an exit — check the observation-end rule") } : null,
    result.prepared?.excludedRows?.length ? { kind: tr(locale, "제외 행", "Excluded rows"), target: tr(locale, `${fmtNum(result.prepared.excludedRows.length)}행`, `${fmtNum(result.prepared.excludedRows.length)} rows`), text: tr(locale, "날짜·기간·이벤트 값이 불완전하거나 모순", "Incomplete or contradictory date, tenure, or event values") } : null,
    result.groups?.length > 6 ? { kind: tr(locale, "세그먼트", "Segments"), target: tr(locale, `${result.groups.length}개`, `${result.groups.length}`), text: tr(locale, "6개 초과 — 비교 보류, 상위 항목만 남겨 다시 분석", "More than six — comparison withheld; keep the top groups and rerun") } : null,
  ].filter(Boolean);

  return { tone, lines, text, stats, issues, resultState, atHorizon };
}
