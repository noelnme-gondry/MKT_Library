// 5-3 결론 카드의 "지금 할 일"과 "확인할 점" (2026-10-22 사용자 요청: 보면 바로 문제와 행동이 보이게).
// 배분 결과·대상 상태·원인 판정을 한 줄짜리 행동으로 합친다. 문장은 화면이 만들고 여기서는 코드만 고른다 —
// 같은 판정을 결론·표·내보내기가 서로 다르게 말하지 않게 하려는 것이다.

const WORSE_VERDICTS = new Set(["AUCTION_COST", "CREATIVE", "FUNNEL_POST_CLICK", "MARKET", "BUDGET_CURVE", "MIXED", "NEW_CREATIVE_LEARNING"]);
const HOLD_BINDINGS = new Set(["locked", "held", "low_confidence", "no_curve", "state:INSUFFICIENT"]);

/** 최근 7일 vs 직전 7일 단가 변화율(ROAS면 ROAS 변화율). 원인 판정이 없으면 null. */
function recentChange(unit, isRoas) {
  const total = unit?.diagnosis?.components?.total;
  if (!Number.isFinite(total)) return null;
  return isRoas ? Math.exp(-total) - 1 : Math.exp(total) - 1;
}

function reasonOf(item, unit, direction, isRoas) {
  if (HOLD_BINDINGS.has(item.binding)) return { code: item.binding === "no_curve" || item.binding === "state:INSUFFICIENT" ? "hold_no_curve" : item.binding === "low_confidence" ? "hold_low_confidence" : "hold_locked" };
  const change = recentChange(unit, isRoas);
  const verdict = unit?.diagnosis?.verdict;
  const worse = unit?.diagnosis?.direction === "worse";
  if (direction === "down") {
    if (item.state === "EXTRAPOLATING") return { code: "down_outside_history", change };
    if (worse && WORSE_VERDICTS.has(verdict)) return { code: "down_worse", verdict, change };
    return { code: "down_low_marginal" };
  }
  if (direction === "up") {
    if (item.binding === "max_daily_increase") return { code: "up_daily_limit" };
    if (item.binding === "extrapolation") return { code: "up_history_ceiling" };
    return { code: "up_high_marginal" };
  }
  return { code: "keep" };
}

/**
 * 대상별 행동. 변화가 큰 순서(절대 금액)로 정렬한다.
 * @param {object[]} items 5-3 배분 항목(channel·cost·current·binding·state·cpr)
 * @param {object[]} units 플래너 대상(unit·path·diagnosis·state)
 * @param {{isRoas?:boolean, minShare?:number, history?:Object<string,{totalCost:number,totalResults:number}>}} opts
 *   minShare: 현재 지출 대비 이 비율 미만의 변화는 "유지"
 *   history: 대상별 최근 일평균 — 있으면 현재·예상 CPR을 함께 싣는다(예산 변화와 효율 변화를 같은 행에서 읽게)
 */
export function allocationMoves(items = [], units = [], { isRoas = false, minShare = 0.01, history = null } = {}) {
  const unitOf = new Map(units.map((unit) => [unit.unit, unit]));
  return items.map((item) => {
    const current = Number(item.current) || 0;
    const proposed = Number(item.cost) || 0;
    const delta = proposed - current;
    const changePct = current > 0 ? delta / current : null;
    const small = current > 0 ? Math.abs(delta) < current * minShare : Math.abs(delta) < 1e-6;
    const direction = small ? "keep" : delta > 0 ? "up" : "down";
    const unit = unitOf.get(item.channel);
    const past = history?.[item.channel];
    const results = Number(item.results);
    return {
      unit: item.channel,
      channel: unit?.path?.channel || item.channel,
      current,
      proposed,
      delta,
      changePct,
      direction,
      currentCpr: past && past.totalResults > 0 ? past.totalCost / past.totalResults : null,
      plannedCpr: results > 0 ? proposed / results : null,
      reason: reasonOf(item, unit, direction, isRoas),
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.unit.localeCompare(b.unit));
}

/** 결론 문장에 쓸 묶음: 줄이는 채널·늘리는 채널(대상 수와 금액 합). */
export function moveGroups(moves) {
  const group = (direction) => {
    const byChannel = new Map();
    for (const move of moves.filter((item) => item.direction === direction)) {
      const entry = byChannel.get(move.channel) || { channel: move.channel, count: 0, delta: 0 };
      entry.count += 1;
      entry.delta += move.delta;
      byChannel.set(move.channel, entry);
    }
    return [...byChannel.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.channel.localeCompare(b.channel));
  };
  const down = group("down");
  const up = group("up");
  return {
    down,
    up,
    moved: down.reduce((acc, entry) => acc - entry.delta, 0),
    added: up.reduce((acc, entry) => acc + entry.delta, 0),
  };
}

/**
 * "확인할 점" — 배분만으로 해결되지 않아 사람이 해야 하는 일. 실제 신호가 있을 때만, 중요한 순서로.
 * @returns {{code:string, params:object}[]}
 */
export function allocationIssues({ creatives = [], toUnit = new Map(), asOf = "", horizonDays = 14, learningWarnings = [], loserScenario = null, reviewHeldUnits = [], unallocated = 0, addDays }) {
  const issues = [];
  for (const warning of learningWarnings.filter((item) => item.status === "short")) {
    issues.push({ code: "learning_short", params: { unit: warning.unit, creative: warning.creativeId, needed: warning.neededDaily, expected: warning.expectedDaily } });
  }
  if (loserScenario?.base && loserScenario?.scenario && loserScenario.scenario.results > loserScenario.base.results) {
    for (const off of loserScenario.offs.filter((item) => item.multiplier > 0 && item.multiplier < 1)) {
      issues.push({ code: "loser_creative", params: { unit: off.unit, creatives: off.creativeIds, gain: loserScenario.scenario.results - loserScenario.base.results, horizonDays: loserScenario.horizonDays } });
    }
  }
  if (addDays && asOf) {
    const end = addDays(asOf, horizonDays);
    const fatigue = creatives
      .filter((entry) => !entry.ended && entry.share >= 0.3 && entry.fatigue)
      .map((entry) => {
        const date = entry.fatigue.fatigued ? null : Number.isFinite(entry.fatigue.etaDays) ? addDays(asOf, Math.max(1, Math.ceil(entry.fatigue.etaDays))) : undefined;
        return { entry, date };
      })
      .filter(({ entry, date }) => entry.fatigue.fatigued || (date && date <= end))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || b.entry.share - a.entry.share);
    for (const { entry, date } of fatigue) {
      issues.push({ code: entry.fatigue.fatigued ? "fatigue_now" : "fatigue_soon", params: { unit: toUnit.get(entry.nodeKey) || entry.nodeKey, creative: entry.creativeId, date } });
    }
  }
  if (reviewHeldUnits.length) issues.push({ code: "review_held", params: { units: reviewHeldUnits } });
  if (unallocated > 0) issues.push({ code: "unallocated", params: { amount: unallocated } });
  return issues;
}

/**
 * 결론 한 줄(화면은 여러 줄). 감액·증액·효과를 각자 한 줄로 두고, 줄 안은 끊기지 않는 덩어리로 나눈다 —
 * "Google / UAC 외 2곳"처럼 이름 중간에서 줄이 바뀌지 않게 하려는 것이다. 공유·내보내기는 `text`를 쓴다.
 * @param {{groups:ReturnType<typeof moveGroups>, change:number|null, isRoas?:boolean, metricLabel:string, money:(v:number)=>string, locale?:string}} input
 *   change: 평균 지표(CPR 공간 아님, 표시 지표) 상대 변화. null이면 비교할 과거가 없다.
 * @returns {{tone:"good"|"bad"|"neutral", lines:{kind:string, chunks:string[]}[], text:string}}
 */
export function allocationHeadline({ groups, change, isRoas = false, metricLabel, money, locale = "ko" }) {
  const en = locale === "en";
  const names = (list) => (list.length > 1 ? (en ? `${list[0].channel} +${list.length - 1}` : `${list[0].channel} 외 ${list.length - 1}곳`) : list[0].channel);
  const actions = [];
  if (groups.down.length) actions.push({ kind: "down", chunks: en ? [`Cut ${names(groups.down)}`, `by ${money(groups.moved)}/day`] : [names(groups.down), `일 ${money(groups.moved)} 감액`] });
  if (groups.up.length) actions.push({ kind: "up", chunks: en ? [`Add ${money(groups.added)}/day to`, names(groups.up)] : [names(groups.up), `일 ${money(groups.added)} 증액`] });
  const pct = (value) => `${value > 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%`;
  let tone = "neutral";
  let lines;
  if (change != null && (Math.abs(change) < 0.02 || !actions.length)) {
    lines = [
      { kind: "keep", chunks: [en ? "Keep the current split" : "현 배분 유지 권고"] },
      { kind: "effect", chunks: [en ? `reallocation moves ${metricLabel} by ${Math.abs(change * 100).toFixed(1)}%` : `재배분 효과 ${metricLabel} ${Math.abs(change * 100).toFixed(1)}%`] },
    ];
  } else if (change != null) {
    const good = isRoas ? change > 0 : change < 0;
    tone = good ? "good" : "bad";
    lines = [...actions, { kind: "effect", chunks: [good ? `→ ${metricLabel} ${pct(change)}` : (en ? `→ ${metricLabel} worsens ${pct(change)}` : `→ ${metricLabel} ${pct(change)} 악화`)] }];
  } else {
    lines = actions.length ? actions : [{ kind: "keep", chunks: [en ? "Keep the current split" : "현 배분 유지 권고"] }];
  }
  const sentence = (line) => line.chunks.join(" ");
  const effect = lines.find((line) => line.kind === "effect");
  const body = lines.filter((line) => line !== effect).map(sentence).join(" · ");
  const text = effect ? `${body}${effect.chunks[0].startsWith("→") ? " " : " · "}${sentence(effect)}` : body;
  return { tone, lines, text };
}
