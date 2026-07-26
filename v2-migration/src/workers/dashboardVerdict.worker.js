import { buildDashboardVerdict } from "../utils/dashboardVerdict";

globalThis.onmessage = (event) => {
  try {
    globalThis.postMessage({ ok: true, result: buildDashboardVerdict(event.data || {}) });
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "Dashboard analysis failed" });
  }
};
