import { STATS } from "./abTestMath";
import { _lgamma, chi2Cdf, mmmNormCdf, studentTcrit, studentTp } from "./statPrimitives";
import { fUpperTail } from "./factorialAnovaMath";

export const GROUP_COMPARISON_CONFIG = Object.freeze({
  alpha: 0.05,
  exactRankProductLimit: 200,
  exactSignedRankLimit: 25,
  studentizedRangeSteps: 160,
});

const finite = (values = []) => values.filter(Number.isFinite);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sampleVariance = (values) => {
  if (values.length < 2) return null;
  const center = mean(values);
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
};

function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ranks(values = []) {
  const sorted = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const result = Array(values.length).fill(null);
  const ties = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[start].value) end += 1;
    const rank = (start + 1 + end + 1) / 2;
    for (let index = start; index <= end; index += 1) result[sorted[index].index] = rank;
    if (end > start) ties.push(end - start + 1);
    start = end + 1;
  }
  return { ranks: result, ties };
}

function holmAdjust(values = []) {
  const indexed = values.map((value, index) => ({ index, value: Number.isFinite(value) ? value : 1 }))
    .sort((left, right) => left.value - right.value);
  const adjusted = Array(values.length).fill(1);
  let previous = 0;
  indexed.forEach((entry, rank) => {
    previous = Math.min(1, Math.max(previous, entry.value * (indexed.length - rank)));
    adjusted[entry.index] = previous;
  });
  return adjusted;
}

function normalTwoSidedP(z) {
  return Math.min(1, Math.max(0, 2 * (1 - mmmNormCdf(Math.abs(z)))));
}

function cohenD(left, right) {
  const varianceLeft = sampleVariance(left);
  const varianceRight = sampleVariance(right);
  const pooledDf = left.length + right.length - 2;
  if (!(varianceLeft >= 0) || !(varianceRight >= 0) || !(pooledDf > 0)) return null;
  const pooledSd = Math.sqrt(((left.length - 1) * varianceLeft + (right.length - 1) * varianceRight) / pooledDf);
  if (!(pooledSd > 0)) return null;
  const d = (mean(left) - mean(right)) / pooledSd;
  const correction = 1 - 3 / (4 * pooledDf - 1);
  return { cohenD: d, hedgesG: d * correction };
}

// 평균 차이가 질문일 때 Welch가 기본이다. 분산이 같다는 근거가 없는 마케팅
// 그룹을 pooled t-test로 접지 않는다.
export function welchTTest(left = [], right = []) {
  const a = finite(left);
  const b = finite(right);
  if (a.length < 2 || b.length < 2) return { ok: false, reason: "insufficient_group_rows", nA: a.length, nB: b.length };
  const result = STATS.continuousTest(a.length, mean(a), Math.sqrt(sampleVariance(a)), b.length, mean(b), Math.sqrt(sampleVariance(b)));
  if (!result?.ok) return { ok: false, reason: result?.reason || "welch_not_estimable", nA: a.length, nB: b.length };
  return {
    ok: true,
    method: "welch_t_test",
    nA: a.length,
    nB: b.length,
    meanA: mean(a),
    meanB: mean(b),
    difference: mean(a) - mean(b),
    t: -result.z,
    df: result.df,
    p: result.pValue,
    ciLow: -result.ciHigh95,
    ciHigh: -result.ciLow95,
    effect: cohenD(a, b),
  };
}

export function pairedTTest(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return { ok: false, reason: "pair_alignment_required" };
  const differences = left.map((value, index) => Number.isFinite(value) && Number.isFinite(right[index]) ? value - right[index] : null).filter(Number.isFinite);
  if (differences.length < 2) return { ok: false, reason: "insufficient_pairs", n: differences.length };
  const average = mean(differences);
  const variance = sampleVariance(differences);
  if (!(variance > 0)) return { ok: false, reason: "constant_pair_difference", n: differences.length };
  const standardError = Math.sqrt(variance / differences.length);
  const df = differences.length - 1;
  const t = average / standardError;
  const critical = studentTcrit(0.95, df);
  return {
    ok: true,
    method: "paired_t_test",
    n: differences.length,
    difference: average,
    t,
    df,
    p: studentTp(Math.abs(t), df),
    ciLow: average - critical * standardError,
    ciHigh: average + critical * standardError,
    effect: { dz: average / Math.sqrt(variance) },
  };
}

function mannWhitneyExactDistribution(nA, nB) {
  const states = Array.from({ length: nA + 1 }, () => Array.from({ length: nB + 1 }, () => []));
  for (let a = 0; a <= nA; a += 1) states[a][0] = [1];
  for (let b = 0; b <= nB; b += 1) states[0][b] = [1];
  for (let a = 1; a <= nA; a += 1) {
    for (let b = 1; b <= nB; b += 1) {
      const values = Array(a * b + 1).fill(0);
      states[a - 1][b].forEach((count, u) => { values[u + b] += count; });
      states[a][b - 1].forEach((count, u) => { values[u] += count; });
      states[a][b] = values;
    }
  }
  return states[nA][nB];
}

export function wilcoxonRankSum(left = [], right = [], config = GROUP_COMPARISON_CONFIG) {
  const a = finite(left);
  const b = finite(right);
  if (!a.length || !b.length) return { ok: false, reason: "insufficient_group_rows", nA: a.length, nB: b.length };
  const combined = [...a, ...b];
  const ranked = ranks(combined);
  const rankSumA = ranked.ranks.slice(0, a.length).reduce((sum, value) => sum + value, 0);
  const uA = rankSumA - a.length * (a.length + 1) / 2;
  const uB = a.length * b.length - uA;
  const u = Math.min(uA, uB);
  const noTies = ranked.ties.length === 0;
  const canUseExact = noTies && a.length * b.length <= config.exactRankProductLimit;
  let p;
  let z = null;
  if (canUseExact) {
    const distribution = mannWhitneyExactDistribution(a.length, b.length);
    const total = distribution.reduce((sum, count) => sum + count, 0);
    const lower = distribution.slice(0, Math.floor(u) + 1).reduce((sum, count) => sum + count, 0) / total;
    p = Math.min(1, 2 * lower);
  } else {
    const n = combined.length;
    const tieTerm = ranked.ties.reduce((sum, size) => sum + size ** 3 - size, 0);
    const variance = a.length * b.length / 12 * ((n + 1) - tieTerm / (n * (n - 1)));
    if (!(variance > 0)) return { ok: false, reason: "rank_variance_not_estimable" };
    const correction = uA > a.length * b.length / 2 ? 0.5 : -0.5;
    z = (uA - a.length * b.length / 2 - correction) / Math.sqrt(variance);
    p = normalTwoSidedP(z);
  }
  return {
    ok: true,
    method: "wilcoxon_rank_sum",
    pMethod: canUseExact ? "exact" : "tie_corrected_normal_approximation",
    nA: a.length,
    nB: b.length,
    uA,
    uB,
    u,
    z,
    p,
    effect: { rankBiserial: 2 * uA / (a.length * b.length) - 1, hodgesLehmann: median(a.flatMap((leftValue) => b.map((rightValue) => leftValue - rightValue))) },
  };
}

function signedRankExactP(ranksInput, observed) {
  const total = ranksInput.reduce((sum, value) => sum + value, 0);
  const ways = Array(total + 1).fill(0);
  ways[0] = 1;
  ranksInput.forEach((rank) => {
    for (let sum = total - rank; sum >= 0; sum -= 1) ways[sum + rank] += ways[sum];
  });
  const denominator = 2 ** ranksInput.length;
  const lower = ways.slice(0, observed + 1).reduce((sum, count) => sum + count, 0) / denominator;
  const upper = ways.slice(observed).reduce((sum, count) => sum + count, 0) / denominator;
  return Math.min(1, 2 * Math.min(lower, upper));
}

export function wilcoxonSignedRank(left = [], right = [], config = GROUP_COMPARISON_CONFIG) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return { ok: false, reason: "pair_alignment_required" };
  const differences = left.map((value, index) => Number.isFinite(value) && Number.isFinite(right[index]) ? value - right[index] : null)
    .filter((value) => Number.isFinite(value) && value !== 0);
  if (!differences.length) return { ok: false, reason: "all_pair_differences_zero" };
  const ranked = ranks(differences.map(Math.abs));
  const wPlus = differences.reduce((sum, value, index) => sum + (value > 0 ? ranked.ranks[index] : 0), 0);
  const totalRank = ranked.ranks.reduce((sum, value) => sum + value, 0);
  const wMinus = totalRank - wPlus;
  const noTies = ranked.ties.length === 0;
  const canUseExact = noTies && differences.length <= config.exactSignedRankLimit;
  let p;
  let z = null;
  if (canUseExact) {
    p = signedRankExactP(ranked.ranks, Math.round(wPlus));
  } else {
    const n = differences.length;
    const tieTerm = ranked.ties.reduce((sum, size) => sum + size ** 3 - size, 0);
    const variance = n * (n + 1) * (2 * n + 1) / 24 - tieTerm / 48;
    if (!(variance > 0)) return { ok: false, reason: "rank_variance_not_estimable" };
    const correction = wPlus > totalRank / 2 ? 0.5 : -0.5;
    z = (wPlus - totalRank / 2 - correction) / Math.sqrt(variance);
    p = normalTwoSidedP(z);
  }
  return {
    ok: true,
    method: "wilcoxon_signed_rank",
    pMethod: canUseExact ? "exact" : "tie_corrected_normal_approximation",
    n: differences.length,
    wPlus,
    wMinus,
    z,
    p,
    effect: { rankBiserial: (wPlus - wMinus) / totalRank, hodgesLehmann: median(differences) },
  };
}

function normalizedGroups(groups = []) {
  return groups.map((group) => ({ name: String(group?.name ?? ""), values: finite(group?.values) })).filter((group) => group.name && group.values.length > 0);
}

export function welchAnova(groups = []) {
  const usable = normalizedGroups(groups);
  if (usable.length < 3 || usable.some((group) => group.values.length < 2)) return { ok: false, reason: "three_groups_with_two_rows_required" };
  const summary = usable.map((group) => ({ ...group, mean: mean(group.values), variance: sampleVariance(group.values) }));
  if (summary.some((group) => !(group.variance > 0))) return { ok: false, reason: "group_variance_not_estimable" };
  const weights = summary.map((group) => group.values.length / group.variance);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const grandMean = summary.reduce((sum, group, index) => sum + weights[index] * group.mean, 0) / totalWeight;
  const k = summary.length;
  const numerator = summary.reduce((sum, group, index) => sum + weights[index] * (group.mean - grandMean) ** 2, 0) / (k - 1);
  const adjustmentTerm = summary.reduce((sum, group, index) => sum + (1 - weights[index] / totalWeight) ** 2 / (group.values.length - 1), 0);
  const denominator = 1 + 2 * (k - 2) / (k ** 2 - 1) * adjustmentTerm;
  const f = numerator / denominator;
  const df2 = (k ** 2 - 1) / (3 * adjustmentTerm);
  const all = summary.flatMap((group) => group.values);
  const overall = mean(all);
  const ssBetween = summary.reduce((sum, group) => sum + group.values.length * (group.mean - overall) ** 2, 0);
  const ssTotal = all.reduce((sum, value) => sum + (value - overall) ** 2, 0);
  return {
    ok: true,
    method: "welch_anova",
    n: all.length,
    groups: summary.map(({ name, values, mean: groupMean, variance }) => ({ name, n: values.length, mean: groupMean, variance })),
    f,
    df1: k - 1,
    df2,
    p: fUpperTail(f, k - 1, df2),
    effect: { etaSquared: ssTotal > 0 ? ssBetween / ssTotal : null },
  };
}

function simpson(fn, start, end, steps) {
  const count = steps % 2 === 0 ? steps : steps + 1;
  const width = (end - start) / count;
  let total = fn(start) + fn(end);
  for (let index = 1; index < count; index += 1) total += (index % 2 ? 4 : 2) * fn(start + width * index);
  return total * width / 3;
}

// Studentized range의 정규 한계 CDF. k개 독립 표준정규의 최댓값−최솟값이 q
// 이하일 확률을 한 차원 적분으로 계산한다. 외부 R 패키지를 자동 설치하지 않고도
// Games–Howell의 이분산 사후 비교를 지원하기 위한 순수·결정론 경로다.
function normalRangeCdf(q, groups, steps) {
  if (!(q >= 0) || groups < 2) return 0;
  const density = (value) => Math.exp(-value * value / 2) / Math.sqrt(2 * Math.PI);
  return Math.min(1, Math.max(0, simpson((value) => {
    const span = Math.max(0, mmmNormCdf(value + q) - mmmNormCdf(value));
    return groups * density(value) * span ** (groups - 1);
  }, -8, 8, steps)));
}

function studentizedRangeCdf(q, groups, df, steps = GROUP_COMPARISON_CONFIG.studentizedRangeSteps) {
  if (!(q >= 0) || !(groups >= 2) || !(df > 0)) return 0;
  if (df >= 1e4) return normalRangeCdf(q, groups, steps);
  const shape = df / 2;
  const upper = Math.sqrt(df + 12 * Math.sqrt(2 * df) + 50);
  const radialDensity = (radius) => {
    if (radius === 0) return df === 1 ? Math.exp((1 - shape) * Math.log(2) - _lgamma(shape)) : 0;
    const logDensity = (1 - shape) * Math.log(2) - _lgamma(shape) + (df - 1) * Math.log(radius) - radius * radius / 2;
    return Math.exp(logDensity);
  };
  return Math.min(1, Math.max(0, simpson((radius) => {
    const scaledQ = q * radius / Math.sqrt(df);
    return radialDensity(radius) * normalRangeCdf(scaledQ, groups, steps);
  }, 0, upper, steps)));
}

function studentizedRangeCritical(groups, df) {
  let low = 0;
  let high = 12;
  while (studentizedRangeCdf(high, groups, df) < 0.95 && high < 100) high *= 2;
  for (let iteration = 0; iteration < 42; iteration += 1) {
    const middle = (low + high) / 2;
    if (studentizedRangeCdf(middle, groups, df) < 0.95) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function gamesHowell(groups = []) {
  const usable = normalizedGroups(groups);
  if (usable.length < 3 || usable.some((group) => group.values.length < 2)) return { ok: false, reason: "three_groups_with_two_rows_required" };
  const summary = usable.map((group) => ({ ...group, mean: mean(group.values), variance: sampleVariance(group.values) }));
  if (summary.some((group) => !(group.variance > 0))) return { ok: false, reason: "group_variance_not_estimable" };
  const pairs = [];
  for (let left = 0; left < summary.length; left += 1) {
    for (let right = left + 1; right < summary.length; right += 1) {
      const varianceLeft = summary[left].variance / summary[left].values.length;
      const varianceRight = summary[right].variance / summary[right].values.length;
      const standardError = Math.sqrt(varianceLeft + varianceRight);
      const df = (varianceLeft + varianceRight) ** 2 / (varianceLeft ** 2 / (summary[left].values.length - 1) + varianceRight ** 2 / (summary[right].values.length - 1));
      const difference = summary[left].mean - summary[right].mean;
      const q = Math.abs(difference) * Math.SQRT2 / standardError;
      const critical = studentizedRangeCritical(summary.length, df);
      const margin = critical * standardError / Math.SQRT2;
      pairs.push({
        left: summary[left].name,
        right: summary[right].name,
        difference,
        standardError,
        df,
        q,
        p: 1 - studentizedRangeCdf(q, summary.length, df),
        ciLow: difference - margin,
        ciHigh: difference + margin,
      });
    }
  }
  return { ok: true, method: "games_howell", familySize: summary.length, pairs };
}

export function kruskalWallis(groups = []) {
  const usable = normalizedGroups(groups);
  if (usable.length < 3) return { ok: false, reason: "three_groups_required" };
  const entries = usable.flatMap((group, groupIndex) => group.values.map((value) => ({ value, groupIndex })));
  if (entries.length <= usable.length) return { ok: false, reason: "insufficient_residual_df" };
  const ranked = ranks(entries.map((entry) => entry.value));
  const rankSums = usable.map((_, groupIndex) => entries.reduce((sum, entry, index) => sum + (entry.groupIndex === groupIndex ? ranked.ranks[index] : 0), 0));
  const n = entries.length;
  const uncorrected = 12 / (n * (n + 1)) * rankSums.reduce((sum, rankSum, index) => sum + rankSum ** 2 / usable[index].values.length, 0) - 3 * (n + 1);
  const tieTerm = ranked.ties.reduce((sum, size) => sum + size ** 3 - size, 0);
  const correction = 1 - tieTerm / (n ** 3 - n);
  if (!(correction > 0)) return { ok: false, reason: "rank_variance_not_estimable" };
  const h = uncorrected / correction;
  const df = usable.length - 1;
  return {
    ok: true,
    method: "kruskal_wallis",
    n,
    df,
    h,
    p: 1 - chi2Cdf(h, df),
    correction,
    groups: usable.map((group, index) => ({ name: group.name, n: group.values.length, meanRank: rankSums[index] / group.values.length })),
    effect: { epsilonSquared: (h - usable.length + 1) / (n - usable.length) },
  };
}

export function dunnHolm(groups = []) {
  const usable = normalizedGroups(groups);
  const omnibus = kruskalWallis(usable);
  if (!omnibus.ok) return omnibus;
  const entries = usable.flatMap((group, groupIndex) => group.values.map((value) => ({ value, groupIndex })));
  const ranked = ranks(entries.map((entry) => entry.value));
  const n = entries.length;
  const tieTerm = ranked.ties.reduce((sum, size) => sum + size ** 3 - size, 0);
  const correction = 1 - tieTerm / (n ** 3 - n);
  const meanRanks = usable.map((group, groupIndex) => entries.reduce((sum, entry, index) => sum + (entry.groupIndex === groupIndex ? ranked.ranks[index] : 0), 0) / group.values.length);
  const pairs = [];
  for (let left = 0; left < usable.length; left += 1) {
    for (let right = left + 1; right < usable.length; right += 1) {
      const standardError = Math.sqrt(n * (n + 1) / 12 * correction * (1 / usable[left].values.length + 1 / usable[right].values.length));
      const z = (meanRanks[left] - meanRanks[right]) / standardError;
      pairs.push({ left: usable[left].name, right: usable[right].name, difference: meanRanks[left] - meanRanks[right], z, rawP: normalTwoSidedP(z) });
    }
  }
  const adjusted = holmAdjust(pairs.map((pair) => pair.rawP));
  pairs.forEach((pair, index) => { pair.holmP = adjusted[index]; pair.isSignificant = pair.holmP < GROUP_COMPARISON_CONFIG.alpha; });
  return { ok: true, method: "dunn_holm", omnibus, pairs, adjustment: "holm" };
}

// 범주형 연관은 "유의한 셀이 있다"로 끝내지 않는다. 교차표와 Cramér's V를
// 같이 내보내고, 2×2 희소표만 기존 Fisher 정확검정으로 넘긴다.
export function categoricalAssociation(table = []) {
  if (!Array.isArray(table) || table.length < 2 || table.some((row) => !Array.isArray(row) || row.length < 2)) {
    return { ok: false, reason: "two_by_two_or_larger_table_required" };
  }
  const width = table[0].length;
  if (table.some((row) => row.length !== width || row.some((value) => !Number.isInteger(value) || value < 0))) {
    return { ok: false, reason: "nonnegative_integer_counts_required" };
  }
  const rowTotals = table.map((row) => row.reduce((sum, value) => sum + value, 0));
  const columnTotals = Array.from({ length: width }, (_, column) => table.reduce((sum, row) => sum + row[column], 0));
  const n = rowTotals.reduce((sum, value) => sum + value, 0);
  if (!(n > 0) || rowTotals.some((value) => value === 0) || columnTotals.some((value) => value === 0)) {
    return { ok: false, reason: "empty_margin" };
  }
  const expected = table.map((row, rowIndex) => row.map((_, columnIndex) => rowTotals[rowIndex] * columnTotals[columnIndex] / n));
  const chiSquare = table.reduce((sum, row, rowIndex) => sum + row.reduce((rowSum, observed, columnIndex) => {
    const cellExpected = expected[rowIndex][columnIndex];
    return rowSum + (observed - cellExpected) ** 2 / cellExpected;
  }, 0), 0);
  const df = (table.length - 1) * (width - 1);
  const smallestExpected = Math.min(...expected.flat());
  const isTwoByTwo = table.length === 2 && width === 2;
  const useFisher = isTwoByTwo && STATS.shouldPreferExactTest(rowTotals[0], table[0][0], rowTotals[1], table[1][0]);
  const fisher = useFisher ? STATS.fisherExact2x2(rowTotals[0], table[0][0], rowTotals[1], table[1][0]) : null;
  return {
    ok: true,
    method: useFisher ? "fisher_exact_2x2" : "chi_square",
    n,
    table: table.map((row) => row.slice()),
    expected,
    chiSquare,
    df,
    p: fisher?.pValue ?? 1 - chi2Cdf(chiSquare, df),
    smallestExpected,
    effect: { cramersV: Math.sqrt(chiSquare / (n * Math.min(table.length - 1, width - 1))) },
    fisher,
  };
}
