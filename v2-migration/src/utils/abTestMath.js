export const STATS = (() => {
  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741,
      a4 = -1.453152027,
      a5 = 1.061405429,
      p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y =
      1 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-x * x);
    return sign * y;
  }
  function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.SQRT2));
  }

  function normalInverse(p) {
    if (p <= 0 || p >= 1) return NaN;
    const a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
      3.754408661907416,
    ];
    const pLow = 0.02425,
      pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r +
          a[5]) *
          q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]
      ) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  function studentTCDF(t, v) {
    if (v <= 0) return NaN;
    if (v === 1) return 0.5 + Math.atan(t) / Math.PI; // Exact for Cauchy
    if (v > 1000) return normalCDF(t);
    // Hill-Davis (1968) approximation for Student's T CDF
    const t2 = t * t;
    const t4 = t2 * t2;
    const t6 = t4 * t2;
    const z = t * (
      1 
      - (t2 + 3) / (4 * v) 
      + (5 * t4 + 16 * t2 + 3) / (96 * v * v) 
      + (3 * t6 + 19 * t4 + 17 * t2 - 15) / (384 * v * v * v)
    );
    return normalCDF(z);
  }

  function sampleSizePerArm({
    baseline,
    mdeRelative,
    alpha = 0.05,
    power = 0.8,
    twoSided = true,
  }) {
    const p1 = baseline;
    const p2 = baseline * (1 + mdeRelative);
    if (!(p1 > 0) || p1 >= 1 || !(mdeRelative > 0) || p2 <= 0 || p2 >= 1 || !(alpha > 0) || alpha >= 1 || !(power > 0) || power >= 1) {
      return { n: NaN, p1, p2 };
    }
    const pBar = (p1 + p2) / 2;
    const zA = twoSided
      ? normalInverse(1 - alpha / 2)
      : normalInverse(1 - alpha);
    const zB = normalInverse(power);
    const num = 2 * Math.pow(zA + zB, 2) * pBar * (1 - pBar);
    const den = Math.pow(p2 - p1, 2);
    return { n: Math.ceil(num / den), p1, p2, zA, zB };
  }

  function twoPropZTest(nA, xA, nB, xB) {
    if (![nA, xA, nB, xB].every(Number.isFinite) || !(nA > 0) || !(nB > 0) || xA < 0 || xB < 0 || xA > nA || xB > nB) return null;
    const pA = xA / nA,
      pB = xB / nB;
    const pPool = (xA + xB) / (nA + nB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
    const z = se > 0 ? (pB - pA) / se : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));
    const liftAbs = pB - pA;
    const liftRel = pA > 0 ? (pB - pA) / pA : 0;
    const seDiff = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
    const ciLow95 = liftAbs - 1.96 * seDiff;
    const ciHigh95 = liftAbs + 1.96 * seDiff;
    return { pA, pB, liftAbs, liftRel, z, pValue, ciLow95, ciHigh95 };
  }

  function logGamma(z) {
    const coefficients = [
      0.9999999999998099, 676.5203681218851, -1259.1392167224028,
      771.3234287776531, -176.6150291621406, 12.507343278686905,
      -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    const shifted = z - 1;
    let series = coefficients[0];
    for (let i = 1; i < coefficients.length; i++) series += coefficients[i] / (shifted + i);
    const t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
  }

  const logBeta = (a, b) => logGamma(a) + logGamma(b) - logGamma(a + b);

  function betaContinuedFraction(a, b, x) {
    const fpMin = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < fpMin) d = fpMin;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 240; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 3e-12) break;
    }
    return h;
  }

  function betaCdf(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const logFront = a * Math.log(x) + b * Math.log1p(-x) - logBeta(a, b);
    const front = Math.exp(logFront);
    const value = x < (a + 1) / (a + b + 2)
      ? (front * betaContinuedFraction(a, b, x)) / a
      : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
    return Math.min(1, Math.max(0, value));
  }

  function betaQuantile(probability, a, b) {
    if (probability <= 0) return 0;
    if (probability >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 72; i++) {
      const mid = (lo + hi) / 2;
      if (betaCdf(mid, a, b) < probability) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function logAddExp(a, b) {
    if (a === -Infinity) return b;
    const hi = Math.max(a, b);
    return hi + Math.log1p(Math.exp(Math.min(a, b) - hi));
  }

  // Exact finite sum for integer Beta shapes (Cook, 2005). The recurrence
  // avoids repeatedly subtracting very large log-gamma values.
  function betaGreaterInteger(aX, bX, aY, bY) {
    let logTerm = logBeta(aY, bX + bY) - logBeta(aY, bY);
    let logSum = -Infinity;
    for (let i = 0; i < aX; i++) {
      logSum = logAddExp(logSum, logTerm);
      if (i + 1 < aX) {
        logTerm += Math.log(aY + i) + Math.log(bX + i)
          - Math.log(aY + bX + bY + i) - Math.log(i + 1);
      }
    }
    return Math.min(1, Math.max(0, Math.exp(logSum)));
  }

  function betaGreaterAdaptive(aB, bB, aA, bA, gridN) {
    const tail = 1e-8;
    const lo = Math.min(betaQuantile(tail, aA, bA), betaQuantile(tail, aB, bB));
    const hi = Math.max(betaQuantile(1 - tail, aA, bA), betaQuantile(1 - tail, aB, bB));
    const width = Math.max(1e-15, hi - lo);
    let maxLog = -Infinity;
    const points = new Array(gridN);
    for (let i = 0; i < gridN; i++) {
      const x = lo + ((i + 0.5) / gridN) * width;
      const logWeight = (aB - 1) * Math.log(x) + (bB - 1) * Math.log1p(-x) - logBeta(aB, bB);
      points[i] = [x, logWeight];
      if (logWeight > maxLog) maxLog = logWeight;
    }
    let numerator = 0;
    let denominator = 0;
    for (const [x, logWeight] of points) {
      const weight = Math.exp(logWeight - maxLog);
      numerator += weight * betaCdf(x, aA, bA);
      denominator += weight;
    }
    return denominator > 0 ? numerator / denominator : 0.5;
  }

  function betaProbGreater(aB, bB, aA, bA, gridN) {
    const shapes = [aB, bB, aA, bA];
    if (shapes.every((value) => Number.isInteger(value) && value > 0)) {
      const candidates = [
        { count: aB, run: () => betaGreaterInteger(aB, bB, aA, bA) },
        { count: aA, run: () => 1 - betaGreaterInteger(aA, bA, aB, bB) },
        { count: bA, run: () => betaGreaterInteger(bA, aA, bB, aB) },
        { count: bB, run: () => 1 - betaGreaterInteger(bB, aB, bA, aA) },
      ].sort((left, right) => left.count - right.count);
      if (candidates[0].count <= 50000) return Math.min(1, Math.max(0, candidates[0].run()));
    }
    const meanA = aA / (aA + bA);
    const meanB = aB / (aB + bB);
    const varA = (aA * bA) / ((aA + bA) ** 2 * (aA + bA + 1));
    const varB = (aB * bB) / ((aB + bB) ** 2 * (aB + bB + 1));
    if (Math.min(...shapes) > 80) return normalCDF((meanB - meanA) / Math.sqrt(varA + varB));
    return betaGreaterAdaptive(aB, bB, aA, bA, gridN);
  }

  function bayesianAB({
    nA,
    xA,
    nB,
    xB,
    sims = 10000,
    priorAlpha = 1,
    priorBeta = 1,
  }) {
    const aA = priorAlpha + xA,
      bA = priorBeta + (nA - xA);
    const aB = priorAlpha + xB,
      bB = priorBeta + (nB - xB);
    const gridN = Math.max(800, Math.min(4000, Math.round(sims / 5)));
    const meanA = aA / (aA + bA);
    const meanB = aB / (aB + bB);
    const probBWins = betaProbGreater(aB, bB, aA, bA, gridN);
    return {
      probBWins: Math.min(1, Math.max(0, probBWins)),
      // Posterior-mean ratio is finite even when the control has zero observed
      // conversions. E[B/A] itself can diverge under the default Beta(1,1)
      // prior, which would create an impressive-looking but meaningless lift.
      expectedLift: meanA > 0 ? meanB / meanA - 1 : null,
      ciA: [betaQuantile(0.025, aA, bA), betaQuantile(0.975, aA, bA)],
      ciB: [betaQuantile(0.025, aB, bB), betaQuantile(0.975, aB, bB)],
    };
  }

  function sampleSizeContinuous({
    baselineMean,
    mdeRelative,
    sigma,
    alpha = 0.05,
    power = 0.8,
    twoSided = true,
  }) {
    const delta = baselineMean * mdeRelative;
    if (!(baselineMean > 0) || !(mdeRelative > 0) || !(sigma > 0) || !(alpha > 0) || alpha >= 1 || !(power > 0) || power >= 1) {
      return { n: NaN, delta, sigma };
    }
    const zA = twoSided
      ? normalInverse(1 - alpha / 2)
      : normalInverse(1 - alpha);
    const zB = normalInverse(power);
    const num = 2 * Math.pow(zA + zB, 2) * sigma * sigma;
    const den = delta * delta;
    return { n: Math.ceil(num / den), delta, sigma, zA, zB };
  }

  function continuousTest(nA, meanA, sdA, nB, meanB, sdB) {
    if (![nA, meanA, sdA, nB, meanB, sdB].every(Number.isFinite) || !(nA >= 2) || !(nB >= 2) || sdA < 0 || sdB < 0 || (sdA === 0 && sdB === 0)) {
      return { ok: false, reason: "insufficient_variation" };
    }
    const seA2 = (sdA * sdA) / nA;
    const seB2 = (sdB * sdB) / nB;
    const se = Math.sqrt(seA2 + seB2);
    const z = se > 0 ? (meanB - meanA) / se : 0; // z is actually t-statistic here
    const df =
      (seA2 + seB2) ** 2 /
      ((seA2 * seA2) / Math.max(1, nA - 1) + (seB2 * seB2) / Math.max(1, nB - 1));
    const pValue = 2 * (1 - studentTCDF(Math.abs(z), df));
    const liftAbs = meanB - meanA;
    const liftRel = meanA > 0 ? (meanB - meanA) / meanA : 0;
    
    // Calculate critical t-value for 95% CI (two-tailed). Since normalInverse is standard normal,
    // we use a simple normal approx for CI bound if df is large, else we could invert the t-dist.
    // For simplicity and speed, we will approximate t-critical for 95% CI
    // t_crit ~ z_crit + (z_crit^3 + z_crit)/(4*df)
    const zCrit = 1.95996;
    const tCrit = zCrit + (Math.pow(zCrit, 3) + zCrit) / (4 * df);
    
    const ciLow95 = liftAbs - tCrit * se;
    const ciHigh95 = liftAbs + tCrit * se;
    return {
      ok: true,
      meanA,
      meanB,
      sdA,
      sdB,
      liftAbs,
      liftRel,
      z,
      pValue,
      ciLow95,
      ciHigh95,
      df,
    };
  }

  function budgetForTest({ nPerArm, cprA, cprB }) {
    const cprBuse = cprB != null && !isNaN(cprB) ? cprB : cprA;
    const costA = nPerArm * cprA;
    const costB = nPerArm * cprBuse;
    return { costA, costB, total: costA + costB, cprA, cprB: cprBuse };
  }

  function massReadout(arms) {
    const control = arms.find((a) => a.isControl);
    if (!control || !control.n || control.n <= 0)
      return { control: null, rows: [] };
    const rows = arms.map((a) => {
      if (a === control) {
        return {
          name: a.name,
          n: a.n,
          x: a.x,
          isControl: true,
          rate: a.n > 0 ? a.x / a.n : 0,
          liftRel: 0,
          z: 0,
          pValue: 1,
          rawPValue: 1,
          ciLow95: 0,
          ciHigh95: 0,
          probBWins: 0.5,
          sig: false,
        };
      }
      const freq = twoPropZTest(control.n, control.x, a.n, a.x);
      // Reuse the same posterior engine as the two-arm readout. The legacy
      // creative grid integrates over all of [0,1] and collapses sparse,
      // million-row posteriors into one bin, which can reverse the verdict.
      const probBWins = betaProbGreater(
        a.x + 1,
        a.n - a.x + 1,
        control.x + 1,
        control.n - control.x + 1,
        2000,
      );
      return {
        name: a.name,
        n: a.n,
        x: a.x,
        isControl: false,
        rate: freq.pB,
        liftRel: freq.liftRel,
        z: freq.z,
        pValue: freq.pValue,
        rawPValue: freq.pValue,
        ciLow95: freq.ciLow95,
        ciHigh95: freq.ciHigh95,
        probBWins,
        sig: freq.pValue < 0.05,
      };
    });
    const variants = rows.filter((row) => !row.isControl).sort((a, b) => a.rawPValue - b.rawPValue);
    let previousAdjusted = 0;
    variants.forEach((row, index) => {
      const adjusted = Math.min(1, Math.max(previousAdjusted, row.rawPValue * (variants.length - index)));
      row.pValue = adjusted;
      row.sig = adjusted < 0.05;
      previousAdjusted = adjusted;
    });
    return { control, rows };
  }

  function mdeForSampleSize({
    baseline,
    n,
    alpha = 0.05,
    power = 0.8,
    twoSided = true,
    maxMde = 5,
  }) {
    if (!(baseline > 0) || baseline >= 1 || !(n > 0)) return NaN;
    let lo = 1e-6,
      hi = maxMde;
    for (let i = 0; i < 30; i++) {
      const nHi = sampleSizePerArm({
        baseline,
        mdeRelative: hi,
        alpha,
        power,
        twoSided,
      }).n;
      if (isFinite(nHi) && nHi <= n) break;
      hi *= 1.6;
      if (hi > 50) break;
    }
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const r = sampleSizePerArm({
        baseline,
        mdeRelative: mid,
        alpha,
        power,
        twoSided,
      });
      if (!isFinite(r.n) || isNaN(r.n) || r.n > n) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  function powerCurve({
    baseline,
    alpha = 0.05,
    power = 0.8,
    points = 24,
    nMin = 200,
    nMax = 200000,
  }) {
    const out = [];
    const logMin = Math.log(nMin),
      logMax = Math.log(nMax);
    for (let i = 0; i < points; i++) {
      const n = Math.round(
        Math.exp(logMin + ((logMax - logMin) * i) / (points - 1)),
      );
      const mde = mdeForSampleSize({ baseline, n, alpha, power });
      out.push({ n, mdePct: isFinite(mde) ? mde * 100 : null });
    }
    return out;
  }

  return {
    normalCDF,
    normalInverse,
    studentTCDF,
    sampleSizePerArm,
    twoPropZTest,
    bayesianAB,
    sampleSizeContinuous,
    continuousTest,
    budgetForTest,
    massReadout,
    mdeForSampleSize,
    powerCurve,
  };
})();
