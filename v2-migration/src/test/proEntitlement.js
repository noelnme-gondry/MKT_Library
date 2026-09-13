// Explicit active access for tests whose subject is a Pro write, not the paywall.
export function activePro({ trial = false } = {}) {
  const expiresAt = Date.now() + 86400000;
  return { plan: "paid", account: true, trial, expiresAt, offlineUntil: expiresAt };
}
