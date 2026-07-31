const SEVERITY_WEIGHT = { action: 200, watch: 100, info: 0 };
const TOOL_PRIORITY = { "5-2": 1, "5-21": 2, "5-22": 3, "5-3": 4 };
const KIND_PRIORITY = { anomaly: 1, saturation: 2, allocation: 3, quality: 4, opportunity: 5 };

export function rankFindings(findings) {
  return [...(findings || [])].sort((a, b) => {
    const scoreA = (SEVERITY_WEIGHT[a.severity] || 0) + a.score;
    const scoreB = (SEVERITY_WEIGHT[b.severity] || 0) + b.score;
    return scoreB - scoreA
      || (TOOL_PRIORITY[a.toolId] || 99) - (TOOL_PRIORITY[b.toolId] || 99)
      || (KIND_PRIORITY[a.kind] || 99) - (KIND_PRIORITY[b.kind] || 99)
      || String(a.id).localeCompare(String(b.id));
  });
}

