// MMM 렌더층용: 기간 전체의 채널별 평균 주간 지출·모델 예측 성과·효율.
// responseAt은 이미 선택된 adstock/포화 파라미터를 반영한 모델 곡선이며,
// 이 함수는 수학을 재추정하지 않고 화면에 읽기 쉬운 집계만 제공한다.
export function buildMmmWeeklyPerformance(panel, saturationByChannel = {}) {
  if (!panel?.ch || !panel?.week?.length) return [];
  const weekCount = panel.week.length;

  return Object.values(saturationByChannel)
    .map((channel) => {
      const spends = panel.ch[channel.key] || [];
      let totalSpend = 0;
      let totalPredicted = 0;
      let activeWeeks = 0;

      spends.forEach((rawSpend) => {
        const spend = Number(rawSpend);
        if (!Number.isFinite(spend) || spend <= 0) return;
        totalSpend += spend;
        activeWeeks += 1;
        const predicted = typeof channel.responseAt === "function" ? Number(channel.responseAt(spend)) : null;
        if (Number.isFinite(predicted) && predicted > 0) totalPredicted += predicted;
      });

      if (!(totalSpend > 0)) return null;
      const predictedCpr = totalPredicted > 0 ? totalSpend / totalPredicted : null;
      return {
        key: channel.key,
        label: channel.label || channel.key,
        activeWeeks,
        avgWeeklySpend: totalSpend / weekCount,
        avgWeeklyPredicted: totalPredicted / weekCount,
        predictedCpr,
        posteriorPositive: channel.posteriorPositive,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
}

// 상관이 높은 매체 채널은 개별 기여를 단정하기보다 하나의 관측 단위로 함께 읽을 수
// 있다. 이 함수는 모델을 재적합하거나 개별 효과를 바꾸지 않고, 화면 표시만 연결요소
// 단위로 합산한다. 따라서 언제든 개별 보기로 원래 추정을 확인할 수 있다.
export function buildMmmCollinearityGroupedPerformance(panel, rows = [], collinearPairs = [], threshold = 0.9) {
  if (!panel?.week?.length || !rows.length) return rows;
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
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
      maxCorrelation,
    };
  });
  return [
    ...rows.filter((row) => !groupedKeys.has(row.key)),
    ...groupedRows,
  ].sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
}
