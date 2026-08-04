import { describe, expect, it } from "vitest";
import { getRouteSeo } from "./routeSeo";

const PUBLISHED_TOOL_IDS = ["5-2", "5-3", "5-4", "5-18", "5-18-paid-organic", "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast", "5-20", "5-21", "5-22", "5-23", "5-24", "9-1", "9-6"];

describe("published tool SEO copy", () => {
  it.each(["guide-index", "start-gate"])("%s keeps the rendered English title within 60 characters", (routeId) => {
    const title = getRouteSeo(routeId, "en").title;
    expect(`${title} | Growth Opt Playbook`.length).toBeLessThanOrEqual(60);
  });

  it.each(PUBLISHED_TOOL_IDS)("%s has concise KO and EN metadata", (toolId) => {
    const ko = getRouteSeo(toolId, "ko");
    const en = getRouteSeo(toolId, "en");

    expect(ko?.title).toBeTruthy();
    expect(ko?.description).toBeTruthy();
    expect(en?.title).toBeTruthy();
    expect(en?.description).toBeTruthy();
    expect([...ko.title].length).toBeLessThanOrEqual(30);
    expect([...ko.description].length).toBeLessThanOrEqual(80);
    expect(en.title.length).toBeLessThanOrEqual(60);
    expect(`${en.title} | Growth Opt Playbook`.length).toBeLessThanOrEqual(60);
    expect(en.description.length).toBeLessThanOrEqual(160);
  });

  it("separates parent, cannibalization, and budget search intent", () => {
    expect(getRouteSeo("5-18", "ko").title).toContain("MMM");
    expect(getRouteSeo("5-18-cannibal", "ko").title).toContain("카니발라이제이션");
    expect(getRouteSeo("5-3", "ko").title).toContain("시뮬레이터");
  });
});
