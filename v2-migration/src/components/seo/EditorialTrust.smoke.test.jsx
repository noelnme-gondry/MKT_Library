import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EditorialTrust from "./EditorialTrust";

describe("EditorialTrust", () => {
  it.each(["ko", "en"])("keeps compact %s sources in HTML, collapsed without inventing a review", locale => {
    const { container } = render(<EditorialTrust compact locale={locale} sources={[{ title: "Source", url: "https://example.com/source" }]} />);
    expect(container.querySelector("details").open).toBe(false);
    expect(container.querySelector("summary").textContent).toContain(locale === "en" ? "Sources and review" : "출처·검토");
    expect(container.querySelector("a").getAttribute("href")).toBe("https://example.com/source");
    expect(container.querySelector("time")).toBeNull();
  });
  it("does not imply a review when no explicit review or source exists", () => {
    const { container } = render(<EditorialTrust />);
    expect(container.innerHTML).toBe("");
  });

  it("renders only explicit review metadata and visible sources", () => {
    render(
      <EditorialTrust
        locale="en"
        reviewer="Analytics editor"
        reviewedAt="2026-08-01"
        sources={[{ title: "Official reference", url: "https://example.com/reference" }]}
      />,
    );
    expect(screen.getByText("Reviewed August 1, 2026")).toBeTruthy();
    expect(screen.getByText("Reviewed by Analytics editor")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Official reference" }).getAttribute("href")).toBe("https://example.com/reference");
  });

  it("labels glossary sources as definition sources", () => {
    render(
      <EditorialTrust
        contentType="glossary"
        sources={[{ title: "공식 정의", url: "https://example.com/definition" }]}
      />,
    );
    expect(screen.getByText("이 용어 설명에서 인용한 1차 출처")).toBeTruthy();
  });
});
