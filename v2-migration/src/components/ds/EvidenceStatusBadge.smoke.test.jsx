// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidenceStatusBadge from "@/components/ds/EvidenceStatusBadge";
import { STATISTICAL_STATUS } from "@/lib/analysis-router/statisticalStatus";

// 신뢰도 라벨은 늘 붙이지 않는다(2026-09-24): 문제가 없으면 없음, 있으면 빨간 "!" 하나.
describe("EvidenceStatusBadge", () => {
  it("draws nothing when the result is ready", () => {
    const { container } = render(<EvidenceStatusBadge status={STATISTICAL_STATUS.READY} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows one red mark that explains insufficient evidence in Korean", () => {
    render(<EvidenceStatusBadge status={STATISTICAL_STATUS.INSUFFICIENT_DATA} />);
    const mark = screen.getByRole("button", { name: /확인할 점 1개/ });
    expect(mark.textContent).toBe("!");
    fireEvent.click(mark);
    expect(screen.getByRole("dialog").textContent).toContain("근거 부족");
    expect(screen.getByRole("dialog").textContent).toContain("결론을 낼 만큼");
  });

  it("explains a caution in English without leaking Korean", () => {
    render(<EvidenceStatusBadge status={STATISTICAL_STATUS.CAUTION} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: /to check/ }));
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
  });
});
