// MMM 렌더층용: 주간 기여분해와 동일한 채널별 counterfactual 기여를 집계한다.
// 0-spend 주의 carryover도 기여에 포함하므로 반응곡선에 당주 지출을 다시 넣는
// 별도 계산과 달리 표·분해 그래프·CSV의 합계가 항상 같은 원천을 사용한다.
export const MMM_AGGREGATE_MEDIA_GROUPS = [
  { key: "performance_total", label: "Performance total", kind: "perf", groupName: "Performance" },
  { key: "branding_total", label: "Branding total", kind: "brand", groupName: "Brand" },
];

export function buildMmmAggregateMediaPanel(panel) {
  if (!panel?.week?.length || !panel?.channels?.length) return null;
  const groups = MMM_AGGREGATE_MEDIA_GROUPS.map((group) => ({
    ...group,
    members: panel.channels.filter((channel) => (
      group.kind === "brand" ? channel.kind === "brand" : channel.kind !== "brand"
    )),
  })).filter((group) => group.members.length > 0);
  const ch = Object.fromEntries(groups.map((group) => [
    group.key,
    panel.week.map((_, weekIndex) => group.members.reduce(
      (sum, channel) => sum + Math.max(0, Number(panel.ch?.[channel.key]?.[weekIndex]) || 0),
      0,
    )),
  ]));
  return {
    ...panel,
    ch,
    channels: groups.map(({ key, label, kind }) => ({ key, label, kind })),
    aggregateMediaGroups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      kind: group.kind,
      groupName: group.groupName,
      members: group.members.map((channel) => channel.key),
    })),
  };
}

export function allocateMmmAggregateRun(panel, aggregatePanel, aggregateRun, adstockFn) {
  if (!panel?.week?.length || !aggregateRun?.weeks?.length || typeof adstockFn !== "function") return null;
  const groups = aggregatePanel?.aggregateMediaGroups || [];
  const allocated = {};
  const weeklyByChannel = Object.fromEntries((panel.channels || []).map((channel) => [channel.key, []]));

  groups.forEach((group) => {
    const groupContribution = aggregateRun.channelContributions?.[group.key];
    const alpha = aggregateRun.saturationByChannel?.[group.key]?.params?.alpha;
    if (!groupContribution || !Number.isFinite(alpha)) return;
    const members = group.members.map((key) => (
      (panel.channels || []).find((channel) => channel.key === key)
    )).filter(Boolean);
    const adstockByKey = Object.fromEntries(members.map((channel) => [
      channel.key,
      adstockFn(panel.ch?.[channel.key] || [], alpha),
    ]));
    const fallbackWeights = Object.fromEntries(members.map((channel) => {
      const total = (panel.ch?.[channel.key] || []).reduce(
        (sum, value) => sum + Math.max(0, Number(value) || 0),
        0,
      );
      return [channel.key, total];
    }));
    const fallbackTotal = Object.values(fallbackWeights).reduce((sum, value) => sum + value, 0);
    const sharesByKey = Object.fromEntries(members.map((channel) => [channel.key, []]));

    panel.week.forEach((_, weekIndex) => {
      const denominator = members.reduce(
        (sum, channel) => sum + Math.max(0, Number(adstockByKey[channel.key]?.[weekIndex]) || 0),
        0,
      );
      members.forEach((channel) => {
        const share = denominator > 0
          ? Math.max(0, Number(adstockByKey[channel.key]?.[weekIndex]) || 0) / denominator
          : fallbackTotal > 0
            ? fallbackWeights[channel.key] / fallbackTotal
            : 1 / Math.max(1, members.length);
        sharesByKey[channel.key].push(share);
        weeklyByChannel[channel.key][weekIndex] = Math.max(
          0,
          Number(groupContribution.weeklyMean?.[weekIndex]) || 0,
        ) * share;
      });
    });

    members.forEach((channel) => {
      const shares = sharesByKey[channel.key];
      const weeklyMean = weeklyByChannel[channel.key];
      const weeklyLow = shares.map((share, index) => (
        Math.max(0, Number(groupContribution.weeklyLow?.[index]) || 0) * share
      ));
      const weeklyHigh = shares.map((share, index) => (
        Math.max(0, Number(groupContribution.weeklyHigh?.[index]) || 0) * share
      ));
      allocated[channel.key] = {
        ...groupContribution,
        key: channel.key,
        label: channel.label || channel.key,
        weeklyMean,
        weeklyLow,
        weeklyHigh,
        totalMean: weeklyMean.reduce((sum, value) => sum + value, 0),
        totalLow: weeklyLow.reduce((sum, value) => sum + value, 0),
        totalHigh: weeklyHigh.reduce((sum, value) => sum + value, 0),
        source: "aggregate-group-adstock-allocation",
        allocationReliability: "group-total-by-construction",
        identificationVerdict: "ALLOCATED/BY-CONSTRUCTION",
        identification: {
          byConstruction: true,
          allocationBasis: "weekly-adstocked-spend-share",
          groupKey: group.key,
        },
        groupKey: group.key,
        groupLabel: group.label,
        groupPosteriorPositive: groupContribution.posteriorPositive,
      };
    });
  });

  const weeks = aggregateRun.weeks.map((week, weekIndex) => ({
    ...week,
    channelContrib: Object.fromEntries(Object.entries(weeklyByChannel).map(([key, values]) => [
      key,
      Math.max(0, Number(values[weekIndex]) || 0),
    ])),
  }));
  return {
    ...aggregateRun,
    weeks,
    channelContributions: allocated,
    aggregateMediaAllocation: {
      method: "weekly-adstocked-spend-share",
      byConstruction: true,
      groups,
    },
  };
}

export function sliceMmmChannelContributions(channelContributions = {}, start = 0, end = Infinity) {
  const slice = (values) => Array.isArray(values) ? values.slice(start, end) : [];
  return Object.fromEntries(Object.entries(channelContributions).map(([key, value]) => {
    const weeklyMean = slice(value.weeklyMean);
    const weeklyLow = slice(value.weeklyLow);
    const weeklyHigh = slice(value.weeklyHigh);
    return [key, {
      ...value,
      weeklyMean,
      weeklyLow,
      weeklyHigh,
      totalMean: weeklyMean.reduce((sum, item) => sum + (Number(item) || 0), 0),
      totalLow: weeklyLow.reduce((sum, item) => sum + (Number(item) || 0), 0),
      totalHigh: weeklyHigh.reduce((sum, item) => sum + (Number(item) || 0), 0),
    }];
  }));
}

// Stress-profile display allocation: preserve each fitted group total while giving
// every active channel a small positive share. This is not a new channel fit and must
// remain labeled as allocation rather than identified channel effect.
export function applyMmmPosteriorFloorAllocation(run, panel, minShare = 0.05) {
  if (!run?.weeks?.length || !panel?.channels?.length || !run.channelContributions) return run;
  const channels = panel.channels.filter((channel) => run.channelContributions[channel.key]);
  const groups = [
    { key: "Performance", members: channels.filter((channel) => channel.kind !== "brand") },
    { key: "Brand", members: channels.filter((channel) => channel.kind === "brand") },
  ].filter((group) => group.members.length);
  const floor = Math.min(Math.max(0, Number(minShare) || 0), 1 / Math.max(1, channels.length));
  const allocated = Object.fromEntries(Object.entries(run.channelContributions).map(([key, value]) => [key, {
    ...value,
    weeklyMean: (value.weeklyMean || []).slice(),
    weeklyLow: (value.weeklyLow || []).slice(),
    weeklyHigh: (value.weeklyHigh || []).slice(),
  }]));

  groups.forEach((group) => {
    const baseWeights = group.members.map((channel) => {
      const contribution = run.channelContributions[channel.key];
      const posterior = Math.max(0, Number(contribution.posteriorPositive) || 0);
      const fitted = Math.max(0, Number(contribution.totalMean) || 0);
      return posterior > 0 ? posterior : fitted;
    });
    const weightTotal = baseWeights.reduce((sum, value) => sum + value, 0);
    const rawShares = weightTotal > 0
      ? baseWeights.map((value) => value / weightTotal)
      : group.members.map(() => 1 / group.members.length);
    const shares = rawShares.map((share) => floor + (1 - floor * group.members.length) * share);
    group.members.forEach((channel, memberIndex) => {
      const contribution = allocated[channel.key];
      contribution.weeklyMean = run.weeks.map((_, weekIndex) => (
        group.members.reduce((sum, member) => sum + Math.max(0, Number(run.channelContributions[member.key]?.weeklyMean?.[weekIndex]) || 0), 0)
      ) * shares[memberIndex]);
      contribution.weeklyLow = run.weeks.map((_, weekIndex) => (
        group.members.reduce((sum, member) => sum + Math.max(0, Number(run.channelContributions[member.key]?.weeklyLow?.[weekIndex]) || 0), 0)
      ) * shares[memberIndex]);
      contribution.weeklyHigh = run.weeks.map((_, weekIndex) => (
        group.members.reduce((sum, member) => sum + Math.max(0, Number(run.channelContributions[member.key]?.weeklyHigh?.[weekIndex]) || 0), 0)
      ) * shares[memberIndex]);
      contribution.totalMean = contribution.weeklyMean.reduce((sum, value) => sum + value, 0);
      contribution.totalLow = contribution.weeklyLow.reduce((sum, value) => sum + value, 0);
      contribution.totalHigh = contribution.weeklyHigh.reduce((sum, value) => sum + value, 0);
      contribution.source = "channel-model-posterior-floor-allocation";
      contribution.allocationReliability = "posterior-floor-allocation";
      contribution.identificationVerdict = "ALLOCATED/BY-CONSTRUCTION";
      contribution.identification = { byConstruction: true, allocationBasis: "posterior-positive-share-with-floor", minShare: floor, groupKey: group.key };
    });
  });

  const weeks = run.weeks.map((week, weekIndex) => ({
    ...week,
    channelContrib: Object.fromEntries(Object.entries(allocated).map(([key, contribution]) => [key, contribution.weeklyMean[weekIndex] || 0])),
  }));
  return { ...run, weeks, channelContributions: allocated, channelAllocation: { method: "posterior-positive-share-with-floor", minShare: floor, byConstruction: true } };
}

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

      const weeklyMean = Array.isArray(channel.weeklyMean) ? channel.weeklyMean : [];
      const totalPredicted = Number.isFinite(channel.totalMean)
        ? Math.max(0, channel.totalMean)
        : weeklyMean.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
      if (!(totalSpend > 0) && !(totalPredicted > 0)) return null;
      const predictedCpr = totalSpend > 0 && totalPredicted > 0 ? totalSpend / totalPredicted : null;
      return {
        key: channel.key,
        label: channel.label || channel.key,
        activeWeeks,
        totalSpend,
        totalPredicted,
        avgWeeklySpend: totalSpend / weekCount,
        avgWeeklyPredicted: totalPredicted / weekCount,
        totalPredictedLow: Number.isFinite(channel.totalLow) ? Math.max(0, channel.totalLow) : null,
        totalPredictedHigh: Number.isFinite(channel.totalHigh) ? Math.max(0, channel.totalHigh) : null,
        avgWeeklyPredictedLow: Number.isFinite(channel.totalLow) ? Math.max(0, channel.totalLow) / weekCount : null,
        avgWeeklyPredictedHigh: Number.isFinite(channel.totalHigh) ? Math.max(0, channel.totalHigh) / weekCount : null,
        predictedCpr,
        posteriorPositive: channel.posteriorPositive,
        source: channel.source || "observational",
        allocationReliability: channel.allocationReliability || "model-estimate",
        identificationVerdict: channel.identificationVerdict || null,
        identification: channel.identification || null,
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
        totalSpend,
        totalPredicted,
        avgWeeklySpend: totalSpend / panel.week.length,
        avgWeeklyPredicted: totalPredicted / panel.week.length,
        totalPredictedLow: Number.isFinite(contribution.totalLow) ? contribution.totalLow : null,
        totalPredictedHigh: Number.isFinite(contribution.totalHigh) ? contribution.totalHigh : null,
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
      totalSpend,
      totalPredicted,
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
