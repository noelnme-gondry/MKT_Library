/* ============================================================
 * segmentOpsMath — 구성 변화(5-29) 운영 지문
 *
 * "무엇이 움직였나" 다음에 마케터가 실제로 묻는 것은 "그럼 내가 뭘 건드린
 * 결과인가"다. 여기서 하는 일은 그 **가설을 좁히는 관측 신호**를 만드는 데까지고,
 * 원인 확정은 하지 않는다(설계 §6.5).
 *
 * 금지: "직접 증거", "원인 확정", "경로 없음". 볼륨↑·비용효율↑는 경쟁 완화의
 * 단서일 수 있지만 소재·타게팅·계절성으로도 똑같이 생긴다.
 *
 * 입력은 SegmentPanelV1뿐이다. 비용은 셀 속성이라 멤버 레코드마다 반복돼 있고,
 * 그 사실은 정규화 계약이 이미 처리했다(합산 금지 → 셀당 1회).
 * ============================================================ */

import { foldCells, selectsPeriod, SEGMENT_REASON } from "@/utils/segmentCompositionMath";

export const OPS_THRESHOLDS = {
  minEntitySpend: 1,        // 비용이 0인 단위는 탄력성·단가 비교에서 제외
  minEntityPopulation: 30,  // 단위별 모수 하한(작으면 단가가 튄다)
  minPeriodPairs: 3,        // 반복성을 말하려면 최소 이만큼의 기간 쌍이 필요
  largeShift: 0.05,         // 5%p 이상 움직인 기간을 "큰 변동"으로 층화
};

export const OPS_REASON = {
  NO_SPEND: "NO_SPEND",
  NO_ENTITY: "NO_ENTITY",
  NO_DENOMINATOR: "NO_DENOMINATOR",
  LOW_ENTITY_POPULATION: "LOW_ENTITY_POPULATION",
  NOT_ENOUGH_PERIODS: "NOT_ENOUGH_PERIODS",
  MULTIPLE_COMPARISONS: "MULTIPLE_COMPARISONS",
  DIRECTION_MIXED: "DIRECTION_MIXED",
};

// 2×2 사분면. 볼륨과 획득 단가가 각각 어느 쪽으로 갔는지만 말한다.
export const COST_VOLUME_QUADRANT = {
  SCALE_EFFICIENT: "SCALE_EFFICIENT", // 볼륨↑ 단가↓
  SCALE_COSTLY: "SCALE_COSTLY",       // 볼륨↑ 단가↑
  SHRINK_EFFICIENT: "SHRINK_EFFICIENT", // 볼륨↓ 단가↓
  SHRINK_COSTLY: "SHRINK_COSTLY",     // 볼륨↓ 단가↑
};

const bucketFor = (records, selector, scopeFilter) => foldCells(
  records.filter((record) => selectsPeriod(record.time, selector) && matches(record, scopeFilter)),
);

const matches = (record, scopeFilter) => (
  !scopeFilter || Object.entries(scopeFilter).every(([column, value]) => record.scope?.[column] === value)
);

/* 셀 → 단위별 {모수, 멤버 인원, 비용}. 비용은 셀 속성이므로 셀마다 한 번만 더한다. */
function byEntity(cells, memberId) {
  const entities = new Map();
  cells.forEach((cell) => {
    const current = entities.get(cell.entityKey) || { entityKey: cell.entityKey, entity: cell.entity, population: 0, memberCount: 0, spend: 0, hasSpend: false };
    if (cell.denominator != null) current.population += cell.denominator;
    current.memberCount += cell.members.get(memberId) || 0;
    const spend = cell.spend;
    if (spend != null && Number.isFinite(spend)) { current.spend += spend; current.hasSpend = true; }
    entities.set(cell.entityKey, current);
  });
  return entities;
}

/* foldCells는 optionalMeasures를 셀에 싣지 않으므로 여기서 한 번 더 붙인다.
 * 레코드가 아니라 셀 단위로 읽어야 멤버 수만큼 비용이 부풀지 않는다. */
function attachSpend(cells, records) {
  const spendByCell = new Map();
  records.forEach((record) => {
    const key = `${record.time}│${Object.values(record.entity || {}).join("│") || "(전체)"}│${Object.values(record.scope || {}).join("│") || "(전체)"}`;
    if (!spendByCell.has(key)) spendByCell.set(key, record.optionalMeasures?.spend ?? null);
  });
  cells.forEach((cell) => { cell.spend = spendByCell.get(cell.key) ?? null; });
  return cells;
}

function prepareSides({ panel, dimensionId, memberId, pre, post, scopeFilter }) {
  const records = (panel?.records || []).filter((record) => record.dimensionId === dimensionId);
  const preCells = attachSpend(bucketFor(records, pre, scopeFilter), records);
  const postCells = attachSpend(bucketFor(records, post, scopeFilter), records);
  return { preEntities: byEntity(preCells, memberId), postEntities: byEntity(postCells, memberId) };
}

/**
 * 비용 배분이 옮겨 간 방향과 구성이 옮겨 간 방향이 같은가.
 *
 * 탄력성은 두 기간의 로그 변화비(Δln 멤버 인원 ÷ Δln 비용)로만 계산한다. 두 점
 * 사이의 비율일 뿐이라 곡선도 인과도 아니며, 부호가 뒤집힌 단위를 눈에 띄게 하는
 * 용도다. 비용이 0이거나 한쪽 기간에만 있는 단위는 숫자를 만들지 않는다.
 */
export function spendShiftFingerprint({
  panel, dimensionId, memberId, pre, post, scopeFilter = null, thresholds = OPS_THRESHOLDS,
} = {}) {
  const { preEntities, postEntities } = prepareSides({ panel, dimensionId, memberId, pre, post, scopeFilter });
  const reasons = new Set();
  const keys = [...new Set([...preEntities.keys(), ...postEntities.keys()])].sort();
  if (keys.length < 2) reasons.add(SEGMENT_REASON.SINGLE_ENTITY);

  const totalSpend = (map) => [...map.values()].reduce((sum, entity) => sum + entity.spend, 0);
  const preSpend = totalSpend(preEntities);
  const postSpend = totalSpend(postEntities);
  const hasSpend = [...preEntities.values(), ...postEntities.values()].some((entity) => entity.hasSpend);
  if (!hasSpend || preSpend <= 0 || postSpend <= 0) {
    return { available: false, reasons: [OPS_REASON.NO_SPEND], entities: [] };
  }

  const entities = keys.map((key) => {
    const before = preEntities.get(key);
    const after = postEntities.get(key);
    const spendPre = before?.spend ?? 0;
    const spendPost = after?.spend ?? 0;
    const countPre = before?.memberCount ?? 0;
    const countPost = after?.memberCount ?? 0;
    const usable = spendPre >= thresholds.minEntitySpend && spendPost >= thresholds.minEntitySpend && countPre > 0 && countPost > 0;
    if (!usable) reasons.add(OPS_REASON.NO_SPEND);
    // 두 점 로그비 — 곡선이 아니라 "같은 방향으로 갔는가"를 보는 지문이다.
    const elasticity = usable ? Math.log(countPost / countPre) / Math.log(spendPost / spendPre) : null;
    const spendShareDelta = (spendPost / postSpend) - (spendPre / preSpend);
    const countShareDelta = countPost / Math.max(1, [...postEntities.values()].reduce((sum, entity) => sum + entity.memberCount, 0))
      - countPre / Math.max(1, [...preEntities.values()].reduce((sum, entity) => sum + entity.memberCount, 0));
    const sameDirection = spendShareDelta === 0 || countShareDelta === 0
      ? null
      : (spendShareDelta > 0) === (countShareDelta > 0);
    if (sameDirection === false) reasons.add(OPS_REASON.DIRECTION_MIXED);
    return {
      entityKey: key,
      entity: (after || before).entity,
      spendPre, spendPost,
      spendShareDelta,
      memberCountPre: countPre,
      memberCountPost: countPost,
      memberShareDelta: countShareDelta,
      elasticity: Number.isFinite(elasticity) ? elasticity : null,
      sameDirection,
    };
  });

  return { available: true, reasons: [...reasons].sort(), entities };
}

/**
 * CPA × 볼륨 2×2. 단위별로 볼륨과 획득 단가가 어느 쪽으로 갔는지만 분류한다.
 * `SCALE_EFFICIENT`(볼륨↑ 단가↓)는 경쟁 완화의 단서일 수 있으나 소재·타게팅·
 * 계절성으로도 똑같이 생긴다 — 분류 자체가 원인을 말하지 않는다.
 */
export function costVolumeQuadrants({
  panel, dimensionId, memberId, pre, post, scopeFilter = null, thresholds = OPS_THRESHOLDS,
} = {}) {
  const { preEntities, postEntities } = prepareSides({ panel, dimensionId, memberId, pre, post, scopeFilter });
  const reasons = new Set();
  const keys = [...new Set([...preEntities.keys(), ...postEntities.keys()])].sort();
  const rows = [];

  keys.forEach((key) => {
    const before = preEntities.get(key);
    const after = postEntities.get(key);
    if (!before || !after) return; // 한쪽에만 있는 단위는 단가 비교 자체가 불가능하다
    if (!before.hasSpend || !after.hasSpend) { reasons.add(OPS_REASON.NO_SPEND); return; }
    if (before.memberCount <= 0 || after.memberCount <= 0) { reasons.add(OPS_REASON.LOW_ENTITY_POPULATION); return; }
    if (Math.min(before.population, after.population) < thresholds.minEntityPopulation) {
      reasons.add(OPS_REASON.LOW_ENTITY_POPULATION);
    }
    const costPre = before.spend / before.memberCount;
    const costPost = after.spend / after.memberCount;
    const volumeUp = after.memberCount > before.memberCount;
    const costUp = costPost > costPre;
    rows.push({
      entityKey: key,
      entity: after.entity,
      volumePre: before.memberCount,
      volumePost: after.memberCount,
      costPerMemberPre: costPre,
      costPerMemberPost: costPost,
      volumeChange: after.memberCount - before.memberCount,
      costChange: costPost - costPre,
      quadrant: volumeUp
        ? (costUp ? COST_VOLUME_QUADRANT.SCALE_COSTLY : COST_VOLUME_QUADRANT.SCALE_EFFICIENT)
        : (costUp ? COST_VOLUME_QUADRANT.SHRINK_COSTLY : COST_VOLUME_QUADRANT.SHRINK_EFFICIENT),
    });
  });

  if (!rows.length) return { available: false, reasons: [...reasons].sort().length ? [...reasons].sort() : [OPS_REASON.NO_SPEND], rows: [] };
  return { available: true, reasons: [...reasons].sort(), rows };
}

/**
 * 기간별 구성 이동 스캔. 인접 기간 쌍마다 선택 멤버 비중의 변화를 계산해
 * "언제 크게 움직였나"를 보여 준다. 변화점 검정이 아니라 서술 통계다 —
 * 여러 기간을 훑는 순간 우연히 큰 값이 나오므로 다중 탐색 경고를 함께 낸다.
 */
export function scanPeriodShifts({ panel, dimensionId, memberId, scopeFilter = null, thresholds = OPS_THRESHOLDS } = {}) {
  const records = (panel?.records || []).filter((record) => record.dimensionId === dimensionId && matches(record, scopeFilter));
  const periods = [...new Set(records.map((record) => record.time))].sort();
  if (periods.length < 2) return { available: false, reasons: [OPS_REASON.NOT_ENOUGH_PERIODS], steps: [] };

  const shareAt = (period) => {
    const cells = foldCells(records.filter((record) => record.time === period));
    let population = 0;
    let memberCount = 0;
    cells.forEach((cell) => {
      if (cell.denominator == null) return;
      population += cell.denominator;
      memberCount += cell.members.get(memberId) || 0;
    });
    return population > 0 ? { share: memberCount / population, population } : null;
  };

  const series = periods.map((period) => ({ period, ...(shareAt(period) || { share: null, population: 0 }) }));
  const steps = [];
  for (let index = 1; index < series.length; index += 1) {
    const before = series[index - 1];
    const after = series[index];
    if (before.share == null || after.share == null) continue;
    steps.push({
      from: before.period,
      to: after.period,
      shareBefore: before.share,
      shareAfter: after.share,
      delta: after.share - before.share,
      isLarge: Math.abs(after.share - before.share) >= thresholds.largeShift,
      population: Math.min(before.population, after.population),
    });
  }

  const reasons = [];
  if (steps.length < thresholds.minPeriodPairs) reasons.push(OPS_REASON.NOT_ENOUGH_PERIODS);
  // 기간 쌍을 전부 훑고 최댓값을 고르는 순간 우연이 섞인다. 개수를 그대로 말한다.
  if (steps.length > 1) reasons.push(OPS_REASON.MULTIPLE_COMPARISONS);

  const ranked = [...steps].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.to.localeCompare(b.to));
  return { available: steps.length > 0, reasons: reasons.sort(), series, steps, ranked, comparisons: steps.length };
}

/**
 * 반복성 층화. 큰 변동이 같은 방향으로 반복되는지, 한 번뿐인지 센다.
 * 반복된다고 원인이 확인되는 것은 아니지만, 한 번뿐인 변동을 추세로 읽는 것은 막는다.
 */
export function repeatabilityByMagnitude(scan, { thresholds = OPS_THRESHOLDS } = {}) {
  if (!scan?.available) return { available: false, reasons: scan?.reasons || [OPS_REASON.NOT_ENOUGH_PERIODS], strata: [] };
  const large = scan.steps.filter((step) => step.isLarge);
  const small = scan.steps.filter((step) => !step.isLarge);
  const summarize = (steps, label) => {
    const up = steps.filter((step) => step.delta > 0).length;
    const down = steps.filter((step) => step.delta < 0).length;
    return {
      label,
      count: steps.length,
      up,
      down,
      // 방향이 갈리면 "반복"이 아니라 "왔다 갔다"다 — 한쪽으로 몰아 읽지 않게 둘 다 센다.
      dominantDirection: up === down ? null : up > down ? "up" : "down",
      isRepeated: steps.length >= 2 && (up === 0 || down === 0),
    };
  };
  const strata = [summarize(large, "large"), summarize(small, "small")];
  const reasons = [];
  if (scan.steps.length < thresholds.minPeriodPairs) reasons.push(OPS_REASON.NOT_ENOUGH_PERIODS);
  if (strata[0].count && strata[0].dominantDirection === null) reasons.push(OPS_REASON.DIRECTION_MIXED);
  return { available: true, reasons: reasons.sort(), strata };
}

export const SEGMENT_OPS_MATH = {
  spendShiftFingerprint,
  costVolumeQuadrants,
  scanPeriodShifts,
  repeatabilityByMagnitude,
};
