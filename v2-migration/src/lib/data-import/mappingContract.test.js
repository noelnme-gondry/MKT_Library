import { describe, expect, it } from "vitest";
import { buildMappingContract } from "./mappingContract";

describe("buildMappingContract", () => {
  it("scopes candidates and reports missing required fields", () => {
    const result = buildMappingContract({
      toolId: "5-22",
      headers: ["날짜", "소진액", "채널"],
      rows: [{ 날짜: "2026-01-05", 소진액: "100", 채널: "Meta" }],
    });

    expect(result.mapping).toMatchObject({ 날짜: "date", 소진액: "cost", 채널: "channel" });
    expect(result.requiredMissing).toEqual(expect.arrayContaining(["installs/actions"]));
    expect(result.confidence).toBe("blocked");
    expect(result.source).toBe("csv");
  });

  it("marks a selected field with an incompatible profile for review", () => {
    const result = buildMappingContract({
      toolId: "5-22",
      headers: ["date", "cost", "channel", "installs"],
      rows: [{ date: "not-a-date", cost: "100", channel: "Meta", installs: "4" }],
    });

    expect(result.typeWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ header: "date", field: "date", expectedType: "date" }),
    ]));
    expect(result.confidence).toBe("review");
  });

  it("is deterministic for identical input", () => {
    const input = {
      toolId: "5-22",
      headers: ["date", "cost", "channel", "installs"],
      rows: [{ date: "2026-01-05", cost: "100", channel: "Meta", installs: "4" }],
      source: "handoff",
    };
    expect(buildMappingContract(input)).toEqual(buildMappingContract(input));
  });

  it("keeps numeric start-gate columns inside the efficiency contract", () => {
    const result = buildMappingContract({
      toolId: "start-gate",
      headers: ["date", "channel", "cost", "installs"],
      rows: [
        { date: "2026-06-17", channel: "Meta", cost: "850000", installs: "120" },
        { date: "2026-06-18", channel: "Google", cost: "910000", installs: "101" },
      ],
    });

    expect(result.mapping).toMatchObject({ date: "date", channel: "channel", cost: "cost", installs: "installs" });
    expect(Object.values(result.mapping)).not.toContain("campaign_on");
    expect(result.confidence).toBe("confirmed");
  });

  // /start의 매핑은 효율 슬라이스에 저장돼 사이드바로 진입한 도구가 이어 쓴다.
  // 퍼널·코호트 컬럼이 스코프 밖이면 그 경로에서 영구 미매핑이 된다.
  it("maps the efficiency family's funnel and cohort columns at start-gate", () => {
    const headers = ["date", "channel", "cost", "installs", "impressions", "clicks", "revenue_d7", "ret_d7"];
    const rows = Array.from({ length: 4 }, (_, index) => ({
      date: `2026-06-1${index}`,
      channel: index % 2 ? "Meta" : "Google",
      cost: String(850000 + index),
      installs: String(120 + index),
      impressions: String(1200000 + index),
      clicks: String(23000 + index),
      revenue_d7: String(900000 + index),
      ret_d7: "0.31",
    }));

    expect(buildMappingContract({ toolId: "start-gate", headers, rows }).mapping).toMatchObject({
      impressions: "impressions",
      clicks: "clicks",
      revenue_d7: "revenue_d7",
      ret_d7: "ret_d7",
    });
  });

  it("keeps Apple Ads budget and bid headers in the ASA tool contract", () => {
    const headers = ["Date", "Search Term", "Total Cost", "Taps", "Installs", "Match Type", "Daily Budget", "Target CPA", "Target CPT", "Current CPT"];
    const rows = [{ Date: "2026-08-01", "Search Term": "planner", "Total Cost": "420", Taps: "42", Installs: "8", "Match Type": "Exact", "Daily Budget": "1000", "Target CPA": "120", "Target CPT": "8", "Current CPT": "7" }];

    expect(buildMappingContract({ toolId: "5-26", headers, rows }).mapping).toMatchObject({
      "Match Type": "match_type", "Daily Budget": "daily_budget", "Target CPA": "target_cpa", "Target CPT": "target_cpt", "Current CPT": "current_cpt",
    });
  });

  it("keeps creative export attributes scoped to the creative tool", () => {
    const headers = ["Date", "Creative ID", "Channel", "Impressions", "Clicks", "Installs", "Amount Spent", "3s Views", "Video Completions", "Hook Type", "Message Angle", "Text Overlay", "Video Duration", "OCR Character Count", "Scene Cut Count", "Face Screen Ratio", "Speech Rate"];
    const rows = [{ Date: "2026-08-01", "Creative ID": "ad-01", Channel: "Meta", Impressions: "12000", Clicks: "510", Installs: "82", "Amount Spent": "320000", "3s Views": "7000", "Video Completions": "3200", "Hook Type": "Problem", "Message Angle": "Savings", "Text Overlay": "yes", "Video Duration": "15", "OCR Character Count": "32", "Scene Cut Count": "8", "Face Screen Ratio": "0.42", "Speech Rate": "132" }];

    expect(buildMappingContract({ toolId: "9-6", headers, rows }).mapping).toMatchObject({
      "Amount Spent": "spend", "3s Views": "video_3s_views", "Video Completions": "video_completions", "Hook Type": "hook_type", "Message Angle": "message_angle", "Text Overlay": "has_text_overlay",
      "Video Duration": "duration_seconds", "OCR Character Count": "text_length", "Scene Cut Count": "scene_cut_count", "Face Screen Ratio": "face_screen_ratio", "Speech Rate": "speech_rate",
    });
  });

  it("maps subscription survival exports without borrowing comparison fields", () => {
    const headers = ["Subscription Tenure", "Churn Observed", "Observation Entry", "Pricing Plan", "Promotion Type", "Event Type", "Acquisition Cost"];
    const rows = [{ "Subscription Tenure": "6", "Churn Observed": "1", "Observation Entry": "0", "Pricing Plan": "monthly", "Promotion Type": "welcome", "Event Type": "voluntary", "Acquisition Cost": "24000" }];

    const contract = buildMappingContract({ toolId: "5-28", headers, rows });
    expect(contract.mapping).toMatchObject({
      "Subscription Tenure": "tenure_periods", "Churn Observed": "event_observed", "Observation Entry": "entry_period",
      "Pricing Plan": "plan", "Promotion Type": "promo", "Event Type": "event_type", "Acquisition Cost": "cac",
    });
    expect(contract.requiredMissing).toEqual([]);
  });

  it("accepts a dated subscription export as an alternative to tenure and event flags", () => {
    const headers = ["Subscription Start Date", "Cancellation Date", "Data Extracted At", "Pricing Plan"];
    const rows = [
      { "Subscription Start Date": "2026-01-15", "Cancellation Date": "2026-02-18", "Data Extracted At": "2026-03-01", "Pricing Plan": "monthly" },
      { "Subscription Start Date": "2026-01-20", "Cancellation Date": "", "Data Extracted At": "2026-03-01", "Pricing Plan": "annual" },
    ];

    const contract = buildMappingContract({ toolId: "5-28", headers, rows });
    expect(contract.mapping).toMatchObject({
      "Subscription Start Date": "subscription_start_date",
      "Cancellation Date": "churn_date",
      "Data Extracted At": "observation_end_date",
      "Pricing Plan": "plan",
    });
    expect(contract.requiredMissing).toEqual([]);
    expect(contract.confidence).not.toBe("blocked");
  });
});
