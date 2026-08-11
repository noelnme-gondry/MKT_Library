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
    const { container } = render(<ToolEvidenceLinks items={ITEMS} />);

    const guides = screen.getByRole("region", { name: "실무 가이드" });
    const terms = screen.getByRole("region", { name: "핵심 용어" });
    expect(within(guides).getAllByRole("link")).toHaveLength(2);
    expect(within(terms).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "관련 가이드와 용어" })).toBeTruthy();
    expect(screen.queryByText("첫 번째 설명")).toBeNull();
    expect(container.textContent).not.toContain("개");
  });

  it("renders the same grouped hierarchy in English without Korean copy", () => {
    const { container } = render(<ToolEvidenceLinks items={ITEMS.map((item, index) => ({ ...item, title: `Item ${index + 1}`, description: "Description" }))} locale="en" />);

    expect(screen.getByRole("region", { name: "Guide" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Key glossary terms" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related guides and terms" })).toBeTruthy();
    expect(container.textContent).not.toContain("Description");
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });

  it("lets a single content type occupy the full grouped surface", () => {
    const { container } = render(<ToolEvidenceLinks items={ITEMS.filter((item) => item.type === "term")} />);
    expect(container.querySelectorAll(".tool-evidence__group")).toHaveLength(1);
    expect(container.querySelector(".tool-evidence__group:only-child")).toBeTruthy();
  });
});
