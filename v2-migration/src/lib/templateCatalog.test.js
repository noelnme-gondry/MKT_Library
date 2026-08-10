import { describe, expect, it } from "vitest";

import { buildToolTemplateCsv } from "@/components/ds/csvTemplate";
import { getTemplatePage, TEMPLATE_PAGES, TEMPLATE_PAGE_SLUGS } from "./templateCatalog";
import { idToSlug } from "./routeMap";

describe("templateCatalog", () => {
  it("publishes a template page for tools that actually have a template", () => {
    expect(TEMPLATE_PAGES.length).toBeGreaterThan(4);
    expect(new Set(TEMPLATE_PAGE_SLUGS).size).toBe(TEMPLATE_PAGE_SLUGS.length);
    for (const page of TEMPLATE_PAGES) expect(idToSlug[page.toolId]).toBe(page.toolPath);
  });

  // 페이지의 컬럼 표와 실제 내려받는 CSV 헤더가 갈라지면 사용자가 잘못된 양식을 만든다.
  it("matches the downloaded CSV header exactly", () => {
    for (const slug of TEMPLATE_PAGE_SLUGS) {
      const page = getTemplatePage(slug);
      const header = buildToolTemplateCsv(page.toolId, "tool").replace("﻿", "").trim().split(",");
      expect(page.fields.map((field) => field.key), slug).toEqual(header);
    }
  });

  it("marks required columns from the tool contract, including oneOf groups", () => {
    const dashboard = getTemplatePage("dashboard");
    expect(dashboard.requiredCount).toBeGreaterThan(0);
    expect(dashboard.fields.find((field) => field.key === "date")?.required).toBe(true);
  });

  it("returns null for unknown slugs instead of throwing", () => {
    expect(getTemplatePage("nope")).toBeNull();
    expect(getTemplatePage(undefined)).toBeNull();
  });
});
