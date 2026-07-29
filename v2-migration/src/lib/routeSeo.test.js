import { describe, expect, it } from "vitest";
import { getRouteSeo } from "./routeSeo";

const PUBLISHED_TOOL_IDS = ["5-2", "5-3", "5-4", "5-18", "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast", "5-20", "5-21", "5-22", "5-23", "9-1", "9-6"];

describe("published tool SEO copy", () => {
  it.each(PUBLISHED_TOOL_IDS)("%s has concise KO and EN metadata", (toolId) => {
    const ko = getRouteSeo(toolId, "ko");
    const en = getRouteSeo(toolId, "en");

    expect(ko?.title).toBeTruthy();
    expect(ko?.description).toBeTruthy();
    expect(en?.title).toBeTruthy();
    expect(en?.description).toBeTruthy();
    expect([...ko.title].length).toBeLessThanOrEqual(24);
    expect([...ko.description].length).toBeLessThanOrEqual(80);
    expect(en.title.length).toBeLessThanOrEqual(45);
    expect(en.description.length).toBeLessThanOrEqual(160);
  });
});
