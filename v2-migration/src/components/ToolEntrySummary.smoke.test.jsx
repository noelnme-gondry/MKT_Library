import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUTES, hasEnVersion, isRouteIndexable } from "@/lib/routeMap";
import { getToolSearchContent, hasInlineToolReference } from "@/lib/toolSearchContent";
import ToolEntrySummary from "./ToolEntrySummary";

describe("public tool entry summary", () => {
  const routes = ROUTES.filter(route => /^(5|9)-/.test(route.id) && isRouteIndexable(route.id) && !hasInlineToolReference(route.id));
  it("covers the published route registry rather than a hand-written tool list", () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      for (const locale of hasEnVersion(route.id) ? ["ko", "en"] : ["ko"]) {
        const content = getToolSearchContent(route.id, locale);
        expect(content, `${route.id}/${locale}`).toBeTruthy();
        const html = renderToStaticMarkup(<ToolEntrySummary toolId={route.id} locale={locale} />);
        expect(html).toContain(`id="tool-entry-summary-${route.id}"`);
        expect(html).toContain("<h2");
        expect(html).not.toContain("<h1");
        expect(html).not.toContain("undefined");
        expect(html).not.toContain("role=\"status\"");
      }
    }
  });
  it("does not publish a private workspace as a search landing page", () => {
    expect(renderToStaticMarkup(<ToolEntrySummary toolId="dochi-result" />)).toBe("");
  });
});
