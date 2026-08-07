/*
 * MMM T2 — 비선형 변환 파라미터(adstock α · 반포화점 ec · Hill slope)의 불확실성.
 *
 * 배경: 엔진은 (α, ec, slope) 그리드 후보를 각각 적합하고 BIC 가중치로 모델평균한다
 * (mmmMath.js _mmmBayesTransformUncertainty). 지금까지 파라미터는 점추정만 표시했다.
 * T2는 이 프로파일 그리드로부터 각 파라미터의 90% 구간을 유도한다 — 순수 표시층
 * 헬퍼라 엔진 적합/골든에 영향 없음(모델은 이미 계산된 값).
 *
 * 방법: 가중치 w_i ∝ exp(-0.5·BIC_i) 이므로 nll_i = -2·ln(w_i) = BIC_i + const.
 * 각 파라미터에 대해 나머지를 프로파일 아웃(같은 값에서 최소 nll)한 뒤,
 *  - 최빈값이 내부(양쪽 이웃 존재)면 국소 2차식 곡률로 Laplace 근사 SD = 1/√a
 *    (nll(p) ≈ nll* + a·(p−p*)², a = 1/σ²).
 *  - 그리드가 성기거나 최빈값이 경계면 이산 가중 SD로 폴백(gridLimited 플래그).
 * 구간은 관측 그리드 범위로 clamp(밖으로 외삽하지 않음, 정직성 §8).
 * 결정론: 입력(weights)이 결정론이라 출력도 byte-동일.
 */

function _paramUncertainty(models, key) {
  const pts = models
    .map((m) => ({ v: Number(m[key]), w: Number(m.weight) || 0 }))
    .filter((p) => isFinite(p.v) && p.w > 0);
  if (!pts.length) return null;

  const mode = pts.reduce((best, p) => (p.w > best.w ? p : best), pts[0]);

  // 파라미터 값별 프로파일 nll(같은 값에서 최소 nll = 최대 가중).
  const byVal = new Map();
  for (const p of pts) {
    const nll = -2 * Math.log(Math.max(p.w, 1e-300));
    if (!byVal.has(p.v) || nll < byVal.get(p.v)) byVal.set(p.v, nll);
  }
  const vals = [...byVal.keys()].sort((a, b) => a - b);
  const gridLo = vals[0];
  const gridHi = vals[vals.length - 1];

  // 값이 1개뿐 → 프로파일 불가(변환 고정).
  if (vals.length < 2) {
    return { value: mode.v, sd: 0, ci90: [mode.v, mode.v], method: "fixed", gridLimited: false, gridLo, gridHi };
  }

  // 이산 가중 평균/표준편차(폴백).
  const wSum = pts.reduce((s, p) => s + p.w, 0) || 1;
  const wMean = pts.reduce((s, p) => s + p.w * p.v, 0) / wSum;
  const gridSd = Math.sqrt(Math.max(0, pts.reduce((s, p) => s + p.w * (p.v - wMean) ** 2, 0) / wSum));

  // Laplace: 최빈값이 내부일 때 국소 2차식 곡률.
  let laplaceSd = null;
  const mi = vals.indexOf(mode.v);
  if (mi > 0 && mi < vals.length - 1) {
    const p0 = vals[mi];
    const nll0 = byVal.get(p0);
    const dLo = byVal.get(vals[mi - 1]) - nll0;
    const dHi = byVal.get(vals[mi + 1]) - nll0;
    const hLo = p0 - vals[mi - 1];
    const hHi = vals[mi + 1] - p0;
    if (dLo > 0 && dHi > 0 && hLo > 0 && hHi > 0) {
      // nll(p) ≈ nll0 + a·(p−p0)²,  a ≈ 평균(d/h²) = 1/σ²  →  SD = 1/√a.
      const a = 0.5 * (dLo / (hLo * hLo) + dHi / (hHi * hHi));
      if (a > 0 && isFinite(a)) laplaceSd = 1 / Math.sqrt(a);
    }
  }

  const useLaplace = laplaceSd != null && isFinite(laplaceSd) && laplaceSd > 0;
  const sd = useLaplace ? laplaceSd : gridSd;
  let lo = mode.v - 1.645 * sd;
  let hi = mode.v + 1.645 * sd;
  let clamped = false;
  if (lo < gridLo) { lo = gridLo; clamped = true; }
  if (hi > gridHi) { hi = gridHi; clamped = true; }
  return {
    value: mode.v,
    sd,
    ci90: [lo, hi],
    method: useLaplace ? "laplace" : "grid-weighted",
    gridLimited: !useLaplace || clamped,
    gridLo,
    gridHi,
  };
}

/**
 * @param {Array<{alpha:number, ec:number, slope:number, weight:number}>} models
 *   _mmmBayesTransformUncertainty 프로파일(가중치 포함).
 * @returns {{alpha, ec, slope}|null} 각 파라미터의 {value, sd, ci90, method, gridLimited} 또는 null.
 */
export function mmmNonlinearLaplace(models) {
  if (!Array.isArray(models) || !models.length) return null;
  return {
    alpha: _paramUncertainty(models, "alpha"),
    ec: _paramUncertainty(models, "ec"),
    slope: _paramUncertainty(models, "slope"),
  };
}
