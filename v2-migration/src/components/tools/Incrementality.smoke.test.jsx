// @vitest-environment jsdom
//
// Render-smoke for Incrementality (5-23). Asserts the component MOUNTS without
// throwing in the no-data state and with each method's demo data loaded
// (suppression + pre/post on/off), across method tab switches. Golden covers the
// pure math (incrPrePostMath / incrMath); this catches render-throw (§7).
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Incrementality from "@/components/tools/Incrementality";
import { buildIncrSuppressionDemo, buildIncrPrepostDemo } from "@/utils/demoData";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice) {
  useAppStore.setState({
    currentRouteId: "5-23",
    csvGroups: { ...useAppStore.getState().csvGroups, incrementality: slice },
    csvData: slice,
  });
}

describe("Incrementality render smoke", () => {
  beforeEach(() => seed(EMPTY));

  it("mounts in no-data state", () => {
    expect(() => render(<Incrementality />)).not.toThrow();
  });

  it("mounts with suppression demo", () => {
    seed(buildIncrSuppressionDemo());
    expect(() => render(<Incrementality />)).not.toThrow();
  });

  it("mounts with pre/post demos (on & off)", () => {
    seed(buildIncrPrepostDemo("on"));
    expect(() => render(<Incrementality />)).not.toThrow();
    seed(buildIncrPrepostDemo("off"));
    expect(() => render(<Incrementality />)).not.toThrow();
  });
});
