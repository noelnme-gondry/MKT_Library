const WINDOW_DAYS = 7;

function sumMetrics(records, costKey, resultKey) {
  return records.reduce((total, record) => ({
    cost: total.cost + (Number(record.metrics?.[costKey]) || 0),
    results: total.results + (Number(record.metrics?.[resultKey]) || 0),
  }), { cost: 0, results: 0 });
}

function ratioChange(previous, current) {
  const previousCpr = previous.results > 0 ? previous.cost / previous.results : null;
  const currentCpr = current.results > 0 ? current.cost / current.results : null;
  if (!previousCpr || !currentCpr) return null;
  return (currentCpr - previousCpr) / previousCpr;
}

// Router용 1차 관찰 신호. 원인으로 단정하지 않고, 최근 악화가 큰 곳부터
// "확인할 분석"을 고르는 데만 쓴다. 계산은 모두 브라우저 메모리에서 끝난다.
export function buildRouterDiagnosis({ canonicalData, mapping = {}, locale = "ko" } = {}) {
  const records = canonicalData?.records || [];
  const mapped = new Set(Object.values(mapping).filter((value) => value && value !== "__ignore__"));
  const costKey = mapped.has("cost") ? "cost" : mapped.has("spend") ? "spend" : null;
  const resultKey = mapped.has("actions") ? "actions" : mapped.has("installs") ? "installs" : null;
  const dates = [...new Set(records.map((record) => record.date).filter(Boolean))].sort();
  if (!costKey || !resultKey || dates.length < WINDOW_DAYS * 2) return { byTool: {}, windowDays: WINDOW_DAYS };

  const previousDates = new Set(dates.slice(-WINDOW_DAYS * 2, -WINDOW_DAYS));
  const currentDates = new Set(dates.slice(-WINDOW_DAYS));
  const previous = sumMetrics(records.filter((record) => previousDates.has(record.date)), costKey, resultKey);
  const current = sumMetrics(records.filter((record) => currentDates.has(record.date)), costKey, resultKey);
  const change = ratioChange(previous, current);
  if (change == null || change < 0.1) return { byTool: {}, windowDays: WINDOW_DAYS };

  const byChannel = new Map();
  records.forEach((record) => {
    const channel = record.dimensions?.channel;
    if (!channel || (!previousDates.has(record.date) && !currentDates.has(record.date))) return;
    if (!byChannel.has(channel)) byChannel.set(channel, { previous: [], current: [] });
    byChannel.get(channel)[previousDates.has(record.date) ? "previous" : "current"].push(record);
  });
  const channelChanges = [...byChannel.entries()].map(([channel, windows]) => ({
    channel,
    change: ratioChange(sumMetrics(windows.previous, costKey, resultKey), sumMetrics(windows.current, costKey, resultKey)),
  })).filter((item) => item.change != null);
  const largestChannel = channelChanges.sort((a, b) => b.change - a.change)[0];
  const metric = resultKey === "actions" ? "CPA" : "CPI";
  const overallPct = Math.round(change * 100);
  const channelPhrase = largestChannel && largestChannel.change > 0.1
    ? (locale === "en" ? `${largestChannel.channel} has the largest worsening signal.` : `${largestChannel.channel}에서 악화 신호가 가장 큽니다.`)
    : (locale === "en" ? "Check the largest channel-level change first." : "채널별 변화부터 확인해 보세요.");
  const reason = locale === "en"
    ? `The latest 7-day ${metric} is ${overallPct}% worse than the prior 7 days. ${channelPhrase}`
    : `최근 7일 ${metric}가 직전 7일보다 ${overallPct}% 악화됐습니다. ${channelPhrase}`;
  return {
    windowDays: WINDOW_DAYS,
    overall: { metric, change, previous, current },
    byTool: {
      "5-21": { score: 100, reason },
      "5-2": { score: 40, reason },
    },
  };
}
