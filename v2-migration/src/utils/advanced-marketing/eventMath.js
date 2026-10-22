import { DAY, column, metric, number, observationEnd, pair as P, requireInput, result, table, text, timestamp, uniqueKey, validateRows, wilson } from "./commonMath";

export function runUserFunnel(rows, options = {}) {
  validateRows(rows);
  const end = observationEnd(options.observationEnd);
  const steps = String(options.steps ?? "").split(/[\n,]/).map((step) => step.trim()).filter(Boolean);
  requireInput(steps.length >= 2 && steps.length <= 8 && new Set(steps).size === steps.length, "invalid_funnel_steps");
  const window = number(options.windowDays ?? 7, "windowDays", undefined, { min: 1, max: 90 }) * DAY;
  const returnEvent = text(options.returnEvent, "returnEvent"), seen = new Set(), users = new Map();
  let futureRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], line = i + 2;
    uniqueKey(seen, [text(row.event_id, "event_id", line)], line);
    const user = text(row.user_id, "user_id", line);
    const time = timestamp(row.event_time, "event_time", line, { exactTime: true });
    const name = text(row.event_name, "event_name", line);
    if (time > end) { futureRows++; continue; }
    if (!users.has(user)) users.set(user, []);
    users.get(user).push({ time, name });
  }
  const counts = steps.map(() => 0), cohort = [];
  let immature = 0, ambiguousUsers = 0;
  for (const events of users.values()) {
    events.sort((a, b) => a.time - b.time);
    const first = events.find((event) => event.name === steps[0]);
    if (!first) continue;
    cohort.push({ first: first.time, events });
    if (first.time + window > end) { immature++; continue; }
    let stage = 0, previousTime = first.time;
    counts[0]++;
    let tied = false;
    for (const event of events) {
      if (stage === steps.length - 1 || event.time > first.time + window) break;
      if (event.time < first.time || event.name !== steps[stage + 1]) continue;
      if (event.time === previousTime) { tied = true; continue; }
      if (event.time > previousTime) { stage++; counts[stage]++; previousTime = event.time; }
    }
    if (tied) ambiguousUsers++;
  }
  requireInput(cohort.length > 0, "no_funnel_entries");
  const funnel = steps.map((step, i) => {
    const interval = wilson(counts[i], counts[0]);
    return { step, count: counts[i], denominator: counts[0], estimate: interval?.estimate ?? null,
      low: interval?.low ?? null, high: interval?.high ?? null, stepRate: i && counts[i - 1] ? counts[i] / counts[i - 1] : null };
  });
  const retention = [1, 7, 30].map((day) => {
    let eligible = 0, returned = 0;
    for (const { first, events } of cohort) {
      const target = Math.floor(first / DAY) * DAY + day * DAY;
      if (target + DAY - 1 > end) continue;
      eligible++;
      if (events.some((event) => event.name === returnEvent && event.time >= target && event.time < target + DAY)) returned++;
    }
    const interval = wilson(returned, eligible);
    return { day, returned, eligible, excluded: cohort.length - eligible,
      estimate: interval?.estimate ?? null, low: interval?.low ?? null, high: interval?.high ?? null };
  });
  const rateColumns = [column("estimate", P("비율", "Rate"), "rate"),
    column("low", P("95% 하한", "95% lower"), "rate"), column("high", P("95% 상한", "95% upper"), "rate")];
  return result({
    headline: counts[0] ? P("이벤트 순서와 관측 완료 기간을 반영했습니다.", "Event order and complete observation windows are accounted for.")
      : P("퍼널 관측 기간을 채운 사용자가 아직 없습니다.", "No users have completed the funnel observation window yet."),
    action: P("이탈이 큰 단계를 확인한 뒤 이벤트 누락·같은 시각 기록·코호트 성숙도를 함께 점검하세요.",
      "Review the largest drop-off together with missing events, tied timestamps and cohort maturity."),
    metrics: [metric("entry", P("진입 사용자", "Entering users"), cohort.length, "integer"),
      metric("mature", P("퍼널 관측 완료 사용자", "Users with full funnel observation"), counts[0], "integer"),
      metric("completion", P("전체 퍼널 완료율", "Full-funnel completion"), funnel.at(-1).estimate, "rate", funnel.at(-1)),
      metric("d7", P("정확히 7일째 리텐션", "Exact day-7 retention"), retention[1].estimate, "rate", retention[1])],
    tables: [table("funnel", P("순서가 있는 닫힌 퍼널", "Ordered closed funnel"), [
      column("step", P("단계", "Step"), "text"), column("count", P("도달 사용자", "Users reached"), "integer"),
      column("denominator", P("동일 진입 모수", "Same entry denominator"), "integer"), ...rateColumns,
      column("stepRate", P("직전 단계 대비", "From previous step"), "rate"),
    ], funnel), table("retention", P("UTC 날짜 기준 리텐션", "Retention by UTC calendar day"), [
      column("day", P("기준일 이후 일수", "Day after entry"), "integer"), column("returned", P("재방문 사용자", "Returning users"), "integer"),
      column("eligible", P("관측 완료 모수", "Fully observed denominator"), "integer"),
      column("excluded", P("미성숙 제외", "Immature, excluded"), "integer"), ...rateColumns,
    ], retention)],
    method: P("첫 진입마다 정해진 창 안에서 시각이 엄격히 증가하는 이벤트를 셉니다. 중간 다른 이벤트는 허용합니다. 리텐션은 첫 진입의 UTC 날짜 이후 정확히 N일째이며 비율 구간은 Wilson 95%입니다.",
      "Starting at each user's first entry, steps must occur at strictly increasing timestamps within the window; intervening events are allowed. Retention is exact Nth UTC calendar-day return with Wilson 95% intervals."),
    warnings: [P("동일 시각의 서로 다른 단계는 순서를 확인할 수 없어 완료로 인정하지 않습니다. 관측 기간이 덜 찬 사용자는 성공 여부와 관계없이 분모에서 제외합니다.",
      "Different steps at the same timestamp cannot establish order and are not counted as completion. Immature users are excluded regardless of observed success.")],
    diagnostics: { observationEnd: options.observationEnd, windowDays: window / DAY, immature, ambiguousUsers, futureRows, returnEvent },
    figure: { kind: "bar", tableId: "funnel", label: "step", value: "estimate" },
  });
}
