import { describe, expect, it } from "vitest";

import {
  TEMPLATE_FAMILY,
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
    expect(getToolTemplateFields("start-gate")).toEqual(["date", "channel", "cost", "installs"]);
    expect(buildToolTemplateCsv("start-gate")).toContain("date,channel,cost,installs");
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

  // 통합 템플릿 버튼은 효율 4총사 전용이다. 자체 예시를 가진 /start가 섞이면
  // 첫 업로드 화면에 중복 다운로드 버튼이 생긴다.
  it("keeps the unified template family to the four efficiency tools", () => {
    expect([...TEMPLATE_FAMILY].sort()).toEqual(["5-2", "5-21", "5-22", "5-3"]);
  });
});
