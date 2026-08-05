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
});
