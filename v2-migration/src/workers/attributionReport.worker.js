import { normalizeMultitouch, buildMultitouchView } from "../utils/multitouchMath";
import { normalizeCannibalDetail, buildCannibalDetailView } from "../utils/cannibalDetailMath";
let dataset, kind;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      kind = data.kind;
      dataset = kind === "multitouch" ? normalizeMultitouch(data.raw, data.mapping, data.config) : normalizeCannibalDetail(data.raw, data.mapping);
      const { installs: _installs, rows: _rows, ...metadata } = dataset;
      self.postMessage({ id: data.id, result: metadata });
    } else {
      const result = kind === "multitouch" ? buildMultitouchView(dataset, data.options) : buildCannibalDetailView(dataset, data.options);
      self.postMessage({ id: data.id, result });
    }
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
