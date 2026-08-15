import { MMR_STATS } from "./mmmMath";
import { REG_STATS } from "./regMath";
import { studentTp } from "./statPrimitives";

// Kept separate from the estimator so diagnostics remain deterministic and do
// not alter any existing model result. Thresholds are guidance, not proof.
export const DIAG_THRESHOLDS = Object.freeze({
  vifWarn: 5,
  vifSevere: 10,
  cooksDMultiplier: 4,
  dwLow: 1.5,
  dwHigh: 2.5,
  bgAlpha: 0.05,
  inferenceAlpha: 0.05,
  // 상관행렬 판정 임계 — Holm 보정 후 p와 비교한다(§8.6 임계값은 config로).
  correlationAlpha: 0.05,
});

const EMPTY = Object.freeze({
  dw: null,
  dwVerdict: "unknown",
  bg: null,
  leverages: [],
  cooksD: [],
  influential: [],
  qq: { theoretical: [], sample: [] },
  residVsFitted: { x: [], y: [] },
  scaleLocation: { x: [], y: [] },
  studentizedResiduals: [],
  normalityVerdict: "unknown",
  hc3: { valid: false, changedInference: [] },
});

const isFiniteMatrix = (matrix) => Array.isArray(matrix)
  && matrix.length > 0
  && matrix.every((row) => Array.isArray(row) && row.every(Number.isFinite));

function inverseStandardNormal(p) {
  // Acklam rational approximation. Fixed coefficients and Blom positions make
  // Q-Q coordinates deterministic without sampling.
  if (!(p > 0 && p < 1)) return null;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - 0.02425) return -inverseStandardNormal(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function leverageAt(row, XtXi) {
  let total = 0;
  for (let i = 0; i < row.length; i++) {
    let inner = 0;
    for (let j = 0; j < row.length; j++) inner += XtXi[i][j] * row[j];
    total += row[i] * inner;
  }
  return total;
}

function inferenceChanges(fit) {
  if (!fit?.hc3Valid || !Array.isArray(fit.pval) || !Array.isArray(fit.hc3Pval)) return [];
  return fit.pval.reduce((changes, p, index) => {
    const robust = fit.hc3Pval[index];
    if (Number.isFinite(p) && Number.isFinite(robust) && (p < DIAG_THRESHOLDS.inferenceAlpha) !== (robust < DIAG_THRESHOLDS.inferenceAlpha)) changes.push(index);
    return changes;
  }, []);
}

export function computeOlsDiagnostics(fit, X) {
  if (!fit || !Array.isArray(X) || !X.length || !Array.isArray(fit.resid) || !Array.isArray(fit.yhat)
    || fit.resid.length !== X.length || fit.yhat.length !== X.length || !isFiniteMatrix(fit.XtXi)
    || X.some((row) => !Array.isArray(row) || row.length !== fit.XtXi.length || !row.every(Number.isFinite))) {
    return { ...EMPTY };
  }
  const n = X.length;
  const k = Number.isInteger(fit.k) ? fit.k : X[0].length;
  const leverages = Array.isArray(fit.leverages) && fit.leverages.length === n
    ? fit.leverages.slice()
    : X.map((row) => leverageAt(row, fit.XtXi));
  const usableVariance = Number.isFinite(fit.sigma2) && fit.sigma2 > 0 && Number.isFinite(fit.df) && fit.df > 0;
  const cooksD = usableVariance
    ? leverages.map((h, index) => {
      const denom = k * fit.sigma2 * (1 - h) ** 2;
      return Number.isFinite(h) && denom > 0 ? (fit.resid[index] ** 2 * h) / denom : null;
    })
    : Array(n).fill(null);
  const influential = cooksD.reduce((indexes, value, index) => {
    if (Number.isFinite(value) && value > DIAG_THRESHOLDS.cooksDMultiplier / n) indexes.push(index);
    return indexes;
  }, []);
  const dw = MMR_STATS.durbinWatson(fit.resid);
  const dwVerdict = dw == null ? "unknown" : dw < DIAG_THRESHOLDS.dwLow ? "positive" : dw > DIAG_THRESHOLDS.dwHigh ? "negative" : "ok";
  let bg = null;
  if (n > k + 2) {
    const result = MMR_STATS.breuschGodfrey(fit.resid, X, 1);
    if (result && Number.isFinite(result.pValue)) bg = { ...result, lag: 1, verdict: result.pValue < DIAG_THRESHOLDS.bgAlpha ? "warn" : "ok" };
  }
  // Externally studentized residuals use the variance estimated after deleting
  // each observation. They account for leverage, unlike residual / sigma.
  const rss = Number.isFinite(fit.RSS) ? fit.RSS : fit.sigma2 * fit.df;
  const studentizedResiduals = Number.isFinite(rss) && fit.df > 1
    ? fit.resid.map((value, index) => {
      const h = leverages[index];
      const remaining = 1 - h;
      const deletedVariance = remaining > Number.EPSILON ? (rss - value ** 2 / remaining) / (fit.df - 1) : null;
      return Number.isFinite(deletedVariance) && deletedVariance > 0 ? value / Math.sqrt(deletedVariance * remaining) : null;
    })
    : Array(n).fill(null);
  const sample = studentizedResiduals.filter(Number.isFinite).sort((a, b) => a - b);
  const theoretical = sample.map((_, index) => inverseStandardNormal((index + 1 - 0.375) / (sample.length + 0.25)));
  return {
    dw,
    dwVerdict,
    bg,
    leverages,
    cooksD,
    influential,
    // No automated normality badge: Q-Q is visual evidence and normal residuals
    // are not required for OLS coefficient estimation.
    qq: { theoretical, sample },
    residVsFitted: { x: fit.yhat.slice(), y: fit.resid.slice() },
    scaleLocation: { x: fit.yhat.slice(), y: studentizedResiduals.map((value) => Number.isFinite(value) ? Math.sqrt(Math.abs(value)) : null) },
    studentizedResiduals,
    normalityVerdict: "unknown",
    hc3: { valid: fit.hc3Valid === true, changedInference: inferenceChanges(fit) },
  };
}

function isConstantColumn(values) {
  return values.every((value) => Math.abs(value - values[0]) <= 1e-12);
}

export function computeVif(X) {
  if (!Array.isArray(X) || !X.length || X.some((row) => !Array.isArray(row)) || !X.every((row) => row.length === X[0].length)) {
    return { vif: [], maxVif: null, verdict: "unknown", variableIndices: [] };
  }
  const variableIndices = X[0].map((_, index) => index).filter((index) => {
    const values = X.map((row) => row[index]);
    return values.every(Number.isFinite) && !isConstantColumn(values);
  });
  if (variableIndices.length < 2) return { vif: [], maxVif: null, verdict: "not_applicable", variableIndices };
  const vif = variableIndices.map((targetIndex) => {
    const y = X.map((row) => row[targetIndex]);
    const predictors = X.map((row) => [1, ...variableIndices.filter((index) => index !== targetIndex).map((index) => row[index])]);
    const r2 = REG_STATS.r2of(predictors, y);
    return Number.isFinite(r2) && r2 < 1 - 1e-10 ? 1 / (1 - r2) : null;
  });
  const finite = vif.filter(Number.isFinite);
  const maxVif = finite.length === vif.length ? Math.max(...finite) : null;
  const verdict = finite.length !== vif.length ? "severe"
    : maxVif >= DIAG_THRESHOLDS.vifSevere ? "severe"
      : maxVif >= DIAG_THRESHOLDS.vifWarn ? "warn" : "ok";
  return { vif, maxVif, verdict, variableIndices };
}

// ── 상관행렬 + 다중비교 보정 ────────────────────────────────────────────────
// 5-25는 채널쌍 상관계수 r만 화면에 뿌리고 있었다. 채널 5개면 쌍이 10개라
// 우연히 강한 상관 하나쯤은 늘 나오는데, p값도 보정도 없으면 그걸 구분할 근거가
// 화면에 없다. r만 크게 나온 쌍을 "함께 움직인다"고 읽으면 MMM 판단이 어긋난다.
//
// CI는 각 쌍의 **pointwise** 95% 구간이다(Fisher z 변환). Holm은 p값에만 적용하고
// 구간에는 적용하지 않는다 — 5-4가 이미 같은 구분을 화면 문구로 쓰고 있어
// 두 도구가 다른 말을 하지 않게 맞춘다.
export function correlationMatrix(columns = []) {
  const usable = columns.filter((column) => Array.isArray(column?.values) && column.values.every(Number.isFinite));
  if (usable.length < 2) return { n: 0, pairs: [], adjustment: "holm", ciKind: "pointwise", reason: "insufficient_columns" };
  const n = usable[0].values.length;
  if (!usable.every((column) => column.values.length === n)) {
    return { n: 0, pairs: [], adjustment: "holm", ciKind: "pointwise", reason: "ragged_columns" };
  }
  if (n < 3) return { n, pairs: [], adjustment: "holm", ciKind: "pointwise", reason: "insufficient_rows" };

  const pairs = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      pairs.push({ left: usable[i].name, right: usable[j].name, ...pearsonInference(usable[i].values, usable[j].values, n) });
    }
  }
  // 계산 불가(분산 0 등)는 p=1로 밀어 넣지 않고 보정 대상에서 뺀다 — 넣으면
  // 다른 쌍의 보정 강도를 부풀려 실제 신호를 죽인다.
  const testable = pairs.filter((pair) => Number.isFinite(pair.rawP));
  const adjusted = holmAdjustLocal(testable.map((pair) => pair.rawP));
  testable.forEach((pair, index) => {
    pair.holmP = adjusted[index];
    pair.isSignificant = adjusted[index] < DIAG_THRESHOLDS.correlationAlpha;
  });
  pairs.forEach((pair) => {
    if (!Number.isFinite(pair.rawP)) {
      pair.holmP = null;
      pair.isSignificant = false;
    }
  });
  pairs.sort((left, right) => Math.abs(right.r ?? 0) - Math.abs(left.r ?? 0));
  return { n, pairs, adjustment: "holm", ciKind: "pointwise", comparisons: testable.length, reason: null };
}

function pearsonInference(a, b, n) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / n;
  const meanB = b.reduce((sum, value) => sum + value, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let index = 0; index < n; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  // 한쪽이 상수면 상관은 정의되지 않는다. 0으로 접으면 "무관"이라는 **판정**이
  // 되는데 실제로는 "계산 불가"다(§7 미상은 미상 버킷으로).
  if (!(saa > 0) || !(sbb > 0)) {
    return { r: null, t: null, df: n - 2, rawP: null, holmP: null, ciLow: null, ciHigh: null, isSignificant: false };
  }
  const r = Math.max(-1, Math.min(1, sab / Math.sqrt(saa * sbb)));
  const df = n - 2;
  const denom = 1 - r * r;
  const t = denom > 0 ? r * Math.sqrt(df / denom) : (r > 0 ? Infinity : -Infinity);
  const rawP = Number.isFinite(t) ? studentTp(t, df) : 0;
  // Fisher z 구간은 n>3이어야 정의된다.
  let ciLow = null, ciHigh = null;
  if (n > 3 && Math.abs(r) < 1) {
    const z = Math.atanh(r);
    const se = 1 / Math.sqrt(n - 3);
    ciLow = Math.tanh(z - 1.959963984540054 * se);
    ciHigh = Math.tanh(z + 1.959963984540054 * se);
  }
  return { r, t, df, rawP, holmP: null, ciLow, ciHigh, isSignificant: false };
}

// abTestMath.STATS.holmAdjust와 같은 계약. 이 파일이 A/B 엔진 전체를 끌어오지
// 않도록 지역 구현을 두되, 동작 동일성은 modelDiagnostics.test.js가 대조한다.
function holmAdjustLocal(pValues = []) {
  const indexed = pValues
    .map((value, index) => ({ index, value: Number.isFinite(value) ? value : 1 }))
    .sort((left, right) => left.value - right.value);
  const adjusted = new Array(pValues.length).fill(1);
  let previous = 0;
  indexed.forEach((entry, rank) => {
    previous = Math.min(1, Math.max(previous, entry.value * (indexed.length - rank)));
    adjusted[entry.index] = previous;
  });
  return adjusted;
}
