import { buildCanonicalDataset } from "./buildCanonicalDataset";
import { buildMappingContract } from "./mappingContract";
import { detectDatasetSignature } from "./detectDatasetSignature";
import { buildCanonicalDatasetV2 } from "./canonical-v2/buildCanonicalDatasetV2";
import { mapDataset } from "./semantic-mapper/mapDataset";
import { mapRowsToStandard } from "@/utils/mappedRows";

// Mapping and canonicalization are import-time work, not model math. Keep small
// files synchronous to avoid worker startup overhead; move large files off the
// React main thread. Structured cloning keeps this client-only and server-free.
export const DATA_PREPARATION_WORKER_THRESHOLD = 10_000;

export function shouldUseDataPreparationWorker(rowCount, threshold = DATA_PREPARATION_WORKER_THRESHOLD) {
  return Number.isFinite(rowCount) && rowCount >= threshold;
}

function prepareOnMainThread({ headers = [], raw = [], toolId, source = "csv" } = {}) {
  const mappingContract = buildMappingContract({ headers, rows: raw, toolId, source });
  const mapping = mappingContract.mapping;
  const semanticMapping = mapDataset({ headers, rows: raw });
  return {
    insights: { ...mappingContract, selections: mapping, signature: detectDatasetSignature(headers, raw) },
    canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
    mappedRows: mapRowsToStandard(raw, mapping),
    semanticMapping,
    canonicalDataV2: buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping.bindings, representation: semanticMapping.profile.representation }),
  };
}

export function prepareImportedData(payload = {}) {
  if (!shouldUseDataPreparationWorker(payload.raw?.length) || typeof Worker === "undefined") {
    return Promise.resolve(prepareOnMainThread(payload));
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/dataPreparation.worker.js", import.meta.url), { type: "module" });
    } catch {
      resolve(prepareOnMainThread(payload));
      return;
    }
    worker.onmessage = (event) => {
      worker.terminate();
      const result = event.data || {};
      if (result.ok) resolve({ insights: result.insights, canonicalData: result.canonicalData, mappedRows: result.mappedRows, semanticMapping: result.semanticMapping, canonicalDataV2: result.canonicalDataV2 });
      else reject(new Error(result.error || "Data preparation failed"));
    };
    worker.onerror = (event) => {
      worker.terminate();
      // A worker is an optimization, never a prerequisite for analysis.
      try {
        resolve(prepareOnMainThread(payload));
      } catch (error) {
        reject(error || new Error(event?.message || "Data preparation failed"));
      }
    };
    worker.postMessage(payload);
  });
}
