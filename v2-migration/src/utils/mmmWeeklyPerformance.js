// MMM 렌더층용: 주간 기여분해와 동일한 채널별 counterfactual 기여를 집계한다.
// 0-spend 주의 carryover도 기여에 포함하므로 반응곡선에 당주 지출을 다시 넣는
// 별도 계산과 달리 표·분해 그래프·CSV의 합계가 항상 같은 원천을 사용한다.
export function buildMmmWeeklyPerformance(panel, channelContributions = {}) {
  if (!panel?.ch || !panel?.week?.length) return [];
  const weekCount = panel.week.length;

  return Object.values(channelContributions)
    .map((channel) => {
      const spends = panel.ch[channel.key] || [];
      let totalSpend = 0;
      let activeWeeks = 0;

      spends.forEach((rawSpend) => {
        const spend = Number(rawSpend);
        if (!Number.isFinite(spend) || spend <= 0) return;
        totalSpend += spend;
        activeWeeks += 1;
      });

      if (!(totalSpend > 0)) return null;
      const weeklyMean = Array.isArray(channel.weeklyMean) ? channel.weeklyMean : [];
      const totalPredicted = Number.isFinite(channel.totalMean)
        ? Math.max(0, channel.totalMean)
        : weeklyMean.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
      const predictedCpr = totalPredicted > 0 ? totalSpend / totalPredicted : null;
      return {
        key: channel.key,
        label: channel.label || channel.key,
        activeWeeks,
        avgWeeklySpend: totalSpend / weekCount,
        avgWeeklyPredicted: totalPredicted / weekCount,
        avgWeeklyPredictedLow: Number.isFinite(channel.totalLow) ? Math.max(0, channel.totalLow) / weekCount : null,
        avgWeeklyPredictedHigh: Number.isFinite(channel.totalHigh) ? Math.max(0, channel.totalHigh) / weekCount : null,
        predictedCpr,
        posteriorPositive: channel.posteriorPositive,
        source: channel.source || "observational",
        allocationReliability: channel.allocationReliability || "model-estimate",
        groupKey: channel.groupKey || null,
        groupLabel: channel.groupLabel || null,
        groupMaxCorrelation: channel.groupMaxCorrelation ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
}

// 상관이 높은 매체 채널은 개별 기여를 단정하기보다 하나의 관측 단위로 함께 읽을 수
// 있다. 이 함수는 모델을 재적합하거나 개별 효과를 바꾸지 않고, 화면 표시만 연결요소
// 단위로 합산한다. 따라서 언제든 개별 보기로 원래 추정을 확인할 수 있다.
export function buildMmmCollinearityGroupedPerformance(panel, rows = [], collinearPairs = [], threshold = 0.9, groupRefit = null) {
  if (!panel?.week?.length || !rows.length) return rows;
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  if (groupRefit?.enabled && groupRefit.groups?.length) {
    const groupedKeys = new Set(groupRefit.groups.flatMap((group) => group.members));
    const refitRows = groupRefit.groups.map((group) => {
      const contribution = group.contribution || {};
      const members = group.members.map((key) => rowByKey.get(key)).filter(Boolean);
      const totalSpend = group.members.reduce((sum, key) =>
        sum + (panel.ch?.[key] || []).reduce((channelSum, value) => channelSum + Math.max(0, Number(value) || 0), 0),
      0);
      const totalPredicted = Math.max(0, Number(contribution.totalMean) || 0);
      const activeWeeks = panel.week.reduce((count, _, weekIndex) => count + (
        group.members.some((key) => Number(panel.ch?.[key]?.[weekIndex]) > 0) ? 1 : 0
      ), 0);
      return {
        key: `collinear:${group.members.slice().sort().join("|")}`,
        label: group.label,
        members,
        activeWeeks,
        avgWeeklySpend: totalSpend / panel.week.length,
        avgWeeklyPredicted: totalPredicted / panel.week.length,
        avgWeeklyPredictedLow: Number.isFinite(contribution.totalLow) ? contribution.totalLow / panel.week.length : null,
        avgWeeklyPredictedHigh: Number.isFinite(contribution.totalHigh) ? contribution.totalHigh / panel.week.length : null,
        predictedCpr: totalPredicted > 0 ? totalSpend / totalPredicted : null,
        posteriorPositive: contribution.posteriorPositive ?? null,
        isCollinearityGroup: true,
        isGroupRefit: true,
        maxCorrelation: group.maxCorrelation,
        source: contribution.source,
        allocationReliability: "group-estimate",
        boundaryPosteriorMean: contribution.boundaryPosteriorMean || false,
      };
    });
    return [
      ...rows.filter((row) => !groupedKeys.has(row.key)),
      ...refitRows,
    ].sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
  }
  const parent = new Map();
  const find = (key) => {
    if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
    return parent.get(key);
  };
  const join = (left, right) => {
    const a = find(left), b = find(right);
    if (a !== b) parent.set(b, a);
  };
  const validPairs = collinearPairs.map((pair) => ({
    ...pair,
    left: String(pair.a || "").replace(/^media_/, ""),
    right: String(pair.b || "").replace(/^media_/, ""),
  })).filter((pair) => (
    Math.abs(Number(pair.corr)) >= threshold
    && rowByKey.has(pair.left)
    && rowByKey.has(pair.right)
  ));
  validPairs.forEach((pair) => {
    if (!parent.has(pair.left)) parent.set(pair.left, pair.left);
    if (!parent.has(pair.right)) parent.set(pair.right, pair.right);
    join(pair.left, pair.right);
  });
  if (!validPairs.length) return rows;

  const components = new Map();
  [...parent.keys()].forEach((key) => {
    const root = find(key);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(key);
  });
  const groupedKeys = new Set(parent.keys());
  const weekCount = panel.week.length;
  const groupedRows = [...components.values()].map((keys) => {
    const members = keys.map((key) => rowByKey.get(key));
    const totalSpend = members.reduce((sum, row) => sum + row.avgWeeklySpend * weekCount, 0);
    const totalPredicted = members.reduce((sum, row) => sum + row.avgWeeklyPredicted * weekCount, 0);
    const maxCorrelation = Math.max(...validPairs
      .filter((pair) => keys.includes(pair.left) && keys.includes(pair.right))
      .map((pair) => Math.abs(Number(pair.corr))));
    const activeWeeks = panel.week.reduce((count, _, weekIndex) => count + (
      keys.some((key) => Number(panel.ch?.[key]?.[weekIndex]) > 0) ? 1 : 0
    ), 0);
    return {
      key: `collinear:${keys.slice().sort().join("|")}`,
      label: members.map((row) => row.label).join(" + "),
      members,
      activeWeeks,
      avgWeeklySpend: totalSpend / weekCount,
      avgWeeklyPredicted: totalPredicted / weekCount,
      predictedCpr: totalPredicted > 0 ? totalSpend / totalPredicted : null,
      posteriorPositive: null,
      isCollinearityGroup: true,
      isGroupRefit: false,
      maxCorrelation,
    };
  });
  return [
    ...rows.filter((row) => !groupedKeys.has(row.key)),
    ...groupedRows,
  ].sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
}
