// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ResultActionCard from "./ResultActionCard";

describe("ResultActionCard decision-first hierarchy", () => {
  it("renders key figures before supporting prose", () => {
    const { container } = render(
      <ResultActionCard
        headline="결론"
        stats={[{ label: "즉시 교체", value: "3" }]}
        points={[{ text: "이유를 확인하세요." }]}
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
});
