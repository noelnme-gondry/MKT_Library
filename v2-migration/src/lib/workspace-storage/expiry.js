export const RETENTION_DAYS = 90;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function isExpired(entry, now) {
  const lastUsedAt = Number(entry?.lastUsedAt);
  return !Number.isFinite(lastUsedAt) || now - lastUsedAt >= RETENTION_MS;
}

export function partitionByExpiry(entries, now) {
  return (entries || []).reduce((result, entry) => {
    result[isExpired(entry, now) ? "expired" : "keep"].push(entry);
    return result;
  }, { keep: [], expired: [] });
}

export function remainingRetentionDays(entry, now) {
  const lastUsedAt = Number(entry?.lastUsedAt);
  if (!Number.isFinite(lastUsedAt)) return 0;
  return Math.max(0, Math.ceil((RETENTION_MS - (now - lastUsedAt)) / (24 * 60 * 60 * 1000)));
}
