import { describe, expect, it } from "vitest";

import {
  buildToolTemplateCsv,
  getToolTemplateFields,
  hasToolTemplate,
} from "@/components/ds/csvTemplate";
import { CONNECTED_TOOLS } from "@/lib/toolConnections";

describe("tool mapping templates", () => {
  it("provides a deterministic template for every published connected tool", () => {
    for (const toolId of Object.keys(CONNECTED_TOOLS)) {
      expect(hasToolTemplate(toolId)).toBe(true);
      const fields = getToolTemplateFields(toolId);
      expect(fields.length).toBeGreaterThan(0);
      expect(new Set(fields).size).toBe(fields.length);
      expect(buildToolTemplateCsv(toolId)).toBe(buildToolTemplateCsv(toolId));
    }
  });

  it("covers creative and experiment contracts beyond the efficiency schema", () => {
    expect(getToolTemplateFields("5-6")).toEqual(expect.arrayContaining([
      "creative_id",
      "impressions",
      "spend",
      "hook_type",
      "format",
    ]));
    expect(buildToolTemplateCsv("5-4")).toContain("numerator,denominator");
    expect(buildToolTemplateCsv("5-4")).toContain("is_control");
    expect(buildToolTemplateCsv("5-4")).toContain("arm_id");
    expect(buildToolTemplateCsv("5-18")).toContain("ch_google_roi");
  });
});
