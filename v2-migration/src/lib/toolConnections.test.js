import { describe, expect, it } from "vitest";

import {
  CONNECTED_TOOLS,
  NEXT_TOOL_IDS,
  TOOL_JOURNEY,
  getJourneyContext,
  getNextTools,
  localizedTool,
} from "@/lib/toolConnections";
import { EN_READY_TOOL_IDS, ROUTES, idToSlug, isRoutePublished } from "@/lib/routeMap";
import { TOOL_GROUP, groupForRoute } from "@/lib/toolGroups";
import { displayItemNumberShort } from "@/store/useDataStore";

describe("connected tool workflow", () => {
  it("covers every published tool exactly once in the landing journey", () => {
    const toolIds = Object.keys(CONNECTED_TOOLS);
    const journeyIds = TOOL_JOURNEY.flatMap((stage) => stage.tools);
    const publishedToolIds = ROUTES
      .filter((route) => /^(5|9)-/.test(route.id) && !route.legacy && isRoutePublished(route))
      .map((route) => route.id);
    expect(new Set(journeyIds).size).toBe(13);
    expect([...journeyIds].sort()).toEqual([...toolIds].sort());
    expect([...toolIds].sort()).toEqual([...publishedToolIds].sort());
    expect([...toolIds].sort()).toEqual([...EN_READY_TOOL_IDS].sort());
  });

  it("uses the same visible tool numbers in the journey and sidebar", () => {
    expect(TOOL_JOURNEY.flatMap((stage) => stage.tools).map(displayItemNumberShort)).toEqual([
      "2-1", "2-2", "2-3", "2-4", "2-5", "5-1", "3-1", "3-2", "3-3", "4-1", "4-2", "4-3", "5-2",
    ]);
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
    for (const toolId of Object.keys(CONNECTED_TOOLS)) {
      expect(localizedTool(toolId, "ko").href).toBe(idToSlug[toolId]);
      expect(localizedTool(toolId, "en").href).toBe(`/en${idToSlug[toolId]}`);
    }
  });

  it("derives same-CSV labels from the real store group registry", () => {
    for (const toolId of Object.keys(CONNECTED_TOOLS)) {
      expect(TOOL_GROUP[toolId]).toBeTruthy();
      for (const nextTool of getNextTools(toolId, "ko")) {
        expect(nextTool.isSameData).toBe(groupForRoute(toolId) === groupForRoute(nextTool.id));
      }
    }
    const dashboardNext = getNextTools("5-2", "ko");
    expect(dashboardNext.every((tool) => tool.isSameData)).toBe(true);
    const saturationNext = getNextTools("5-22", "ko");
    expect(saturationNext.find((tool) => tool.id === "5-3").isSameData).toBe(true);
    expect(saturationNext.find((tool) => tool.id === "9-6").isSameData).toBe(false);
  });

  it("has no self-links or dead ends and reaches every tool from every start", () => {
    const toolIds = Object.keys(CONNECTED_TOOLS);
    for (const startId of toolIds) {
      const seen = new Set([startId]);
      const queue = [startId];
      expect(NEXT_TOOL_IDS[startId]).not.toContain(startId);
      while (queue.length > 0) {
        const currentId = queue.shift();
        for (const nextId of NEXT_TOOL_IDS[currentId]) {
          if (!seen.has(nextId)) {
            seen.add(nextId);
            queue.push(nextId);
          }
        }
      }
      expect([...seen].sort()).toEqual([...toolIds].sort());
    }
  });

  it("exposes bidirectional stage navigation and loops learning back to monitoring", () => {
    const creative = getJourneyContext("9-6", "ko");
    expect(creative.previous.map((tool) => tool.id)).toEqual(["5-21"]);
    expect(creative.alternatives.map((tool) => tool.id)).toEqual(["5-22", "5-3", "5-26"]);
    expect(creative.next.map((tool) => tool.id)).toEqual(["5-4", "5-23", "5-24"]);

    const learning = getJourneyContext("5-18", "en");
    expect(learning.isCycleRestart).toBe(true);
    expect(learning.next.map((tool) => tool.id)).toEqual(["5-2"]);
    expect(learning.previous.every((tool) => tool.href.startsWith("/en/"))).toBe(true);
  });
});
