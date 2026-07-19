export function buildDataQualityReport(canonicalData) {
  const records = canonicalData?.records || [];
  const summary = canonicalData?.summary || {};
  const duplicateKeys = new Set();
  let duplicateCount = 0;
  let missingDateCount = 0;
  records.forEach((record) => {
    if (!record.date) missingDateCount += 1;
    const key = JSON.stringify([record.date, record.dimensions]);
    if (duplicateKeys.has(key)) duplicateCount += 1;
    duplicateKeys.add(key);
  });
  const issues = [];
  if (missingDateCount) issues.push({ code: "missing_date", count: missingDateCount });
  if (duplicateCount) issues.push({ code: "duplicates", count: duplicateCount });
  if (summary.invalidValueCount) issues.push({ code: "invalid_values", count: summary.invalidValueCount });
  const grade = records.length === 0 || missingDateCount === records.length ? "unfit" : issues.length ? "caution" : "ready";
  return { grade, rowCount: records.length, periodCount: new Set(records.map((record) => record.date).filter(Boolean)).size, issues };
}
