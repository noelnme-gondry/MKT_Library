import { buildMappingContract } from "../lib/data-import/mappingContract";
import { buildCanonicalDataset } from "../lib/data-import/buildCanonicalDataset";
import { detectDatasetSignature } from "../lib/data-import/detectDatasetSignature";

globalThis.onmessage = (event) => {
  const { headers = [], raw = [], toolId, source = "csv" } = event.data || {};
  try {
    const mappingContract = buildMappingContract({ headers, rows: raw, toolId, source });
    const mapping = mappingContract.mapping;
    globalThis.postMessage({
      ok: true,
      insights: { ...mappingContract, selections: mapping, signature: detectDatasetSignature(headers, raw) },
      canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
    });
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "Data preparation failed" });
  }
};
