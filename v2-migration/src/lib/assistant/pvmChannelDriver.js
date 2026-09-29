import { getMonFilteredRows } from "@/utils/dashboardAggregator";
import { PVM_MATH } from "@/utils/pvmMath";

// 성과 변동 원인(5-21)의 "어느 채널이 단가 변화에 가장 크게 기여했나" 계산 한 벌.
// 결과 작업대 어댑터와 홈 샘플 카드가 같이 쓴다 — 두 곳이 따로 계산하면 같은 샘플에서
// 다른 채널을 원인으로 지목할 수 있다(§7 "같은 것을 두 곳에서 계산하면 갈린다").
// 어댑터 전체(예산 배분·포화 엔진 포함)를 홈 번들에 싣지 않으려고 이 부분만 뺐다.

const DAY_MS = 24 * 60 * 60 * 1000;

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

/** 마지막 날짜 기준 직전 7일·최근 7일. 행이 없으면 null. */
export function pvmPeriods(csvData, filterState = {}) {
  const rows = getMonFilteredRows(csvData, filterState)
    .map((row) => ({
      ...row,
      spend: row.spend ?? row.cost ?? 0,
      campaign_id: row.campaign_id ?? row.campaign_name,
      _time: Date.parse(`${row.date}T00:00:00Z`),
    }))
    .filter((row) => Number.isFinite(row._time));
  if (!rows.length) return null;
  const lastTime = rows.reduce((max, row) => Math.max(max, row._time), -Infinity);
  const dateAt = (offset) => new Date(lastTime - offset * DAY_MS).toISOString().slice(0, 10);
  return {
    periodA: { start: dateAt(13), end: dateAt(7) },
    periodB: { start: dateAt(6), end: dateAt(0) },
    prior: rows.filter((row) => row._time >= lastTime - 13 * DAY_MS && row._time < lastTime - 6 * DAY_MS),
    recent: rows.filter((row) => row._time >= lastTime - 6 * DAY_MS && row._time <= lastTime),
  };
}

/** 매핑된 필드로 분해 단위를 정한다(채널 → 캠페인 → 소재 중 매핑된 것까지). */
export function pvmKeys(fields, resultField) {
  return {
    ch: "channel",
    cmp: fields.has("campaign_id") || fields.has("campaign_name") ? "campaign_id" : null,
    cr: fields.has("creative_id") ? "creative_id" : null,
    resultField,
  };
}

/** 최소 단위에서 한 번 분해한 뒤 채널로 롤업하고, 기여 절댓값이 가장 큰 채널을 고른다. 분해 불가면 null. */
export function pvmChannelBreakdown({ prior, recent, keys, unspecifiedLabel }) {
  const decomposition = PVM_MATH.decomposeFinest(prior, recent, keys);
  if (!decomposition) return null;
  const byChannel = PVM_MATH.rollup(
    decomposition.finest,
    (row) => row.chKey || unspecifiedLabel,
    decomposition.Result1,
    decomposition.Result2,
  ).map((row) => ({ entity: row.key, mix: safeNumber(row.mix), rate: safeNumber(row.rate), contribution: safeNumber(row.contribution) }));
  const driver = [...byChannel].sort((a, b) => Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0))[0] || null;
  return { decomposition, byChannel, driver };
}

/**
 * 어댑터와 같은 입력 규칙으로 가장 큰 기여 채널만 돌려준다(홈 샘플 카드용).
 * 계약 검사를 통과하지 못하거나 기여를 계산할 수 없으면 null — 없는 원인을 말하지 않는다.
 */
export function pvmTopDriver(csvData, { resultField = "actions", filterState = {}, unspecifiedLabel = "미지정" } = {}) {
  const fields = new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__"));
  if (!fields.has("date") || !fields.has("channel") || !fields.has(resultField) || !(fields.has("spend") || fields.has("cost"))) return null;
  const periods = pvmPeriods(csvData, filterState);
  if (!periods?.prior.length || !periods.recent.length) return null;
  const keys = pvmKeys(fields, resultField);
  if (!PVM_MATH.inspectFinestInputs(periods.prior, periods.recent, keys).ok) return null;
  const breakdown = pvmChannelBreakdown({ prior: periods.prior, recent: periods.recent, keys, unspecifiedLabel });
  const driver = breakdown?.driver;
  return driver && Number.isFinite(driver.contribution) ? { ...driver, metric: resultField === "actions" ? "CPA" : "CPI" } : null;
}
