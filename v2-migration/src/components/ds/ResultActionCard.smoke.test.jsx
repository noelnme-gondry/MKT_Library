// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResultActionCard from "./ResultActionCard";
import { useAppStore } from "@/store/useDataStore";

describe("ResultActionCard decision-first hierarchy", () => {
  beforeEach(() => {
    delete window.gtag;
    delete window.IntersectionObserver;
    useAppStore.setState({
      csvData: { raw: [], headers: [], mapping: {}, fileName: "" },
      decisionRecords: [],
      decisionPersistenceEnabled: false,
    });
  });

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
    const { container } = render(
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
    expect(container.querySelector(".decision-review__tape-main").textContent).toContain("Explicit action");
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it("shows the review tape only for a real actionable result", () => {
    const card = (props = {}) => (
      <ResultActionCard
        toolId="5-3"
        headline="Result"
        analysisBasis={false}
        decisionPrefill={{ action: "Move 10% budget", metric: "CPA" }}
        {...props}
      />
    );
    const view = render(card());
    expect(view.container.querySelector(".decision-review")).toBeTruthy();

    view.rerender(card({ decisionReview: false }));
    expect(view.container.querySelector(".decision-review")).toBeFalsy();

    view.rerender(card({ tone: "bad" }));
    expect(view.container.querySelector(".decision-review")).toBeTruthy();

    view.rerender(card({ decisionPrefill: { conclusion: "No safe action" } }));
    expect(view.container.querySelector(".decision-review")).toBeFalsy();

    view.rerender(card({ decisionPrefill: { action: "   " } }));
    expect(view.container.querySelector(".decision-review")).toBeFalsy();

    useAppStore.setState({ csvData: { raw: [{ Date: "2026-01-01" }], headers: ["Date"], mapping: {}, fileName: "demo_efficiency.csv" } });
    view.rerender(card());
    expect(view.container.querySelector(".decision-review")).toBeFalsy();
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it("places the review promise before the folded analysis basis", () => {
    const mappedRows = [{ date: "2026-07-01", cost: "100", installs: "10" }];
    useAppStore.setState({ csvData: {
      raw: [{ Date: "2026-07-01", Cost: "100", Installs: "10" }],
      headers: ["Date", "Cost", "Installs"],
      mapping: { Date: "date", Cost: "cost", Installs: "installs" },
      fileName: "allocation.csv",
      mappedRows,
      canonicalData: {
        summary: {},
        records: [{ date: "2026-07-01", dimensions: { channel: "Search" }, metrics: { cost: 100, installs: 10 } }],
      },
    } });
    const { container } = render(
      <ResultActionCard
        toolId="5-3"
        headline="Result"
        decisionPrefill={{ action: "Move 10% budget", metric: "CPA" }}
      />,
    );
    const review = container.querySelector(".decision-review");
    const basis = container.querySelector(".analysis-basis-bar");
    expect(review).toBeTruthy();
    expect(basis).toBeTruthy();
    expect(review.compareDocumentPosition(basis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("tracks completion once and result viewing only after real visibility", async () => {
    const observers = [];
    class VisibilityObserver {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target) { this.target = target; }
      disconnect() {}
    }
    window.IntersectionObserver = VisibilityObserver;
    window.gtag = vi.fn();
    useAppStore.setState({ csvData: {
      raw: [{ SecretCampaign: "never-send-this" }],
      headers: ["SecretCampaign"],
      mapping: {},
      fileName: "private-client.csv",
      importSource: "csv",
    } });

    const card = (props = {}) => (
      <ResultActionCard
        toolId="5-3"
        analysisKey="telemetry-result-unique-20260804"
        analysisType="budget_allocation"
        resultState="ready"
        headline="Result"
        analysisBasis={false}
        decisionReview={false}
        {...props}
      />
    );
    const view = render(card());

    expect(window.gtag).toHaveBeenCalledWith("event", "analysis_completed", {
      tool_id: "5-3",
      source: "csv",
      row_count: 1,
      analysis_type: "budget_allocation",
      result_state: "ready",
      placement: "result_action_card",
      locale: "ko",
    });
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_result_viewed")).toHaveLength(0);

    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    observers[0].callback([{ target: observers[0].target, isIntersecting: true, intersectionRatio: 0.2 }]);
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_result_viewed")).toHaveLength(1);

    view.unmount();
    const secondView = render(card());
    const completionCalls = window.gtag.mock.calls.filter((call) => call[1] === "analysis_completed");
    expect(completionCalls).toHaveLength(1);

    secondView.unmount();
    useAppStore.setState({ csvData: {
      raw: [{ SecretCampaign: "another-private-value" }],
      headers: ["SecretCampaign"],
      mapping: {},
      fileName: "different-private-client.csv",
      importSource: "csv",
    } });
    render(card());
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_completed")).toHaveLength(2);
    render(card({ locale: "en" }));
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_completed")).toHaveLength(3);
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("private-client.csv");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("different-private-client.csv");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("never-send-this");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("another-private-value");
  });
});
