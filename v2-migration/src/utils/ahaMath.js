/* ----- 컬럼 자동 그룹핑: header → { action, window }.
 * 정규식 ^(.*?)[_-]?d(\d+)$ (대소문자 무시). 매치 안 되면 window=Infinity(단일 윈도우 액션).
 * (index.html ahaParseActionWindow ~30956 verbatim) */
export function ahaParseActionWindow(header) {
  const m = String(header).match(/^(.*?)[_-]?d(\d+)$/i);
  if (m && m[1]) return { action: m[1], window: parseInt(m[2], 10) };
  return { action: String(header), window: Infinity };
}

export const AHA_STATS = (() => {
  function f1(p, r) {
    if (!(p + r > 0)) return 0;
    return (2 * p * r) / (p + r);
  }

  function lift(precision, baseRate) {
    if (!(baseRate > 0)) return null;
    return precision / baseRate;
  }

  function _hashIdx(i, seed) {
    let h = (i * 2654435761 + seed * 40503) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return (h >>> 0) / 4294967296;
  }

  function splitDeterministic(n, seed) {
    const train = [],
      holdout = [];
    for (let i = 0; i < n; i++)
      (_hashIdx(i, seed) < 0.5 ? train : holdout).push(i);
    return { train, holdout };
  }

  function bestThreshold(values, targets, idx, minSupport) {
    const pts = idx
      .map((i) => ({ v: values[i], t: targets[i] }))
      .filter((p) => p.v > 0);
    if (!pts.length) return null;
    pts.sort((a, b) => b.v - a.v);
    const totalPos = idx.reduce((s, i) => s + (targets[i] ? 1 : 0), 0);
    const uniqVals = [...new Set(pts.map((p) => p.v))].sort(
      (a, b) => b - a,
    );
    let cumTP = 0,
      cumN = 0,
      vi = 0;
    let best = null,
      bestAnySupport = null;
    for (const k of uniqVals) {
      while (vi < pts.length && pts[vi].v >= k) {
        cumN++;
        if (pts[vi].t) cumTP++;
        vi++;
      }
      const TP = cumTP,
        FP = cumN - cumTP,
        FN = totalPos - cumTP;
      const support = TP + FP;
      const P = support > 0 ? TP / support : 0;
      const R = TP + FN > 0 ? TP / (TP + FN) : 0;
      const F1 = f1(P, R);
      const cand = { k, P, R, F1, support, TP, FP, FN };
      if (
        !bestAnySupport ||
        cand.F1 > bestAnySupport.F1 ||
        (cand.F1 === bestAnySupport.F1 &&
          cand.support > bestAnySupport.support)
      )
        bestAnySupport = cand;
      if (support >= minSupport) {
        if (
          !best ||
          cand.F1 > best.F1 ||
          (cand.F1 === best.F1 && cand.support > best.support)
        )
          best = cand;
      }
    }
    if (!best) return { ...bestAnySupport, gated: true };
    return { ...best, gated: false };
  }

  // holdoutIdx 위에서 고정 임계값 k의 P/R/F1/support 재평가 (여러 윈도우에
  // 각각 적용하기 위해 gridSearch에서 분리 — 원래는 승자 윈도우 1개만 계산했음).
  function evalHoldout(vals, targets, holdoutIdx, k) {
    let TP = 0, FP = 0, FN = 0;
    for (const i of holdoutIdx) {
      const v = vals[i] || 0, t = targets[i];
      if (v >= k) { if (t) TP++; else FP++; }
      else if (t) FN++;
    }
    const support = TP + FP;
    const P = support > 0 ? TP / support : 0;
    const R = TP + FN > 0 ? TP / (TP + FN) : 0;
    return { P, R, F1: f1(P, R), support };
  }

  // 전체 모집단(학습/홀드아웃 구분 없이 전 유저) 중 값이 k 이상인 인원·비율.
  // "전체 유저 중 몇 명이 이 조건을 채우나"는 타깃(정착 여부)과 무관한 순수
  // 분포 통계라 train/holdout split과 별개로 계산.
  function coverage(valuesAll, k) {
    const n = valuesAll.length;
    if (!n) return { allSupport: 0, allPct: 0 };
    const allSupport = valuesAll.reduce((s, v) => s + ((v || 0) >= k ? 1 : 0), 0);
    return { allSupport, allPct: allSupport / n };
  }

  function gridSearch(
    windowCols,
    targets,
    trainIdx,
    holdoutIdx,
    minSupport,
  ) {
    let bestW = null;
    const grid = [];
    for (const wc of windowCols) {
      const tr = bestThreshold(
        wc.valuesAll,
        targets,
        trainIdx,
        minSupport,
      );
      if (tr) {
        const ho = evalHoldout(wc.valuesAll, targets, holdoutIdx, tr.k);
        const cov = coverage(wc.valuesAll, tr.k);
        grid.push({
          window: wc.window,
          header: wc.header,
          k: tr.k,
          F1: tr.F1,
          P: tr.P,
          R: tr.R,
          support: tr.support,
          gated: tr.gated,
          // 이 윈도우를 D1/D7 토글로 직접 선택했을 때 쓸 홀드아웃 재평가값
          // (기존엔 우승 윈도우 1개만 갖고 있어 다른 윈도우 선택 시 지표가 없었음).
          holdout: ho,
          allSupport: cov.allSupport,
          allPct: cov.allPct,
        });
        if (
          !bestW ||
          tr.F1 > bestW.train.F1 ||
          (tr.F1 === bestW.train.F1 && tr.support > bestW.train.support)
        ) {
          bestW = {
            window: wc.window,
            header: wc.header,
            k: tr.k,
            train: tr,
            holdout: ho,
            allSupport: cov.allSupport,
            allPct: cov.allPct,
          };
        }
      }
    }
    if (!bestW) return null;
    return {
      bestWindow: bestW.window,
      bestHeader: bestW.header,
      bestK: bestW.k,
      train: {
        P: bestW.train.P,
        R: bestW.train.R,
        F1: bestW.train.F1,
        support: bestW.train.support,
      },
      holdout: bestW.holdout,
      allSupport: bestW.allSupport,
      allPct: bestW.allPct,
      gated: bestW.train.gated,
      grid,
    };
  }

  // 고정 윈도우 안에서 k(최소 횟수)를 바꿔가며 P/R/F1·표본·전체유저비중이 어떻게
  // 변하는지 전 구간 스윕(§"300회 vs 100회 vs 50회면 어느 정도인지" 요청).
  // bestThreshold와 같은 누적 계산이지만 최적 1개만 남기지 않고 전 후보를 반환.
  function thresholdSweep(valuesAll, targets, idx, minSupport) {
    const pts = idx
      .map((i) => ({ v: valuesAll[i] || 0, t: targets[i] }))
      .filter((p) => p.v > 0);
    const n = valuesAll.length;
    if (!pts.length) return [];
    pts.sort((a, b) => b.v - a.v);
    const totalPos = idx.reduce((s, i) => s + (targets[i] ? 1 : 0), 0);
    const uniqVals = [...new Set(pts.map((p) => p.v))].sort((a, b) => b - a);
    let cumTP = 0, cumN = 0, vi = 0;
    const out = [];
    for (const k of uniqVals) {
      while (vi < pts.length && pts[vi].v >= k) {
        cumN++;
        if (pts[vi].t) cumTP++;
        vi++;
      }
      const TP = cumTP, FP = cumN - cumTP, FN = totalPos - cumTP;
      const support = TP + FP;
      const P = support > 0 ? TP / support : 0;
      const R = TP + FN > 0 ? TP / (TP + FN) : 0;
      const cov = coverage(valuesAll, k);
      out.push({
        k, P, R, F1: f1(P, R), support,
        gated: support < minSupport,
        allSupport: cov.allSupport,
        allPct: cov.allPct,
      });
    }
    return out.reverse(); // k 오름차순(작은 횟수 → 큰 횟수)으로 반환
  }

  return { f1, lift, splitDeterministic, bestThreshold, gridSearch, thresholdSweep, coverage };
})();
