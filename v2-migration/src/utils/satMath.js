import { ALLOC_MATH } from "./allocationMath";
import { getMappedRows } from "./dashboardAggregator";

export const SAT_CONFIG = {
  satHigh: 1.3,
  scaleLow: 0.85,
  deltaPct: 0.1,
  minPoints: 4,
  recentDays: 7,
};

export const SAT_MATH = (() => {
  function recentAvgDailyCost(pts, recentDays) {
    const dated = pts.filter((p) => p.date && !isNaN(Date.parse(p.date)));
    if (!dated.length) return pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const maxT = Math.max(...dated.map((p) => Date.parse(p.date)));
    const cutoff = maxT - recentDays * 86400000;
    const recent = dated.filter((p) => Date.parse(p.date) >= cutoff);
    const use = recent.length ? recent : dated;
    return use.reduce((s, p) => s + p.x, 0) / use.length;
  }

  function classify(satIndex, cfg) {
    cfg = cfg || SAT_CONFIG;
    // null = 계산 자체가 안 된 상태. Infinity(한계 CPR 발산 = 진짜 포화)와 같은
    // 버킷에 넣으면 "모름"이 "증액 위험"으로 단정된다(감사 P1-2).
    // satVerdictMeta(null)에 이미 "—/분석 불가" 분기가 있는데 도달하지 못했다.
    if (satIndex == null) return null;
    if (!isFinite(satIndex)) return "saturated";
    if (satIndex >= cfg.satHigh) return "saturated";
    if (satIndex < cfg.scaleLow) return "scale";
    return "linear";
  }

  function analyzeEntity(rawPts, cfg) {
    cfg = cfg || SAT_CONFIG;
    const A = ALLOC_MATH;
    if (!rawPts || rawPts.length < cfg.minPoints)
      return { ok: false, reason: "insufficient", n: rawPts ? rawPts.length : 0 };
    const cleaned = A.removeOutliers(rawPts, "iqr", { iqrMult: 1.5 });
    const kept = cleaned && cleaned.kept && cleaned.kept.length >= cfg.minPoints ? cleaned.kept : rawPts;
    const pairs = kept.map((p) => [p.x, p.y]);
    const model = A.fitBest(pairs, null);
    if (!model) return { ok: false, reason: "nofit", n: kept.length };
    const xs = kept.map((p) => p.x);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    // Log 모델은 x→0 근처에서 a*ln(x) 항이 발산(a<0이면 +∞, a>0이면 -∞)해 관측 구간
    // 안에서도 비정상적으로 큰/음수 예측을 낼 수 있음 — 관측 구간 경계(xMin·xMax)에서
    // 예측이 유한 양수인지 먼저 검증, 아니면 차트에 비정상 곡선이 주입되기 전에 nofit 처리.
    if (model.type === "Log") {
      const yAtMin = model.predict(xMin);
      const yAtMax = model.predict(xMax);
      if (!isFinite(yAtMin) || !isFinite(yAtMax) || yAtMin <= 0 || yAtMax <= 0) {
        return { ok: false, reason: "nofit", n: kept.length };
      }
    }
    const poly2Shape = A.detectPoly2Shape(model);
    const chWrap = { model, poly2Shape, xMin, xMax }; // xMin 누락 시 predictSafeCpr의 하한 clamp가 죽는다(감사 P1-4)
    const currentCost = recentAvgDailyCost(kept, cfg.recentDays);
    const avgCpr = A.predictSafeCpr(chWrap, currentCost);
    if (avgCpr == null || avgCpr <= 0) return { ok: false, reason: "out_of_range", n: kept.length };
    const resC = currentCost / avgCpr;
    // 한계효율은 반드시 관측된 비용 범위 안에서만 계산한다. currentCost+delta가
    // xMax를 넘으면 predictSafeCpr의 xMax clamp가 사실상 "상수 CPA 외삽"을 만들어
    // 화면의 관측범위 안내와 달리 포화/여유를 판정할 수 있었다.
    const baseDelta = Math.max(currentCost * cfg.deltaPct, 1e-9);
    const observedRoom = xMax - currentCost;
    const observedBackRoom = currentCost - xMin;
    let delta = 0;
    let dRes = 0;
    if (observedRoom > 1e-9) {
      // Forward difference: current → a higher, still observed spend point.
      delta = Math.min(baseDelta, observedRoom);
      const cprT = A.predictSafeCpr(chWrap, currentCost + delta);
      if (cprT != null && cprT > 0) {
        dRes = (currentCost + delta) / cprT - resC;
      }
    } else if (observedBackRoom > 1e-9) {
      // At the observed maximum, use the preceding observed-range increment
      // (left derivative) instead of extending the curve beyond xMax.
      delta = Math.min(baseDelta, observedBackRoom);
      const cprPrev = A.predictSafeCpr(chWrap, currentCost - delta);
      if (cprPrev != null && cprPrev > 0) {
        const resPrev = (currentCost - delta) / cprPrev;
        dRes = resC - resPrev;
      }
    }
    // 추가 결과가 정확히 0이면 한계 CPA는 무한대이므로 실제 포화 신호다.
    // 반대로 결과가 감소하는 곡선은 안정적인 한계효율 판정 근거가 아니므로 보류한다.
    if (!isFinite(dRes) || dRes < -1e-12 || !(delta > 0)) {
      return { ok: false, reason: "nonpositive_marginal", n: kept.length };
    }
    const marginalCpr = dRes > 1e-12 ? delta / dRes : Infinity;
    const satIndex = marginalCpr / avgCpr;
    let totCost = 0, totRes = 0, totRev = 0, hasRev = false;
    for (const p of kept) {
      totCost += p.x;
      totRes += p.y > 0 ? p.x / p.y : 0;
      if (p.rev != null && isFinite(p.rev)) {
        totRev += p.rev;
        hasRev = true;
      }
    }
    const actualCpr = totRes > 0 ? totCost / totRes : null;
    let roas = null;
    if (hasRev && totRev > 0 && totRes > 0) {
      const revPerRes = totRev / totRes;
      const revC = resC * revPerRes;
      const avgRoas = currentCost > 0 ? revC / currentCost : null;
      const marginalRoas = delta > 0 ? (dRes * revPerRes) / delta : null;
      const satIndexRoas = marginalRoas > 0 && avgRoas > 0 ? avgRoas / marginalRoas : Infinity;
      roas = {
        avgRoas,
        marginalRoas,
        satIndexRoas,
        revPerRes,
        verdict: classify(satIndexRoas, cfg),
      };
    }
    return {
      ok: true, n: kept.length, model, modelType: model.type, r2: model.r2, currentCost,
      avgCpr, marginalCpr, satIndex, verdict: classify(satIndex, cfg), actualCpr, totCost,
      totRes, poly2Shape, xMin, xMax, kept, roas,
    };
  }

  return { recentAvgDailyCost, classify, analyzeEntity };
})();

export function satBuildPoints(rows, grain, metricField, revField) {
  // 이 도구는 creative/adgroup 분해를 하지 않으므로, CSV가 하위 grain(예: creative_name 포함)이면
  // 사용 grain(채널/캠페인)×날짜로 먼저 sum 후 점 1개 생성. (per-row 점 = creative 단위로 찍히는 버그 방지)
  const agg = new Map(); // key -> Map(dateKey -> {cost,res,rev,hasRev,date})
  for (const r of rows) {
    let key;
    if (grain === "campaign") {
      const cmp = String(r.campaign_name ?? "").trim();
      if (!cmp) continue;
      const ch = String(r.channel ?? "").trim();
      key = ch && !cmp.startsWith(ch) ? ch + " · " + cmp : cmp;
    } else {
      const ch = String(r.channel ?? "").trim();
      if (!ch) continue;
      key = ch;
    }
    const cost = Number(r.cost) || 0;
    const res = Number(r[metricField]) || 0;
    const rev = revField != null ? Number(r[revField]) : null;
    const dateKey = r.date != null && r.date !== "" ? String(r.date) : "__nodate__";
    if (!agg.has(key)) agg.set(key, new Map());
    const byDate = agg.get(key);
    if (!byDate.has(dateKey)) byDate.set(dateKey, { cost: 0, res: 0, rev: 0, hasRev: false, date: r.date });
    const e = byDate.get(dateKey);
    e.cost += cost;
    e.res += res;
    if (rev != null && isFinite(rev)) { e.rev += rev; e.hasRev = true; }
  }
  const m = new Map();
  for (const [key, byDate] of agg) {
    const pts = [];
    for (const e of byDate.values()) {
      if (e.cost <= 0 || e.res <= 0) continue; // 합산 후 필터
      pts.push({ x: e.cost, y: e.cost / e.res, date: e.date, rev: e.hasRev ? e.rev : null });
    }
    if (pts.length) m.set(key, pts);
  }
  return m;
}

export function satAvailableFields(csvData) {
  const mappedKeys = new Set(Object.values(csvData?.mapping || {}).filter((v) => v && v !== "__ignore__"));
  const metricField = mappedKeys.has("installs") ? "installs" : mappedKeys.has("actions") ? "actions" : null;
  const revCandidates = ["revenue_d7", "revenue_d0", "revenue_d14", "revenue_d30", "revenue_d90", "revenue_d180", "revenue_d360"];
  const revField = revCandidates.find((k) => mappedKeys.has(k)) || null;
  const hasCampaign = mappedKeys.has("campaign_name");
  return { metricField, revField, hasCampaign };
}

export function satAnalyzeAll(csvData, state) {
  const { metricField, revField } = satAvailableFields(csvData);
  const rows = getMappedRows(csvData);
  const pointsMap = satBuildPoints(rows, state.grain, metricField, revField);
  const out = [];
  for (const [name, pts] of pointsMap) {
    const a = SAT_MATH.analyzeEntity(pts, SAT_CONFIG);
    out.push({ name, raw: pts.length, ...a });
  }
  return out;
}

export function satActiveIndex(r, metric) {
  if (!r.ok) return -1;
  if (metric === "roas") {
    if (!r.roas) return -1;
    return isFinite(r.roas.satIndexRoas) ? r.roas.satIndexRoas : 1e9;
  }
  return isFinite(r.satIndex) ? r.satIndex : 1e9;
}

export function satActiveVerdict(r, metric) {
  if (metric === "roas") return r.roas ? r.roas.verdict : null;
  return r.verdict;
}

// 색은 semantic 토큰으로 — 하드코딩 hex는 라이트 모드에서 대비가 무너진다(§12.3, 감사 P1-14).
// 표시층이 이 값을 그대로 CSS color로 쓰므로 var()를 돌려준다(canvas가 아니라 DOM 경로).
export function satVerdictMeta(v) {
  if (v === "saturated") return { label: "포화", color: "var(--danger)", icon: "▲", advice: "증액 위험" };
  if (v === "scale") return { label: "여유", color: "var(--success)", icon: "▼", advice: "증액 기회" };
  if (v === "linear") return { label: "적정", color: "var(--text-secondary)", icon: "●", advice: "현상 유지" };
  return { label: "—", color: "var(--text-muted)", icon: "·", advice: "분석 불가" };
}
