import { describe, expect, it } from "vitest";
import { fitOls, inverse, number, timestamp, welch } from "./commonMath";
import { bgAlive, bgExpected, ggExpected, runPredictiveClv } from "./clvMath";
import { advancedDemoRows, advancedDemoOptions } from "@/lib/advanced-marketing/demo";
import { quintiles, runCustomerEconomics } from "./transactionMath";
import { runUserFunnel } from "./eventMath";
import { runCuped, runPromotion, runUplift } from "./experimentMath";
import { projectSimplex, syntheticWeights, runGeoExperiment } from "./geoMath";
import { runB2bPipeline } from "./pipelineMath";
import { choiceLoss, choiceProbabilities, fitChoice, runConjoint } from "./conjointMath";
import { runBasketAssociation, runReachFrequency, runTrafficQuality } from "./commerceMath";

const value = (report, id) => report.metrics.find((m) => m.id === id).value;
const error = (fn, code) => { expect(fn).toThrowError(code); };
describe("strict input and independent statistical references", () => {
  it("keeps missing, invalid percentages and invalid calendar days distinct from zero", () => {
    expect(number("0")).toBe(0); expect(number("1,250")).toBe(1250);
    for (const v of ["", null, "2%", "NaN", Infinity]) error(() => number(v), "invalid_number");
    error(() => timestamp("2026-02-30"), "invalid_date");
    error(() => timestamp("2026-01-01T24:00:00Z"), "invalid_date");
    error(() => timestamp("2026-01-01T10:00:00", "event", 2, { exactTime: true }), "invalid_date");
    expect(timestamp("2026-01-01T09:00:00+09:00")).toBe(timestamp("2026-01-01T00:00:00Z"));
  });
  it("matches statsmodels 0.14.6 OLS HC3 with interaction", () => {
    const design = Array.from({ length: 30 }, (_, i) => [1, i % 2, (i * 7) % 11 - 5, (i % 2) * ((i * 7) % 11 - 5)]);
    const outcome = design.map((row, i) => 10 + 2 * row[1] + 0.8 * row[2] + i % 3 - 1);
    const fit = fitOls(design, outcome);
    [10.003424657534243, 2.0092795166944324, 0.8256849315068499, -0.07332558486438046].forEach((v, i) => expect(fit.beta[i]).toBeCloseTo(v, 10));
    [0.24417565340472516, 0.34134676255450686, 0.07818803056714901, 0.10899720835515506].forEach((v, i) => expect(fit.coefficients[i].se).toBeCloseTo(v, 10));
    expect(inverse([[1, 2], [2, 4]])).toBeNull();
  });
  it("does not manufacture zero-width certainty from constant outcomes", () => {
    expect(welch([4, 4], [2, 2])).toMatchObject({ estimate: 2, low: null, high: null, p: null });
  });
  it.each([[0.5, 0.5346019613807635, 0.7919754600242911], [1.5, 0.2768816280926879, 0.36016178636490787], [3, 0.16068636525893973, 0.1837978253351118]])("matches scipy hyp2f1 BG/NBD reference at a=%s", (a, alive, purchases) => {
    const params = [0.8, 12, a, 3], history = { x: 2, tx: 14, age: 40 };
    expect(bgAlive(params, history)).toBeCloseTo(alive, 11);
    expect(bgExpected(params, history, 30)).toBeCloseTo(purchases, 9);
  });
  it("is continuous at BG/NBD a=1 and preserves Gamma–Gamma posterior mean", () => {
    const history = { x: 2, tx: 14, age: 40 };
    expect(bgExpected([0.8, 12, 1, 3], history, 30)).toBeCloseTo(bgExpected([0.8, 12, 1.000001, 3], history, 30), 5);
    expect(ggExpected([2, 3, 10], { x: 2, monetary: 20 })).toBeCloseTo(100 / 6, 12);
    expect(ggExpected([2, 0.5, 10], { x: 0, monetary: null })).toBeNull();
  });
});
describe("transactions and ordered behavior", () => {
  const row = (id, order, date, revenue, cost, acquisition = "") => ({ transaction_id: id, order_id: order, customer_id: "c1", recorded_at: date, net_revenue: revenue, variable_cost: cost, acquisition_cost: acquisition, currency_code: "KRW" });
  it("reverses payback after a refund without resetting purchase recency", () => {
    const data = [row("t1", "o1", "2026-01-01", 100, 20, 50), row("t2", "o1", "2026-01-10", -70, 0)];
    const report = runCustomerEconomics(data, { observationEnd: "2026-01-31", horizonDays: 30 });
    expect(value(report, "margin")).toBe(10); expect(value(report, "recovered")).toBe(0);
    const customer = report.tables.find((t) => t.id === "customers").rows[0];
    expect(customer.recency).toBe(30); expect(customer.paybackDays).toBeNull();
    error(() => runCustomerEconomics([...data, { ...data[0] }], { observationEnd: "2026-01-31" }), "duplicate_key");
    expect(quintiles([1, 1, 1])).toEqual([3, 3, 3]);
  });
  it("excludes immature successes and refuses tied timestamp step order", () => {
    const event = (id, user, day, name, hour = "00") => ({ event_id: id, user_id: user, event_time: `2026-01-${day}T${hour}:00:00Z`, event_name: name });
    const rows = [event("1", "a", "01", "visit"), event("2", "a", "02", "buy"), event("3", "a", "08", "visit"),
      event("4", "b", "01", "visit"), event("5", "b", "01", "buy"), event("6", "c", "09", "visit"), event("7", "c", "09", "buy", "01")];
    const report = runUserFunnel(rows, { observationEnd: "2026-01-10", steps: "visit\nbuy", returnEvent: "visit", windowDays: 7 });
    expect(value(report, "entry")).toBe(3); expect(value(report, "mature")).toBe(2);
    expect(value(report, "completion")).toBe(0.5); expect(value(report, "d7")).toBe(0.5);
    expect(report.diagnostics.ambiguousUsers).toBe(1);
  });
});
describe("randomized experiments and policies", () => {
  it("matches independent A/A rejection counts over every balanced assignment", () => {
    let assignments = 0, rejections = 0;
    // Exhaustive C(12,6), no sampling. statsmodels HC3/use_t=True reference: 38/924.
    for (let mask = 0; mask < 4096; mask++) {
      if (mask.toString(2).replaceAll("0", "").length !== 6) continue;
      const rows = Array.from({ length: 12 }, (_, i) => ({ unit_id: `u${i}`, treatment: (mask >> i) & 1,
        baseline: i - 5.5, outcome: 20 + 0.7 * (i - 5.5) + Math.sin(i * 2.1) + (i % 3) * 0.7 }));
      const report = runCuped(rows, { randomized: true, preTreatment: true });
      const adjusted = report.metrics[0];
      rejections += Number(adjusted.low > 0 || adjusted.high < 0); assignments++;
    }
    expect(assignments).toBe(924); expect(rejections).toBe(38);
  });
  it("requires pre-treatment randomization and catches SRM", () => {
    error(() => runCuped([], {}), "confirm_randomization");
    const rows = Array.from({ length: 100 }, (_, i) => ({ unit_id: `u${i}`, treatment: i < 95 ? 1 : 0, baseline: i, outcome: i + i % 3 }));
    error(() => runCuped(rows, { randomized: true, preTreatment: true }), "sample_ratio_mismatch");
  });
  it("uses assigned-unit profit including zero-revenue nonbuyers", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ unit_id: `u${i}`, treatment: i < 4 ? 1 : 0, net_revenue: i % 4 === 0 ? 0 : i < 4 ? 100 : 80, variable_cost: i % 4 === 0 ? 0 : 40, currency_code: "USD" }));
    const report = runPromotion(rows, { randomized: true, includesNonbuyers: true });
    expect(value(report, "profit")).toBe(15); expect(value(report, "revenue")).toBe(15);
  });
  it("holds ties together in the uplift curve and forbids cross-role duplicate units", () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ unit_id: `u${i}`, treatment: i % 2, outcome: i % 4 < 2 ? 1 : 0, segment: i % 8 < 4 ? "A" : "B", sample_role: i < 40 ? "train" : "evaluation" }));
    const options = { randomized: true, preTreatment: true, heldout: true };
    const report = runUplift(rows, options);
    expect(report.tables.find((t) => t.id === "curve").rows).toHaveLength(2);
    expect(value(report, "qini")).toBe(0);
    error(() => runUplift([...rows, { ...rows[0], sample_role: "evaluation" }], options), "duplicate_key");
  });
});
describe("geo, pipeline and stated preferences", () => {
  it("fits convex donor weights without using post outcomes", () => {
    expect(projectSimplex([2, -1])).toEqual([1, 0]);
    const donors = Array.from({ length: 30 }, (_, i) => [10 + i, 40 - i]);
    const fit = syntheticWeights(donors.map((row) => 0.25 * row[0] + 0.75 * row[1]), donors);
    expect(fit.converged).toBe(true); expect(fit.weights[0]).toBeCloseTo(0.25, 6);
  });
  it("keeps open and reopened deals distinct from first wins", () => {
    const event = (deal, date, stage) => ({ deal_id: deal, event_time: `${date}T00:00:00Z`, stage, amount: 100, channel: "paid", currency_code: "USD" });
    const report = runB2bPipeline([event("a", "2026-01-01", "lead"), event("a", "2026-01-05", "lost"), event("a", "2026-01-10", "qualified"), event("a", "2026-01-15", "won"), event("b", "2026-01-01", "lead")],
      { stages: "lead\nqualified", observationEnd: "2026-02-01", horizonDays: 30 });
    expect(value(report, "win")).toBe(0); expect(value(report, "reopened")).toBe(1); expect(value(report, "open")).toBe(1);
  });
  it("matches the binary logistic choice identity and is invariant to common utilities", () => {
    const alternatives = [{ x: [0] }, { x: [1] }];
    choiceProbabilities([Math.log(3)], alternatives).probabilities.forEach((p, i) => expect(p).toBeCloseTo([0.25, 0.75][i], 14));
    expect(choiceLoss([Math.log(3)], [{ alternatives, chosen: 1 }])).toBeCloseTo(-Math.log(0.75), 12);
    expect(choiceProbabilities([Math.log(3)], [{ x: [1000] }, { x: [1001] }]).probabilities[1]).toBeCloseTo(0.75, 10);
  });
  it("matches the closed-form binary choice MLE and respondent sandwich variance", () => {
    const tasks = Array.from({ length: 40 }, (_, i) => ({ respondent: `r${i}`, alternatives: [{ x: [0] }, { x: [1] }], chosen: i % 10 < 8 ? 1 : 0 }));
    const fit = fitChoice(tasks, 1);
    expect(fit.beta[0]).toBeCloseTo(Math.log(4), 5);
    // Bernoulli p=.8: inverse information=1/(40*.8*.2), G/(G-1).
    expect(fit.covariance[0][0]).toBeCloseTo(1 / (40 * 0.8 * 0.2) * 40 / 39, 5);
  });
  it("keeps geo weights and pre-period power unchanged when post outcomes change", () => {
    const rows = advancedDemoRows("5-36"), options = advancedDemoOptions("5-36");
    const before = runGeoExperiment(rows, options);
    const after = runGeoExperiment(rows.map(row => row.date >= options.interventionDate ? { ...row, outcome: row.outcome * 1.5 } : row), options);
    expect(after.tables.find(t => t.id === "weights")).toEqual(before.tables.find(t => t.id === "weights"));
    expect(after.tables.find(t => t.id === "power")).toEqual(before.tables.find(t => t.id === "power"));
  });
  it("does not refit purchase or choice models on evaluation outcomes", () => {
    const rows = advancedDemoRows("5-35"), options = advancedDemoOptions("5-35");
    const before = runPredictiveClv(rows, options);
    const after = runPredictiveClv(rows.filter(row => row.recorded_at.slice(0, 10) <= options.calibrationEnd), options);
    expect(after.diagnostics.bg.parameters).toEqual(before.diagnostics.bg.parameters);
    expect(after.diagnostics.gg.parameters).toEqual(before.diagnostics.gg.parameters);
    expect(value(after, "actual")).toBe(0);
    expect(value(before, "actual")).toBeGreaterThan(0);
    const choices = advancedDemoRows("5-39"), settings = advancedDemoOptions("5-39");
    const original = runConjoint(choices, settings);
    const changed = runConjoint(choices.map(row => row.sample_role === "evaluation" ? { ...row, price: Number(row.price) * 2 } : row), settings);
    expect(changed.tables.find(t => t.id === "coefficients")).toEqual(original.tables.find(t => t.id === "coefficients"));
  });
});
describe("basket, reach and traffic accounting", () => {
  it("counts baskets, not line quantity, and nets returns", () => {
    const rows = [["1", "A", 2], ["1", "B", 1], ["2", "A", 1], ["2", "B", 1], ["2", "B", -1], ["3", "B", 1]].map(([order_id, product_id, quantity]) => ({ order_id, product_id, quantity }));
    const report = runBasketAssociation(rows, { minCount: 1, minSupport: 0 });
    const rule = report.tables[0].rows.find((r) => r.antecedent === "A");
    expect(rule.support).toBeCloseTo(1 / 3); expect(rule.confidence).toBe(0.5); expect(rule.lift).toBe(0.75);
  });
  it("does not invent overlap; deduplicates only declared shared identity", () => {
    const rows = [{ channel: "A", period: "week1", frequency: 2, audience_count: 10 }, { channel: "B", period: "week1", frequency: 3, audience_count: 8 }];
    const report = runReachFrequency(rows);
    expect(value(report, "exact")).toBeNull(); expect(value(report, "lower")).toBe(10); expect(value(report, "upper")).toBe(18);
    const deduped = runReachFrequency(rows.map((r) => ({ ...r, user_id: "same", audience_count: 1 })), { commonIdentity: true });
    expect(value(deduped, "exact")).toBe(1); expect(value(deduped, "impressions")).toBe(5);
  });
  it("never subtracts invalid clicks twice and withholds constant-history scores", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, channel: "A", clicks: 90, invalid_clicks: 10, conversions: 4, cost: 180, currency_code: "USD" }));
    const report = runTrafficQuality(rows, { clickBasis: "net" });
    expect(value(report, "valid")).toBe(900); expect(value(report, "invalid")).toBe(0.1); expect(value(report, "cpc")).toBe(2);
    expect(report.tables[0].rows.at(-1).robustZ).toBeNull();
    expect(value(runTrafficQuality(rows, { clickBasis: "gross" }), "valid")).toBe(800);
  });
});
