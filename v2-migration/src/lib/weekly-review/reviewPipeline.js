/**
 * Weekly Review 파이프라인 — 업로드된 행과 저장된 스냅샷·결정에서 화면이 그릴 것을 전부 만든다.
 *
 * 화면 컴포넌트에서 이 조립을 떼어낸 이유는 두 가지다. ① 순수 함수라 골든으로 고정할 수 있고,
 * ② 화면은 "무엇을 그릴지"만 남아 계산과 표시가 섞이지 않는다.
 *
 * 저장된 스냅샷이 있으면 **평소 변동 범위**를 알 수 있어 유의미성 판정이 세 축으로 완성된다.
 * 없으면 크기·표본 두 축으로 떨어지고, 그 사실은 `baselineKnown:false`로 화면에 전달된다 —
 * 모르는 것을 정상이라고 말하지 않기 위해서다.
 */

import { resolveComparisonPeriods } from "./period";
import { buildSnapshot, deriveMetrics, snapshotMetrics, sumRows } from "./snapshot";
import { historyFor } from "./snapshotStore";
import { routeAnalyses } from "./router";
import { buildVariance } from "./varianceBridge";
import { scoreDecision } from "./decisionScore";
import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./significance";

/** 프로젝트 기본값. KPI 설정 화면이 이 모양을 채운다. */
export const DEFAULT_PROJECT = Object.freeze({
  kpi: { metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER },
  target: null,
});

/** 고를 수 있는 핵심 지표. 방향은 지표가 소유한다 — 사용자가 고르게 하면 CPA를 "높을수록 좋음"으로 둘 수 있다. */
export const KPI_OPTIONS = Object.freeze([
  { metric: "cpa", direction: LOWER_IS_BETTER, ko: "CPA (전환당 비용)", en: "CPA (cost per action)" },
  { metric: "cpi", direction: LOWER_IS_BETTER, ko: "CPI (설치당 비용)", en: "CPI (cost per install)" },
  { metric: "roas", direction: HIGHER_IS_BETTER, ko: "ROAS (광고 수익률)", en: "ROAS" },
  { metric: "conversions", direction: HIGHER_IS_BETTER, ko: "전환 수", en: "Conversions" },
]);

export function kpiFor(metric, basis = "actions") {
  const option = KPI_OPTIONS.find((item) => item.metric === metric) || KPI_OPTIONS[0];
  return { metric: option.metric, basis, direction: option.direction };
}

/** 결정 레코드 중 이번 리뷰가 채점할 것 하나 — 검토일이 지났고 판정에 필요한 항목이 있는 가장 최근 것. */
export function pickDecisionToScore(records = [], { currentPeriodStart = null } = {}) {
  const candidates = (Array.isArray(records) ? records : []).filter((record) => {
    if (!record) return false;
    const decidedAt = String(record.createdAt || record.reviewDate || "").slice(0, 10);
    // 이번 기간이 시작되기 전에 내린 결정만 이번 주 결과로 채점할 수 있다.
    return decidedAt && (!currentPeriodStart || decidedAt < currentPeriodStart);
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return candidates[0];
}

/**
 * @param {object[]} rows            매핑 완료 행(`getMappedRows` 결과)
 * @param {object[]} storedSnapshots 저장된 주간 스냅샷(오래된 것 → 최신)
 * @param {object[]} decisionRecords 저장된 결정 레코드
 * @param {object} project           `{ kpi, target }`
 * @param {object} customPeriod      사용자 지정 기간(없으면 자동)
 */
export function runReview({
  rows = [],
  storedSnapshots = [],
  decisionRecords = [],
  project = DEFAULT_PROJECT,
  customPeriod = null,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: "no_rows" };

  const periods = resolveComparisonPeriods({
    dates: rows.map((row) => row.date),
    custom: customPeriod,
  });
  if (!periods.ok) return { ok: false, reason: periods.reason, periods };

  const basis = project.kpi?.basis || "actions";
  const current = buildSnapshot({ rows, period: periods.current });
  const previous = buildSnapshot({ rows, period: periods.previous });
  if (!current.ok || !previous.ok) {
    return { ok: false, reason: current.ok ? "no_previous_data" : "no_rows_in_period", periods };
  }

  const history = historyFor(storedSnapshots, {
    excludeStart: periods.current.start,
    derive: (snapshotRows) => deriveMetrics(sumRows(snapshotRows), { basis }),
  });

  const routing = routeAnalyses({
    current,
    previous,
    history,
    project,
    volumeMultiplier: periods.volumeMultiplier,
  });

  const runsVariance = (routing.run || []).some((entry) => entry.analysis === "variance");
  const variance = runsVariance ? buildVariance({ current, previous, basis }) : null;

  const candidate = pickDecisionToScore(decisionRecords, { currentPeriodStart: periods.current.start });
  const lastDecision = candidate
    ? {
      decision: candidate,
      score: scoreDecision({
        decision: candidate,
        current,
        previous,
        history: history[candidate.goalMetric] || [],
        basis,
        volumeMultiplier: periods.volumeMultiplier,
      }),
    }
    : null;

  const currentMetrics = snapshotMetrics(current, { basis }) || {};
  const previousMetrics = snapshotMetrics(previous, { basis }) || {};

  return {
    ok: true,
    reason: null,
    periods,
    current,
    previous,
    history,
    routing,
    variance,
    lastDecision,
    historyWeeks: Object.keys(history).length > 0 ? (history[project.kpi?.metric] || []).length : 0,
    metrics: {
      current: { ...currentMetrics, cost: currentMetrics.totals?.cost ?? null },
      previous: { ...previousMetrics, cost: previousMetrics.totals?.cost ?? null },
    },
  };
}
