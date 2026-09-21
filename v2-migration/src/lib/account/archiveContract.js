import { DECISION_REVIEW_SAFE_FIELDS, sanitizeDecisionReviewRecord } from "@/lib/decisionReview";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
export const PRO_TRIAL_DAYS = 14;
export const PRO_TRIAL_MS = PRO_TRIAL_DAYS * 86400000;
export function trialRemainingBucket(start, now = Date.now()) {
  if (!start) return "not_started";
  const days = (Date.parse(start) + PRO_TRIAL_MS - now) / 86400000;
  return days <= 0 ? "expired" : days < 3 ? "under_3d" : days <= 7 ? "3_7d" : "8_14d";
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
  const trialUntil = new Date(account?.trial_started_at || "").getTime() + PRO_TRIAL_MS;
  const expiresAt = Math.max(Number.isFinite(paidUntil) ? paidUntil : 0, Number.isFinite(trialUntil) ? trialUntil : 0);
  return expiresAt > now ? { plan: "paid", account: true, trial: !(paidUntil > now), expiresAt, verifiedAt: now, offlineUntil: Math.min(expiresAt, now + SUBSCRIPTION.graceMs) } : null;
}
