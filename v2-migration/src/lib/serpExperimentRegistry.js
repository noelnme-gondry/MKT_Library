export const SERP_EXPERIMENT_POLICY = Object.freeze({
  minimumBaselineDays: 28,
  minimumImpressions: 100,
  ctrPositionBand: Object.freeze({ min: 4, max: 10 }),
  allowedChangedField: "title",
});

// 상세 성과 수치는 공개 저장소에 두지 않는다. 운영자가 비공개 GSC 내보내기의
// 28일 페이지 수치를 evaluateSerpExperiment에 넣어 통과 여부만 확인한다.
export const SERP_TITLE_EXPERIMENTS = Object.freeze([
  Object.freeze({
    id: "ko-glossary-uplift-title",
    locale: "ko",
    kind: "glossary",
    slug: "uplift",
    path: "/glossary/uplift",
    controlTitle: "업리프트 뜻 | 홀드아웃으로 보는 광고 순수 증가분",
    candidateTitle: "업리프트 뜻·계산 | 광고 순수 증가분 측정",
    changedFields: Object.freeze(["title"]),
    lastMaterialChange: "2026-08-26",
    status: "collecting_baseline",
  }),
  Object.freeze({
    id: "ko-glossary-incrementality-title",
    locale: "ko",
    kind: "glossary",
    slug: "incrementality",
    path: "/glossary/incrementality",
    controlTitle: "인크리멘탈리티 뜻 | CPA·ROAS로는 안 보이는 것",
    candidateTitle: "인크리멘탈리티·인크리멘탈 뜻 | 증분 측정",
    changedFields: Object.freeze(["title"]),
    lastMaterialChange: "2026-08-26",
    status: "collecting_baseline",
  }),
]);

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(value) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

export function baselineDays(baseline) {
  const start = isoDay(baseline?.start);
  const end = isoDay(baseline?.end);
  if (start == null || end == null || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

/**
 * 비공개 GSC 페이지 수치를 받아 제목 실험을 시작해도 되는지만 판정한다.
 * CTR 단독 최적화를 막기 위해 순위 대역과 노출량을 함께 요구한다.
 */
export function evaluateSerpExperiment(experiment, baseline) {
  const reasons = [];
  if (!baseline) return { eligible: false, reasons: ["BASELINE_MISSING"] };

  const days = baselineDays(baseline);
  if (days < SERP_EXPERIMENT_POLICY.minimumBaselineDays) reasons.push("BASELINE_TOO_SHORT");
  if (!Number.isFinite(baseline.impressions) || baseline.impressions < SERP_EXPERIMENT_POLICY.minimumImpressions) {
    reasons.push("IMPRESSIONS_TOO_LOW");
  }
  const position = baseline.averagePosition;
  if (!Number.isFinite(position)
    || position < SERP_EXPERIMENT_POLICY.ctrPositionBand.min
    || position > SERP_EXPERIMENT_POLICY.ctrPositionBand.max) {
    reasons.push("POSITION_OUTSIDE_CTR_BAND");
  }
  const baselineStart = isoDay(baseline.start);
  const lastMaterialChange = isoDay(experiment?.lastMaterialChange);
  if (baselineStart == null || lastMaterialChange == null || baselineStart < lastMaterialChange) {
    reasons.push("BASELINE_PREDATES_CONTENT_CHANGE");
  }
  if (experiment?.changedFields?.length !== 1
    || experiment.changedFields[0] !== SERP_EXPERIMENT_POLICY.allowedChangedField) {
    reasons.push("MULTIPLE_VARIABLES");
  }

  return { eligible: reasons.length === 0, reasons, baselineDays: days };
}

export function serpExperimentById(id) {
  return SERP_TITLE_EXPERIMENTS.find((experiment) => experiment.id === id) || null;
}
