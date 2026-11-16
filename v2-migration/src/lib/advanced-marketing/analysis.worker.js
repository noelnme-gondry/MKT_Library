import { executeAdvanced } from "./execute";
self.onmessage = ({ data }) => {
  try {
    const report = executeAdvanced(data.toolId, data.rows, data.options);
    self.postMessage({ requestId: data.requestId, report });
  } catch (error) {
    // Error context contains only a declared field and row number, never cell values.
    self.postMessage({ requestId: data.requestId, error: { code: error.code || "calculation_failed", context: error.context || {} } });
  }
};
