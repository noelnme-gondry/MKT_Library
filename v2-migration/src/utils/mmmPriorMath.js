import { mmmOls } from "./regMath";
import { mmmAdstock, mmmHill } from "./mmmMath";

// 실험 원자료를 MMM 채널계수 prior로 바꾸는 순수 엔진.
// 점추정·표본 수로 임의 강도를 주지 않고, 실험 효과와 실제 집행 강도의 불확실성을
// 같은 설계에서 추정해 delta method(보수적으로 jackknife와 큰 쪽)로 전파한다.

function num(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isTreated(value) {
  return /^(on|treat|treatment|1|처리|처리군)$/i.test(String(value ?? "").trim());
}

function isPost(value) {
  return /^(post|after|1|사후)$/i.test(String(value ?? "").trim());
}

function matrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function addOuter(target, left, right, scale) {
  for (let i = 0; i < left.length; i++) {
    for (let j = 0; j < right.length; j++) target[i][j] += scale * left[i] * right[j];
  }
}

function matmul(left, right) {
  return left.map((row) => right[0].map((_, j) => row.reduce((sum, value, k) => sum + value * right[k][j], 0)));
}

function sandwichSe(inv, meat, correction = 1) {
  const covariance = matmul(matmul(inv, meat), inv).map((row) => row.map((value) => value * correction));
  return covariance.map((row, i) => Math.sqrt(Math.max(0, row[i])));
}

function hacSe(fit, X) {
  const n = X.length;
  const p = X[0].length;
  const lag = Math.min(n - 1, Math.max(0, Math.floor(4 * Math.pow(n / 100, 2 / 9))));
  const meat = matrix(p);
  fit.resid.forEach((residual, i) => addOuter(meat, X[i], X[i], residual * residual));
  for (let l = 1; l <= lag; l++) {
    const weight = 1 - l / (lag + 1);
    for (let i = l; i < n; i++) {
      const scale = weight * fit.resid[i] * fit.resid[i - l];
      addOuter(meat, X[i], X[i - l], scale);
      addOuter(meat, X[i - l], X[i], scale);
    }
  }
  return sandwichSe(fit.XtXinv, meat, n / Math.max(1, n - p));
}

function clusterSe(fit, X, clusterKeys) {
  const groups = new Map();
  X.forEach((row, i) => {
    const key = String(clusterKeys[i] ?? "");
    const score = groups.get(key) || Array(row.length).fill(0);
    row.forEach((value, j) => { score[j] += value * fit.resid[i]; });
    groups.set(key, score);
  });
  const count = groups.size;
  if (count < 4) return null;
  const meat = matrix(X[0].length);
  groups.forEach((score) => addOuter(meat, score, score, 1));
  const n = X.length, p = X[0].length;
  return sandwichSe(fit.XtXinv, meat, (count / (count - 1)) * ((n - 1) / Math.max(1, n - p)));
}

function fitWithDesignSe(X, y, method, clusterKeys) {
  const fit = mmmOls(X, y);
  if (!fit) return null;
  let se = fit.se;
  let ciMethod = "OLS";
  if (method === "cluster") {
    const clustered = clusterSe(fit, X, clusterKeys || []);
    if (clustered?.every(Number.isFinite)) {
      se = clustered;
      ciMethod = "Geo cluster-robust";
    }
  } else if (method === "hac") {
    const robust = hacSe(fit, X);
    if (robust.every(Number.isFinite)) {
      se = robust;
      ciMethod = "HAC";
    }
  }
  return { ...fit, se, ciMethod };
}

function ratioEstimate(X, target, exposure, effectIndex, method, clusterKeys) {
  const effectFit = fitWithDesignSe(X, target, method, clusterKeys);
  const exposureFit = fitWithDesignSe(X, exposure, method, clusterKeys);
  if (!effectFit || !exposureFit) return null;
  const effect = effectFit.beta[effectIndex];
  const exposureEffect = exposureFit.beta[effectIndex];
  const effectSe = effectFit.se[effectIndex];
  const exposureSe = exposureFit.se[effectIndex];
  if (![effect, exposureEffect, effectSe, exposureSe].every(Number.isFinite) || Math.abs(exposureEffect) < 1e-8) return null;
  const mean = effect / exposureEffect;
  const deltaVariance = (effectSe / exposureEffect) ** 2 + ((effect * exposureSe) / (exposureEffect ** 2)) ** 2;
  return { mean, effect, effectSe, exposureEffect, exposureSe, variance: Math.max(0, deltaVariance), ciMethod: effectFit.ciMethod };
}

function jackknifeSe(X, target, exposure, effectIndex, method, clusterKeys) {
  const n = X.length;
  const p = X[0].length;
  const blocks = Math.min(6, Math.floor(n / Math.max(5, p + 2)));
  if (blocks < 3) return null;
  const estimates = [];
  for (let block = 0; block < blocks; block++) {
    const start = Math.floor((block * n) / blocks);
    const end = Math.floor(((block + 1) * n) / blocks);
    const keep = Array.from({ length: n }, (_, i) => i).filter((i) => i < start || i >= end);
    const estimate = ratioEstimate(
      keep.map((i) => X[i]),
      keep.map((i) => target[i]),
      keep.map((i) => exposure[i]),
      effectIndex,
      method,
      keep.map((i) => clusterKeys?.[i]),
    );
    if (estimate && Number.isFinite(estimate.mean)) estimates.push(estimate.mean);
  }
  if (estimates.length < 3) return null;
  const mean = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
  return Math.sqrt(((estimates.length - 1) / estimates.length) * estimates.reduce((sum, value) => sum + (value - mean) ** 2, 0));
}

function sortRows(rows, timeHeader) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => String(a.row[timeHeader] ?? a.index).localeCompare(String(b.row[timeHeader] ?? b.index)) || a.index - b.index);
}

// On/Off 또는 Geo DiD 원자료 → Normal(mean, variance) prior.
// `params`는 현재 타깃 MMM의 대표 adstock/Hill 변환이며, 처리강도는 원 spend가 아닌
// 그 변환 후의 treatment contrast로 계산한다.
export function buildExperimentMediaPrior(rows, {
  targetHeader,
  spendHeader,
  stateHeader = null,
  armHeader = null,
  periodHeader = null,
  timeHeader = null,
  geoHeader = null,
  params,
} = {}) {
  if (!rows?.length || !targetHeader || !spendHeader || !params) return null;
  const ordered = sortRows(rows, timeHeader);
  const usable = ordered.filter(({ row }) => Number.isFinite(num(row[targetHeader])) && Number.isFinite(num(row[spendHeader])));
  if (usable.length < 8) return null;
  const spend = usable.map(({ row }) => num(row[spendHeader]));
  const exposure = mmmAdstock(spend, params.alpha).map((value) => mmmHill(value, params.ec, params.slope));
  const target = usable.map(({ row }) => num(row[targetHeader]));
  let X = null;
  let effectIndex = -1;
  let method = "hac";
  let clusterKeys = null;
  let design = null;
  if (armHeader && periodHeader) {
    const treated = usable.map(({ row }) => (isTreated(row[armHeader]) ? 1 : 0));
    const post = usable.map(({ row }) => (isPost(row[periodHeader]) ? 1 : 0));
    if (!treated.some(Boolean) || treated.every(Boolean) || !post.some(Boolean) || post.every(Boolean)) return null;
    X = usable.map((_, i) => [1, treated[i], post[i], treated[i] * post[i]]);
    effectIndex = 3;
    method = geoHeader ? "cluster" : "hac";
    clusterKeys = usable.map(({ row }) => row[geoHeader || armHeader]);
    design = "Geo DiD";
  } else if (stateHeader) {
    const on = usable.map(({ row }) => (isTreated(row[stateHeader]) ? 1 : 0));
    if (!on.some(Boolean) || on.every(Boolean)) return null;
    X = usable.map((_, i) => [1, i, Math.sin((2 * Math.PI * i) / 52), Math.cos((2 * Math.PI * i) / 52), on[i]]);
    effectIndex = 4;
    design = "On/Off";
  } else {
    return null;
  }
  const estimate = ratioEstimate(X, target, exposure, effectIndex, method, clusterKeys);
  if (!estimate) return null;
  const jackknife = jackknifeSe(X, target, exposure, effectIndex, method, clusterKeys);
  const variance = Math.max(estimate.variance, Number.isFinite(jackknife) ? jackknife ** 2 : 0);
  if (!(variance > 0) || !Number.isFinite(variance)) return null;
  const se = Math.sqrt(variance);
  return {
    mean: estimate.mean,
    variance,
    precision: 1 / variance,
    se,
    ci90: [estimate.mean - 1.645 * se, estimate.mean + 1.645 * se],
    effect: estimate.effect,
    effectSe: estimate.effectSe,
    exposureEffect: estimate.exposureEffect,
    exposureSe: estimate.exposureSe,
    treatmentIntensity: estimate.exposureEffect,
    design,
    ciMethod: jackknife ? `${estimate.ciMethod} + block jackknife` : estimate.ciMethod,
    n: usable.length,
  };
}

// 최근 한 번의 holdout 운에 기대지 않도록, 12주 창을 과거로 이동시켜 반복 검증한다.
export function mmmRollingOrigins(n, { holdout = 12, minTrain = 24, stride = 8, maxFolds = 3 } = {}) {
  const starts = [];
  for (let cut = n - holdout; cut >= minTrain && starts.length < maxFolds; cut -= stride) starts.push({ cut, holdout });
  return starts;
}

export function summarizeRollingErrors(errors, complexity = 1) {
  const finite = (errors || []).filter(Number.isFinite);
  if (!finite.length) return null;
  const meanRmse = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const sdRmse = Math.sqrt(finite.reduce((sum, value) => sum + (value - meanRmse) ** 2, 0) / finite.length);
  return {
    folds: finite.length,
    meanRmse,
    sdRmse,
    // 불안정한 조합과 불필요하게 큰 국가 세트가 한 번의 우연한 승리로 선택되지 않게 한다.
    score: (meanRmse + 0.25 * sdRmse) * (1 + 0.015 * Math.max(0, complexity - 1)),
  };
}
