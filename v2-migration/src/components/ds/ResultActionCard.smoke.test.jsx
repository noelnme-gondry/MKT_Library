// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ResultActionCard from "./ResultActionCard";
import { useAppStore } from "@/store/useDataStore";

describe("ResultActionCard decision-first hierarchy", () => {
  beforeEach(() => useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false }));

  it("renders key figures before supporting prose", () => {
    const { container } = render(
      <ResultActionCard
        headline="결론"
        stats={[{ label: "즉시 교체", value: "3", emphasis: "primary" }]}
        points={[{ label: "최대 영향", text: "Meta", detail: "CPI +₩22.6" }]}
        analysisBasis={false}
        decisionReview={false}
      />,
    );

    const card = container.querySelector(".result-action-card");
    const stats = container.querySelector(".result-action-card__stats");
    const points = container.querySelector(".result-action-card__points");
    expect(card).toBeTruthy();
    expect(stats.compareDocumentPosition(points) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stats.getAttribute("aria-label")).toBe("핵심 수치");
    expect(stats.querySelector(".is-primary")).toBeTruthy();
    expect(points.querySelector(".is-structured")).toBeTruthy();
    expect(points.textContent).toContain("CPI +₩22.6");
  });

  it("localizes the key-figure landmark for English", () => {
    const { container } = render(
      <ResultActionCard
        locale="en"
        headline="Conclusion"
        stats={[{ label: "Headroom", value: "4" }]}
        analysisBasis={false}
        decisionReview={false}
      />,
    );
    expect(container.querySelector(".result-action-card__stats").getAttribute("aria-label")).toBe("Key figures");
  });

  it("passes an explicit decision prefill without inferring from generic points or stats", () => {
    render(
      <ResultActionCard
        toolId="5-3"
        headline="Generic result headline"
        points={[{ text: "Do not infer this point" }]}
        stats={[{ label: "Rows", value: "120" }]}
        analysisBasis={false}
        decisionPrefill={{ action: "Explicit action", metric: "CPA", baseline: "5,240" }}
      />,
    );
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("Explicit action");
    expect(screen.getByLabelText("검증 지표").value).toBe("CPA");
  });

  it("refreshes an untouched seed but never discards an in-progress draft", () => {
    const card = (action) => (
      <ResultActionCard
        toolId="5-3"
        headline="Result"
        analysisBasis={false}
        decisionPrefill={{ action, metric: "CPA" }}
      />
    );
    const view = render(card("Initial suggestion"));
    view.rerender(card("Fresh suggestion"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("Fresh suggestion");

    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "My edited action" } });
    view.rerender(card("Newest result suggestion"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("My edited action");

    view.rerender(
      <ResultActionCard
        toolId="5-22"
        headline="Another tool"
        analysisBasis={false}
        decisionPrefill={{ action: "Different tool suggestion", metric: "ROAS" }}
      />,
    );
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("Different tool suggestion");
  });
});
