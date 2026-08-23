import { describe, expect, it } from "vitest";
import { evaluateV2Eligibility } from "../schema/toolDataRequirements";
import { mapDataset } from "./mapDataset";

// 실제 플랫폼 export의 표시 헤더를 보존한 비식별 최소 fixture다. 숫자·식별값은
// 합성값이며, 이 검사는 V1 데모의 표준키 헤더에 기대지 않는다.
const FIXTURES = [
  {
    name: "App Store Connect source report",
    toolId: "5-27",
    headers: ["Date", "Source Type", "Impressions", "Product Page Views", "Total Downloads"],
    rows: [{ Date: "2026-03-01", "Source Type": "App Store Search", Impressions: "12900", "Product Page Views": "4300", "Total Downloads": "1935" }],
    expected: {
      Date: "date", "Source Type": "store_source", Impressions: "media_impressions",
      "Product Page Views": "store_product_page_views", "Total Downloads": "outcome_installs",
    },
  },
  {
    name: "Apple Ads search terms",
    toolId: "5-26",
    headers: ["Date", "Search Term", "Total Cost", "Taps", "Installs"],
    rows: [{ Date: "2026-08-01", "Search Term": "sample planner", "Total Cost": "₩420", Taps: "42", Installs: "8" }],
    expected: { Date: "date", "Search Term": "asa_search_term", "Total Cost": "media_spend", Taps: "media_clicks", Installs: "outcome_installs" },
  },
  {
    name: "Apple Ads campaign settings export",
    toolId: "5-26",
    headers: ["Date", "Search Term", "Total Cost", "Taps", "Installs", "Match Type", "Daily Budget", "Target CPA", "Target CPT", "Current CPT"],
    rows: [{ Date: "2026-08-01", "Search Term": "sample planner", "Total Cost": "₩420", Taps: "42", Installs: "8", "Match Type": "Exact", "Daily Budget": "₩1000", "Target CPA": "₩120", "Target CPT": "₩8", "Current CPT": "₩7" }],
    expected: {
      Date: "date", "Search Term": "asa_search_term", "Total Cost": "media_spend", Taps: "media_clicks", Installs: "outcome_installs",
      "Match Type": "asa_match_type", "Daily Budget": "media_daily_budget", "Target CPA": "media_target_cpa", "Target CPT": "media_target_cpt", "Current CPT": "media_current_cpt",
    },
  },
  {
    name: "creative performance export",
    toolId: "9-6",
    headers: ["Date", "Creative ID", "Channel", "Impressions", "Clicks", "Installs", "Amount Spent", "3s Views", "Video Completions", "Creative URL", "Hook Type", "Message Angle", "Text Overlay"],
    rows: [{ Date: "2026-08-01", "Creative ID": "ad-01", Channel: "Meta", Impressions: "12000", Clicks: "510", Installs: "82", "Amount Spent": "₩320000", "3s Views": "7000", "Video Completions": "3200", "Creative URL": "https://example.test/ad-01", "Hook Type": "Problem", "Message Angle": "Savings", "Text Overlay": "yes" }],
    expected: {
      Date: "date", "Creative ID": "creative", Channel: "channel", Impressions: "media_impressions", Clicks: "media_clicks", Installs: "outcome_installs", "Amount Spent": "media_spend",
      "3s Views": "media_video_3s_views", "Video Completions": "media_video_completions", "Creative URL": "creative_url", "Hook Type": "creative_hook_type", "Message Angle": "creative_message_angle", "Text Overlay": "creative_text_overlay",
    },
  },
  {
    name: "weekly panel holiday controls",
    toolId: "5-18",
    headers: ["week", "mmm_reg", "G_ROI", "Platform", "PreLNY", "Seollal", "ChuseokOnly", "PostChuWk", "OtherHol"],
    rows: [{ week: "24", mmm_reg: "1200", G_ROI: "50000", Platform: "iOS", PreLNY: "0", Seollal: "1", ChuseokOnly: "0", PostChuWk: "0", OtherHol: "0" }],
    expected: {
      week: "week", mmm_reg: "outcome_registrations", G_ROI: "media_spend", Platform: "platform",
      PreLNY: "control_holiday", Seollal: "control_holiday", ChuseokOnly: "control_holiday", PostChuWk: "control_holiday", OtherHol: "control_holiday",
    },
  },
  {
    name: "subscription survival export",
    toolId: "5-28",
    headers: ["Subscription Tenure", "Churn Observed", "Observation Entry", "Pricing Plan", "Promotion Type", "Event Type", "Acquisition Cost"],
    rows: [{ "Subscription Tenure": "6", "Churn Observed": "1", "Observation Entry": "0", "Pricing Plan": "monthly", "Promotion Type": "welcome", "Event Type": "voluntary", "Acquisition Cost": "24000" }],
    expected: {
      "Subscription Tenure": "subscription_tenure", "Churn Observed": "churn_event", "Observation Entry": "subscription_entry",
      "Pricing Plan": "subscription_plan", "Promotion Type": "control_promotion", "Event Type": "event_type", "Acquisition Cost": "customer_acquisition_cost",
    },
  },
  {
    name: "dated subscription survival export",
    toolId: "5-28",
    headers: ["Subscription Start Date", "Cancellation Date", "Data Extracted At", "Pricing Plan"],
    rows: [{ "Subscription Start Date": "2026-01-15", "Cancellation Date": "2026-02-18", "Data Extracted At": "2026-03-01", "Pricing Plan": "monthly" }],
    expected: {
      "Subscription Start Date": "subscription_start_date",
      "Cancellation Date": "subscription_churn_date",
      "Data Extracted At": "subscription_observation_end_date",
      "Pricing Plan": "subscription_plan",
    },
  },
  {
    name: "generic action survival export",
    toolId: "5-28",
    headers: ["Action Start Date", "Action Exit Date", "Data Extracted At", "Action Survival Duration", "Dropout Observed", "Event Type"],
    rows: [{ "Action Start Date": "2026-01-15", "Action Exit Date": "2026-02-18", "Data Extracted At": "2026-03-01", "Action Survival Duration": "34", "Dropout Observed": "1", "Event Type": "no action for 14 days" }],
    expected: {
      "Action Start Date": "subscription_start_date",
      "Action Exit Date": "subscription_churn_date",
      "Data Extracted At": "subscription_observation_end_date",
      "Action Survival Duration": "subscription_tenure",
      "Dropout Observed": "churn_event",
      "Event Type": "event_type",
    },
  },
];

describe("semantic mapper calibration fixtures", () => {
  it.each(FIXTURES)("maps every declared platform role for $name", (fixture) => {
    const result = mapDataset({ headers: fixture.headers, rows: fixture.rows });
    const actual = Object.fromEntries(result.bindings.map((binding) => [binding.sourceColumn, binding.canonicalKey]));
    expect(actual).toMatchObject(fixture.expected);
    expect(evaluateV2Eligibility({ toolId: fixture.toolId, bindings: result.bindings }).status).toBe("ready");
  });

  it("keeps the measured fixture precision at 100% without AUTO promotion", () => {
    const comparisons = FIXTURES.flatMap((fixture) => {
      const actual = Object.fromEntries(mapDataset({ headers: fixture.headers, rows: fixture.rows }).bindings.map((binding) => [binding.sourceColumn, binding.canonicalKey]));
      return Object.entries(fixture.expected).map(([header, canonicalKey]) => actual[header] === canonicalKey);
    });
    expect(comparisons.filter(Boolean)).toHaveLength(comparisons.length);
    expect(FIXTURES.flatMap((fixture) => mapDataset({ headers: fixture.headers, rows: fixture.rows }).bindings).every((binding) => binding.decision !== "AUTO")).toBe(true);
  });
});
