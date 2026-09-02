import { satActiveIndex, satActiveVerdict } from "@/utils/satMath";

function finiteNonnegative(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function metricValues(row, metric) {
  if (metric === "roas") {
    return {
      average: finiteNonnegative(row?.roas?.avgRoas),
      marginal: finiteNonnegative(row?.roas?.marginalRoas),
    };
  }
  return {
    average: finiteNonnegative(row?.avgCpr),
    marginal: row?.marginalCpr === Infinity ? Infinity : finiteNonnegative(row?.marginalCpr),
  };
}

// 포화도 엔진의 출력을 표시용으로만 정렬한다. 새 모델·목표선·신뢰등급을 만들지 않는다.
export function buildMarginalEfficiencyGap(rows = [], metric = "cpa") {
  const excluded = [];
  const candidates = [];

  for (const row of rows || []) {
    const { average, marginal } = metricValues(row, metric);
    if (average == null || marginal == null) {
      excluded.push({ name: row?.name || "—", reason: "incalculable" });
      continue;
    }
    candidates.push({
      name: row.name,
      average,
      marginal,
      saturationIndex: satActiveIndex(row, metric),
      verdict: satActiveVerdict(row, metric),
      observations: Number(row.raw || row.n || 0),
      r2: Number.isFinite(row.r2) ? row.r2 : null,
    });
  }

  const finiteValues = candidates.flatMap((point) => [
    point.average,
    Number.isFinite(point.marginal) ? point.marginal : null,
  ]).filter(Number.isFinite);
  const finiteMax = finiteValues.length ? Math.max(...finiteValues) : 0;
  const domainMax = finiteMax > 0 ? finiteMax * 1.12 : 1;
  const points = candidates
    .map((point) => ({
      ...point,
      plotMarginal: Number.isFinite(point.marginal) ? point.marginal : domainMax,
      isUnbounded: point.marginal === Infinity,
    }))
    // 포화지수가 낮을수록 다음 예산 투입의 상대 효율이 좋다. 행동 후보를 위에 둔다.
    .sort((a, b) => a.saturationIndex - b.saturationIndex || a.name.localeCompare(b.name));

  return { points, excluded, domainMax };
}
