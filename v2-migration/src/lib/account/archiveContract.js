import { DECISION_REVIEW_SAFE_FIELDS, sanitizeDecisionReviewRecord } from "@/lib/decisionReview";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
/* ============================================================
 * 무료 체험 기간 — 계정당 한 번, `trial_started_at`이 비어 있을 때만 시작된다.
 *
 * 2026-09-21부터 7일이다. 그 전에 시작한 체험은 14일 그대로 둔다 — 정책을
 * 소급하면 이미 쓰고 있는 사람의 남은 기간이 말없이 줄어든다.
 *
 * 이 값은 JS와 SQL 양쪽이 쓴다. 숫자를 SQL에 다시 적지 말고 `trialUntilSql()`을
 * 부를 것 — 같은 것을 두 곳에서 계산하면 반드시 갈린다(§7). 실제로 고치기 전
 * `INTERVAL '14 days'`가 결제 시작일 계산과 만료 알림 두 곳에 각각 박혀 있어서,
 * JS 상수만 바꿨다면 화면은 7일인데 메일과 결제 기산일은 14일로 남았을 것이다.
 * `trialPolicySingleSource.test.js`가 소스에서 파생해 막는다.
 * ============================================================ */
export const PRO_TRIAL_DAYS = 7;
export const PRO_TRIAL_DAYS_LEGACY = 14;
export const PRO_TRIAL_POLICY_CUTOVER = "2026-09-21T00:00:00Z";
export const PRO_TRIAL_MS = PRO_TRIAL_DAYS * 86400000;

/** 그 체험에 적용되는 밀리초 길이. 시작 시점이 정책을 가른다. */
export function trialMsFor(start) {
  const started = Date.parse(start || "");
  if (!Number.isFinite(started)) return PRO_TRIAL_MS;
  return started < Date.parse(PRO_TRIAL_POLICY_CUTOVER) ? PRO_TRIAL_DAYS_LEGACY * 86400000 : PRO_TRIAL_MS;
}

/**
 * 위 정책과 같은 판정을 하는 SQL 식. `alias`는 gop_accounts의 별칭이다.
 * 반환값은 "이 계정의 체험이 끝나는 시각".
 */
export function trialUntilSql(alias = "") {
  const column = `${alias ? `${alias}.` : ""}trial_started_at`;
  return `(${column}+CASE WHEN ${column} < TIMESTAMPTZ '${PRO_TRIAL_POLICY_CUTOVER}'`
    + ` THEN INTERVAL '${PRO_TRIAL_DAYS_LEGACY} days' ELSE INTERVAL '${PRO_TRIAL_DAYS} days' END)`;
}

// 남은 기간 구간 — GA에 원본 날짜를 싣지 않기 위한 범주형이다.
// 7일 정책에서 상한 구간은 3~7일이고, 14일 시절 시작한 체험만 그보다 길 수 있다.
export function trialRemainingBucket(start, now = Date.now()) {
  if (!start) return "not_started";
  const days = (Date.parse(start) + trialMsFor(start) - now) / 86400000;
  return days <= 0 ? "expired" : days < 3 ? "under_3d" : days <= 7 ? "3_7d" : "over_7d";
}
// Raw inputs, continuity snapshots and local matching scope never enter account memos.
const LOCAL_ONLY = new Set(["datasetSnapshot", "comparisonScope"]);
export const ARCHIVE_FIELDS = Object.freeze(Object.fromEntries([
  ...DECISION_REVIEW_SAFE_FIELDS.filter(key => !LOCAL_ONLY.has(key)).map(key => [key, true]),
  ["target", true], // Older account clients still send this alias.
]));
export function archiveMemo(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("INVALID_MEMO");
  const normalized = sanitizeDecisionReviewRecord(record);
  if (!normalized) throw new Error("INVALID_MEMO");
  const memo = Object.fromEntries(Object.keys(ARCHIVE_FIELDS).map(key => [key, key === "target" ? String(record.target ?? "").trim().slice(0, 160) : normalized[key]]));
  if (!/^[\w:-]{1,120}$/.test(memo.id) || !memo.action) throw new Error("INVALID_MEMO");
  if (record.reviewDate) {
    const parsed = new Date(String(record.reviewDate) + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.reviewDate)) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== record.reviewDate) throw new Error("INVALID_MEMO");
  }
  return memo;
}
export function accountEntitlement(account, now = Date.now()) {
  const paidUntil = new Date(account?.paid_until || "").getTime();
  const trialUntil = new Date(account?.trial_started_at || "").getTime() + trialMsFor(account?.trial_started_at);
  const expiresAt = Math.max(Number.isFinite(paidUntil) ? paidUntil : 0, Number.isFinite(trialUntil) ? trialUntil : 0);
  return expiresAt > now ? { plan: "paid", account: true, trial: !(paidUntil > now), expiresAt, verifiedAt: now, offlineUntil: Math.min(expiresAt, now + SUBSCRIPTION.graceMs) } : null;
}
