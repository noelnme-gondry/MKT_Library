// @vitest-environment jsdom
//
// Render-smoke for Incrementality (5-23). Asserts the component MOUNTS without
// throwing in the no-data state and with each method's demo data loaded
// (suppression + pre/post on/off), across method tab switches. Golden covers the
// pure math (incrPrePostMath / incrMath); this catches render-throw (§7).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("mounts with suppression demo → 결론 카드 + 다운로드", () => {
    seed(buildIncrSuppressionDemo());
    const { container } = render(<Incrementality />);
    expect(screen.getByText(/결론 — 광고가 만든 순증분/)).toBeTruthy();
    expect(screen.getAllByText(/결과 받기/).length).toBeGreaterThan(0);
    expect(container.querySelector("#s-incr-method")).toBeTruthy();
    expect(container.querySelector("#s-incr-result")).toBeTruthy();
  });

  it("mounts with pre/post demos (on & off) → 탭 전환 후 결론 카드", () => {
    // method 기본값이 suppression이라 prepost 카드를 보려면 탭을 눌러 전환한다.
    seed(buildIncrPrepostDemo("on"));
    const on = render(<Incrementality />);
    fireEvent.click(on.getByText(/신규 켜기 \(전후\)/));
    expect(on.getByText(/결론 — 신규로 얻은 성과/)).toBeTruthy();
    on.unmount();
    seed(buildIncrPrepostDemo("off"));
    const off = render(<Incrementality />);
    fireEvent.click(off.getByText(/종료 \(전후\)/));
    expect(off.getByText(/결론 — 종료로 잃은 성과/)).toBeTruthy();
  });
});
