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
    expect(container.querySelector(".home-tool-finder__purposes").hidden).toBe(true);
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
  // 필요한 파일은 컬럼보다 먼저 말하고(product-ssot §1.1c), 파일·출처 이름으로도 찾을 수 있다.
  it.each(["ko", "en"])("shows the file each analysis needs and finds analyses by source (%s)", locale => {
    const { container } = render(<HomeToolFinder locale={locale} />);
    const tools = allToolIndexEntries(locale);
    const files = [...container.querySelectorAll(".home-tool-directory__file")].map(node => node.textContent);
    expect(files).toHaveLength(tools.length);
    expect(files[0]).toContain(tools[0].source.file);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "App Store Connect" } });
    const storeTools = tools.filter(tool => tool.source.where.includes("App Store Connect"));
    expect(storeTools.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".home-tool-finder__tool")).toHaveLength(storeTools.length);
    const file = container.querySelector(".home-tool-finder__file");
    expect(file.firstChild.textContent).toBe(storeTools[0].source.file);
    expect(file.querySelector("small").textContent).toBe(storeTools[0].source.family);
  });
  it("restores the full directory after clearing an empty search", () => {
    const { container } = render(<HomeToolFinder />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-tool-xyz" } });
    expect(screen.getByText(/검색 결과가 없습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "검색 지우기" }));
    expect(screen.getByRole("searchbox").value).toBe("");
    expect(container.querySelector(".home-tool-directory").hidden).toBe(false);
    expect(screen.getAllByRole("link")).toHaveLength(allToolIndexEntries().length);
    expect(new Set(screen.getAllByRole("link").map(link => link.getAttribute("href"))).size).toBe(allToolIndexEntries().length);
  });
  it("reports storage failures without claiming success", () => {
    render(<HomeToolFinder />);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getAllByRole("button", { name: /^저장:/ })[0]);
    expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다");
    spy.mockRestore();
  });
});
