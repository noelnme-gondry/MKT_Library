/* ============================================================
 * segmentCompositionMath — 구성 변화 분석(5-29) 순수 엔진
 *
 * 입력은 오직 `SegmentPanelV1`(lib/segment-composition/segmentPanel.js)이다.
 * 원본 CSV 헤더도, 화면 상태도 여기서는 보이지 않는다. 결정론 — 난수 없음.
 *
 * 4층 구조(설계 §6):
 *   1층 전체 분포 변화     … 멤버 비중과 TVD
 *   2층 멤버별 변화        … %p·인원수·신규/소멸
 *   3층 Mix/Rate/상호작용  … 분석 단위 간 이동 vs 단위 내부 변화(무잔차)
 *   4층 순증 구간 프로파일 … 늘어난 몫의 구성 추정치(인과 아님)
 *
 * 이 파일이 하지 않는 일: 인과 판정, 원인 확정, 표본 미달을 0으로 접기.
 * 못 하는 계산은 숫자 대신 사유 코드를 돌려준다.
 * ============================================================ */

import { PANEL_STATUS, SEGMENT_ISSUE } from "@/lib/segment-composition/segmentPanel";

// 임계값은 코드에 흩어 두지 않고 한곳에 모은다 — 픽스처로 튜닝하고 화면에서 보여준다.
export const SEGMENT_THRESHOLDS = {
  minPeriodPopulation: 100,   // 기간별 전체 분모
  minMemberPopulation: 30,    // 멤버별 기간 분모(둘 중 작은 쪽)
  minEntities: 2,             // Mix/Rate 분해에 필요한 분석 단위 수
  minNetIncrease: 30,         // 순증 구간 프로파일을 열어 주는 최소 증가분
};

export const DIMENSION_STATUS = {
  READY: "READY",
  CAUTION: "CAUTION",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  INVALID_GRAIN: "INVALID_GRAIN",
};

// 상태를 만든 사유. "왜 못 하는지"를 말하지 못하면 표본 미달과 변화 없음이 같아 보인다.
export const SEGMENT_REASON = {
  MISSING_PERIOD: "MISSING_PERIOD",
  LOW_PERIOD_POPULATION: "LOW_PERIOD_POPULATION",
  LOW_MEMBER_POPULATION: "LOW_MEMBER_POPULATION",
  NO_DENOMINATOR: "NO_DENOMINATOR",
  NOT_EXHAUSTIVE: "NOT_EXHAUSTIVE",
  GRAIN_CONFLICT: "GRAIN_CONFLICT",
  ESTIMATED_COUNTS: "ESTIMATED_COUNTS",
  MEMBER_SUM_MISMATCH: "MEMBER_SUM_MISMATCH",
  MEMBER_ENTERED: "MEMBER_ENTERED",
  MEMBER_EXITED: "MEMBER_EXITED",
  SINGLE_ENTITY: "SINGLE_ENTITY",
  ENTITY_ENTERED: "ENTITY_ENTERED",
  ENTITY_EXITED: "ENTITY_EXITED",
  POPULATION_NOT_GROWN: "POPULATION_NOT_GROWN",
  NET_INCREASE_TOO_SMALL: "NET_INCREASE_TOO_SMALL",
  NET_RATE_OUT_OF_RANGE: "NET_RATE_OUT_OF_RANGE",
  MIX_RATE_UNAVAILABLE: "MIX_RATE_UNAVAILABLE",
};

const STATUS_RANK = {
  [DIMENSION_STATUS.READY]: 0,
  [DIMENSION_STATUS.CAUTION]: 1,
  [DIMENSION_STATUS.INSUFFICIENT_DATA]: 2,
  [DIMENSION_STATUS.INVALID_GRAIN]: 3,
};

const ENTITY_SEPARATOR = "│";

const entityKeyOf = (entity) => Object.values(entity || {}).join(ENTITY_SEPARATOR) || "(전체)";

const matchesScope = (record, scopeFilter) => (
  !scopeFilter || Object.entries(scopeFilter).every(([column, value]) => record.scope?.[column] === value)
);

/** 기간 선택자: 명시 목록 `["2026-07-01"]` 또는 포함 범위 `{from, to}`. */
export function selectsPeriod(time, selector) {
  if (!selector) return false;
  if (Array.isArray(selector)) return selector.includes(time);
  const { from, to } = selector;
  if (from && time < from) return false;
  if (to && time > to) return false;
  return Boolean(from || to);
}

/* 레코드를 셀 단위로 접는다. 분모·비용은 셀 속성이라 멤버 레코드마다 반복돼 있다 —
 * 레코드를 그대로 합치면 멤버 수만큼 모수가 부풀어 오른다. */
function foldCells(records) {
  const cells = new Map();
  records.forEach((record) => {
    const key = `${record.time}${ENTITY_SEPARATOR}${entityKeyOf(record.entity)}${ENTITY_SEPARATOR}${entityKeyOf(record.scope)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key,
        time: record.time,
        entity: record.entity,
        entityKey: entityKeyOf(record.entity),
        denominator: record.denominator,
        members: new Map(),
        isEstimated: false,
      };
      cells.set(key, cell);
    }
    cell.members.set(record.memberId, (cell.members.get(record.memberId) || 0) + record.count);
    if (record.isCountEstimated) cell.isEstimated = true;
  });
  return [...cells.values()];
}

function aggregateBucket(cells) {
  const members = new Map();
  let population = 0;
  let countSum = 0;
  let cellsWithoutDenominator = 0;
  let isEstimated = false;

  cells.forEach((cell) => {
    if (cell.denominator == null) { cellsWithoutDenominator += 1; return; }
    population += cell.denominator;
    if (cell.isEstimated) isEstimated = true;
    cell.members.forEach((count, memberId) => {
      members.set(memberId, (members.get(memberId) || 0) + count);
      countSum += count;
    });
  });

  return { members, population, countSum, cellsWithoutDenominator, isEstimated, cellCount: cells.length };
}

function resolveStatus({ reasons, hasCells }) {
  if (reasons.has(SEGMENT_REASON.GRAIN_CONFLICT)) return DIMENSION_STATUS.INVALID_GRAIN;
  if (!hasCells || reasons.has(SEGMENT_REASON.MISSING_PERIOD) || reasons.has(SEGMENT_REASON.LOW_PERIOD_POPULATION)) {
    return DIMENSION_STATUS.INSUFFICIENT_DATA;
  }
  const cautions = [
    SEGMENT_REASON.LOW_MEMBER_POPULATION, SEGMENT_REASON.ESTIMATED_COUNTS, SEGMENT_REASON.NO_DENOMINATOR,
    SEGMENT_REASON.NOT_EXHAUSTIVE, SEGMENT_REASON.MEMBER_SUM_MISMATCH,
    SEGMENT_REASON.MEMBER_ENTERED, SEGMENT_REASON.MEMBER_EXITED,
  ];
  return cautions.some((reason) => reasons.has(reason)) ? DIMENSION_STATUS.CAUTION : DIMENSION_STATUS.READY;
}

/**
 * 1층 + 2층. 한 세그먼트 축의 PRE/POST 분포와 멤버별 변화.
 * 계산할 수 없으면 숫자를 지어내지 않고 status·reasons로 답한다.
 */
export function compareDistribution({
  panel, dimensionId, pre, post, scopeFilter = null, thresholds = SEGMENT_THRESHOLDS,
} = {}) {
  const definition = (panel?.dimensions || []).find((dimension) => dimension.id === dimensionId) || null;
  const reasons = new Set();
  const records = (panel?.records || []).filter((record) => (
    record.dimensionId === dimensionId && matchesScope(record, scopeFilter)
  ));

  if (panel?.quality?.status === PANEL_STATUS.BLOCKED) reasons.add(SEGMENT_REASON.MISSING_PERIOD);
  const dimensionIssues = (panel?.quality?.issues || []).filter((issue) => issue.dimensionId === dimensionId);
  if (dimensionIssues.some((issue) => issue.code === SEGMENT_ISSUE.DENOMINATOR_CONFLICT)) reasons.add(SEGMENT_REASON.GRAIN_CONFLICT);
  if (dimensionIssues.some((issue) => issue.code === SEGMENT_ISSUE.MEMBER_SUM_MISMATCH)) reasons.add(SEGMENT_REASON.MEMBER_SUM_MISMATCH);

  const preCells = foldCells(records.filter((record) => selectsPeriod(record.time, pre)));
  const postCells = foldCells(records.filter((record) => selectsPeriod(record.time, post)));
  const preAgg = aggregateBucket(preCells);
  const postAgg = aggregateBucket(postCells);

  if (!preCells.length || !postCells.length) reasons.add(SEGMENT_REASON.MISSING_PERIOD);
  if (preAgg.cellsWithoutDenominator || postAgg.cellsWithoutDenominator) reasons.add(SEGMENT_REASON.NO_DENOMINATOR);
  if (preAgg.isEstimated || postAgg.isEstimated) reasons.add(SEGMENT_REASON.ESTIMATED_COUNTS);
  if (definition && !(definition.isExclusive && definition.isExhaustive)) reasons.add(SEGMENT_REASON.NOT_EXHAUSTIVE);
  if (preAgg.population < thresholds.minPeriodPopulation || postAgg.population < thresholds.minPeriodPopulation) {
    reasons.add(SEGMENT_REASON.LOW_PERIOD_POPULATION);
  }

  const memberIds = [...new Set([...preAgg.members.keys(), ...postAgg.members.keys()])];
  const declaredOrder = new Map((definition?.members || []).map((member, index) => [member.id, index]));
  const labels = new Map((definition?.members || []).map((member) => [member.id, member.label]));
  memberIds.sort((a, b) => (
    (declaredOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (declaredOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    || a.localeCompare(b)
  ));

  const hasPopulation = preAgg.population > 0 && postAgg.population > 0;
  const members = memberIds.map((memberId) => {
    const preCount = preAgg.members.has(memberId) ? preAgg.members.get(memberId) : null;
    const postCount = postAgg.members.has(memberId) ? postAgg.members.get(memberId) : null;
    const preShare = hasPopulation && preCount != null ? preCount / preAgg.population : null;
    const postShare = hasPopulation && postCount != null ? postCount / postAgg.population : null;
    // 한쪽 기간에만 있는 멤버는 조용히 빼지 않는다. 비중은 0이 아니라 "없음"이다.
    const isNew = preCount == null && postCount != null;
    const isLost = preCount != null && postCount == null;
    if (isNew) reasons.add(SEGMENT_REASON.MEMBER_ENTERED);
    if (isLost) reasons.add(SEGMENT_REASON.MEMBER_EXITED);
    const shareDelta = preShare != null && postShare != null ? postShare - preShare
      : isNew ? postShare
        : isLost ? -preShare
          : null;
    if (Math.min(preCount ?? 0, postCount ?? 0) < thresholds.minMemberPopulation) {
      reasons.add(SEGMENT_REASON.LOW_MEMBER_POPULATION);
    }
    return {
      memberId,
      label: labels.get(memberId) || memberId,
      preCount,
      postCount,
      countDelta: preCount != null && postCount != null ? postCount - preCount : null,
      preShare,
      postShare,
      shareDelta,
      shareOfShift: null,
      isNew,
      isLost,
      prePopulation: preAgg.population || null,
      postPopulation: postAgg.population || null,
    };
  });

  const canTotalVariation = Boolean(definition?.contract?.canTotalVariation)
    && hasPopulation && preCells.length > 0 && postCells.length > 0;
  const totalVariation = canTotalVariation
    ? members.reduce((sum, member) => sum + Math.abs(member.shareDelta ?? 0), 0) / 2
    : null;

  members.forEach((member) => {
    member.shareOfShift = totalVariation > 0 && member.shareDelta != null
      ? Math.abs(member.shareDelta) / 2 / totalVariation
      : null;
  });

  return {
    dimensionId,
    label: definition?.label || dimensionId,
    status: resolveStatus({ reasons, hasCells: preCells.length > 0 && postCells.length > 0 }),
    reasons: [...reasons].sort(),
    contract: definition?.contract || null,
    totalVariation,
    members,
    periods: {
      pre: { population: preAgg.population, memberCount: preAgg.countSum, cells: preAgg.cellCount },
      post: { population: postAgg.population, memberCount: postAgg.countSum, cells: postAgg.cellCount },
    },
  };
}

/**
 * 3층. 선택한 멤버의 전체 비율 변화를 분석 단위 간 이동(Mix)과 단위 내부 변화(Rate)로 분해.
 *
 *   R_t = Σ_i w_i,t × r_i,t
 *   ΔR  = Σ Δw_i·r_i,pre + Σ w_i,pre·Δr_i + Σ Δw_i·Δr_i
 *
 * 세 항의 합은 항상 ΔR과 정확히 일치한다(무잔차). 최저 grain에서 한 번 계산하고
 * 상위 수준은 단순 합산으로 롤업한다 — 단계마다 다시 분해하면 Σ가 어긋난다.
 */
export function decomposeMixRate({
  panel, dimensionId, memberId, pre, post, scopeFilter = null, thresholds = SEGMENT_THRESHOLDS,
} = {}) {
  const definition = (panel?.dimensions || []).find((dimension) => dimension.id === dimensionId) || null;
  const reasons = new Set();
  if (!definition?.contract?.canMixRate) {
    return { available: false, reasons: [SEGMENT_REASON.MIX_RATE_UNAVAILABLE], entities: [], totals: null };
  }

  const records = (panel?.records || []).filter((record) => (
    record.dimensionId === dimensionId && matchesScope(record, scopeFilter)
  ));
  const collect = (cells) => {
    const byEntity = new Map();
    let population = 0;
    cells.forEach((cell) => {
      if (cell.denominator == null) return;
      population += cell.denominator;
      const current = byEntity.get(cell.entityKey) || { entity: cell.entity, population: 0, memberCount: 0 };
      current.population += cell.denominator;
      current.memberCount += cell.members.get(memberId) || 0;
      byEntity.set(cell.entityKey, current);
    });
    return { byEntity, population };
  };

  const preSide = collect(foldCells(records.filter((record) => selectsPeriod(record.time, pre))));
  const postSide = collect(foldCells(records.filter((record) => selectsPeriod(record.time, post))));
  if (!preSide.population || !postSide.population) {
    return { available: false, reasons: [SEGMENT_REASON.MISSING_PERIOD], entities: [], totals: null };
  }

  const entityKeys = [...new Set([...preSide.byEntity.keys(), ...postSide.byEntity.keys()])].sort();
  if (entityKeys.length < thresholds.minEntities) reasons.add(SEGMENT_REASON.SINGLE_ENTITY);

  const entities = entityKeys.map((entityKey) => {
    const before = preSide.byEntity.get(entityKey);
    const after = postSide.byEntity.get(entityKey);
    // 한쪽에만 있는 단위는 비중 0으로 두어 항등식을 유지하고, 진입/이탈로 표시한다.
    // 진입 단위의 변화는 전부 상호작용 항에 잡힌다 — 숨기지 말고 kind로 알린다.
    const wPre = before ? before.population / preSide.population : 0;
    const wPost = after ? after.population / postSide.population : 0;
    const rPre = before && before.population > 0 ? before.memberCount / before.population : 0;
    const rPost = after && after.population > 0 ? after.memberCount / after.population : 0;
    const kind = !before ? "entry" : !after ? "exit" : "stable";
    if (kind === "entry") reasons.add(SEGMENT_REASON.ENTITY_ENTERED);
    if (kind === "exit") reasons.add(SEGMENT_REASON.ENTITY_EXITED);
    const mix = (wPost - wPre) * rPre;
    const rate = wPre * (rPost - rPre);
    const interaction = (wPost - wPre) * (rPost - rPre);
    return {
      entityKey,
      entity: (after || before).entity,
      kind,
      wPre,
      wPost,
      rPre,
      rPost,
      prePopulation: before?.population ?? 0,
      postPopulation: after?.population ?? 0,
      mix,
      rate,
      interaction,
      total: mix + rate + interaction,
    };
  });

  const sumOf = (field) => entities.reduce((accumulator, entity) => accumulator + entity[field], 0);
  const memberTotal = (side) => [...side.byEntity.values()].reduce((accumulator, entity) => accumulator + entity.memberCount, 0);
  const preRate = memberTotal(preSide) / preSide.population;
  const postRate = memberTotal(postSide) / postSide.population;

  return {
    available: true,
    reasons: [...reasons].sort(),
    memberId,
    entities,
    totals: {
      preRate,
      postRate,
      delta: postRate - preRate,
      mix: sumOf("mix"),
      rate: sumOf("rate"),
      interaction: sumOf("interaction"),
    },
  };
}

/** 3층 롤업. 각 항이 단위별 가산이므로 상위 키로 단순 합산하면 항등식이 그대로 남는다. */
export function rollupMixRate(decomposition, keyOf) {
  if (!decomposition?.available) return [];
  const groups = new Map();
  decomposition.entities.forEach((entity) => {
    const key = keyOf(entity);
    const current = groups.get(key) || { key, mix: 0, rate: 0, interaction: 0, total: 0, entities: 0 };
    current.mix += entity.mix;
    current.rate += entity.rate;
    current.interaction += entity.interaction;
    current.total += entity.total;
    current.entities += 1;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * 4층. 늘어난 몫(순증 구간)의 구성 추정치.
 *
 *   순증 멤버율 = (N_post·p_post − N_pre·p_pre) / (N_post − N_pre)
 *
 * 이것은 두 기간을 뺀 산술 결과지 "증분 유저의 인과적 프로필"이 아니다.
 * 범위를 벗어나면 clamp해서 정상처럼 보이게 하지 않고 해석 불가로 남긴다.
 */
export function netNewProfile(distribution, { thresholds = SEGMENT_THRESHOLDS } = {}) {
  const prePopulation = distribution?.periods?.pre?.population || 0;
  const postPopulation = distribution?.periods?.post?.population || 0;
  const increase = postPopulation - prePopulation;

  if (increase <= 0) {
    return { available: false, reasons: [SEGMENT_REASON.POPULATION_NOT_GROWN], increase, members: [] };
  }
  if (increase < thresholds.minNetIncrease) {
    return { available: false, reasons: [SEGMENT_REASON.NET_INCREASE_TOO_SMALL], increase, members: [] };
  }

  const reasons = new Set();
  const members = (distribution.members || []).map((member) => {
    const netCount = (member.postCount ?? 0) - (member.preCount ?? 0);
    const netRate = netCount / increase;
    const interpretable = netRate >= 0 && netRate <= 1;
    if (!interpretable) reasons.add(SEGMENT_REASON.NET_RATE_OUT_OF_RANGE);
    return {
      memberId: member.memberId,
      label: member.label,
      netCount,
      // clamp 금지 — 범위 밖 값은 그대로 두고 해석 불가로 표시한다.
      netRate: interpretable ? netRate : null,
      rawNetRate: netRate,
      interpretable,
      preShare: member.preShare,
      postShare: member.postShare,
    };
  });

  return { available: true, reasons: [...reasons].sort(), increase, prePopulation, postPopulation, members };
}

/**
 * 축 랭킹. 임의 합성 점수를 만들지 않는다 —
 * 증거 상태 → TVD → 두 기간 중 작은 분모 → id 안정 정렬.
 */
export function rankDimensions({ panel, pre, post, scopeFilter = null, thresholds = SEGMENT_THRESHOLDS } = {}) {
  const summaries = (panel?.dimensions || []).map((dimension) => compareDistribution({
    panel, dimensionId: dimension.id, pre, post, scopeFilter, thresholds,
  }));
  const smallestPopulation = (summary) => Math.min(summary.periods.pre.population, summary.periods.post.population);
  return summaries.sort((a, b) => (
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || (b.totalVariation ?? -1) - (a.totalVariation ?? -1)
    || smallestPopulation(b) - smallestPopulation(a)
    || a.dimensionId.localeCompare(b.dimensionId)
  ));
}

export const SEGMENT_COMPOSITION_MATH = {
  compareDistribution,
  decomposeMixRate,
  rollupMixRate,
  netNewProfile,
  rankDimensions,
  selectsPeriod,
};
