// @vitest-environment jsdom
//
// Render-smoke for KillerContentFinder (9-2, content_aha group). It's a thin
// wrapper that renders <AhaMomentFinder domain="content" /> — same engine
// (AHA_STATS, golden-covered), content-domain labels. Asserts the wrapper mounts
// without throwing in the no-data and with-data states (content vocabulary CSV:
// reader_id / subscribed / <content>_d<window>). Deterministic — NO Math.random.
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import KillerContentFinder from "@/components/tools/KillerContentFinder";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-2",
    csvGroups: { ...useAppStore.getState().csvGroups, content_aha: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

function seedWithData() {
  const headers = ["reader_id", "subscribed", "ga4guide_d7", "casestudy_d7", "pricing_d7"];
  const raw = [];
  for (let u = 0; u < 140; u++) {
    const readGuide = u % 3 === 0 ? 2 : 0;         // killer content read count
    const readCase = u % 4 === 0 ? 3 : 1;
    const readPricing = u % 5 === 0 ? 1 : 0;
    // subscribed correlates deterministically with reading the killer guide
    const subscribed = readGuide >= 2 || (readCase >= 3 && u % 2 === 0) ? 1 : 0;
    raw.push({
      reader_id: `r${u}`,
      subscribed,
      ga4guide_d7: readGuide,
      casestudy_d7: readCase,
      pricing_d7: readPricing,
    });
  }
  const mapping = {}; headers.forEach((h) => { mapping[h] = h; });
  const slice = { raw, headers, mapping, fileName: "content_aha.csv" };
  useAppStore.setState({
    currentRouteId: "9-2",
    csvGroups: { ...useAppStore.getState().csvGroups, content_aha: slice },
    csvData: slice,
  });
}

describe("KillerContentFinder render smoke", () => {
  beforeEach(() => {
    seedNoData();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<KillerContentFinder />)).not.toThrow();
    expect(document.body.querySelector("*")).toBeTruthy();
  });

  it("mounts without throwing with a content event CSV (subscribed + content)", () => {
    seedWithData();
    expect(() => render(<KillerContentFinder />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
