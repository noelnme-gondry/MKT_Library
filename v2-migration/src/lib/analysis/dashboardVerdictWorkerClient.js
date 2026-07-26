import { buildDashboardVerdict } from "@/utils/dashboardVerdict";

export const DASHBOARD_VERDICT_WORKER_THRESHOLD = 10_000;

export function shouldUseDashboardVerdictWorker(rowCount, threshold = DASHBOARD_VERDICT_WORKER_THRESHOLD) {
  return Number.isFinite(rowCount) && rowCount >= threshold;
}

export function runDashboardVerdict(payload = {}) {
  const rowCount = payload.csvData?.raw?.length || 0;
  if (!shouldUseDashboardVerdictWorker(rowCount) || typeof Worker === "undefined") {
    return Promise.resolve(buildDashboardVerdict(payload));
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/dashboardVerdict.worker.js", import.meta.url), { type: "module" });
    } catch {
      resolve(buildDashboardVerdict(payload));
      return;
    }
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data?.ok) resolve(event.data.result);
      else reject(new Error(event.data?.error || "Dashboard analysis failed"));
    };
    worker.onerror = () => {
      worker.terminate();
      try {
        resolve(buildDashboardVerdict(payload));
      } catch (error) {
        reject(error);
      }
    };
    worker.postMessage(payload);
  });
}
