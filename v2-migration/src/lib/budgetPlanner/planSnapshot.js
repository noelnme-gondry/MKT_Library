// 5-3 배분안 스냅샷 — 결정 기록의 `allocationPlan` 칸 하나에 담는 직렬화 (spec §8.2).
// 결정 기록은 평면 CSV라 목록을 문자열 하나에 담는다(AGENTS §12.24b): 항목은 ";", 칸은 "|",
// 사람이 만든 이름(단위 키 = 캠페인명 등)은 퍼센트 인코딩해 구분자·CSV를 깨지 않게 한다.
// 이 파일은 의존성이 없어야 한다 — decisionReview가 읽고, decisionReview는 많은 곳이 읽는다.

export const PLAN_SNAPSHOT_VERSION = "v1";
export const PLAN_SNAPSHOT_MAX_TARGETS = 60;
export const PLAN_SNAPSHOT_METRICS = Object.freeze(["installs", "actions", "revenue_d7"]);
export const PLAN_SNAPSHOT_UNITS = Object.freeze(["channel", "country", "campaign_name"]);
const UNIT_TEXT_LIMIT = 160;

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const finite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const round = (value, digits) => Number(value.toFixed(digits));

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

/**
 * @param {{start:string, days:number, metric:string, unitField:string, byPlatform:boolean, targets:{unit:string, cost:number, results:number}[]}} plan
 *   byPlatform: 단위를 OS별로 나눴는지(5-3 "OS별로 나눠 보기") — 실제값을 같은 방식으로 묶어야 대상이 맞는다
 *   targets: 예측 기간 전체의 계획 지출·예측 결과(대상별 합계)
 * @returns {string} 비어 있으면 저장하지 않는다(대상이 너무 많거나 값이 비정상)
 */
export function serializeAllocationPlan(plan) {
  if (!plan || !isDate(plan.start)) return "";
  const days = Math.floor(Number(plan.days));
  if (!(days >= 1 && days <= 92)) return "";
  if (!PLAN_SNAPSHOT_METRICS.includes(plan.metric) || !PLAN_SNAPSHOT_UNITS.includes(plan.unitField)) return "";
  const targets = (Array.isArray(plan.targets) ? plan.targets : [])
    .map((target) => ({ unit: String(target?.unit ?? "").slice(0, UNIT_TEXT_LIMIT), cost: finite(target?.cost), results: finite(target?.results) }))
    .filter((target) => target.unit && target.cost != null && target.results != null);
  if (!targets.length || targets.length > PLAN_SNAPSHOT_MAX_TARGETS) return "";
  if (new Set(targets.map((target) => target.unit)).size !== targets.length) return "";
  const head = [PLAN_SNAPSHOT_VERSION, plan.start, days, plan.metric, plan.unitField, plan.byPlatform ? "1" : "0"].join("|");
  const body = targets
    .sort((a, b) => a.unit.localeCompare(b.unit))
    .map((target) => [encodeURIComponent(target.unit), round(target.cost, 2), round(target.results, 4)].join("|"));
  return [head, ...body].join(";");
}

/** 직렬화의 역. 모르는 버전·깨진 칸은 일부만 살리지 않고 통째로 거절한다(null). */
export function parseAllocationPlan(text) {
  const parts = String(text ?? "").trim().split(";");
  if (parts.length < 2) return null;
  const [version, start, days, metric, unitField, platformFlag] = parts[0].split("|");
  if (version !== PLAN_SNAPSHOT_VERSION || !isDate(start) || !["0", "1"].includes(platformFlag)) return null;
  const dayCount = Number(days);
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 92) return null;
  if (!PLAN_SNAPSHOT_METRICS.includes(metric) || !PLAN_SNAPSHOT_UNITS.includes(unitField)) return null;
  const targets = [];
  for (const part of parts.slice(1)) {
    const fields = part.split("|");
    if (fields.length !== 3) return null;
    const unit = decode(fields[0]);
    const cost = finite(fields[1]);
    const results = finite(fields[2]);
    if (!unit || cost == null || results == null) return null;
    targets.push({ unit: unit.slice(0, UNIT_TEXT_LIMIT), cost, results });
  }
  if (targets.length > PLAN_SNAPSHOT_MAX_TARGETS || new Set(targets.map((target) => target.unit)).size !== targets.length) return null;
  return { start, days: dayCount, metric, unitField, byPlatform: platformFlag === "1", targets };
}

/** 계획 기간의 마지막 날. */
export function allocationPlanEnd(plan) {
  const date = new Date(`${plan.start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + plan.days - 1);
  return date.toISOString().slice(0, 10);
}
