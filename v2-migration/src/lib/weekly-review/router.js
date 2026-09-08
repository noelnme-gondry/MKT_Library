/**
 * Weekly Review 분석 라우터.
 *
 * 20개 분석을 매주 다 돌려서 보여주면 죽는다. 라우터는 **이번 주에 필요한 분석만** 고른다.
 * 그래서 이 모듈에서 제일 중요한 결과는 "아무것도 안 함"이다 — 신호가 없으면 원인·행동 카드를
 * 접고 "이번 주는 확인할 것이 없습니다"로 끝낸다. 그게 정상 경로이고 골든에도 들어 있다.
 *
 * 두 가지를 구분해서 내보낸다.
 *
 * ① **조용함(quiet)과 모름(unknown)은 다르다.** 지표가 평소 범위 안이라 조용한 것과, 지난
 *    기간 값이 없어 판정 자체를 못 한 것은 화면 문구가 달라야 한다. 후자를 조용함으로 접으면
 *    "확인할 것 없음"이라고 거짓말하게 된다.
 * ② **빠진 것과 일부러 뺀 것을 구분한다.** V1에 없는 분석(소재 피로도·구성 변화·페이싱)은
 *    레지스트리에 `enabled:false`와 사유를 달아 남긴다. 목록에서 그냥 없으면 나중에 그것이
 *    결정이었는지 누락이었는지 알 수 없다.
 *
 * 모든 등록 신호는 결과의 `run` 또는 `skipped` 중 한쪽에 반드시 나타난다(골든이 강제).
 * 조용히 사라지는 신호가 없어야 한다.
 */

import { LOWER_IS_BETTER, assessChange } from "./significance";
import { snapshotMetrics } from "./snapshot";

export const ROUTER_CONFIG = Object.freeze({
  spendShiftPct: 0.15, // 비용이 이만큼 움직이면 믹스를 함께 본다
});

/**
 * 신호 레지스트리. 화면·테스트는 이 배열에서 파생한다 — 목록을 손으로 다시 쓰지 않는다.
 *
 * `enabled:false`는 **의도적 제외**다. 조건은 그대로 적어 두되 실행하지 않고,
 * `skipped`에 `not_in_v1`로 남겨 나중에 무엇을 켜야 하는지 코드가 말하게 한다.
 */
export const SIGNALS = Object.freeze([
  {
    id: "kpi_change",
    analysis: "variance",
    enabled: true,
    requires: [],
    label: "핵심 지표 변화",
  },
  {
    id: "spend_shift",
    analysis: "variance",
    emphasis: "mix",
    enabled: true,
    requires: ["cost"],
    label: "비용 급변",
  },
  {
    id: "creative_fatigue",
    analysis: "creative",
    enabled: false,
    plannedFor: "V2",
    requires: ["impressions", "clicks"],
    label: "소재 피로도",
  },
  {
    id: "composition_shift",
    analysis: "composition",
    enabled: false,
    plannedFor: "V2",
    requires: [],
    label: "구성 변화",
  },
  {
    id: "pacing",
    analysis: "pacing",
    enabled: false,
    plannedFor: "V2",
    requires: ["cost"],
    label: "예산 페이싱",
  },
]);

/**
 * 신호별 평가기. **레지스트리에만 올리고 평가기를 안 만들면 안 된다** — 처음엔 평가기 없이
 * 조건을 `if`로 늘어놓았는데, 새 신호가 어느 분기에도 안 걸리면 조용히 `no_signal`로 떨어졌다.
 * "평가한 적 없음"이 "신호 없음"으로 둔갑하는 것은 이 모듈이 막으려는 바로 그 오류다.
 * 지금은 평가기가 없으면 `not_evaluated`로 남고, 골든이 켜진 신호마다 평가기 존재를 강제한다.
 *
 * 평가기는 `{ hit, evidence }` 또는 `{ unassessable: "사유" }`를 돌려준다.
 */
export const EVALUATORS = Object.freeze({
  kpi_change({ kpiAssessment, kpi }) {
    if (kpiAssessment.deltaPct === null) return { unassessable: kpiAssessment.reason };
    return {
      hit: kpiAssessment.significant,
      evidence: { metric: kpi.metric, deltaPct: kpiAssessment.deltaPct, z: kpiAssessment.z },
    };
  },
  spend_shift({ spendChange, config }) {
    if (spendChange === null) return { unassessable: "no_previous_value" };
    return {
      hit: Math.abs(spendChange) >= config.spendShiftPct,
      evidence: { metric: "spend", deltaPct: spendChange },
    };
  },
});

function pctChange(current, previous) {
  if (current === null || previous === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null; // 0에서 출발한 변화율은 정의되지 않는다
  return (current - previous) / Math.abs(previous);
}

function metricValue(metrics, name) {
  if (!metrics) return null;
  if (name === "spend" || name === "cost") return metrics.totals?.cost ?? null;
  if (name === "conversions") return metrics.conversions ?? null;
  return metrics[name] ?? null;
}

/**
 * 이번 주에 돌릴 분석을 정한다.
 *
 * @param {object} current   이번 기간 스냅샷 (`buildSnapshot` 결과)
 * @param {object} previous  지난 기간 스냅샷
 * @param {object} history   지표별 최근 주간값 — `{ cpa: [...] }`. 없으면 평소 범위를 모른다.
 * @param {object} project   `{ kpi: { metric, basis, direction }, target }`
 * @param {number} volumeMultiplier  부분 주 소표본이면 2 (period.js가 준다)
 */
export function routeAnalyses({
  current = null,
  previous = null,
  history = {},
  project = {},
  volumeMultiplier = 1,
  config = ROUTER_CONFIG,
} = {}) {
  const kpi = project.kpi || { metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER };
  const basis = kpi.basis || "actions";

  const currentMetrics = snapshotMetrics(current, { basis });
  const previousMetrics = snapshotMetrics(previous, { basis });

  if (!currentMetrics || !previousMetrics) {
    return {
      status: "unknown",
      reason: !currentMetrics ? "no_current_snapshot" : "no_previous_snapshot",
      kpi: null,
      run: [],
      skipped: SIGNALS.map((signal) => ({ signal: signal.id, reason: "no_comparison" })),
    };
  }

  const available = new Set(current.availableFields || []);

  const kpiAssessment = assessChange({
    current: metricValue(currentMetrics, kpi.metric),
    previous: metricValue(previousMetrics, kpi.metric),
    history: history[kpi.metric] || [],
    volume: currentMetrics.conversions,
    direction: kpi.direction || LOWER_IS_BETTER,
    volumeMultiplier,
  });

  const spendChange = pctChange(
    metricValue(currentMetrics, "spend"),
    metricValue(previousMetrics, "spend"),
  );

  const fired = [];
  const skipped = [];

  for (const signal of SIGNALS) {
    if (!signal.enabled) {
      skipped.push({ signal: signal.id, reason: "not_in_v1", plannedFor: signal.plannedFor });
      continue;
    }

    const missing = signal.requires.filter((field) => !available.has(field));
    if (missing.length > 0) {
      skipped.push({ signal: signal.id, reason: "data_missing", missing });
      continue;
    }

    const evaluate = EVALUATORS[signal.id];
    if (!evaluate) {
      // 평가기가 없다. 신호가 없는 것이 아니라 **본 적이 없는** 것이다.
      skipped.push({ signal: signal.id, reason: "not_evaluated" });
      continue;
    }

    const verdict = evaluate({ kpiAssessment, kpi, spendChange, config, currentMetrics, previousMetrics });
    if (verdict.unassessable) {
      skipped.push({ signal: signal.id, reason: "not_assessable", detail: verdict.unassessable });
      continue;
    }

    if (verdict.hit) fired.push({ signal, evidence: verdict.evidence });
    else skipped.push({ signal: signal.id, reason: "no_signal", evidence: verdict.evidence });
  }

  // 같은 분석을 두 번 그리지 않는다. 신호는 모아서 강조점으로 전달한다.
  const byAnalysis = new Map();
  for (const { signal, evidence } of fired) {
    let entry = byAnalysis.get(signal.analysis);
    if (!entry) {
      entry = { analysis: signal.analysis, triggers: [], emphasis: [], evidence: [] };
      byAnalysis.set(signal.analysis, entry);
    }
    entry.triggers.push(signal.id);
    if (signal.emphasis && !entry.emphasis.includes(signal.emphasis)) entry.emphasis.push(signal.emphasis);
    entry.evidence.push({ signal: signal.id, ...evidence });
  }

  const run = [...byAnalysis.values()];
  const kpiUnknown = kpiAssessment.deltaPct === null;

  return {
    status: run.length > 0 ? "signal" : kpiUnknown ? "unknown" : "quiet",
    reason: run.length > 0 ? null : kpiUnknown ? kpiAssessment.reason : "no_signal",
    kpi: kpiAssessment,
    run,
    skipped,
  };
}
