import customerLedger from "./fixtures/customer-ledger.json";
import { ADVANCED_BY_ID, advancedDefaults } from "./registry";
import { ADVANCED_FIELDS } from "./fields";

const date = (day) => new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
const instant = (day, hour = 0) => `${date(day)}T${String(hour).padStart(2, "0")}:00:00Z`;
export function advancedDemoOptions(id) {
  const defaults = advancedDefaults(id);
  const confirmed = Object.fromEntries(ADVANCED_BY_ID[id].options.filter((o) => o.type === "checkbox").map((o) => [o.key, true]));
  return { ...defaults, ...confirmed, observationEnd: "2026-09-30", calibrationEnd: "2026-06-30", treatedRegion: "Treated", interventionDate: date(70),
    ...(id === "5-42" ? { commonIdentity: false } : {}) };
}
export function advancedDemoRows(id) {
  if (id === "5-32" || id === "5-35") return customerLedger.map(([customer_id, order_id, recorded_at, net_revenue, variable_cost], i) => ({
    customer_id, order_id, transaction_id: `tx${i}`, recorded_at, net_revenue, variable_cost, currency_code: "KRW",
    acquisition_cost: order_id.endsWith("-0") ? 12000 : "",
  }));
  if (id === "5-33") return Array.from({ length: 100 }, (_, i) => {
    const first = i % 30;
    return [{ event_name: "visit", event_time: instant(first) },
      ...(i % 5 ? [{ event_name: "signup", event_time: instant(first, 1) }] : []),
      ...(i % 5 && i % 3 ? [{ event_name: "purchase", event_time: instant(first + 1) }] : []),
      ...[1, 7, 30].filter((day) => (i + day) % 4).map((day) => ({ event_name: "visit", event_time: instant(first + day, 2) }))]
      .map((event, j) => ({ ...event, event_id: `e${i}-${j}`, user_id: `u${i}` }));
  }).flat();
  if (id === "5-34") return Array.from({ length: 100 }, (_, i) => ({ unit_id: `u${i}`, treatment: i % 2, baseline: (i * 7) % 31,
    outcome: 20 + 2 * (i % 2) + 0.8 * ((i * 7) % 31) + Math.sin(i * 13) * 3 }));
  if (id === "5-36") return Array.from({ length: 91 }, (_, day) => {
    const base = 100 + day * 0.2 + 12 * Math.sin(day / 7);
    const a = base + 5 * Math.cos(day / 4), b = base - 7 * Math.cos(day / 4);
    return [["Donor A", a], ["Donor B", b], ["Donor C", base + 4 * Math.sin(day / 3)], ["Donor D", base - 3 * Math.sin(day / 2)],
      ["Treated", 0.4 * a + 0.6 * b + 1.4 * Math.sin(day * 1.7) + (day >= 70 ? 15 : 0)]]
      .map(([region, outcome]) => ({ date: date(day), region, outcome }));
  }).flat();
  if (id === "5-37") return Array.from({ length: 800 }, (_, i) => {
    const treatment = i % 2, segment = Math.floor(i / 2) % 2 ? "returning" : "new";
    const rank = Math.floor(i / 4) % 100;
    const threshold = segment === "new" ? (treatment ? 35 : 15) : (treatment ? 18 : 20);
    return { unit_id: `u${i}`, treatment, segment, sample_role: i < 400 ? "train" : "evaluation", outcome: rank < threshold ? 1 : 0 };
  });
  if (id === "5-38") return Array.from({ length: 80 }, (_, i) => {
    const sequence = [[0, "lead"], [5, "qualified"], ...(i % 4 ? [[12, "opportunity"]] : []),
      ...(i % 3 ? [[25, i % 5 ? "won" : "lost"]] : []), ...(i % 15 === 5 ? [[30, "qualified"], [45, "won"]] : [])];
    return sequence.map(([offset, stage]) => ({ deal_id: `d${i}`, event_time: instant(i + offset), stage,
      amount: 100000 + (i % 10) * 5000, channel: i % 2 ? "paid" : "organic", currency_code: "KRW" }));
  }).flat();
  if (id === "5-39") return Array.from({ length: 100 }, (_, respondent) => Array.from({ length: 6 }, (_, task) => {
    const alternatives = Array.from({ length: 3 }, (_, alt) => ({ price: 10 + ((respondent * 7 + task * 3 + alt * 11) % 20), attribute_1: (task + alt) % 3,
      attribute_2: (respondent + alt) % 2 }));
    const weights = alternatives.map((a) => Math.exp(-0.12 * a.price + 0.7 * a.attribute_1 + 0.35 * a.attribute_2));
    const u = ((respondent * 137 + task * 227 + 19) % 997) / 997 * weights.reduce((a, b) => a + b, 0);
    let chosen = 0, cumulative = weights[0];
    while (chosen < 2 && u > cumulative) cumulative += weights[++chosen];
    return alternatives.map((a, alt) => ({ ...a, respondent_id: `r${respondent}`, task_id: `q${task}`, alternative_id: `a${alt}`, chosen: alt === chosen ? 1 : 0,
      sample_role: respondent < 80 ? "train" : "evaluation", currency_code: "USD" }));
  })).flat(2);
  if (id === "5-40") return Array.from({ length: 100 }, (_, i) => ({ unit_id: `u${i}`, treatment: i % 2,
    net_revenue: i % 5 ? (i % 2 ? 80 : 60) + (i % 7) * 3 : 0, variable_cost: i % 5 ? 35 : 0, currency_code: "USD" }));
  if (id === "5-41") return Array.from({ length: 100 }, (_, i) => ["coffee", ...(i % 3 ? ["milk"] : []), ...(i % 4 ? ["bread"] : []), ...(i % 6 === 0 ? ["tea"] : [])]
    .map((product_id) => ({ order_id: `o${i}`, product_id, quantity: 1 }))).flat();
  if (id === "5-42") return ["Meta", "Google", "Video"].flatMap((channel, j) => Array.from({ length: 6 }, (_, i) => ({ channel, period: "2026-09", frequency: i + 1, audience_count: Math.round(1000 / ((i + 1) * (j + 1))) })));
  if (id === "5-43") return Array.from({ length: 30 }, (_, day) => ({ date: date(day), channel: "Search", clicks: 1000 + day * 5,
    invalid_clicks: day === 28 ? 130 : 10 + day % 7, conversions: 45 + day % 11, cost: 200000 + day * 100, currency_code: "KRW" }));
  throw new Error("unknown_analysis");
}
export function buildAdvancedDemo(id) {
  const rows = advancedDemoRows(id), keys = Object.keys(rows[0]);
  const headers = keys.map((key) => ADVANCED_FIELDS[key]?.labelEn || key);
  const mapping = Object.fromEntries(headers.map((header, i) => [header, keys[i]]));
  const raw = rows.map((row) => Object.fromEntries(headers.map((header, i) => [header, String(row[keys[i]] ?? "")])));
  return { raw, headers, mapping, currency: rows[0].currency_code || "KRW", importSource: "demo", fileName: `demo_${ADVANCED_BY_ID[id].key}.csv`, advancedDemoToolId: id };
}
