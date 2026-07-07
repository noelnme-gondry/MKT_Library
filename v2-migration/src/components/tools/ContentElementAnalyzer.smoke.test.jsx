// @vitest-environment jsdom
//
// Render-smoke for ContentElementAnalyzer (9-1, content_attr group). New tool on
// the regMath OLS engine (REG_STATS.ols, golden-covered by regMath.test.js).
// Asserts the component MOUNTS without throwing in the no-data state and with a
// valid attribute×outcome CSV (1 row = 1 content piece; numeric attribute
// columns + an outcome column). Deterministic signal so the fit succeeds and the
// forest plot + table render. NO Math.random (harness §3).
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentElementAnalyzer from "@/components/tools/ContentElementAnalyzer";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-1",
    csvGroups: { ...useAppStore.getState().csvGroups, content_attr: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

function seedWithData() {
  const headers = ["post_id", "title_has_number", "title_len", "has_emoji", "ctr"];
  const raw = [];
  for (let i = 0; i < 120; i++) {
    const hasNum = i % 2 === 0 ? 1 : 0;
    const titleLen = 20 + (i % 40);
    const emoji = i % 3 === 0 ? 1 : 0;
    // ctr deterministically driven by hasNum (+) and titleLen (−); emoji ≈ noise-free 0
    const ctr = 2.4 + hasNum * 1.3 + (titleLen - 40) * -0.01 + (i % 7) * 0.05;
    raw.push({
      post_id: `p${i}`,
      title_has_number: hasNum,
      title_len: titleLen,
      has_emoji: emoji,
      ctr: Number(ctr.toFixed(2)),
    });
  }
  const slice = { raw, headers, mapping: {}, fileName: "content_attr.csv" };
  useAppStore.setState({
    currentRouteId: "9-1",
    csvGroups: { ...useAppStore.getState().csvGroups, content_attr: slice },
    csvData: slice,
  });
}

describe("ContentElementAnalyzer render smoke", () => {
  beforeEach(() => {
    seedNoData();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<ContentElementAnalyzer />)).not.toThrow();
    expect(document.body.querySelector("*")).toBeTruthy();
  });

  it("mounts without throwing with a valid attribute×outcome CSV", () => {
    seedWithData();
    expect(() => render(<ContentElementAnalyzer />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
