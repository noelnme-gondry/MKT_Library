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
});
