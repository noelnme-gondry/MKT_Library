import { normalizeMultitouch, buildMultitouchView } from "../../utils/multitouchMath";
import { normalizeCannibalDetail, buildCannibalDetailView } from "../../utils/cannibalDetailMath";
export function createReportSession(kind, raw, mapping, config = {}) {
  if (typeof Worker === "undefined") {
    const ready = Promise.resolve().then(() => kind === "multitouch" ? normalizeMultitouch(raw, mapping, config) : normalizeCannibalDetail(raw, mapping));
    return { ready: ready.then(({ installs: _installs, rows: _rows, ...meta }) => meta),
      query: options => ready.then(data => kind === "multitouch" ? buildMultitouchView(data, options) : buildCannibalDetailView(data, options)), close() {} };
  }
  const worker = new Worker(new URL("../../workers/attributionReport.worker.js", import.meta.url), { type: "module" });
  const pending = new Map();
  let serial = 0;
  const send = payload => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, ...payload });
  });
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id); if (!task) return;
    pending.delete(data.id); if (data.error) task.reject(new Error(data.error)); else task.resolve(data.result);
  };
  worker.onerror = event => { pending.forEach(task => task.reject(new Error(event.message || "Analysis worker failed"))); pending.clear(); };
  return { ready: send({ type: "init", kind, raw, mapping, config }), query: options => send({ type: "query", options }),
    close() { worker.terminate(); pending.forEach(task => task.reject(new Error("Analysis cancelled"))); pending.clear(); } };
}
