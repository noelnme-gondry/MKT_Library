import { describe, expect, it } from "vitest";
import { exampleHref, isExampleUrl, stripExampleParam } from "./exampleLink";
import { hasEnVersion, idToSlug, publishedToolIds } from "./routeMap";

describe("example link contract", () => {
  it("gives every published tool a KO example link on its own path", () => {
    const ids = publishedToolIds();
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(exampleHref(id, "ko")).toBe(`${idToSlug[id]}?example=1`);
  });

  it("only links EN examples for tools with an EN route", () => {
    for (const id of publishedToolIds()) {
      expect(exampleHref(id, "en")).toBe(hasEnVersion(id) ? `/en${idToSlug[id]}?example=1` : null);
    }
  });

  it("refuses unpublished routes — a link must land on a result, not a hub", () => {
    expect(exampleHref("5-18", "ko")).toBeNull();
    expect(exampleHref("no-such-tool", "ko")).toBeNull();
  });

  it("reads and strips only its own parameter", () => {
    expect(isExampleUrl("?example=1")).toBe(true);
    expect(isExampleUrl("?example=0")).toBe(false);
    expect(isExampleUrl("")).toBe(false);
    expect(stripExampleParam("https://growthoptplaybook.com/dashboard?example=1&utm_source=x#top")).toBe("/dashboard?utm_source=x#top");
  });
});
