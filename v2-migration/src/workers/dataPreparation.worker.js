import { buildMappingContract } from "../lib/data-import/mappingContract";
import { buildCanonicalDataset } from "../lib/data-import/buildCanonicalDataset";
import { detectDatasetSignature } from "../lib/data-import/detectDatasetSignature";
import { buildCanonicalDatasetV2 } from "../lib/data-import/canonical-v2/buildCanonicalDatasetV2";
import { mapDataset } from "../lib/data-import/semantic-mapper/mapDataset";
import { mapRowsToStandard } from "../utils/mappedRows";

globalThis.onmessage = (event) => {
  const { headers = [], raw = [], toolId, source = "csv" } = event.data || {};
  try {
    const mappingContract = buildMappingContract({ headers, rows: raw, toolId, source });
    const mapping = mappingContract.mapping;
    const semanticMapping = mapDataset({ headers, rows: raw });
    globalThis.postMessage({
      ok: true,
      insights: { ...mappingContract, selections: mapping, signature: detectDatasetSignature(headers, raw) },
      canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
      mappedRows: mapRowsToStandard(raw, mapping),
      semanticMapping,
      canonicalDataV2: buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping.bindings, representation: semanticMapping.profile.representation }),
    });
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "Data preparation failed" });
  }
};
