import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeToolFinder from "./HomeToolFinder";
import { allToolIndexEntries } from "@/lib/toolIndex";

describe("tool discovery and reuse", () => {
  beforeEach(() => window.localStorage.clear());
  it.each(["ko", "en"])("searches all tools and preserves saved tools across visits (%s)", locale => {
    const { container, unmount } = render(<HomeToolFinder locale={locale} />);
    const tool = allToolIndexEntries(locale)[0];
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: tool.name } });
    expect(container.querySelector("#home-tool-results").hidden).toBe(false);
    expect(screen.getByRole("link", { name: `${locale === "en" ? "Open" : "분석 열기"}: ${tool.name}` }).getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}${tool.href}`);
    expect(container.querySelector("dl").textContent).toContain(tool.needs[0]);
    fireEvent.click(screen.getByRole("button", { name: `${locale === "en" ? "Save" : "저장"}: ${tool.name}` }));
    unmount();
    render(<HomeToolFinder locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: /(?:Saved tools|저장한 도구) \(1\)/ }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: `${locale === "en" ? "Save" : "저장"}: ${tool.name}` }));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
  it("shows an empty search and lets a question reset it", () => {
    const { container } = render(<HomeToolFinder />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-tool-xyz" } });
    expect(screen.getByText(/검색 결과가 없습니다/)).toBeTruthy();
    fireEvent.click(container.querySelector(".home-tool-finder__purposes button"));
    expect(screen.getByRole("searchbox").value).toBe("");
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    const icons = [...container.querySelectorAll(".home-tool-finder__purposes svg")].map(icon => icon.innerHTML);
    expect(new Set(icons).size).toBe(icons.length);
  });
  it("reports storage failures without claiming success", () => {
    const { container } = render(<HomeToolFinder />);
    fireEvent.click(container.querySelector(".home-tool-finder__purposes button"));
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getAllByRole("button", { name: /^저장:/ })[0]);
    expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다");
    spy.mockRestore();
  });
});
