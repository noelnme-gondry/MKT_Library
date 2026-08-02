// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidenceStatusBadge from "@/components/ds/EvidenceStatusBadge";
import { STATISTICAL_STATUS } from "@/lib/analysis-router/statisticalStatus";

describe("EvidenceStatusBadge", () => {
  it("uses one Korean label and explanation for insufficient evidence", () => {
    render(<EvidenceStatusBadge status={STATISTICAL_STATUS.INSUFFICIENT_DATA} />);
    expect(screen.getByRole("status").textContent).toContain("근거 부족");
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain("결론을 낼 만큼");
  });

  it("links English terminology without leaking Korean", () => {
    render(<EvidenceStatusBadge status={STATISTICAL_STATUS.CAUTION} locale="en" glossarySlug="adstock" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/en/glossary/adstock");
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
  });
});
