/**
 * Weekly Review 스냅샷 — 주 × 캠페인 집계.
 *
 * 원본 CSV 행은 저장하지 않는다. 5만 행이 캠페인 수십 개짜리 표 하나로 줄고, 8주를 모아도
 * 수백 행이라 브라우저 안에 남길 수 있다. 대신 캠페인명은 저장된다 — 그게 없으면 원인을
 * 캠페인까지 좁힐 수 없다.
 *
 * 두 가지를 특히 지킨다.
 *
 * ① **합산 가능한 값만 저장한다.** CPA·CTR·ROAS 같은 비율은 저장하지 않고 읽을 때 합에서
 *    만든다. 비율을 저장해 두면 나중에 롤업하면서 "비율의 평균"을 내게 되는데, 그건 모수를
 *    무시한 값이라 캠페인별과 전체가 어긋난다.
 * ② **없는 것과 0을 구분한다.** 매출 컬럼이 매핑되지 않은 것과 매출이 0인 것은 다르다.
 *    전자를 0으로 저장하면 ROAS 0%가 화면에 뜬다. 없으면 null이다.
 *
 * 결정론 — 정렬은 로케일에 의존하지 않는 코드포인트 비교로 한다(`localeCompare`는 ICU·로케일
 * 설정에 따라 순서가 달라져 같은 입력이 다른 스냅샷을 만든다). 합산은 Neumaier 보정합이라
 * 입력 행 순서가 달라도 부동소수점 오차가 쌓이지 않는다.
 */

import { formatUtcDate, parseUtcDate } from "./period";

/** 합산 가능한 필드. 여기 없는 것(비율)은 저장하지 않는다. */
export const ADDITIVE_FIELDS = Object.freeze([
  "cost",
  "impressions",
  "clicks",
  "installs",
  "actions",
  "revenue",
]);

function toFiniteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  // CSV는 "2,488"처럼 천단위 콤마를 담고 온다. parseFloat는 여기서 2를 돌려준다.
  const num = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
  return Number.isFinite(num) ? num : null;
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** 코드포인트 비교 — 로케일에 흔들리지 않는다. */
function compareText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Neumaier 보정합 누산기. */
function newSum() {
  return { sum: 0, comp: 0, seen: false };
}

function addTo(acc, value) {
  const next = acc.sum + value;
  acc.comp += Math.abs(acc.sum) >= Math.abs(value)
    ? (acc.sum - next) + value
    : (value - next) + acc.sum;
  acc.sum = next;
  acc.seen = true;
}

/** 한 번도 값을 보지 못했으면 null — 0이 아니다. */
function finish(acc) {
  return acc.seen ? acc.sum + acc.comp : null;
}

function inPeriod(dateText, period) {
  const date = parseUtcDate(dateText);
  if (!date) return false;
  const iso = formatUtcDate(date);
  return iso >= period.start && iso <= period.end;
}

/**
 * 매핑된 행을 기간으로 자르고 채널×캠페인으로 집계한다.
 *
 * @param {object[]} rows   `{ date, channel?, campaign, cost, ... }` 표준키 행
 * @param {object} period   `{ start, end, days }` (period.js가 준다)
 * @returns {object} 스냅샷. `rows`에는 합산값만 들어간다.
 */
export function buildSnapshot({ rows = [], period = null, kpi = null, createdAt = null } = {}) {
  if (!period || !period.start || !period.end) {
    return { ok: false, reason: "no_period", period: null, rows: [], availableFields: [], kpi: null, createdAt };
  }

  const groups = new Map();
  const fieldSeen = new Set();
  let matched = 0;
  let hasChannel = false;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !inPeriod(row.date, period)) continue;
    matched += 1;

    const channel = text(row.channel);
    const campaign = text(row.campaign);
    if (channel) hasChannel = true;

    // 구분자 문자를 쓰면 캠페인명에 그 문자가 들어올 때 그룹이 합쳐진다. JSON이 안전하다.
    const key = JSON.stringify([channel, campaign]);
    let group = groups.get(key);
    if (!group) {
      group = { channel, campaign, acc: {} };
      for (const field of ADDITIVE_FIELDS) group.acc[field] = newSum();
      groups.set(key, group);
    }

    for (const field of ADDITIVE_FIELDS) {
      const value = toFiniteNumber(row[field]);
      if (value === null) continue;
      addTo(group.acc[field], value);
      fieldSeen.add(field);
    }
  }

  if (matched === 0) {
    return { ok: false, reason: "no_rows_in_period", period, rows: [], availableFields: [], kpi: null, createdAt };
  }

  const out = [...groups.values()]
    .map((group) => {
      const row = { channel: group.channel || null, campaign: group.campaign };
      for (const field of ADDITIVE_FIELDS) row[field] = finish(group.acc[field]);
      return row;
    })
    .sort((a, b) => compareText(a.channel || "", b.channel || "") || compareText(a.campaign, b.campaign));

  return {
    ok: true,
    reason: null,
    period: { start: period.start, end: period.end, days: period.days ?? null },
    hasChannel,
    rows: out,
    availableFields: ADDITIVE_FIELDS.filter((field) => fieldSeen.has(field)),
    kpi: kpi ? { ...kpi } : null,
    createdAt: createdAt ?? null,
  };
}

/** 스냅샷 행들의 합. 부분집합에도 쓸 수 있어야 해서 행 배열을 받는다. */
export function sumRows(rows = []) {
  const acc = {};
  for (const field of ADDITIVE_FIELDS) acc[field] = newSum();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    for (const field of ADDITIVE_FIELDS) {
      const value = toFiniteNumber(row[field]);
      if (value !== null) addTo(acc[field], value);
    }
  }
  const out = {};
  for (const field of ADDITIVE_FIELDS) out[field] = finish(acc[field]);
  return out;
}

function ratio(numerator, denominator) {
  if (numerator === null || denominator === null) return null;
  if (!(denominator > 0)) return null; // 0으로 나눈 값을 화면에 내보내지 않는다
  return numerator / denominator;
}

/**
 * 합에서 비율을 만든다. **저장하지 않고 읽을 때 계산한다** — 그래야 어떤 묶음으로 롤업해도
 * 캠페인별과 전체가 어긋나지 않는다.
 *
 * @param {object} totals  `sumRows()` 결과
 * @param {string} basis   전환의 기준 — "actions"(가입 등) 또는 "installs"
 */
export function deriveMetrics(totals = {}, { basis = "actions" } = {}) {
  const conversions = basis === "installs" ? (totals.installs ?? null) : (totals.actions ?? null);
  const impressions = totals.impressions ?? null;
  return {
    conversions,
    cpa: ratio(totals.cost ?? null, conversions),
    cpi: ratio(totals.cost ?? null, totals.installs ?? null),
    ctr: ratio(totals.clicks ?? null, impressions),
    cvr: ratio(conversions, totals.clicks ?? null),
    cpm: impressions === null ? null : ratio(totals.cost ?? null, impressions / 1000),
    roas: ratio(totals.revenue ?? null, totals.cost ?? null),
  };
}

/** 스냅샷 한 장의 대표 지표. 화면 상단 스코어카드가 읽는 값이다. */
export function snapshotMetrics(snapshot, { basis = "actions" } = {}) {
  if (!snapshot || !snapshot.ok) return null;
  const totals = sumRows(snapshot.rows);
  return { totals, ...deriveMetrics(totals, { basis }) };
}
