import { describe, expect, it } from "vitest";

import {
  CONNECTED_TOOLS,
  NEXT_TOOL_IDS,
  TOOL_JOURNEY,
  getNextTools,
  localizedTool,
} from "@/lib/toolConnections";

describe("connected tool workflow", () => {
  it("covers each published KR/EN tool exactly once in the landing journey", () => {
    const toolIds = Object.keys(CONNECTED_TOOLS);
    const journeyIds = TOOL_JOURNEY.flatMap((stage) => stage.tools);
    expect(toolIds).toHaveLength(10);
    expect(new Set(journeyIds).size).toBe(10);
    expect([...journeyIds].sort()).toEqual([...toolIds].sort());
  });

  it("keeps every next-step reference valid and limited to three choices", () => {
    for (const [sourceId, nextIds] of Object.entries(NEXT_TOOL_IDS)) {
      expect(CONNECTED_TOOLS[sourceId]).toBeTruthy();
      expect(nextIds).toHaveLength(3);
      expect(new Set(nextIds).size).toBe(3);
      nextIds.forEach((nextId) => expect(CONNECTED_TOOLS[nextId]).toBeTruthy());
    }
  });

  it("builds matching KR and EN routes", () => {
    expect(localizedTool("5-21", "ko").href).toBe("/tools/campaign-variance");
    expect(localizedTool("5-21", "en").href).toBe("/en/tools/campaign-variance");
    expect(localizedTool("5-21", "en").title).toBe("Campaign performance variance");
  });

  it("labels only compatible datasets as same-CSV continuations", () => {
    const dashboardNext = getNextTools("5-2", "ko");
    expect(dashboardNext.every((tool) => tool.isSameData)).toBe(true);
    const saturationNext = getNextTools("5-22", "ko");
    expect(saturationNext.find((tool) => tool.id === "5-3").isSameData).toBe(true);
    expect(saturationNext.find((tool) => tool.id === "9-6").isSameData).toBe(false);
  });
});
