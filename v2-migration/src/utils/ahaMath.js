/* ----- 컬럼 자동 그룹핑: header → { action, window }.
 * D1/D7 윈도우 표기를 접미/접두·숫자순서·day/일 변형까지 넓게 자동 인식(대소문자 무시).
 * 어느 패턴도 안 맞으면 window=Infinity(단일 윈도우 액션). action이 비면 파싱 실패로 간주.
 * 원 index.html은 접미사 `_dN`만 지원(`^(.*?)[_-]?d(\d+)$`) — 실데이터 관용표기(d7_invite,
 * invite_7d, invite_day7, invite_7일 등)가 전체 윈도우로 잡히던 문제를 확장. 순수·결정론.
 *   지원: invite_d7 / invited7 / invite_7d / invite_day7 / invite_7day / invite_7일
 *         d7_invite / d7invite / 7d_invite / 7일_invite */
export function ahaParseActionWindow(header) {
  const h = String(header).trim();
  const ok = (action, win) => (action && action.trim() ? { action: action.trim(), window: win } : null);
  // 접미사 계열 (숫자 뒤): action[_-]?dN  — 원 동작 우선(골든 유지).
  let m = h.match(/^(.*?)[_-]?d(\d+)$/i);
  let r = m && ok(m[1], parseInt(m[2], 10));
  if (r) return r;
  m = h.match(/^(.*?)[_-]?day(\d+)$/i); // action_day7
  r = m && ok(m[1], parseInt(m[2], 10));
  if (r) return r;
  m = h.match(/^(.*?)[_-]?(\d+)(?:d|day|일)$/i); // action_7d / action7day / action_7일
  r = m && ok(m[1], parseInt(m[2], 10));
  if (r) return r;
  // 접두사 계열 (숫자 앞): dN[_-]?action / Nd[_-]?action
  m = h.match(/^d(\d+)[_-]?(.+)$/i); // d7_invite / d7invite
  r = m && ok(m[2], parseInt(m[1], 10));
  if (r) return r;
  m = h.match(/^(\d+)(?:d|day|일)[_-]?(.+)$/i); // 7d_invite / 7일_invite
  r = m && ok(m[2], parseInt(m[1], 10));
  if (r) return r;
  return { action: h, window: Infinity };
}

/* 렌더층 헬퍼(엔진 AHA_STATS 불변): thresholdSweep 결과를 "달성률(=전체 유저 중 그 조건을
 * 채우는 비율)" stepPct(기본 5%) 구간으로 접어 대표점 1개씩 반환. 임계 k를 낮출수록 달성률이
 * 올라가는 곡선을 균등 분포로 시각화하기 위함 — 산점도에 이벤트별 점을 뿌리고, 표에서 구간별
 * 브레이크다운을 보여준다. bestK 지점은 항상 포함하고 isOptimal 플래그. baseRate를 주면
 * lift(P/baseRate)를 동봉. 순수·결정론(입력 같으면 byte-동일). */
export function ahaCoverageBuckets(sweep, opts = {}) {
  const { stepPct = 5, bestK = null, baseRate = null } = opts;
  if (!Array.isArray(sweep) || !sweep.length) return [];
  const shape = (s) => ({
    k: s.k,
    P: s.P,
    R: s.R,
    F1: s.F1,
    support: s.support,
    gated: s.gated,
    allSupport: s.allSupport,
    allPct: s.allPct,
    lift: baseRate != null && baseRate > 0 ? s.P / baseRate : null,
  });
  const step = stepPct / 100;
  const pcts = sweep.map((s) => s.allPct);
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  const chosen = new Map(); // k -> point (dedup)
  // maxPct 이하의 5% 배수 레벨(예: max 62% → 60,55,...,minPct). 각 레벨에서 allPct가 가장
  // 가까운 sweep 점을 대표로 채택.
  for (let lv = Math.floor(maxPct / step + 1e-9) * step; lv > 0 && lv >= minPct - 1e-9; lv -= step) {
    let best = null;
    let bestD = Infinity;
    for (const s of sweep) {
      const d = Math.abs(s.allPct - lv);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best && !chosen.has(best.k)) chosen.set(best.k, shape(best));
  }
  // 최고 달성률 점(가장 낮은 k)은 항상 보이도록 보강.
  const topPt = sweep.reduce((a, b) => (b.allPct > a.allPct ? b : a), sweep[0]);
  if (topPt && !chosen.has(topPt.k)) chosen.set(topPt.k, shape(topPt));
  // 자동 선택된 최적 임계값(bestK) 포함.
  if (bestK != null) {
    const bp = sweep.find((s) => s.k === bestK);
    if (bp && !chosen.has(bestK)) chosen.set(bestK, shape(bp));
  }
  const out = [...chosen.values()].map((p) => ({
    ...p,
    isOptimal: bestK != null && p.k === bestK,
  }));
  // 달성률 내림차순(높은 커버리지 → 낮은 커버리지, = k 오름차순)
  out.sort((a, b) => b.allPct - a.allPct);
  return out;
}

export const AHA_STATS = (() => {
  function validateBinaryTargets(values) {
    if (!Array.isArray(values) || !values.length) return { ok: false, reason: "empty_target" };
    const targets = [];
    for (const value of values) {
      const normalized = String(value ?? "").trim();
      if (normalized !== "0" && normalized !== "1") return { ok: false, reason: "non_binary_target" };
      targets.push(normalized === "1" ? 1 : 0);
    }
    const positives = targets.reduce((sum, value) => sum + value, 0);
    if (positives === 0 || positives === targets.length) return { ok: false, reason: "constant_target" };
    return { ok: true, targets, positives };
  }

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
          gated: tr.gated || ho.support < minSupport,
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
      gated: bestW.train.gated || bestW.holdout.support < minSupport,
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

  return { f1, lift, splitDeterministic, bestThreshold, gridSearch, thresholdSweep, coverage, validateBinaryTargets };
})();
