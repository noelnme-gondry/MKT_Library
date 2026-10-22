// PVM 연결 (spec §6.5): "어느 노드·소재에서"는 PVM, "왜"는 곡선.
// PVM_MATH는 고치지 않는다. 앞뒤에서 ① 결과 0 칸 묶기 ② 최소 grain 1회 분해 후 롤업
// ③ mix를 캠페인 간/안으로, rate를 예산 곡선·시장·나머지로 무잔차 분할 ④ 진입·이탈 재라벨만 한다.
import { PVM_MATH } from "@/utils/pvmMath";
import { nodeKey } from "./plannerData";

export const PVM_COLUMNS = Object.freeze(["betweenMix", "withinMix", "entry", "exit", "budget", "market", "creative"]);

function aggregate(rows, finestLevel, groupLevel, levels) {
  const cells = new Map();
  for (const row of rows) {
    const key = nodeKey(row, finestLevel, levels);
    if (!cells.has(key)) {
      cells.set(key, {
        key,
        groupKey: nodeKey(row, groupLevel, levels),
        label: levels.slice(0, levels.indexOf(finestLevel) + 1).map((name) => row[name]).filter(Boolean).join(" › ") || "(전체)",
        creativeId: row.creative_id || "",
        cost: 0,
        result: 0,
      });
    }
    const cell = cells.get(key);
    cell.cost += row.cost;
    cell.result += row.result;
  }
  return cells;
}

const isZeroResult = (cell) => cell != null && cell.cost > 0 && !(cell.result > 0);

/**
 * 비용 > 0·결과 0 칸이 하나라도 있으면 PVM_MATH가 분해 전체를 멈춘다. 학습 중 신규 소재가 정확히 이 경우다.
 * 두 기간에 같은 묶음 규칙을 써야 분해가 성립하므로 소속은 두 기간을 함께 보고 정한다.
 */
export function poolZeroResultCells(cellsB, cellsR, steps) {
  const keys = new Set([...cellsB.keys(), ...cellsR.keys()]);
  const target = new Map([...keys].map((key) => [key, key]));
  const pooled = [];
  const excluded = [];
  const meta = (key) => cellsB.get(key) || cellsR.get(key);
  const totalOf = (members, cells) => members.reduce((acc, key) => {
    const cell = cells.get(key);
    return cell ? { cost: acc.cost + cell.cost, result: acc.result + cell.result } : acc;
  }, { cost: 0, result: 0 });

  const zeroKeys = [...keys].filter((key) => isZeroResult(cellsB.get(key)) || isZeroResult(cellsR.get(key)));
  const byGroup = new Map();
  for (const key of zeroKeys) {
    const group = meta(key).groupKey;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(key);
  }

  for (const [group, members] of [...byGroup].sort(([a], [b]) => a.localeCompare(b))) {
    const unitB = totalOf(members, cellsB);
    const unitR = totalOf(members, cellsR);
    if (steps.includes("campaign_bucket") && !isZeroResult(unitB) && !isZeroResult(unitR)) {
      const bucketKey = `${group}::zero-result-bucket`;
      members.forEach((key) => target.set(key, bucketKey));
      pooled.push({ group, into: bucketKey, members, rule: "campaign_bucket" });
      continue;
    }
    const others = [...keys].filter((key) => meta(key).groupKey === group && !zeroKeys.includes(key));
    if (steps.includes("mergeIntoSmallest")) {
      // 묶음이 비용을 쓴 기간마다 결과가 있는 칸이어야 합친 뒤에도 결과 0 칸이 생기지 않는다.
      const candidates = others
        .filter((key) => (!(unitB.cost > 0) || cellsB.get(key)?.result > 0) && (!(unitR.cost > 0) || cellsR.get(key)?.result > 0))
        .sort((a, b) => ((cellsB.get(a)?.cost || 0) + (cellsR.get(a)?.cost || 0)) - ((cellsB.get(b)?.cost || 0) + (cellsR.get(b)?.cost || 0)) || a.localeCompare(b));
      if (candidates.length) {
        members.forEach((key) => target.set(key, candidates[0]));
        pooled.push({ group, into: candidates[0], members, rule: "mergeIntoSmallest" });
        continue;
      }
    }
    if (steps.includes("excludeAndReport")) {
      members.forEach((key) => target.set(key, null));
      excluded.push({ group, members, costB: unitB.cost, costR: unitR.cost, wholeGroup: others.length === 0 });
      continue;
    }
    return { ok: false, code: "ZERO_RESULT_UNRESOLVED", group };
  }
  return { ok: true, target, pooled, excluded };
}

function remap(cells, target, metaOf) {
  const out = new Map();
  for (const [key, cell] of cells) {
    const to = target.get(key);
    if (to == null) continue;
    if (!out.has(to)) {
      const own = metaOf(to);
      out.set(to, own
        ? { ...own, cost: 0, result: 0 }
        : { key: to, groupKey: cell.groupKey, label: `${cell.label.split(" › ").slice(0, -1).join(" › ")} › 결과 0 소재 묶음`, creativeId: "", pooled: true, cost: 0, result: 0 });
    }
    const merged = out.get(to);
    merged.cost += cell.cost;
    merged.result += cell.result;
  }
  return out;
}

/**
 * 기준 B → 최근 R의 CPA 변화를 무잔차로 나눈다.
 * @param {object[]} rowsB
 * @param {object[]} rowsR
 * @param {{levels:string[], finestLevel:string, groupLevel:string, cfg:object,
 *   rateFactors?:Map<string,{budget?:number, market?:number}>, learningIds?:Set<string>}} opts
 *   rateFactors: 그룹(배분 노드)별 곡선 기대 배율 g와 시장 배율 m.
 */
export function decomposePlannerPvm(rowsB, rowsR, { levels, finestLevel, groupLevel, cfg, rateFactors = new Map(), creativeStateOf }) {
  const cellsB = aggregate(rowsB, finestLevel, groupLevel, levels);
  const cellsR = aggregate(rowsR, finestLevel, groupLevel, levels);
  const pooling = poolZeroResultCells(cellsB, cellsR, cfg.pvm.zeroResultPooling);
  if (!pooling.ok) return { ok: false, code: pooling.code, group: pooling.group };
  const metaOf = (key) => cellsB.get(key) || cellsR.get(key);
  const aggB = remap(cellsB, pooling.target, metaOf);
  const aggR = remap(cellsR, pooling.target, metaOf);
  const decomposed = PVM_MATH.decompose(
    new Map([...aggB].map(([key, cell]) => [key, { cost: cell.cost, result: cell.result }])),
    new Map([...aggR].map(([key, cell]) => [key, { cost: cell.cost, result: cell.result }])),
  );
  if (!decomposed) return { ok: false, code: "NOT_IDENTIFIED", excluded: pooling.excluded };

  const { CPA1, CPA2 } = decomposed;
  const Cbar = (CPA1 + CPA2) / 2;
  const meta = (key) => aggB.get(key) || aggR.get(key);
  const groups = new Map();
  for (const entity of decomposed.entities) {
    const group = meta(entity.key).groupKey;
    if (!groups.has(group)) groups.set(group, { cost1: 0, result1: 0, cost2: 0, result2: 0, s1: 0, s2: 0 });
    const g = groups.get(group);
    g.cost1 += entity.cost1;
    g.result1 += entity.result1;
    g.cost2 += entity.cost2;
    g.result2 += entity.result2;
    g.s1 += entity.s1;
    g.s2 += entity.s2;
  }
  for (const g of groups.values()) {
    // PVM_MATH와 같은 규칙: 결과 0(부재) 칸의 CPA는 0으로 둔다.
    g.cpaBar = ((g.result1 > 0 ? g.cost1 / g.result1 : 0) + (g.result2 > 0 ? g.cost2 / g.result2 : 0)) / 2;
  }

  const order = cfg.pvm.rateSplitOrder;
  const rows = decomposed.entities.map((entity) => {
    const cell = meta(entity.key);
    const group = groups.get(cell.groupKey);
    const ds = entity.s2 - entity.s1;
    const cpaBar = (entity.cpa1 + entity.cpa2) / 2;
    const sBar = (entity.s1 + entity.s2) / 2;
    const columns = Object.fromEntries(PVM_COLUMNS.map((name) => [name, 0]));
    // mix_i = (cpā_i − C̄)Δs_i = (cpā_g − C̄)Δs_i [그룹 간] + (cpā_i − cpā_g)Δs_i [그룹 안]
    columns.betweenMix = (group.cpaBar - Cbar) * ds;
    columns.withinMix = (cpaBar - group.cpaBar) * ds;
    // rate_i = s̄_i(cpa2 − cpa1)를 정해진 순서로 곡선·시장 배율을 적용하며 나누고, 남은 몫이 소재·퍼널.
    const factors = rateFactors.get(cell.groupKey) || {};
    let running = entity.cpa1;
    for (const step of order) {
      const factor = Number.isFinite(factors[step]) && factors[step] > 0 ? factors[step] : 1;
      columns[step] = sBar * running * (factor - 1);
      running *= factor;
    }
    columns.creative = sBar * (entity.cpa2 - running);
    let kind = "continuing";
    if (cfg.pvm.relabelEntryExit && !(entity.result1 > 0)) kind = "entry";
    else if (cfg.pvm.relabelEntryExit && !(entity.result2 > 0)) kind = "exit";
    if (kind !== "continuing") {
      const total = entity.mix + entity.rate;
      PVM_COLUMNS.forEach((name) => { columns[name] = 0; });
      columns[kind] = total;
    }
    const state = cell.creativeId && creativeStateOf ? creativeStateOf(cell) : null;
    return {
      key: entity.key,
      groupKey: cell.groupKey,
      label: cell.label,
      creativeId: cell.creativeId,
      creativeState: state,
      kind,
      cost1: entity.cost1,
      cost2: entity.cost2,
      result1: entity.result1,
      result2: entity.result2,
      cpa1: entity.result1 > 0 ? entity.cpa1 : null,
      cpa2: entity.result2 > 0 ? entity.cpa2 : null,
      resultShare1: entity.s1,
      resultShare2: entity.s2,
      contribution: entity.contribution,
      ...columns,
    };
  });

  const rollup = (keyOf) => {
    const out = new Map();
    for (const row of rows) {
      const key = keyOf(row);
      if (!out.has(key)) out.set(key, { key, contribution: 0, ...Object.fromEntries(PVM_COLUMNS.map((name) => [name, 0])) });
      const acc = out.get(key);
      acc.contribution += row.contribution;
      PVM_COLUMNS.forEach((name) => { acc[name] += row[name]; });
    }
    return [...out.values()];
  };
  const totals = rollup(() => "total")[0];
  const residual = PVM_COLUMNS.reduce((acc, name) => acc + totals[name], 0) - decomposed.deltaCpa;

  return {
    ok: true,
    CPA1,
    CPA2,
    deltaCpa: decomposed.deltaCpa,
    columns: PVM_COLUMNS,
    rateSplitOrder: order,
    shareBasis: "result",
    totals,
    residual,
    rows,
    groups: rollup((row) => row.groupKey),
    pooled: pooling.pooled,
    excluded: pooling.excluded,
    // 묶음·제외가 있으면 화면은 "전체 CPA"가 아니라 "분해 대상 CPA"라고 불러야 한다.
    scope: pooling.excluded.length ? "decomposed_subset" : "all",
  };
}

/**
 * 계획 vs 실제 (spec §8.2). 차이를 "계획과 다르게 쓴 지출 비중"(실행 편차)과 "대상별 효율 예측 오차"(모형 오차)로 나눈다.
 * 결과량 비중 PVM은 여기 쓰면 안 된다 — 효율이 빗나가면 결과 비중이 같이 움직여, 계획대로 쓴 지출도
 * 실행 편차로 잡힌다(실측). 지출 1원당 결과 E = Σ 지출비중 × 효율 이 지출 비중에 선형이므로 이것을
 * Bennet 분해한다(무잔차·중첩 항등식은 PVM과 같다): ΔE = Σ(ēᵢ − Ē)·Δwᵢ [실행] + Σ w̄ᵢ·Δeᵢ [모형].
 * 화면은 CPR로 읽으므로 각 항을 ΔCPR/ΔE로 비례 환산한다(합은 ΔCPR과 정확히 같다).
 * @param {{key:string, cost:number, results:number}[]} planned 기간 합계 예측
 * @param {{key:string, cost:number, results:number}[]} actual 같은 기간 실제
 */
export function reviewPlanVsActual(planned, actual, cfg) {
  const p = new Map(planned.map((item) => [item.key, item]));
  const a = new Map(actual.map((item) => [item.key, item]));
  const keys = [...new Set([...p.keys(), ...a.keys()])].sort();
  const total = (map, field) => [...map.values()].reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
  const C1 = total(p, "cost");
  const C2 = total(a, "cost");
  const R1 = total(p, "results");
  const R2 = total(a, "results");
  if (!(C1 > 0) || !(C2 > 0) || !(R1 > 0) || !(R2 > 0)) return { ok: false, code: "NOT_IDENTIFIED" };
  const E1 = R1 / C1;
  const E2 = R2 / C2;
  const Ebar = (E1 + E2) / 2;
  const cpr1 = C1 / R1;
  const cpr2 = C2 / R2;
  const scale = E2 !== E1 ? (cpr2 - cpr1) / (E2 - E1) : 0;
  const nodes = keys.map((key) => {
    const c1 = Number(p.get(key)?.cost) || 0;
    const r1 = Number(p.get(key)?.results) || 0;
    const c2 = Number(a.get(key)?.cost) || 0;
    const r2 = Number(a.get(key)?.results) || 0;
    const w1 = c1 / C1;
    const w2 = c2 / C2;
    // 한쪽에 지출이 없으면 그 쪽 효율을 다른 쪽 값으로 둔다 — 진입·제외는 통째로 실행 편차다.
    const e1 = c1 > 0 ? r1 / c1 : c2 > 0 ? r2 / c2 : 0;
    const e2 = c2 > 0 ? r2 / c2 : e1;
    const mixE = ((e1 + e2) / 2 - Ebar) * (w2 - w1);
    const rateE = ((w1 + w2) / 2) * (e2 - e1);
    const measured = c1 > 0 && c2 > 0;
    const modelError = measured && r1 > 0 && r2 > 0 ? (r1 / c1) / (r2 / c2) - 1 : null;
    return {
      key,
      executionDeviation: mixE * scale,
      modelErrorContribution: rateE * scale,
      cprPlanned: r1 > 0 ? c1 / r1 : null,
      cprActual: r2 > 0 ? c2 / r2 : null,
      modelError,
      // 계획엔 결과가 있었는데 실제 결과가 0이면 오차는 무한대 — 큰 오차다.
      largeError: (measured && r1 > 0 && r2 === 0) || (modelError != null && Math.abs(modelError) > cfg.pvm.reviewErrorThreshold),
    };
  });
  return { ok: true, plannedCpa: cpr1, actualCpa: cpr2, deltaCpa: cpr2 - cpr1, nodes };
}

/** 모형 오차가 큰 리뷰가 연속 N회면 그 노드의 신뢰도를 한 단계 낮춘다. */
export function shouldDowngradeConfidence(history, cfg) {
  const need = cfg.pvm.reviewDowngradeAfter;
  if (history.length < need) return false;
  return history.slice(-need).every((review) => review?.largeError === true);
}
