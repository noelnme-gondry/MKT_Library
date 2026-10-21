import {
  DAY, column, isoDay, mean, metric, number, observationEnd, pair as P,
  requireInput, result, sum, table, text, timestamp, uniqueKey, validateRows,
} from "./commonMath";

export function currencyOf(rows) {
  const currencies = new Set(rows.map((row, i) => text(row.currency_code, "currency_code", i + 2).toUpperCase()));
  requireInput(currencies.size === 1, "mixed_currency");
  const currency = [...currencies][0];
  requireInput(/^[A-Z]{3}$/.test(currency), "invalid_currency");
  return currency;
}

// Append-only order ledger: the positive purchase and its later refunds are
// distinct transactions. Refund timestamps must never become purchase recency.
export function ledger(rows, end) {
  validateRows(rows);
  const currency = currencyOf(rows), seen = new Set(), orders = new Map();
  let excludedFutureRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i], line = i + 2;
    const id = text(raw.transaction_id, "transaction_id", line);
    uniqueKey(seen, [id], line);
    const orderId = text(raw.order_id, "order_id", line), customer = text(raw.customer_id, "customer_id", line);
    const time = timestamp(raw.recorded_at, "recorded_at", line);
    const revenue = number(raw.net_revenue, "net_revenue", line), cost = number(raw.variable_cost, "variable_cost", line);
    const acquisition = raw.acquisition_cost === "" || raw.acquisition_cost == null ? null
      : number(raw.acquisition_cost, "acquisition_cost", line, { min: 0 });
    if (time > end) { excludedFutureRows++; continue; }
    if (!orders.has(orderId)) orders.set(orderId, { id: orderId, customer, entries: [] });
    const order = orders.get(orderId);
    requireInput(order.customer === customer, "order_customer_conflict", { row: line });
    order.entries.push({ time, revenue, cost, acquisition });
  }
  requireInput(orders.size > 0, "empty_scope");
  const customers = new Map();
  for (const order of orders.values()) {
    order.entries.sort((a, b) => a.time - b.time);
    const purchases = order.entries.filter((entry) => entry.revenue > 0);
    requireInput(purchases.length === 1 && order.entries[0].revenue > 0, "invalid_order_ledger");
    order.time = purchases[0].time;
    order.revenue = sum(order.entries.map((entry) => entry.revenue));
    order.margin = sum(order.entries.map((entry) => entry.revenue - entry.cost));
    requireInput(order.revenue >= -1e-8, "over_refund");
    if (!customers.has(order.customer)) customers.set(order.customer, { id: order.customer, orders: [] });
    customers.get(order.customer).orders.push(order);
  }
  for (const customer of customers.values()) {
    customer.orders.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    customer.first = customer.orders[0].time;
    const acquisitionEntries = customer.orders.flatMap((order) => order.entries).filter((entry) => entry.acquisition !== null);
    requireInput(acquisitionEntries.length <= 1 && acquisitionEntries.every((entry) => entry.time === customer.first),
      "repeated_acquisition_cost");
    customer.acquisition = acquisitionEntries[0]?.acquisition ?? null;
    customer.entries = customer.orders.flatMap((order) => order.entries).sort((a, b) => a.time - b.time);
    customer.purchases = customer.orders.filter((order) => order.revenue > 1e-8);
    customer.revenue = sum(customer.orders.map((order) => order.revenue));
    customer.margin = sum(customer.orders.map((order) => order.margin));
  }
  return { customers: [...customers.values()], orders: [...orders.values()], currency, excludedFutureRows };
}

export function quintiles(values, reverse = false) {
  const sorted = [...values].sort((a, b) => a - b), positions = new Map();
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[start]) end++;
    const percentile = (start + end + 1) / (2 * sorted.length);
    positions.set(sorted[start], Math.min(5, Math.floor((reverse ? 1 - percentile : percentile) * 5) + 1));
    start = end + 1;
  }
  return values.map((value) => positions.get(value));
}

export function runCustomerEconomics(rows, options = {}) {
  const end = observationEnd(options.observationEnd);
  const data = ledger(rows, end), active = data.customers.filter((customer) => customer.purchases.length);
  const recencies = active.map((customer) => Math.floor((end - customer.purchases.at(-1).time) / DAY));
  const r = quintiles(recencies, true), f = quintiles(active.map((c) => c.purchases.length));
  const m = quintiles(active.map((c) => c.revenue));
  const scores = new Map(active.map((customer, i) => [customer.id, { recency: recencies[i], r: r[i], f: f[i], m: m[i] }]));
  const customerRows = data.customers.map((customer) => {
    let cumulative = 0, recovery = null;
    if (customer.acquisition !== null) {
      // Combine simultaneous entries before finding a sustained crossing.
      const days = new Map();
      for (const entry of customer.entries) days.set(entry.time, (days.get(entry.time) || 0) + entry.revenue - entry.cost);
      for (const [time, margin] of days) {
        cumulative += margin;
        if (cumulative < customer.acquisition) recovery = null;
        else if (recovery === null) recovery = time;
      }
    }
    const score = scores.get(customer.id);
    return { customer: customer.id, recency: score?.recency ?? null, frequency: customer.purchases.length,
      revenue: customer.revenue, margin: customer.margin, acquisition: customer.acquisition,
      rfm: score ? `${score.r}${score.f}${score.m}` : P("분류 불가", "Unclassified"),
      paybackDays: recovery === null ? null : (recovery - customer.first) / DAY,
      paybackStatus: customer.acquisition === null ? P("획득비 미입력", "Acquisition cost missing")
        : recovery === null ? P("관측 종료까지 미회수", "Unrecovered at observation end") : P("현재까지 회수 유지", "Recovery sustained to observation end"),
    };
  });
  const cohorts = new Map();
  for (const customer of data.customers) {
    const cohort = isoDay(customer.first).slice(0, 7);
    if (!cohorts.has(cohort)) cohorts.set(cohort, []);
    cohorts.get(cohort).push(customer);
  }
  const horizon = number(options.horizonDays ?? 90, "horizonDays", undefined, { min: 1, max: 730, integer: true });
  const cohortRows = [...cohorts].sort().map(([cohort, customers]) => {
    const mature = customers.filter((customer) => customer.first + horizon * DAY <= end);
    const margins = mature.map((customer) => sum(customer.entries.filter((entry) => entry.time < customer.first + horizon * DAY)
      .map((entry) => entry.revenue - entry.cost)));
    const acquisitionKnown = mature.filter((customer) => customer.acquisition !== null);
    return { cohort, customers: customers.length, mature: mature.length, excluded: customers.length - mature.length,
      margin: mean(margins), acquisition: acquisitionKnown.length === mature.length && mature.length
        ? mean(acquisitionKnown.map((c) => c.acquisition)) : null };
  });
  const known = customerRows.filter((c) => c.acquisition !== null), recovered = known.filter((c) => c.paybackDays !== null);
  return result({
    headline: P("환불을 반영한 고객 가치와 회수 상태를 계산했습니다.", "Customer value and recovery status now include recorded refunds."),
    action: P("같은 관측 길이의 코호트를 비교하고, 미회수 고객을 제외하지 않은 상태에서 획득비를 점검하세요.",
      "Compare cohorts at equal observation lengths and keep unrecovered customers in acquisition-cost reviews."),
    metrics: [
      metric("customers", P("관측 고객", "Observed customers"), data.customers.length, "integer"),
      metric("margin", P("관측 고객당 공헌이익", "Observed contribution per customer"), mean(customerRows.map((c) => c.margin)), "money"),
      metric("recovered", P("회수 유지 고객 / 획득비 입력 고객", "Recovered / acquisition-cost-known customers"), known.length ? recovered.length / known.length : null, "rate"),
      metric("unrecovered", P("관측 종료까지 미회수", "Unrecovered at observation end"), known.length - recovered.length, "integer"),
    ],
    tables: [
      table("cohorts", P("같은 관측 길이의 코호트", "Cohorts with equal observation length"), [
        column("cohort", P("첫 관측 구매월", "First observed purchase month"), "text"), column("customers", P("고객", "Customers"), "integer"),
        column("mature", P("관측 완료", "Fully observed"), "integer"), column("excluded", P("미성숙 제외", "Immature, excluded"), "integer"),
        column("margin", P("고객당 공헌이익", "Contribution per customer"), "money"), column("acquisition", P("고객당 획득비", "Acquisition cost per customer"), "money"),
      ], cohortRows),
      table("customers", P("RFM과 고객별 회수 상태", "RFM and customer recovery"), [
        column("customer", P("고객", "Customer"), "text"), column("recency", P("최근 구매 후 일수", "Days since purchase")),
        column("frequency", P("잔존 구매 건수", "Positive-net orders"), "integer"), column("revenue", P("순매출", "Net revenue"), "money"),
        column("margin", P("공헌이익", "Contribution"), "money"), column("rfm", P("RFM 점수", "RFM score"), "text"),
        column("paybackDays", P("회수까지 일수", "Days to sustained recovery")), column("paybackStatus", P("회수 상태", "Recovery status"), "text"),
      ], customerRows),
    ],
    method: P("RFM은 환불 후 양수인 주문으로 계산하며 동점은 중간 순위를 공유합니다. 공헌이익은 순매출−변동비입니다. 코호트 값은 지정 일수의 관측 합계이며 미래 LTV 예측이 아닙니다.",
      "RFM uses positive-net orders with midrank tie handling. Contribution = net revenue minus variable costs. Cohort values are observed totals over the chosen horizon, not predicted lifetime value."),
    warnings: [P("첫 구매 이전 이력이 없으면 신규 고객 코호트가 아니라 첫 관측 구매 코호트입니다. 추가 환불은 현재의 회수 상태를 바꿀 수 있습니다.",
      "Without earlier history these are first-observed-purchase cohorts, not verified new customers. Later refunds can reverse recovery.")],
    diagnostics: { currency: data.currency, observationEnd: isoDay(end), horizonDays: horizon,
      acquisitionKnown: known.length, excludedFutureRows: data.excludedFutureRows },
    figure: { kind: "bar", tableId: "cohorts", label: "cohort", value: "margin" },
  });
}
