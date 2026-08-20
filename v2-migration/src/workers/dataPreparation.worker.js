import { buildMappingContract } from "../lib/data-import/mappingContract";
import { buildCanonicalDataset } from "../lib/data-import/buildCanonicalDataset";
import { detectDatasetSignature } from "../lib/data-import/detectDatasetSignature";
import { buildCanonicalDatasetV2 } from "../lib/data-import/canonical-v2/buildCanonicalDatasetV2";
import { buildMappingParityReport } from "../lib/data-import/canonical-v2/buildMappingParityReport";
import { mapDataset } from "../lib/data-import/semantic-mapper/mapDataset";
import { mapRowsToStandard } from "../utils/mappedRows";

globalThis.onmessage = (event) => {
  const { headers = [], raw = [], toolId, source = "csv" } = event.data || {};
  try {
    const mappingContract = buildMappingContract({ headers, rows: raw, toolId, source });
    const mapping = mappingContract.mapping;
    const semanticMapping = mapDataset({ headers, rows: raw });
    const parityReport = process.env.NODE_ENV === "production" ? null : buildMappingParityReport({ legacyMapping: mapping, bindings: semanticMapping.bindings });
    globalThis.postMessage({
      ok: true,
      insights: { ...mappingContract, selections: mapping, signature: detectDatasetSignature(headers, raw) },
      canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
      mappedRows: mapRowsToStandard(raw, mapping),
      semanticMapping,
      canonicalDataV2: buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping.bindings, representation: semanticMapping.profile.representation }),
      parityReport,
    });
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "Data preparation failed" });
  }
};
