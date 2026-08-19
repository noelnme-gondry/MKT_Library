import { describe, expect, it } from "vitest";
import { EN_READY_UNLISTED_IDS, EN_READY_TOOL_IDS, ROUTES, hasEnVersion, idToSlug, isRouteIndexable, isRoutePublished } from "./routeMap";
import { ITEM_TITLE_EN } from "./enNavCopy";

describe("English route registry", () => {
  it("has a published route, slug and English nav title for every ready tool", () => {
    for (const id of EN_READY_TOOL_IDS) {
      const route = ROUTES.find((item) => item.id === id && !item.legacy);
      expect(route, `${id} route`).toBeTruthy();
      expect(isRoutePublished(route), `${id} published`).toBe(true);
      expect(idToSlug[id], `${id} slug`).toBeTruthy();
      expect(hasEnVersion(id), `${id} EN gate`).toBe(true);
      expect(ITEM_TITLE_EN[id], `${id} EN title`).toBeTruthy();
    }
  });

  it("does not expose preview-only routes through the ready registry", () => {
    for (const id of EN_READY_TOOL_IDS) {
      const route = ROUTES.find((item) => item.id === id);
      expect(route?.publication).not.toBe("preview");
    }
  });

  it("keeps unlisted routes out of navigation but indexable in search", () => {
    for (const id of EN_READY_UNLISTED_IDS) {
      expect(isRoutePublished(id), `${id} navigation publication`).toBe(false);
      expect(isRouteIndexable(id), `${id} search indexability`).toBe(true);
      expect(hasEnVersion(id), `${id} EN gate`).toBe(true);
    }
  });
});
