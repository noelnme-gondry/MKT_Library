import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { buildCsvToolInventory } from "./toolDataInventory";

describe("CSV tool inventory", () => {
  const inventory = buildCsvToolInventory();

  it("is derived from the routable CSV groups, including preview and subtool routes", () => {
    const expected = ROUTES
      .filter((route) => !route.legacy && Boolean(TOOL_GROUP[route.id]))
      .map((route) => route.id)
      .sort();
    expect(inventory.map((item) => item.toolId).sort()).toEqual(expected);
    expect(inventory.find((item) => item.toolId === "9-3")?.publication).toBe("preview");
    expect(inventory.find((item) => item.toolId === "5-18")?.publication).toBe("subtool");
  });

  it("describes each legacy mapping key from the current input contract", () => {
    for (const tool of inventory) {
      expect(tool.dataGroup, tool.toolId).toBeTruthy();
      for (const requirement of tool.requirements) {
        expect(["all", "one_of"], tool.toolId).toContain(requirement.kind);
        expect(requirement.min, tool.toolId).toBe(1);
        for (const field of requirement.fields) expect(STANDARD_FIELDS[field.legacyKey], `${tool.toolId}:${field.legacyKey}`).toBeTruthy();
      }
      for (const field of tool.optionalFields) expect(STANDARD_FIELDS[field.legacyKey], `${tool.toolId}:${field.legacyKey}`).toBeTruthy();
    }
  });

  it("keeps tool-owned role mapping explicit instead of pretending it uses the common contract", () => {
    expect(inventory.find((item) => item.toolId === "5-20")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "5-23")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "9-1")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "5-2")?.mappingMode).toBe("contract");
  });
});
