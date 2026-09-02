function finiteNumber(value) {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  const normalized = typeof value === "string" ? value.replace(/[\s,]/g, "") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function scaleEntityName(row, grain) {
  if (grain === "campaign") {
    const campaign = String(row?.campaign_name ?? "").trim();
    if (!campaign) return null;
    const channel = String(row?.channel ?? "").trim();
    return channel && !campaign.startsWith(channel) ? `${channel} · ${campaign}` : campaign;
  }
  const channel = String(row?.channel ?? "").trim();
  return channel || null;
}

export function median(values = []) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function classifyScaleDecision({ metric, cost, efficiency, costThreshold, efficiencyThreshold }) {
  if (![cost, efficiency, costThreshold, efficiencyThreshold].every(Number.isFinite)) return null;
  const isHighCost = cost >= costThreshold;
  const isEfficient = metric === "roas"
    ? efficiency >= efficiencyThreshold
    : efficiency <= efficiencyThreshold;

  if (isEfficient && !isHighCost) return "scale";
  if (isEfficient && isHighCost) return "maintain";
  if (metric === "cpa" && !isHighCost) return "stop";
  if (!isHighCost) return "watch";
  return "reduce";
}

// 채널/캠페인별 실제 합계만 사용한다. 곡선 적합·한계효율과 섞지 않아 사분면이
// 모델 선택에 따라 움직이지 않으며, 비율은 행 평균이 아니라 분자·분모 합계로 계산한다.
export function buildScaleDecisionMatrix({
  rows = [],
  grain = "channel",
  metric = "cpa",
  resultField = "actions",
  revenueField = null,
} = {}) {
  const grouped = new Map();

  for (const row of rows || []) {
    const name = scaleEntityName(row, grain);
    if (!name) continue;
    const cost = finiteNumber(row?.cost);
    if (!(cost > 0)) continue;

    const results = finiteNumber(row?.[resultField]);
    const revenue = revenueField ? finiteNumber(row?.[revenueField]) : null;
    const current = grouped.get(name) || {
      name,
      cost: 0,
      results: 0,
      revenue: 0,
      hasRevenue: false,
      hasMissingResults: false,
      hasMissingRevenue: false,
      rowCount: 0,
    };
    current.cost += cost;
    if (results != null && results >= 0) current.results += results;
    else current.hasMissingResults = true;
    if (revenue != null) {
      current.revenue += revenue;
      current.hasRevenue = true;
    } else if (revenueField) current.hasMissingRevenue = true;
    current.rowCount += 1;
    grouped.set(name, current);
  }

  const excluded = [];
  const entities = [];
  for (const group of grouped.values()) {
    if (group.hasMissingResults) {
      excluded.push({ name: group.name, reason: "missing_results" });
      continue;
    }
    if (metric === "roas") {
      if (!revenueField || !group.hasRevenue || group.hasMissingRevenue) {
        excluded.push({ name: group.name, reason: "missing_revenue" });
        continue;
      }
      entities.push({ ...group, efficiency: group.revenue / group.cost });
      continue;
    }
    if (!(group.results > 0)) {
      excluded.push({ name: group.name, reason: "zero_results" });
      continue;
    }
    entities.push({ ...group, efficiency: group.cost / group.results });
  }

  const costThreshold = median(entities.map((entity) => entity.cost));
  const totalCost = entities.reduce((sum, entity) => sum + entity.cost, 0);
  const totalResults = entities.reduce((sum, entity) => sum + entity.results, 0);
  const totalRevenue = entities.reduce((sum, entity) => sum + entity.revenue, 0);
  const efficiencyThreshold = metric === "roas"
    ? (totalCost > 0 ? totalRevenue / totalCost : null)
    : (totalResults > 0 ? totalCost / totalResults : null);

  const points = entities.map((entity) => ({
    ...entity,
    action: classifyScaleDecision({
      metric,
      cost: entity.cost,
      efficiency: entity.efficiency,
      costThreshold,
      efficiencyThreshold,
    }),
  }));

  return {
    points,
    excluded,
    thresholds: { cost: costThreshold, efficiency: efficiencyThreshold },
    totals: { cost: totalCost, results: totalResults, revenue: totalRevenue },
  };
}
