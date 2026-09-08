// 분류된 유입면만 보관한다. URL·검색어·파일·사용자 식별자는 저장하지 않는다.
const KEY = "gop:site-journey";
const TTL = 30 * 60 * 1000;
const SURFACES = new Set(["home", "blog", "glossary", "guide", "tool", "start", "dochi", "review", "other"]);

export function journeySurface(pathname = "") {
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (path === "/") return "home";
  if (path === "/weekly-review") return "review";
  if (path === "/dochi-result") return "dochi";
  if (path === "/start") return "start";
  for (const kind of ["blog", "glossary", "guide"]) if (path === `/${kind}` || path.startsWith(`/${kind}/`)) return kind;
  if (path === "/dashboard" || path.startsWith("/tools/") || path.startsWith("/content/")) return "tool";
  return "other";
}

export function withSiteJourney(name, params, storage, now = Date.now()) {
  try {
    let journey = JSON.parse(storage.getItem(KEY) || "null");
    if (!journey || !SURFACES.has(journey.entry) || !Number.isFinite(journey.lastAt) || now < journey.lastAt || now - journey.lastAt > TTL) journey = null;
    if (name === "journey_page_viewed" && !journey && SURFACES.has(params.scope)) journey = { entry: params.scope, lastAt: now };
    if (!journey) return params;
    journey.lastAt = now;
    storage.setItem(KEY, JSON.stringify(journey));
    return { ...params, journey_entry: journey.entry };
  } catch { return params; }
}
