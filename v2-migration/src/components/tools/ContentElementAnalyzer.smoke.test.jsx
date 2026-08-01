// @vitest-environment jsdom
//
// Render-smoke for ContentElementAnalyzer (9-1, content_attr group). New tool on
// the regMath OLS engine (REG_STATS.ols, golden-covered by regMath.test.js).
// Asserts the component MOUNTS without throwing in the no-data state and with a
// valid attribute×outcome CSV (1 row = 1 content piece; numeric attribute
// columns + an outcome column). Deterministic signal so the fit succeeds and the
// forest plot + table render. NO Math.random (harness §3).
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentElementAnalyzer from "@/components/tools/ContentElementAnalyzer";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-1",
    csvGroups: { ...useAppStore.getState().csvGroups, content_attr: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
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

function seedWithSparseElement() {
  const headers = ["post_id", "rare_hook", "ctr"];
  const raw = Array.from({ length: 24 }, (_, i) => ({
    post_id: `p${i}`,
    // Four appearances can look dramatic in a tiny sample but must not become
    // a conclusion. The tool requires at least five present and absent rows.
    rare_hook: i < 4 ? 1 : 0,
    ctr: 1 + i * 0.1,
  }));
  const slice = { raw, headers, mapping: {}, fileName: "sparse_content_attr.csv" };
  useAppStore.setState({
    currentRouteId: "9-1",
    csvGroups: { ...useAppStore.getState().csvGroups, content_attr: slice },
    csvData: slice,
  });
}

function seedWithNoSignal() {
  const headers = ["post_id", "has_emoji", "ctr"];
  const raw = Array.from({ length: 60 }, (_, i) => ({
    post_id: `p${i}`,
    has_emoji: i % 2,
    // Each binary state gets the same repeating outcome distribution.
    ctr: (Math.floor(i / 2) % 3) + 1,
  }));
  const slice = { raw, headers, mapping: {}, fileName: "no_signal_content_attr.csv" };
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
    const { container } = render(<ContentElementAnalyzer />);
    expect(document.body.querySelector("*")).toBeTruthy();
    expect(container.querySelector("#s-content-mapping")).toBeTruthy();
  });

  it("mounts without throwing with a valid attribute×outcome CSV", () => {
    seedWithData();
    const { container } = render(<ContentElementAnalyzer />);
    expect(document.body.textContent.length).toBeGreaterThan(0);
    expect(container.querySelector("#s-content-mapping")).toBeTruthy();
  });

  it("collapses mapping and puts numeric evidence first after analysis", () => {
    seedWithData();
    const { container } = render(<ContentElementAnalyzer />);
    const mapping = container.querySelector("#s-content-mapping");
    expect(mapping.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "▶ 분석하기" }));

    expect(mapping.open).toBe(false);
    const stats = container.querySelector(".result-action-card__stats");
    const points = container.querySelector(".result-action-card__points");
    expect(stats).toBeTruthy();
    expect(stats.compareDocumentPosition(points) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("stores only a one-variable observational follow-up for a significant top element", () => {
    seedWithData();
    const { container } = render(<ContentElementAnalyzer />);
    fireEvent.change(container.querySelector("select.map-select"), { target: { value: "ctr" } });
    for (const name of ["title_has_number", "title_len", "has_emoji"]) {
      const button = screen.getByRole("button", { name: new RegExp(name) });
      const shouldBeSelected = name === "title_has_number";
      if (button.classList.contains("active") !== shouldBeSelected) fireEvent.click(button);
    }
    fireEvent.click(screen.getByRole("button", { name: "▶ 분석하기" }));

    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/A\/B 테스트 초안.*나머지 요소.*고정/);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));

    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("9-1");
    expect(saved.conclusion).toMatch(/관측 연관.*인과효과로 확정하지 않습니다/);
    expect(saved.action).toMatch(/A\/B 테스트 초안/);
    expect(saved.metric).toBe("ctr");
    expect(saved.baseline).toBe("");
    expect(saved.sourcePeriod).toBe("");
    expect(saved.raw).toBeUndefined();
    expect(saved.mapping).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("content_attr.csv");
  });

  it("provides the same safe one-variable draft in English", () => {
    seedWithData();
    const { container } = render(<ContentElementAnalyzer locale="en" />);
    fireEvent.change(container.querySelector("select.map-select"), { target: { value: "ctr" } });
    for (const name of ["title_has_number", "title_len", "has_emoji"]) {
      const button = screen.getByRole("button", { name: new RegExp(name) });
      const shouldBeSelected = name === "title_has_number";
      if (button.classList.contains("active") !== shouldBeSelected) fireEvent.click(button);
    }
    fireEvent.click(screen.getByRole("button", { name: "▶ Analyze" }));

    expect(screen.getByLabelText("What will change?").value).toMatch(/Draft an A\/B test.*holding every other element.*fixed/);
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save for next review" }));

    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("9-1");
    expect(saved.locale).toBe("en");
    expect(saved.conclusion).toMatch(/observed association.*does not establish a causal effect/i);
    expect(saved.reviewQuestion).toMatch(/one-variable controlled experiment/i);
    expect(saved.baseline).toBe("");
  });

  it("does not show decision review when no significant element exists", () => {
    seedWithNoSignal();
    const { container } = render(<ContentElementAnalyzer />);
    fireEvent.change(container.querySelector("select.map-select"), { target: { value: "ctr" } });
    const feature = screen.getByRole("button", { name: /has_emoji/ });
    if (!feature.classList.contains("active")) fireEvent.click(feature);
    fireEvent.click(screen.getByRole("button", { name: "▶ 분석하기" }));

    expect(screen.getByText("유의한 요소를 확정할 증거가 아직 부족합니다.")).toBeTruthy();
    expect(screen.queryByText("다음 검토 약속 만들기")).toBeNull();
  });

  it("abstains from a sparse binary element instead of over-reading four appearances", () => {
    seedWithSparseElement();
    render(<ContentElementAnalyzer />);

    fireEvent.click(screen.getByRole("button", { name: "▶ 분석하기" }));

    expect(screen.getByText("추정 불가")).toBeTruthy();
    expect(screen.getByText(/희소 요소\(rare_hook\)/)).toBeTruthy();
    expect(screen.queryByText("다음 검토 약속 만들기")).toBeNull();
  });
});
