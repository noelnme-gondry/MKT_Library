import { describe, expect, it } from "vitest";
import { journeySurface, withSiteJourney } from "./siteJourney";

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

describe("site journey attribution", () => {
  it.each(["", "/en"])("keeps the original entry across Dochi, tools and review (%s)", prefix => {
    const store = storage();
    expect(withSiteJourney("journey_page_viewed", { scope: journeySurface(`${prefix}/blog/example`) }, store, 100).journey_entry).toBe("blog");
    for (const [index, path] of ["/", "/dochi-result", "/tools/budget-allocation", "/weekly-review"].entries()) {
      expect(withSiteJourney("journey_page_viewed", { scope: journeySurface(`${prefix}${path}`) }, store, 200 + index).journey_entry).toBe("blog");
    }
    expect(withSiteJourney("weekly_decision_saved", { tool_id: "weekly-review" }, store, 500).journey_entry).toBe("blog");
    expect([...store.values.values()].join("")).not.toContain("example");
  });
  it("expires after inactivity and rejects untrusted stored entry values", () => {
    const store = storage();
    withSiteJourney("journey_page_viewed", { scope: "home" }, store, 100);
    expect(withSiteJourney("journey_page_viewed", { scope: "review" }, store, 1_800_101).journey_entry).toBe("review");
    store.setItem("gop:site-journey", JSON.stringify({ entry: "private campaign", lastAt: 1_800_102 }));
    expect(withSiteJourney("analysis_started", {}, store, 1_800_103)).toEqual({});
  });
  it("does not interrupt analysis when storage is blocked", () => {
    expect(withSiteJourney("analysis_started", { source: "csv" }, { getItem() { throw Error("blocked"); } })).toEqual({ source: "csv" });
  });
});
