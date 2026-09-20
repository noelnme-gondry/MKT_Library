/** Select report records and include ancestors so a follow-up keeps its decision basis. */
export function selectProjectReviewRecords(records, { toolId = "", start = "", end = "", threadId = "" } = {}) {
  const byId = new Map(records.map(record => [record.id, record]));
  const inThread = record => {
    if (!threadId) return true;
    const seen = new Set();
    let current = record;
    while (current && !seen.has(current.id)) {
      if (current.id === threadId) return true;
      seen.add(current.id); current = byId.get(current.parentDecisionId);
    }
    return false;
  };
  const matches = records.filter(record => (!toolId || record.toolId === toolId) && (!start || record.reviewDate && record.reviewDate >= start) && (!end || record.reviewDate && record.reviewDate <= end) && inThread(record));
  const selected = new Set(matches.map(record => record.id));
  for (const record of matches) {
    let current = byId.get(record.parentDecisionId);
    const seen = new Set([record.id]);
    while (current && !seen.has(current.id)) {
      selected.add(current.id); seen.add(current.id); current = byId.get(current.parentDecisionId);
    }
  }
  return { records: records.filter(record => selected.has(record.id)), matched: matches.length, ancestors: selected.size - matches.length, excluded: records.length - selected.size };
}
