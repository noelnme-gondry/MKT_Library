import { currencyOf } from "./transactionMath";
import {
  DAY, column, mean, metric, number, pair as P, quantile, requireInput, result, sum, table, text, timestamp, uniqueKey, validateRows, wilson,
} from "./commonMath";

export function runBasketAssociation(rows, options = {}) {
  validateRows(rows);
  const orders = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], order = text(row.order_id, "order_id", i + 2), product = text(row.product_id, "product_id", i + 2);
    const quantity = number(row.quantity, "quantity", i + 2);
    if (!orders.has(order)) orders.set(order, new Map());
    const basket = orders.get(order);
    basket.set(product, (basket.get(product) || 0) + quantity);
  }
  const baskets = [...orders.values()].map((basket) => {
    requireInput([...basket.values()].every((n) => n >= 0), "negative_basket_quantity");
    return [...basket].filter(([, quantity]) => quantity > 0).map(([product]) => product).sort();
  }).filter((basket) => basket.length);
  requireInput(baskets.length >= 2, "insufficient_baskets");
  const products = new Map(), pairs = new Map();
  for (const basket of baskets) {
    requireInput(basket.length <= 100, "basket_too_wide");
    for (const product of basket) products.set(product, (products.get(product) || 0) + 1);
    requireInput(products.size <= 300, "too_many_products");
    for (let i = 0; i < basket.length; i++) for (let j = i + 1; j < basket.length; j++) {
      const key = JSON.stringify([basket[i], basket[j]]);
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  }
  requireInput(products.size <= 300, "too_many_products");
  const minSupport = number(options.minSupport ?? 0.01, "minSupport", undefined, { min: 0, max: 1 });
  const minCount = number(options.minCount ?? 3, "minCount", undefined, { min: 1, integer: true });
  const rules = [];
  for (const [key, count] of pairs) {
    if (count < minCount || count / baskets.length < minSupport) continue;
    const [a, b] = JSON.parse(key);
    for (const [antecedent, consequent] of [[a, b], [b, a]]) {
      const interval = wilson(count, products.get(antecedent));
      rules.push({ antecedent, consequent, count, antecedentCount: products.get(antecedent), support: count / baskets.length,
        confidence: interval.estimate, low: interval.low, high: interval.high,
        lift: interval.estimate / (products.get(consequent) / baskets.length) });
    }
  }
  rules.sort((a, b) => b.lift - a.lift || b.count - a.count || a.antecedent.localeCompare(b.antecedent));
  return result({
    headline: rules.length ? P("함께 구매된 상품 쌍을 지지도·신뢰도·리프트로 정리했습니다.", "Co-purchased pairs are ranked by support, confidence and lift.")
      : P("설정한 최소 건수와 지지도를 충족한 상품 쌍이 없습니다.", "No product pairs meet the minimum count and support."),
    action: P("실제 주문 건수와 구간을 확인하고, 묶음 판매·추천 효과는 별도 실험으로 확인하세요.",
      "Check order counts and uncertainty, then test bundles or recommendations in a separate experiment."),
    metrics: [metric("baskets", P("환불 후 유효 장바구니", "Positive-net baskets"), baskets.length, "integer"),
      metric("products", P("상품", "Products"), products.size, "integer"),
      metric("rules", P("조건 충족 방향 규칙", "Directional rules meeting thresholds"), rules.length, "integer"),
      metric("size", P("장바구니당 상품 종류", "Distinct products per basket"), mean(baskets.map((b) => b.length)))],
    tables: [table("rules", P("상품 쌍의 관측 연관", "Observed pair associations"), [
      column("antecedent", P("기준 상품", "Antecedent"), "text"), column("consequent", P("동반 상품", "Consequent"), "text"),
      column("count", P("동시 구매 주문", "Joint orders"), "integer"), column("antecedentCount", P("기준 상품 주문", "Antecedent orders"), "integer"),
      column("support", P("지지도", "Support"), "rate"), column("confidence", P("신뢰도 (조건부 비율)", "Confidence (conditional rate)"), "rate"),
      column("low", P("조건부 비율 95% 하한", "Conditional rate 95% lower"), "rate"),
      column("high", P("조건부 비율 95% 상한", "Conditional rate 95% upper"), "rate"), column("lift", P("관측 리프트", "Observed lift")),
    ], rules)],
    method: P("주문별 순수량이 양수인 상품의 존재 여부로 2상품 방향 규칙을 계산합니다. 지지도=P(A∩B), 신뢰도=P(B|A), 리프트=P(B|A)/P(B). 구간은 조건부 비율의 Wilson 95% 개별 구간입니다.",
      "Two-product directional rules use product presence after netting quantities per order. Support=P(A∩B), confidence=P(B|A), lift=P(B|A)/P(B). Intervals are pointwise Wilson 95% intervals for conditional rates."),
    warnings: [P("리프트는 추천·할인의 인과효과가 아닙니다. 여러 규칙 중 선택한 구간은 선택 편향과 다중비교를 보정하지 않습니다. 완전 환불 주문은 분모에서 제외합니다.",
      "Lift is not the causal effect of a recommendation or discount. Selected-rule intervals do not adjust for selection or multiplicity. Fully refunded orders are excluded.")],
    diagnostics: { excludedEmptyBaskets: orders.size - baskets.length, minSupport, minCount, testedPairs: pairs.size },
    figure: { kind: "bar", tableId: "rules", label: "antecedent", value: "lift" },
  });
}

export function runReachFrequency(rows, options = {}) {
  validateRows(rows);
  const identity = options.commonIdentity === true, seen = new Set(), channels = new Map(), people = new Map(), periods = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], line = i + 2, channel = text(row.channel, "channel", line), period = text(row.period, "period", line);
    const frequency = number(row.frequency, "frequency", line, { min: 1, max: 1000000, integer: true });
    const audience = number(row.audience_count, "audience_count", line, { min: 1, integer: true });
    periods.add(period);
    const person = identity ? text(row.user_id, "user_id", line) : null;
    uniqueKey(seen, [channel, identity ? person : frequency, period], line);
    if (identity) {
      requireInput(audience === 1, "identity_count");
      people.set(person, (people.get(person) || 0) + frequency);
    }
    if (!channels.has(channel)) channels.set(channel, new Map());
    const distribution = channels.get(channel);
    distribution.set(frequency, (distribution.get(frequency) || 0) + audience);
  }
  requireInput(periods.size === 1, "mixed_periods");
  const channelRows = [...channels].map(([channel, bins]) => {
    const reach = sum([...bins.values()]), impressions = sum([...bins].map(([frequency, n]) => frequency * n));
    return { channel, reach, impressions, average: impressions / reach };
  });
  requireInput(channelRows.every((row) => Number.isSafeInteger(row.reach) && Number.isSafeInteger(row.impressions)), "numeric_overflow");
  const reachSum = sum(channelRows.map((row) => row.reach)), lower = Math.max(...channelRows.map((row) => row.reach));
  const universe = options.universe === "" || options.universe == null ? null : number(options.universe, "universe", undefined, { min: lower, integer: true });
  const upper = Math.min(reachSum, universe ?? Infinity), exact = identity ? people.size : null;
  requireInput(exact === null || universe === null || exact <= universe, "invalid_universe");
  const distribution = identity ? [...people.values()].reduce((map, frequency) => map.set(frequency, (map.get(frequency) || 0) + 1), new Map()) : null;
  const bins = [...channels].flatMap(([channel, values]) => [...values].sort((a, b) => a[0] - b[0])
    .map(([frequency, audience]) => ({ channel, frequency, audience })));
  if (distribution) bins.push(...[...distribution].sort((a, b) => a[0] - b[0]).map(([frequency, audience]) => ({
    channel: P("플랫폼 간 중복 제거", "Cross-platform deduplicated"), frequency, audience,
  })));
  return result({
    headline: identity ? P("공통 식별자 기준으로 플랫폼 간 도달을 중복 제거했습니다.", "Cross-platform reach is deduplicated using declared common identifiers.")
      : P("플랫폼 간 중복은 식별되지 않아 도달 범위만 계산했습니다.", "Cross-platform overlap is unidentified; only reach bounds are computed."),
    action: P("기간과 모집단을 일치시키고, 같은 사람을 뜻하는 공통 식별자가 있을 때만 정확한 중복 제거값을 사용하세요.",
      "Align periods and populations; use exact deduplication only when identifiers refer to the same person across platforms."),
    metrics: [metric("exact", P("식별자 기준 중복 제거 도달", "Identifier-deduplicated reach"), exact, "integer"),
      metric("lower", P("도달 하한 (산술 경계)", "Reach lower bound (arithmetic)"), lower, "integer"),
      metric("upper", P("도달 상한 (산술 경계)", "Reach upper bound (arithmetic)"), upper, "integer"),
      metric("impressions", P("전체 노출", "Total impressions"), sum(channelRows.map((r) => r.impressions)), "integer")],
    tables: [table("channels", P("플랫폼별 도달과 빈도", "Platform reach and frequency"), [
      column("channel", P("플랫폼", "Platform"), "text"), column("reach", P("도달", "Reach"), "integer"),
      column("impressions", P("노출", "Impressions"), "integer"), column("average", P("평균 빈도", "Average frequency")),
    ], channelRows), table("distribution", P("정확한 빈도별 도달", "Reach by exact frequency"), [
      column("channel", P("범위", "Scope"), "text"), column("frequency", P("빈도", "Frequency"), "integer"),
      column("audience", P("도달", "Reach"), "integer"),
    ], bins)],
    method: P("집계 빈도 구간은 서로 배타적인 정확한 빈도여야 합니다. 공통 식별자가 없으면 합집합 도달은 최대 플랫폼 도달 이상, 플랫폼 도달 합 이하입니다. 이 범위는 신뢰구간이 아닙니다.",
      "Aggregated frequency bins must be mutually exclusive exact frequencies. Without shared identity, union reach is bounded by the maximum platform reach and the sum of platform reaches. These are not confidence intervals."),
    warnings: [P("서로 다른 기간·중복되는 1+ 또는 2+ 누적 빈도 구간을 합치면 도달이 중복됩니다. 플랫폼별 사용자 ID가 같아 보인다는 이유만으로 공통 식별자로 간주할 수 없습니다.",
      "Different periods or cumulative 1+/2+ frequency bins double-count reach. Matching-looking platform IDs do not establish a shared identity.")],
    diagnostics: { mode: identity ? "common_identity" : "aggregate_bounds", period: [...periods][0], universe },
    figure: { kind: "bar", tableId: "channels", label: "channel", value: "reach" },
  });
}

export function runTrafficQuality(rows, options = {}) {
  validateRows(rows);
  const currency = currencyOf(rows), basis = options.clickBasis ?? "net";
  requireInput(["net", "gross"].includes(basis), "invalid_click_basis");
  const seen = new Set(), data = rows.map((row, i) => {
    const line = i + 2, channel = text(row.channel, "channel", line), time = timestamp(row.date, "date", line);
    requireInput(time % DAY === 0, "daily_panel_required");
    uniqueKey(seen, [channel, time], line);
    const clicks = number(row.clicks, "clicks", line, { min: 0, integer: true });
    const invalid = number(row.invalid_clicks, "invalid_clicks", line, { min: 0, integer: true });
    const conversions = number(row.conversions, "conversions", line, { min: 0 });
    const cost = number(row.cost, "cost", line, { min: 0 });
    requireInput(basis !== "gross" || invalid <= clicks, "invalid_exceeds_gross");
    const valid = basis === "gross" ? clicks - invalid : clicks, gross = basis === "gross" ? clicks : clicks + invalid;
    return { date: new Date(time).toISOString().slice(0, 10), time, channel, clicks, invalid, valid, gross, conversions, cost,
      invalidRate: gross ? invalid / gross : null, cpc: valid ? cost / valid : null, conversionRate: valid ? conversions / valid : null };
  }).sort((a, b) => a.time - b.time || a.channel.localeCompare(b.channel));
  const histories = new Map();
  for (const row of data) {
    const history = histories.get(row.channel) || [], previous = history.slice(-14);
    row.robustZ = null;
    if (previous.length >= 7) {
      const median = quantile(previous, 0.5), mad = quantile(previous.map((value) => Math.abs(value - median)), 0.5);
      if (mad > 0 && row.invalidRate !== null) row.robustZ = (row.invalidRate - median) / (1.4826 * mad);
    }
    row.flag = row.robustZ === null ? P("기준 변동 추정 불가", "Baseline variation unavailable")
      : row.robustZ > 3.5 ? P("과거 대비 높은 비율", "High relative to history") : P("상승 기준 미충족", "High-rate criterion not met");
    if (row.invalidRate !== null) history.push(row.invalidRate);
    histories.set(row.channel, history);
  }
  const gross = sum(data.map((r) => r.gross)), valid = sum(data.map((r) => r.valid)), invalid = sum(data.map((r) => r.invalid));
  const cost = sum(data.map((r) => r.cost)), conversions = sum(data.map((r) => r.conversions));
  return result({
    headline: P("플랫폼의 무효 클릭 처리 기준을 구분해 효율을 계산했습니다.", "Efficiency is calculated using the declared platform invalid-click basis."),
    action: P("비율 급증 기간의 유입 위치·지면·추적 변경을 확인하고 플랫폼 무효 트래픽 보고서와 대조하세요.",
      "Review locations, placements and tracking changes during spikes against the platform's invalid-traffic report."),
    metrics: [metric("invalid", P("총 클릭 시도 대비 무효 비율", "Invalid share of gross click attempts"), gross ? invalid / gross : null, "rate"),
      metric("valid", P("유효 클릭", "Valid clicks"), valid, "integer"),
      metric("cpc", P("유효 클릭당 비용", "Cost per valid click"), valid ? cost / valid : null, "money"),
      metric("flags", P("과거 대비 상승 신호 기간", "Periods with historical high-rate signals"), data.filter((r) => r.robustZ > 3.5).length, "integer")],
    tables: [table("quality", P("날짜·채널별 품질 진단", "Quality diagnostics by date and channel"), [
      column("date", P("날짜", "Date"), "text"), column("channel", P("채널", "Channel"), "text"),
      column("gross", P("총 클릭 시도", "Gross attempts"), "integer"), column("valid", P("유효 클릭", "Valid clicks"), "integer"),
      column("invalid", P("무효 클릭", "Invalid clicks"), "integer"), column("invalidRate", P("무효 비율", "Invalid share"), "rate"),
      column("cpc", P("유효 CPC", "Valid-click CPC"), "money"), column("conversionRate", P("유효 클릭당 전환 수", "Conversions per valid click")),
      column("robustZ", P("과거 MAD 표준화 차이", "Historical MAD-standardized difference")), column("flag", P("신호", "Signal"), "text"),
    ], data)],
    method: P("순 클릭 입력이면 무효 클릭을 다시 차감하지 않습니다. 총 클릭 입력일 때만 유효=총−무효입니다. 이상 신호는 같은 채널의 이전 최대 14개 유효 관측 비율의 중앙값·MAD 기준이며 최소 7개가 필요합니다.",
      "Net-reported clicks are not filtered twice. Only gross input uses valid=gross−invalid. Signals use the prior up-to-14 valid rates from the same channel, with median/MAD and at least seven observations."),
    warnings: [P("이상 신호는 부정행위 판정이 아닙니다. 플랫폼의 무효 분류가 정답임을 검증한 것도 아닙니다. 전환 수는 반복·기여 전환을 포함할 수 있어 클릭당 전환을 확률로 해석하지 않습니다.",
      "Anomalies do not establish fraud or validate the platform's classification. Conversion counts may include repeated or attributed conversions; conversions per click are not necessarily a probability.")],
    diagnostics: { currency, clickBasis: basis, gross, valid, invalid, cost, conversions, baselineWindow: 14, minBaseline: 7 },
    figure: { kind: "line", tableId: "quality", label: "date", value: "invalidRate", series: "channel" },
  });
}
