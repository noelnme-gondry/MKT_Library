import { currencyOf } from "./transactionMath";
import {
  DAY, column, mean, metric, number, observationEnd, pair as P, requireInput, result, sum, table, text, timestamp, uniqueKey, validateRows, wilson,
} from "./commonMath";

export function runB2bPipeline(rows, options = {}) {
  validateRows(rows);
  const currency = currencyOf(rows), end = observationEnd(options.observationEnd);
  const stages = String(options.stages ?? "").split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  const won = text(options.wonStage ?? "won", "wonStage"), lost = text(options.lostStage ?? "lost", "lostStage");
  requireInput(stages.length >= 2 && new Set([...stages, won, lost]).size === stages.length + 2, "invalid_stages");
  const horizon = number(options.horizonDays ?? 90, "horizonDays", undefined, { min: 1, max: 730 }) * DAY;
  const seen = new Set(), deals = new Map();
  let excludedFutureRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], line = i + 2, deal = text(row.deal_id, "deal_id", line);
    const time = timestamp(row.event_time, "event_time", line, { exactTime: true });
    uniqueKey(seen, [deal, time], line);
    const stage = text(row.stage, "stage", line);
    requireInput([...stages, won, lost].includes(stage), "unknown_stage", { row: line, field: "stage" });
    const amount = number(row.amount, "amount", line, { min: 0 }), channel = text(row.channel, "channel", line);
    if (time > end) { excludedFutureRows++; continue; }
    if (!deals.has(deal)) deals.set(deal, []);
    deals.get(deal).push({ time, stage, amount, channel });
  }
  requireInput(deals.size > 0, "empty_scope");
  const histories = [...deals].map(([deal, events]) => {
    events.sort((a, b) => a.time - b.time);
    const first = events[0], current = events.at(-1), firstTerminal = events.find((e) => e.stage === won || e.stage === lost);
    let regressions = 0, reopenings = 0;
    for (let i = 1; i < events.length; i++) {
      const before = events[i - 1].stage, after = events[i].stage;
      if ([won, lost].includes(before) && stages.includes(after)) reopenings++;
      if (stages.includes(before) && stages.includes(after) && stages.indexOf(after) < stages.indexOf(before)) regressions++;
    }
    const completeStart = first.stage === stages[0], mature = completeStart && first.time + horizon <= end;
    return { deal, events, first, current, firstTerminal, regressions, reopenings, completeStart, mature,
      wonWithin: mature && firstTerminal?.stage === won && firstTerminal.time <= first.time + horizon,
      cycleDays: firstTerminal ? (firstTerminal.time - first.time) / DAY : null };
  });
  const mature = histories.filter((h) => h.mature);
  const interval = wilson(mature.filter((h) => h.wonWithin).length, mature.length);
  const stageRows = stages.map((stage) => {
    const eligible = histories.filter((h) => h.mature);
    const reached = eligible.filter((h) => h.events.some((event) => event.stage === stage && event.time <= h.first.time + horizon)).length;
    const rate = wilson(reached, eligible.length);
    return { stage, reached, denominator: eligible.length, estimate: rate?.estimate ?? null, low: rate?.low ?? null, high: rate?.high ?? null,
      current: histories.filter((h) => h.current.stage === stage).length,
      pipeline: sum(histories.filter((h) => h.current.stage === stage).map((h) => h.current.amount)) };
  });
  const channelRows = [...new Set(histories.map((h) => h.first.channel))].sort().map((channel) => {
    const group = histories.filter((h) => h.first.channel === channel), eligible = group.filter((h) => h.mature);
    const rate = wilson(eligible.filter((h) => h.wonWithin).length, eligible.length);
    return { channel, deals: group.length, eligible: eligible.length, estimate: rate?.estimate ?? null, low: rate?.low ?? null, high: rate?.high ?? null };
  });
  return result({
    headline: P("미종결·단계 후퇴·재개 딜을 구분해 파이프라인을 계산했습니다.", "Pipeline results distinguish open, regressed and reopened deals."),
    action: P("동일 기간을 관측한 유입 코호트의 수주율을 비교하고, 현재 단계 잔류 딜을 별도로 확인하세요.",
      "Compare win rates for acquisition cohorts observed over the same horizon; review deals still in each stage separately."),
    metrics: [metric("win", P("관측 완료 딜의 기간 내 첫 수주율", "First-win rate within the horizon, mature deals"), interval?.estimate ?? null, "rate", interval),
      metric("open", P("현재 미종결 딜", "Currently open deals"), histories.filter((h) => stages.includes(h.current.stage)).length, "integer"),
      metric("pipeline", P("현재 미종결 파이프라인 금액", "Current open pipeline amount"), sum(histories.filter((h) => stages.includes(h.current.stage)).map((h) => h.current.amount)), "money"),
      metric("reopened", P("재개 이력 딜", "Deals with reopening history"), histories.filter((h) => h.reopenings).length, "integer")],
    tables: [table("stages", P("단계 도달과 현재 잔류", "Stage reach and current occupancy"), [
      column("stage", P("단계", "Stage"), "text"), column("reached", P("기간 내 도달", "Reached within horizon"), "integer"),
      column("denominator", P("관측 완료 모수", "Mature denominator"), "integer"), column("estimate", P("도달률", "Reach rate"), "rate"),
      column("low", P("95% 하한", "95% lower"), "rate"), column("high", P("95% 상한", "95% upper"), "rate"),
      column("current", P("현재 잔류", "Currently at stage"), "integer"), column("pipeline", P("현재 금액", "Current amount"), "money"),
    ], stageRows), table("channels", P("최초 유입별 첫 수주율", "First-win rate by initial source"), [
      column("channel", P("최초 유입", "Initial source"), "text"), column("deals", P("딜", "Deals"), "integer"),
      column("eligible", P("관측 완료 모수", "Mature denominator"), "integer"), column("estimate", P("수주율", "Win rate"), "rate"),
      column("low", P("95% 하한", "95% lower"), "rate"), column("high", P("95% 상한", "95% upper"), "rate"),
    ], channelRows), table("deals", P("딜 이력과 검열 상태", "Deal history and censoring status"), [
      column("deal", P("딜", "Deal"), "text"), column("stage", P("현재 단계", "Current stage"), "text"),
      column("status", P("기간 내 수주율 포함 상태", "Fixed-horizon eligibility"), "text"),
      column("regressions", P("단계 후퇴 횟수", "Regressions"), "integer"), column("reopenings", P("재개 횟수", "Reopenings"), "integer"),
      column("cycleDays", P("첫 종결까지 일수", "Days to first closure")), column("ageDays", P("현재 관측 일수", "Observed age, days")),
    ], histories.map((h) => ({ deal: h.deal, stage: h.current.stage, regressions: h.regressions, reopenings: h.reopenings,
      cycleDays: h.cycleDays, ageDays: (end - h.first.time) / DAY,
      status: !h.completeStart ? P("최초 단계 누락", "Initial stage missing") : h.mature ? P("포함", "Included") : P("관측 기간 미완료", "Observation incomplete") })))],
    method: P("최초 단계부터 지정 기간이 지난 딜만 고정 기간 첫 수주율의 분모에 포함합니다. 첫 실패 종결은 경쟁 결과이며 검열로 빼지 않습니다. 비율은 Wilson 95% 구간입니다. 현재 파이프라인은 마지막 단계·금액으로 계산합니다.",
      "Fixed-horizon first-win rates include only deals observed from the initial stage for the full horizon. First losses are competing outcomes, not censored away. Rates use Wilson 95% intervals. Current pipeline uses the latest stage and amount."),
    warnings: [P("종결 딜만의 평균 영업기간은 진행 중인 딜의 미래 종결 시간을 추정하지 않습니다. 재개 후 수주는 첫 종결 수주율과 구분합니다. 채널 차이는 인과효과가 아닙니다.",
      "Mean cycle time among closed deals does not estimate open deals' future closure times. Wins after reopening differ from first-closure win rates. Source differences are not causal effects.")],
    diagnostics: { currency, horizonDays: horizon / DAY, matureDeals: mature.length,
      incompleteHistory: histories.filter((h) => !h.completeStart).length, immatureDeals: histories.filter((h) => h.completeStart && !h.mature).length,
      closedDealMeanDays: mean(histories.filter((h) => h.completeStart && h.cycleDays !== null).map((h) => h.cycleDays)), excludedFutureRows },
    figure: { kind: "bar", tableId: "stages", label: "stage", value: "current" },
  });
}
