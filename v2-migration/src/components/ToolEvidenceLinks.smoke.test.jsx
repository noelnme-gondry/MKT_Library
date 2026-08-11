/* @vitest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToolEvidenceLinks from "@/components/ToolEvidenceLinks";

const ITEMS = [
  { type: "post", href: "/blog/guide-one", title: "운영 가이드 1", description: "첫 번째 설명" },
  { type: "post", href: "/blog/guide-two", title: "운영 가이드 2", description: "두 번째 설명" },
  { type: "term", href: "/glossary/adstock", title: "애드스톡", description: "용어 설명" },
];

describe("ToolEvidenceLinks", () => {
  it("groups guides and glossary terms into visibly separate sections", () => {
    render(<ToolEvidenceLinks items={ITEMS} />);

    const guides = screen.getByRole("region", { name: "실무 가이드" });
    const terms = screen.getByRole("region", { name: "핵심 용어" });
    expect(within(guides).getAllByRole("link")).toHaveLength(2);
    expect(within(terms).getAllByRole("link")).toHaveLength(1);
    expect(within(guides).getByText("2개")).toBeTruthy();
    expect(within(terms).getByText("1개")).toBeTruthy();
  });

  it("renders the same grouped hierarchy in English without Korean copy", () => {
    const { container } = render(<ToolEvidenceLinks items={ITEMS.map((item, index) => ({ ...item, title: `Item ${index + 1}`, description: "Description" }))} locale="en" />);

    expect(screen.getByRole("region", { name: "Guide" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Key glossary terms" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
