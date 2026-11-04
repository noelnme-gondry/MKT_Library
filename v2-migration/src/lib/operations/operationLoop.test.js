import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildOperationsHistory, compareOperationsChange, shiftDate } from "./changeHistory";
import { operationsTarget } from "./operationsIdentity";
import { createOperationRecord, reviewOperationRecord, operationsCreativeSignals, operationRecommendations } from "./operationLoop";
import { readOperationAction } from "./actionContract";
import { sanitizeDecisionReviewRecord, serializeDecisionReviewCsv } from "@/lib/decisionReview";
import { prepareOperationsBrief, planOperationsBudget } from "./operationsBrief";
import { buildToolDemo } from "@/lib/toolDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";

const rows = Array.from({ length: 70 }, (_, d) => ({ date: shiftDate("2026-07-01", d), country: "KR", platform: "iOS", channel: "Meta", source: "paid",
  campaign_id: "cmp1", campaign_name: "Campaign", creative_id: d < 20 ? "old" : "new", cost: d < 20 ? 100 : 200,
  installs: 10, daily_budget: d < 20 ? 100 : 200, clicks: 100, impressions: 10000 }));
const target = operationsTarget(rows[0]);
const draft = { kind: "budget", target, plannedDate: "2026-07-21", executedDate: "2026-07-21", state: "executed", beforeBudget: 100, afterBudget: 200, reviewDays: 7, metric: "installs", currency: "KRW" };
const make = extra => createOperationRecord({ draft: { ...draft, ...extra }, today: "2026-09-10", sourceThrough: rows.at(-1).date });

describe("whole-history observations and explicit actions", () => {
  it("finds old spend, CPR, setting and creative changes outside the latest two weeks", () => {
    const history = buildOperationsHistory(rows);
    expect(history.dates).toHaveLength(70);
    expect(history.scanned).toBe(57);
    expect(new Set(history.events.map(event => event.kind))).toEqual(new Set(["spend", "efficiency", "budget_setting", "creative_first", "creative_absent"]));
    expect(history.events.every(event => event.date < "2026-08-01")).toBe(true);
    expect(history.events.find(event => event.kind === "creative_first").creative).toBe("new");
    expect(history.events.some(event => event.creative === "old" && event.kind === "creative_first")).toBe(false);
    expect(buildOperationsHistory([...rows].reverse()).events).toEqual(history.events);
  });
  it("does not interpret campaign-wide missing dates as a creative removal", () => {
    const history = buildOperationsHistory(rows.filter(row => !["2026-07-21", "2026-07-22", "2026-07-23"].includes(row.date)));
    expect(history.events.filter(event => event.kind === "creative_absent")).toEqual([]);
  });
  it("compares total cost / total outcomes and preserves country, OS, source and campaign ID", () => {
    const foreign = rows.map(row => ({ ...row, platform: "Android", cost: 999999 }));
    const renamed = rows.map(row => ({ ...row, campaign_name: "Renamed" }));
    const comparison = compareOperationsChange([...renamed, ...foreign], { date: "2026-07-21", target });
    expect(comparison.ok).toBe(true);
    expect(comparison.previous).toEqual({ cost: 700, results: 70, cpr: 10 });
    expect(comparison.current).toEqual({ cost: 1400, results: 70, cpr: 20 });
    expect(comparison.cprChange).toBe(1);
    expect(comparison.pvm).toBeTruthy();
  });
  it("withholds missing days and missing values; explicit zero outcomes remain unavailable CPR", () => {
    expect(compareOperationsChange(rows.filter(row => row.date !== "2026-07-18"), { date: "2026-07-21", target }).reason).toBe("coverage");
    expect(compareOperationsChange(rows.map(row => ({ ...row, cost: row.date === "2026-07-18" ? "" : row.cost })), { date: "2026-07-21", target }).reason).toBe("values");
    expect(compareOperationsChange(rows.map(row => ({ ...row, installs: 0 })), { date: "2026-07-21", target }).current.cpr).toBeNull();
  });
  it("does not merge an unidentified campaign into every campaign in its channel", () => {
    const unidentified = rows.map(row => ({ ...row, campaign_id: "", campaign_name: "", cost: 1 }));
    const comparison = compareOperationsChange([...rows, ...unidentified], { date: "2026-07-21", target: operationsTarget(unidentified[0], "campaign") });
    expect(comparison.current.cost).toBe(7);
  });
  it("requires a confirmed execution and mature same-currency data to review", () => {
    const config = { metric: "installs", currency: "KRW", today: "2026-09-10" };
    expect(reviewOperationRecord(make(), rows, config).state).toBe("ready");
    expect(reviewOperationRecord(make(), rows, config).followup).toMatchObject({ beforeBudget: 200, afterBudget: 100 });
    expect(reviewOperationRecord(make({ state: "planned" }), rows, config).state).toBe("planned");
    expect(reviewOperationRecord(make(), rows, { ...config, today: "2026-07-27" }).state).toBe("waiting");
    expect(reviewOperationRecord(make(), rows, { ...config, currency: "USD" }).state).toBe("scope");
    expect(reviewOperationRecord(make(), rows, { ...config, metric: "actions" }).state).toBe("scope");
    expect(reviewOperationRecord({ action: "raised budget", baselineDate: "2026-07-21" }, rows, config).state).toBe("legacy");
    expect(make({ executedDate: "2026-12-01" })).toBeNull();
    expect(make({ afterBudget: "" })).toBeNull();
  });
  it("round-trips allowlisted action metadata through project sanitization and CSV", () => {
    const record = sanitizeDecisionReviewRecord({ ...make(), id: "a1" });
    expect(readOperationAction(record.operationAction)).toMatchObject({ target, beforeBudget: 100, afterBudget: 200, executedDate: "2026-07-21" });
    expect(record.reviewDate).toBe("2026-07-28");
    const raw = Papa.parse(serializeDecisionReviewCsv([record]), { header: true }).data[0];
    expect(sanitizeDecisionReviewRecord(raw).operationAction).toBe(record.operationAction);
    expect(readOperationAction(JSON.stringify({ ...draft, version: 1, rows, password: "secret" }))).not.toHaveProperty("rows");
    expect(readOperationAction('{"version":99}')).toBeNull();
  });
  it("records the actual replacement identity without assigning it a predicted CPR effect", () => {
    expect(make({ kind: "creative_replace", creative: "old", replacementCreative: "" })).toBeNull();
    const record = sanitizeDecisionReviewRecord(make({ kind: "creative_replace", creative: "old", replacementCreative: "new", note: "Confirmed in ad account" }));
    expect(record.action).toContain("old → new");
    expect(readOperationAction(record.operationAction)).toMatchObject({ creative: "old", replacementCreative: "new", note: "Confirmed in ad account" });
    expect(readOperationAction(record.operationAction)).not.toHaveProperty("expectedCpr");
  });
  it("reuses real creative diagnostics but exposes no forecast effect for creative actions", () => {
    const data = buildToolDemo("5-31", "ko"), demoRows = getMappedRows(data);
    const signals = operationsCreativeSignals(demoRows, "installs");
    expect(signals.length).toBeGreaterThan(0);
    const brief = prepareOperationsBrief({ rows: demoRows, metric: "installs", periods: { current: { start: "2026-09-24", end: "2026-09-30" }, previous: { start: "2026-09-17", end: "2026-09-23" } } });
    const signal = { ...signals[0], needsAction: true };
    const recommendations = operationRecommendations(brief, planOperationsBudget(brief, { currency: "KRW" }), [signal]);
    const creative = recommendations.find(row => row.kind === "creative_replace");
    expect(creative).toBeTruthy();
    expect(creative).not.toHaveProperty("expectedCpr");
    expect(creative).not.toHaveProperty("gain");
  });
});
