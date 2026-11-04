export function operationContributionLabels(metricName, locale) {
  const install = metricName === "CPI";
  return locale === "en" ? {
    share: `Change in ${install ? "install" : "outcome"} share by creative`,
    cost: `Change in cost per ${install ? "install" : "outcome"} by creative`,
    title: `Two contributions to the ${metricName} change`,
  } : {
    share: `소재별 ${install ? "설치" : "성과"} 비중 변화`,
    cost: `소재별 ${install ? "설치당" : "성과당"} 비용 변화`,
    title: `전체 ${metricName}가 달라진 두 가지 몫`,
  };
}

// Plot the fitted curve against its own observations. Budget guardrails are not a fitted curve.
export function operationsScatterEvidence(campaign, model) {
  const points = campaign.trend.filter(row => row.cost > 0 && Number.isFinite(row.cpr)).map(row => ({ x: row.cost, y: row.cpr, date: row.date }));
  if (!model?.kept?.length || !Number.isFinite(model.xMin) || !Number.isFinite(model.xMax)) return { used: points, earlier: [], excluded: [], fitted: [], start: points[0]?.date, end: points.at(-1)?.date };
  const used = model.kept.map(row => ({ x: row.x, y: row.y, date: row.date }));
  const scopeDates = (model.regime?.kept || points).map(point => point.date).sort();
  const dates = new Set(used.map(row => row.date)), start = model.regime?.start || scopeDates[0];
  return { used, earlier: points.filter(point => point.date < start), excluded: points.filter(point => point.date >= start && !dates.has(point.date)), start, end: scopeDates.at(-1),
    fitted: Array.from({ length: 41 }, (_, index) => {
      const x = model.xMin + (model.xMax - model.xMin) * index / 40;
      return { x, y: model.model.predict(x) };
    }).filter(point => Number.isFinite(point.y) && point.y > 0),
  };
}
