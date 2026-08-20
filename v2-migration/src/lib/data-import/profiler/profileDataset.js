import { sampleRowsDeterministically } from "./sampleRows";
import { profileColumnV2 } from "./profileColumnV2";

const normalizedHeaders = (headers) => headers.map((header) => String(header || "").normalize("NFKC").trim().toLowerCase());

export function detectDatasetRepresentation(headers = [], profiles = []) {
  const names = normalizedHeaders(headers);
  const hasMetric = names.some((name) => /^(metric|measure|지표|항목)$/.test(name));
  const valueProfile = profiles.find((profile) => /^(value|values|값|수치)$/.test(profile.headerFeatures.normalized));
  const hasChannel = names.some((name) => /channel|media|network|채널|매체/.test(name));
  if (hasMetric && valueProfile && hasChannel) return "long";
  const repeatedNumeric = profiles.filter((profile) => profile.inferredType === "number" && /(?:spend|cost|revenue|매출|비용|광고비)/i.test(profile.header)).length;
  return repeatedNumeric >= 2 ? "wide" : "tabular";
}

export function profileDatasetV2({ headers = [], rows = [] } = {}) {
  const sampledRows = sampleRowsDeterministically(rows);
  const columns = headers.map((header) => profileColumnV2(header, sampledRows));
  return {
    schemaVersion: 2,
    sampledRowCount: sampledRows.length,
    inputRowCount: rows.length,
    representation: detectDatasetRepresentation(headers, columns),
    columns,
  };
}
