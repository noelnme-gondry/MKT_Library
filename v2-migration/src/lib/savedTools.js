// Preferences only: never stores CSV content, search text, or entitlement.
const KEY = "gop-saved-tools-v1";
const EVENT = "gop-saved-tools-changed";
export function readSavedTools() {
  try { return window.localStorage.getItem(KEY) || "[]"; } catch { return "[]"; }
}
export function parseSavedTools(value) {
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string"))].slice(0, 100) : [];
  } catch { return []; }
}
export function subscribeSavedTools(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}
export function toggleSavedTool(id) {
  const ids = parseSavedTools(readSavedTools());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch { return false; }
}
export const savedToolsServerSnapshot = () => "[]";
