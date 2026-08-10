import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RelatedGlossaryList from "@/components/seo/RelatedGlossaryList";

const items = [
  { slug: "marginal-cpa", term: "한계 CPA", shortDef: "다음 1원의 지출이 만드는 전환 비용", href: "/glossary/marginal-cpa" },
  { slug: "roas", term: "ROAS", shortDef: "광고비 대비 매출", href: "/glossary/roas" },
];

describe("RelatedGlossaryList", () => {
  // 예전에는 slug 원문이 앵커 텍스트였다. 사람에게도 내부 링크 문맥에도 의미가 없다.
  it("uses the term name as anchor text, not the slug", () => {
    render(<RelatedGlossaryList items={items} />);
    const link = screen.getByRole("link", { name: /한계 CPA/ });
    expect(link.getAttribute("href")).toBe("/glossary/marginal-cpa");
    expect(screen.queryByText("marginal-cpa")).toBeNull();
  });

  it("shows the short definition when present", () => {
    render(<RelatedGlossaryList items={items} />);
    expect(screen.getByText("다음 1원의 지출이 만드는 전환 비용")).toBeTruthy();
  });

  it("renders nothing when there are no related terms", () => {
    const { container } = render(<RelatedGlossaryList items={[]} />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("localizes the section label", () => {
    render(<RelatedGlossaryList items={items} locale="en" />);
    expect(screen.getByText("Terms used in this article")).toBeTruthy();
  });
});
