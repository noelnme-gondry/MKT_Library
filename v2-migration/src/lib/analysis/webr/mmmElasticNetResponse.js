const COEFFICIENT_EPSILON = 1e-10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function foldCoefficients(row, foldCount) {
  const serialized = String(row?.fold_coefficients || "").trim();
  const parsed = serialized
    ? serialized.split("|").map(Number).filter(Number.isFinite)
    : [];
  if (parsed.length === foldCount) return parsed;
  return [];
}

export function buildElasticNetChannelModels(rawRows = [], input = {}) {
  const foldCount = Math.max(0, input.cuts?.length || 0);
  const rowTerms = rawRows.map((row, index) => ({ row, term: input.terms?.[index] })).filter(({ term }) => term?.isMedia);
  return (input.channelScenarios || []).map((scenario) => {
    const terms = rowTerms.filter(({ term }) => term.channelKey === scenario.key).map(({ row, term }) => ({
      alpha: finiteOr(term.adstockAlpha),
      coefficient: Math.max(0, finiteOr(row.coefficient)),
      foldCoefficients: foldCoefficients(row, foldCount).map((value) => Math.max(0, value)),
      lastAdstock: Math.max(0, finiteOr(scenario.lastAdstockByAlpha?.[term.adstockAlpha])),
    }));
    const foldChannelCoefficients = Array.from({ length: foldCount }, (_, foldIndex) => (
      terms.reduce((sum, term) => sum + finiteOr(term.foldCoefficients[foldIndex]), 0)
    ));
    const hasCompleteFoldEvidence = foldCount > 0
      && terms.length > 0
      && terms.every((term) => term.foldCoefficients.length === foldCount);
    const positiveFoldShare = hasCompleteFoldEvidence
      ? foldChannelCoefficients.filter((value) => value > COEFFICIENT_EPSILON).length / foldCount
      : 0;
    return {
      ...scenario,
      terms,
      foldChannelCoefficients,
      coefficient: terms.reduce((sum, term) => sum + term.coefficient, 0),
      hasCompleteFoldEvidence,
      positiveFoldShare,
    };
  });
}

function responseForCoefficients(channel, spend, foldIndex = null) {
  const safeSpend = Math.max(0, finiteOr(spend));
  return (channel?.terms || []).reduce((sum, term) => {
    const coefficient = foldIndex == null
      ? term.coefficient
      : Math.max(0, finiteOr(term.foldCoefficients?.[foldIndex]));
    const carry = Math.max(0, term.alpha * term.lastAdstock);
    return sum + coefficient * (Math.log1p(carry + safeSpend) - Math.log1p(carry));
  }, 0);
}

export function elasticNetResponseAt(channel, spend) {
  const mean = responseForCoefficients(channel, spend);
  const foldValues = (channel?.foldChannelCoefficients || []).map((_, foldIndex) => (
    responseForCoefficients(channel, spend, foldIndex)
  ));
  return {
    mean,
    low: foldValues.length >= 2 ? Math.min(...foldValues) : null,
    high: foldValues.length >= 2 ? Math.max(...foldValues) : null,
    foldValues,
  };
}

export function elasticNetMarginalAt(channel, spend, increment) {
  const safeSpend = Math.max(0, finiteOr(spend));
  const safeIncrement = Math.max(0, finiteOr(increment));
  const current = elasticNetResponseAt(channel, safeSpend);
  const next = elasticNetResponseAt(channel, safeSpend + safeIncrement);
  const foldValues = next.foldValues.map((value, index) => value - finiteOr(current.foldValues[index]));
  const mean = next.mean - current.mean;
  const initialStep = elasticNetResponseAt(channel, safeIncrement).mean;
  return {
    spend: safeSpend,
    increment: safeIncrement,
    mean,
    low: foldValues.length >= 2 ? Math.min(...foldValues) : null,
    high: foldValues.length >= 2 ? Math.max(...foldValues) : null,
    foldValues,
    saturation: initialStep > COEFFICIENT_EPSILON
      ? clamp(1 - mean / initialStep, 0, 1)
      : null,
  };
}

export function buildElasticNetResponseCurve(channel, options = {}) {
  const steps = Math.max(10, Math.floor(finiteOr(options.steps, 40)));
  const minSpend = Math.max(0, finiteOr(channel?.observedMin));
  const maxSpend = Math.max(0, finiteOr(channel?.observedMax));
  if (!channel?.terms?.length || !(maxSpend > minSpend)) return null;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const spend = minSpend + (maxSpend - minSpend) * index / steps;
    return { spend, ...elasticNetResponseAt(channel, spend) };
  });
  return {
    channelKey: channel.key,
    observedMin: minSpend,
    observedMax: maxSpend,
    currentSpend: clamp(finiteOr(channel.recentSpend), 0, maxSpend),
    points,
  };
}

export function evaluateElasticNetChannelGate(channel, options = {}) {
  const increment = Math.max(0, finiteOr(options.increment));
  const currentSpend = Math.max(0, finiteOr(channel?.recentSpend));
  const marginal = elasticNetMarginalAt(channel, currentSpend, increment);
  const reasons = [];
  if ((options.folds || 0) < 2) reasons.push("insufficient-oos-folds");
  if (!(channel?.coefficient > COEFFICIENT_EPSILON) || channel?.positiveFoldShare < 1) reasons.push("unstable-fold-coefficient");
  if ((channel?.activeWeeks || 0) < 20) reasons.push("sparse-active-weeks");
  if (!(channel?.recentSpend > COEFFICIENT_EPSILON) || (channel?.recentActiveWeeks || 0) < 4) reasons.push("recently-inactive-channel");
  if ((channel?.uniqueSpendValues || 0) < 5 || !(channel?.spendCv >= 0.1)) reasons.push("insufficient-spend-variation");
  if (channel?.collinearityGroup?.length > 1) reasons.push("high-collinearity");
  if (!(increment > 0) || currentSpend + increment > finiteOr(channel?.observedMax)) reasons.push("outside-observed-spend-range");
  if (!(marginal.low > COEFFICIENT_EPSILON)) reasons.push("non-positive-marginal-lower-bound");
  return { eligible: reasons.length === 0, reasons, marginal };
}

export function optimizeElasticNetBudget(channels = [], totalBudget, options = {}) {
  const budget = Math.max(0, finiteOr(totalBudget));
  const increment = Math.max(1e-9, finiteOr(options.increment));
  const folds = Math.max(0, finiteOr(options.folds));
  const predictiveWinner = options.predictiveWinner === true;
  const evaluated = channels.map((channel) => ({
    channel,
    gate: evaluateElasticNetChannelGate(channel, { folds, increment }),
  }));
  const globalReasons = [];
  if (!predictiveWinner) globalReasons.push("webr-not-predictive-winner");
  if (evaluated.length < 2) globalReasons.push("insufficient-channels");
  if (evaluated.some(({ gate }) => !gate.eligible)) globalReasons.push("channel-gate-failed");
  const minimumRequired = evaluated.reduce((sum, { channel }) => sum + Math.max(0, finiteOr(channel.observedMin)), 0);
  if (budget < minimumRequired) globalReasons.push("budget-below-observed-minimums");
  if (globalReasons.length) {
    return { status: "blocked", reasons: globalReasons, channels: evaluated, totalBudget: budget, increment };
  }

  const allocations = evaluated.map(({ channel, gate }) => ({
    channel,
    gate,
    spend: Math.max(0, finiteOr(channel.observedMin)),
  }));
  let remaining = budget - allocations.reduce((sum, item) => sum + item.spend, 0);
  let iterations = 0;
  while (remaining > 1e-9 && iterations < 10000) {
    iterations += 1;
    let best = null;
    allocations.forEach((item) => {
      const room = Math.max(0, finiteOr(item.channel.observedMax) - item.spend);
      const step = Math.min(increment, remaining, room);
      if (!(step > 1e-9)) return;
      const marginal = elasticNetMarginalAt(item.channel, item.spend, step);
      if (!(marginal.low > COEFFICIENT_EPSILON)) return;
      const score = marginal.low / step;
      if (!best || score > best.score || (score === best.score && item.channel.key < best.item.channel.key)) {
        best = { item, step, marginal, score };
      }
    });
    if (!best) break;
    best.item.spend += best.step;
    remaining -= best.step;
  }
  const items = allocations.map(({ channel, gate, spend }) => ({
    key: channel.key,
    label: channel.label,
    currentSpend: channel.recentSpend,
    plannedSpend: spend,
    response: elasticNetResponseAt(channel, spend),
    marginal: elasticNetMarginalAt(channel, spend, Math.min(increment, Math.max(0, channel.observedMax - spend))),
    gate,
  })).sort((left, right) => right.plannedSpend - left.plannedSpend);
  return {
    status: remaining > Math.max(1e-6, budget * 1e-9) ? "partial" : "complete",
    reasons: remaining > 0 ? ["observed-range-or-positive-marginal-limit"] : [],
    totalBudget: budget,
    totalAllocated: budget - remaining,
    unallocated: remaining,
    increment,
    iterations,
    items,
  };
}
