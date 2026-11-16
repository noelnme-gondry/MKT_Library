import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import GuideIndex from "./GuideIndex";
import MarketingAnalysisLibrary from "./MarketingAnalysisLibrary";
import { MARKETING_ANALYSIS_DOMAINS } from "@/lib/marketingAnalysisLibrary";

afterEach(cleanup);

describe.each(["ko", "en"])("analysis library %s", (locale) => {
  const en = locale === "en";
  it("is reachable through the real guide and includes method text in initial HTML", () => {
    const html = renderToStaticMarkup(<GuideIndex locale={locale} />);
    expect(html).toContain('href="#analysis-library"');
    expect(html).toContain("CUPED");
    expect(html).toContain(en ? "Marketing analysis map" : "마케팅 분석 지도");
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    const methodCount = MARKETING_ANALYSIS_DOMAINS.reduce((sum, group) => sum + group.methods.length, 0);
    expect((html.match(/<details\b/g) || []).length).toBe(methodCount);
  });

  it("filters, announces no results and resets without presenting a fake run action", () => {
    render(<MarketingAnalysisLibrary locale={locale} />);
    const query = screen.getByLabelText(en ? "Search questions and methods" : "분석 질문·방법 검색");
    fireEvent.change(query, { target: { value: "CUPED" } });
    const method = document.querySelector("#analysis-cuped");
    expect(method).not.toBeNull();
    expect(method.textContent).toContain(en ? "Tool linked" : "연결 도구 있음");
    expect(within(method).getByRole("link", { name: en ? "CUPED experiment adjustment" : "CUPED 실험 보정" }).getAttribute("href")).toBe(`${en ? "/en" : ""}/tools/cuped-experiment`);
    fireEvent.change(screen.getByLabelText(en ? "Availability" : "제공 범위"), { target: { value: "tool" } });
    expect(document.querySelectorAll("details")).toHaveLength(1);
    fireEvent.change(query, { target: { value: "no-such-analysis-7823" } });
    expect(document.querySelectorAll("details")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("0");
    fireEvent.click(screen.getByRole("button", { name: en ? "Reset filters" : "필터 초기화" }));
    fireEvent.change(screen.getByLabelText(en ? "Domain" : "분야"), { target: { value: "acquisition" } });
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toContain(`${en ? "/en" : ""}/tools/asa-keyword-finder`);
    expect(links).toContain(`${en ? "/en" : ""}/tools/aso-store-conversion`);
    if (en) expect(links.filter((href) => href.startsWith("/") && !href.startsWith("/en/"))).toEqual([]);
  });
});
