import { idToPath, resolvePathToId } from "../routeMap";
const key = "gop:payment-return";
export function rememberPaymentReturn(toolId, locale) {
  const path = idToPath(toolId);
  if (!path || path === "/subscription") return;
  try { sessionStorage.setItem(key, JSON.stringify({ path: `${locale === "en" ? "/en" : ""}${path}`, at: Date.now() })); } catch { /* Optional navigation only. */ }
}
export function readPaymentReturn() {
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    if (!value || Date.now() - value.at > 86400000 || !value.path.startsWith("/") || value.path.startsWith("//") || !resolvePathToId(value.path)) return null;
    return value.path;
  } catch { return null; }
}
