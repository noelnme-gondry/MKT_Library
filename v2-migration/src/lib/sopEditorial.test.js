import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/routeMap";
import { SOP_EDITORIAL, getSopEditorial, getSopLastModified } from "./sopEditorial";

const guideIds = ROUTES
  .filter((route) => route.slug.startsWith("/guide/") && route.id !== "guide-index")
  .map((route) => route.id)
  .sort();

describe("SOP editorial references", () => {
  it("covers every published SOP with official, locale-matched references", () => {
    expect(Object.keys(SOP_EDITORIAL).sort()).toEqual(guideIds);

    for (const routeId of guideIds) {
      const ko = getSopEditorial(routeId, "ko");
      const en = getSopEditorial(routeId, "en");

      expect(ko.reviewedAt).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
      expect(getSopLastModified(routeId)).toBe(ko.reviewedAt);
      expect(ko.sources.length).toBeGreaterThan(0);
      expect(en.sources.map((source) => source.url)).toEqual(ko.sources.map((source) => source.url));
      for (const source of [...ko.sources, ...en.sources]) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.title.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
