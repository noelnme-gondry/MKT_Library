export const SUBSCRIPTION = Object.freeze({ monthlyKrw: 5900, freeProjects: 1, graceMs: 72 * 60 * 60 * 1000, cacheKey: "gop:license:v1" });
export function hasPaidAccess(entitlement, now = Date.now()) {
  return entitlement?.plan === "paid" && Number(entitlement.expiresAt) > now && Number(entitlement.offlineUntil) > now;
}
export function canCreateProject(count, entitlement, now = Date.now()) {
  return count < SUBSCRIPTION.freeProjects || hasPaidAccess(entitlement, now);
}
export function resolveLicenseResult(previous, result, now = Date.now()) {
  if (result === null) return hasPaidAccess(previous, now) ? { ...previous, offline: true } : null;
  const expiresAt = Date.parse(result.expires_at);
  if (result.valid !== true || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { plan: "paid", expiresAt, verifiedAt: now, offlineUntil: Math.min(expiresAt, now + SUBSCRIPTION.graceMs), offline: false };
}
export async function validateLicense(plainKey, previous = null, { fetcher = fetch, now = Date.now() } = {}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plainKey.trim()));
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  return validateLicenseHash(hash, previous, { fetcher, now });
}
export async function validateLicenseHash(hash, previous = null, { fetcher = fetch, now = Date.now() } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return { entitlement: null, status: "not_configured" };
  if (!/^[a-f0-9]{64}$/.test(hash || "")) return { entitlement: null, status: "invalid" };
  // 다른 키의 성공 캐시는 새 키의 장애를 승인하는 데 사용할 수 없다.
  const cached = previous?.keyHash === hash ? previous : null;
  try {
    const response = await fetcher(`${url.replace(/\/$/, "")}/rest/v1/rpc/validate_access_key`, {
      method: "POST", headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json" },
      // 파일럿은 기기 바인딩 OFF. 사용자 데이터와 기기 토큰을 전송하지 않는다.
      body: JSON.stringify({ input_hash: hash }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("LICENSE_UNAVAILABLE");
    const payload = await response.json();
    if (!Array.isArray(payload) || typeof payload[0]?.valid !== "boolean") throw new Error("LICENSE_RESPONSE_INVALID");
    const entitlement = resolveLicenseResult(cached, payload[0], now);
    return { entitlement: entitlement ? { ...entitlement, keyHash: hash } : null, status: entitlement ? "valid" : "invalid" };
  } catch {
    return { entitlement: resolveLicenseResult(cached, null, now), status: "offline" };
  }
}
