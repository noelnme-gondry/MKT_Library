import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
export const PRO_TRIAL_DAYS = 14;
export const PRO_TRIAL_MS = PRO_TRIAL_DAYS * 86400000;
export function trialRemainingBucket(start, now = Date.now()) {
  if (!start) return "not_started";
  const days = (Date.parse(start) + PRO_TRIAL_MS - now) / 86400000;
  return days <= 0 ? "expired" : days < 3 ? "under_3d" : days <= 7 ? "3_7d" : "8_14d";
}
// Deliberately excludes snapshots, raw rows, filenames, mappings and computed datasets.
export const ARCHIVE_FIELDS = Object.freeze({ id: 120, toolId: 32, action: 500, conclusion: 500, hypothesis: 500, metric: 120, reviewDate: 10, learning: 1000, actual: 160, status: 32, actionKind: 32, actionTarget: 120, actionAmount: 32, goalMetric: 120, goalDirection: 16, guardrailMetric: 120, guardrailOp: 16, guardrailValue: 40, baseline: 160, baselineDate: 10, target: 160, targetDirection: 16 });
export function archiveMemo(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("INVALID_MEMO");
  const memo = Object.fromEntries(Object.entries(ARCHIVE_FIELDS).map(([key, max]) => [key, String(record[key] ?? "").trim().slice(0, max)]));
  if (!/^[\w:-]{1,120}$/.test(memo.id) || !memo.action) throw new Error("INVALID_MEMO");
  if (memo.reviewDate) {
    const parsed = new Date(memo.reviewDate + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memo.reviewDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== memo.reviewDate) throw new Error("INVALID_MEMO");
  }
  return memo;
}
export function accountEntitlement(account, now = Date.now()) {
  const paidUntil = new Date(account?.paid_until || "").getTime();
  const trialUntil = new Date(account?.trial_started_at || "").getTime() + PRO_TRIAL_MS;
  const expiresAt = Math.max(Number.isFinite(paidUntil) ? paidUntil : 0, Number.isFinite(trialUntil) ? trialUntil : 0);
  return expiresAt > now ? { plan: "paid", account: true, trial: !(paidUntil > now), expiresAt, verifiedAt: now, offlineUntil: Math.min(expiresAt, now + SUBSCRIPTION.graceMs) } : null;
}
