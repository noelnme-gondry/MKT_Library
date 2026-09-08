/**
 * Weekly Review → PVM 분해 브리지.
 *
 * 라우터가 "variance를 돌려라"라고 말하면 여기서 실제로 돌린다. **새 수학을 만들지 않는다** —
 * 5-21이 쓰는 `PVM_MATH.decomposeFinest`/`rollup`을 그대로 부르고, 스냅샷을 그 엔진이 읽는
 * 모양으로 번역하고 결과를 화면·보고서가 쓰는 모양으로 되돌린다.
 *
 * 번역에서 조심할 것 셋.
 *
 * ① **엔진은 `r.spend`를 읽지 `r.cost`가 아니다.** 스냅샷은 `cost`로 저장하므로 반드시
 *    갈아끼워야 한다. 이름만 비슷해서 그냥 넘기면 비용이 전부 0으로 들어가고, 분해는
 *    조용히 "전부 효율 변화"라고 답한다.
 * ② **`비용>0 · 결과=0` 셀 하나가 분해 전체를 거부시킨다.** `validateAggregateContract`가
 *    `NOT_IDENTIFIED`를 돌려주기 때문이다(정확한 판단이다 — 그 셀의 CPA는 정의되지 않는다).
 *    그런데 실제 주간 데이터에는 지출만 있고 전환이 0인 소액 캠페인이 거의 항상 있다.
 *    실측하면 800원짜리 캠페인 하나가 전체를 막는다. 그래서 엔진에 넘기기 전에 소액 셀을
 *    `기타(소액)`로 합친다(5-21의 `applyNoiseGuard`와 같은 발상, 행 수준에서).
 *    합쳐도 Bennet 분해는 가법적이라 Σ 항등식은 그대로다 — 묶음 **안쪽** 귀속만 사라진다.
 * ③ **그래도 남는 `전환 0 · 지출 있음` 셀은 분해에서 빼되, 뺀 사실과 금액을 반드시 함께 낸다.**
 *    소액 셀을 합쳐도 그 묶음의 전환이 전부 0이면 여전히 못 푼다 — 지출만 있고 결과가 없는 셀은
 *    CPA가 정의되지 않아 Bennet 항등식에 들어갈 수 없기 때문이다(엔진의 거부가 옳다).
 *    이때 "왜 CPA가 변했나"를 아예 못 답하는 것보다, **결과를 낸 캠페인들 안에서** 답하고
 *    범위를 밝히는 편이 낫다. 그래서 `excluded`(뺀 셀·금액)와 `overall`(전체 CPA)을 함께
 *    돌려주고, 분해가 설명하는 범위(`scope`)와 전체가 다르면 화면이 그 차이를 말해야 한다.
 *    빼는 것을 조용히 하면 그 순간 거짓 숫자가 된다.
 *
 * 비율은 **불안정하면 내주지 않는다**. 효율과 믹스가 서로 반대로 커서 합이 0에 가까우면
 * `rate/Δ`가 폭발한다. 그때는 `shares:null`과 사유를 주고 화면이 금액으로만 말하게 한다.
 */

import { PVM_MATH } from "@/utils/pvmMath";

export const VARIANCE_CONFIG = Object.freeze({
  /** 두 기간 결과 합이 이 미만인 셀은 `기타(소액)`로 합친다. */
  noiseThreshold: 30,
  /** 화면에 이름을 보일 상위 항목 수. 나머지는 한 줄로 묶는다. */
  topN: 3,
  /** |Δ|가 |효율|+|믹스|의 이 비율보다 작으면 지분을 내주지 않는다. */
  shareStability: 0.5,
  /** `전환 0 · 지출 있음` 셀을 분해에서 빼고 범위를 고지할지. false면 분해를 거부한다. */
  excludeZeroResultCells: true,
});

export const OTHER_LABEL = "기타(소액)";
const REMAINDER_LABEL = (count) => `나머지 ${count}개`;

function toFiniteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 스냅샷 행 → PVM 행. `cost` → `spend` 번역이 여기서 일어난다. */
function toEngineRows(rows, resultField, mergedKeys) {
  return rows.map((row) => {
    const label = labelOf(row);
    const merged = mergedKeys.has(label);
    return {
      channel: merged ? "" : (row.channel ?? ""),
      campaign: merged ? OTHER_LABEL : row.campaign,
      spend: toFiniteNumber(row.cost) ?? 0,
      [resultField]: toFiniteNumber(row[resultField]) ?? 0,
    };
  });
}

function labelOf(row) {
  return row.channel ? `${row.channel} / ${row.campaign}` : row.campaign;
}

/** 두 기간을 합쳐 결과가 문턱 미만인 셀 — 엔진에 넘기기 전에 합친다. */
function smallCellKeys(currentRows, previousRows, resultField, threshold) {
  const totals = new Map();
  for (const rows of [currentRows, previousRows]) {
    for (const row of rows) {
      const label = labelOf(row);
      totals.set(label, (totals.get(label) || 0) + (toFiniteNumber(row[resultField]) ?? 0));
    }
  }
  const small = new Set();
  for (const [label, total] of totals) if (total < threshold) small.add(label);
  return small;
}

/**
 * 스냅샷 두 장에서 CPA 변동을 분해한다.
 *
 * @param {object} current  이번 기간 스냅샷
 * @param {object} previous 지난 기간 스냅샷
 * @param {string} basis    "actions" | "installs"
 * @returns {object} `{ ok, reason, deltaCpa, split, drivers, identity }`
 */
export function buildVariance({
  current = null,
  previous = null,
  basis = "actions",
  config = VARIANCE_CONFIG,
} = {}) {
  const fail = (reason, extra = {}) => ({
    ok: false, reason, deltaCpa: null, split: null, drivers: [], identity: null, ...extra,
  });

  if (!current?.ok || !previous?.ok) return fail(!current?.ok ? "no_current_snapshot" : "no_previous_snapshot");

  const resultField = basis === "installs" ? "installs" : "actions";
  const hasResult = (current.availableFields || []).includes(resultField)
    && (previous.availableFields || []).includes(resultField);
  const hasCost = (current.availableFields || []).includes("cost")
    && (previous.availableFields || []).includes("cost");
  if (!hasCost || !hasResult) {
    return fail("data_missing", { missing: [!hasCost ? "cost" : null, !hasResult ? resultField : null].filter(Boolean) });
  }

  const keys = { ch: "channel", cmp: "campaign", cr: null, resultField };
  const merged = smallCellKeys(current.rows, previous.rows, resultField, config.noiseThreshold);
  const rows2 = toEngineRows(current.rows, resultField, merged);
  const rows1 = toEngineRows(previous.rows, resultField, merged);

  // 합친 뒤에도 `지출>0 · 결과=0`인 셀이 남으면 CPA가 정의되지 않아 항등식에 못 넣는다.
  const zeroResult = zeroResultLabels(rows1, rows2, resultField);
  const excluded = config.excludeZeroResultCells ? zeroResult : new Set();
  const keep = (row) => !excluded.has(engineLabel(row));
  const kept2 = rows2.filter(keep);
  const kept1 = rows1.filter(keep);

  if (kept1.length === 0 || kept2.length === 0) {
    return fail("all_cells_excluded", { excludedCells: [...excluded] });
  }

  const contract = PVM_MATH.inspectFinestInputs(kept1, kept2, keys);
  if (!contract.ok) {
    // 소액 병합으로도 못 푼다. 어느 셀이 막는지 그대로 알려준다 — 숫자를 지어내지 않는다.
    return fail("not_identified", {
      code: contract.code,
      blockedCells: contract.invalidCells.map((cell) => ({
        label: safeLabel(cell.key),
        period: cell.period === "P2" ? "current" : "previous",
        cost: cell.cost ?? null,
        result: cell.result ?? null,
      })),
      mergedCells: [...merged],
    });
  }

  const decomposed = PVM_MATH.decomposeFinest(kept1, kept2, keys);
  if (!decomposed) return fail("no_result_volume"); // 어느 기간의 결과 합이 0

  const rolled = PVM_MATH.rollup(
    decomposed.finest,
    (entry) => (entry.chKey ? `${entry.chKey} / ${entry.cmpKey}` : entry.cmpKey),
    decomposed.Result1,
    decomposed.Result2,
  );

  const rateTotal = rolled.reduce((sum, entry) => sum + entry.rate, 0);
  const mixTotal = rolled.reduce((sum, entry) => sum + entry.mix, 0);
  const sumContribution = rolled.reduce((sum, entry) => sum + entry.contribution, 0);
  const delta = decomposed.deltaCpa;

  const spread = Math.abs(rateTotal) + Math.abs(mixTotal);
  const stable = spread > 0 && Math.abs(delta) >= config.shareStability * spread;
  const share = (value) => (stable ? value / delta : null);

  rolled.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || (a.key < b.key ? -1 : 1));
  const top = rolled.slice(0, config.topN);
  const rest = rolled.slice(config.topN);

  const drivers = top.map((entry) => driverOf(entry, share));
  if (rest.length > 0) {
    const contribution = rest.reduce((sum, entry) => sum + entry.contribution, 0);
    drivers.push({
      label: REMAINDER_LABEL(rest.length),
      contribution,
      share: share(contribution),
      cpa1: null, cpa2: null, cpaChangePct: null,
      s1: rest.reduce((sum, entry) => sum + entry.s1, 0),
      s2: rest.reduce((sum, entry) => sum + entry.s2, 0),
      isRemainder: true,
      remainderCount: rest.length,
    });
  }

  return {
    ok: true,
    reason: null,
    cpa1: decomposed.CPA1,
    cpa2: decomposed.CPA2,
    deltaCpa: delta,
    deltaPct: decomposed.CPA1 > 0 ? delta / decomposed.CPA1 : null,
    split: {
      efficiency: rateTotal,
      mix: mixTotal,
      shares: stable ? { efficiency: rateTotal / delta, mix: mixTotal / delta } : null,
      sharesReason: stable ? null : "offsetting",
      lead: Math.abs(rateTotal) >= Math.abs(mixTotal) ? "efficiency" : "mix",
    },
    drivers,
    mergedCells: [...merged],
    // 분해에서 뺀 것 — 화면이 반드시 고지해야 한다. 조용히 빼면 거짓 숫자가 된다.
    excluded: buildExcluded(rows1, rows2, excluded, resultField),
    // 분해가 설명하는 범위(scope)와 전체가 다르면 그 차이를 화면이 말해야 한다.
    overall: overallCpa(previous, current, resultField),
    coversAllSpend: excluded.size === 0,
    // 화면·테스트가 분해가 성립함을 직접 확인할 수 있게 남긴다.
    identity: { sumContribution, deltaCpa: delta },
  };
}

function engineLabel(row) {
  return row.channel ? `${row.channel} / ${row.campaign}` : row.campaign;
}

/**
 * `지출>0 · 결과=0`인 셀. **기간별로** 본다 — 엔진의 계약 검증이 기간별이기 때문이다.
 * 두 기간 합계로 보면 "지난주엔 전환이 있었는데 이번 주 0"인 캠페인(정지·소재 소진으로
 * 흔하다)을 놓치고, 그러면 엔진이 그 셀 때문에 분해 전체를 거부한다.
 */
function zeroResultLabels(rows1, rows2, resultField) {
  const out = new Set();
  for (const rows of [rows1, rows2]) {
    const perPeriod = new Map();
    for (const row of rows) {
      const label = engineLabel(row);
      const entry = perPeriod.get(label) || { cost: 0, result: 0 };
      entry.cost += row.spend || 0;
      entry.result += row[resultField] || 0;
      perPeriod.set(label, entry);
    }
    for (const [label, entry] of perPeriod) if (entry.cost > 0 && entry.result <= 0) out.add(label);
  }
  return out;
}

function buildExcluded(rows1, rows2, labels, resultField) {
  const sumFor = (rows) => rows
    .filter((row) => labels.has(engineLabel(row)))
    .reduce((sum, row) => sum + (row.spend || 0), 0);
  return {
    cells: [...labels],
    reason: labels.size > 0 ? "zero_result_with_spend" : null,
    cost1: sumFor(rows1),
    cost2: sumFor(rows2),
    resultField,
  };
}

/** 전체(제외 없이) CPA — 분해 범위와 다를 수 있으므로 화면이 대조할 수 있게 준다. */
function overallCpa(previous, current, resultField) {
  const totals = (snapshot) => snapshot.rows.reduce(
    (acc, row) => ({
      cost: acc.cost + (Number(row.cost) || 0),
      result: acc.result + (Number(row[resultField]) || 0),
    }),
    { cost: 0, result: 0 },
  );
  const t1 = totals(previous);
  const t2 = totals(current);
  const cpa1 = t1.result > 0 ? t1.cost / t1.result : null;
  const cpa2 = t2.result > 0 ? t2.cost / t2.result : null;
  return { cpa1, cpa2, deltaCpa: cpa1 !== null && cpa2 !== null ? cpa2 - cpa1 : null };
}

function driverOf(entry, share) {
  const cpa1 = entry.result1 > 0 && Number.isFinite(entry.cpa1) ? entry.cpa1 : null;
  const cpa2 = entry.result2 > 0 && Number.isFinite(entry.cpa2) ? entry.cpa2 : null;
  return {
    label: entry.key,
    isMerged: entry.key === OTHER_LABEL,
    contribution: entry.contribution,
    share: share(entry.contribution),
    cpa1,
    cpa2,
    cpaChangePct: cpa1 > 0 && cpa2 !== null ? (cpa2 - cpa1) / cpa1 : null,
    s1: entry.s1,
    s2: entry.s2,
    isRemainder: false,
  };
}

function safeLabel(tupleKey) {
  try {
    const [channel, campaign] = JSON.parse(tupleKey);
    return channel ? `${channel} / ${campaign}` : campaign;
  } catch {
    return String(tupleKey);
  }
}
