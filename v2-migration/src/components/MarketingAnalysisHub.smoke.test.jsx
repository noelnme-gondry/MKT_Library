// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MarketingAnalysisHub from "./MarketingAnalysisHub";
import { MARKETING_ANALYSIS_TASKS, marketingAnalysisCopy } from "@/lib/marketingAnalysisHub";
import { idToPath } from "@/lib/routeMap";
import { COMPARE_SLUGS } from "@/lib/compareContent";
import { getCalculator } from "@/lib/calculators";
import { trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import examples from "@/lib/blogExamples/data.json";
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn(), trackProductEventOnce: vi.fn(), productEventKey: (...parts) => parts.join(":") }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["ko", "en"])("connects each %s marketing question to its declared analysis and preserves method guides", locale => {
  const prefix = locale === "en" ? "/en" : "";
  const { container } = render(<MarketingAnalysisHub locale={locale} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(marketingAnalysisCopy(locale).title);
  for (const task of MARKETING_ANALYSIS_TASKS) {
    const question = screen.getByRole("button", { name: new RegExp(task[locale].question) });
    fireEvent.click(question);
    expect(question.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById(question.getAttribute("aria-controls")).getAttribute("role")).toBe("region");
    const href = idToPath(task.toolId);
    if (task.calculator) expect(getCalculator(task.calculator, locale)).toBeTruthy();
    const link = screen.getByRole("link", { name: task[locale].action });
    expect(link.getAttribute("href")).toBe(`${prefix}${href}`);
    fireEvent.click(link);
    expect(trackProductEvent).toHaveBeenLastCalledWith("blog_tool_cta_clicked", expect.objectContaining({ content_type: "compare", content_slug: "marketing-analysis", locale, tool_id: task.toolId }));
    expect(container.querySelectorAll(".analysis-preview .btn.primary")).toHaveLength(1);
    if (task.calculator) expect(container.querySelector(".calculator-result a")).toBeNull();
    expect(container.querySelector(`a[href="${prefix}/blog/${task.slug}#blog-practice"]`)).toBeTruthy();
  }
  for (const slug of COMPARE_SLUGS) expect(container.querySelector(`a[href="${prefix}/compare/${slug}"]`)).toBeTruthy();
  const [faq, breadcrumb] = JSON.parse(container.querySelector('script[type="application/ld+json"]').textContent);
  expect(faq.mainEntity.map(item => item.name)).toEqual(marketingAnalysisCopy(locale).faq.map(item => item.q));
  expect(breadcrumb.itemListElement[1].item).toBe(`https://growthoptplaybook.com${prefix}/compare`);
});
it.each(["ko", "en"])("shows signed engine evidence and an editable ROAS result in %s", locale => {
  const { container } = render(<MarketingAnalysisHub locale={locale} />);
  const bars = [...container.querySelectorAll(".analysis-preview__bar-label strong")].map(node => node.textContent);
  expect(bars).toEqual(examples["ad-performance-diagnosis"].bars.map(bar => `${bar.value > 0 ? "+" : ""}${new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 0 }).format(bar.value)}`));
  expect(bars.some(value => value.startsWith("-"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Inspect TikTok" : "TikTok 확인" }));
  expect(container.querySelector(".analysis-preview__channel").textContent).toContain("TikTok");
  expect(container.querySelector(".analysis-preview__channel").textContent).toContain("-4");
  expect(screen.getByRole("button", { name: locale === "en" ? "Inspect TikTok" : "TikTok 확인" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(MARKETING_ANALYSIS_TASKS[1][locale].question) }));
  const inputs = screen.getAllByRole("spinbutton");
  fireEvent.change(inputs[0], { target: { value: "200" } });
  fireEvent.change(inputs[1], { target: { value: "500" } });
  expect(screen.getByText("250% · 2.50×")).toBeTruthy();
  expect(trackProductEventOnce).toHaveBeenLastCalledWith("calculator_used", expect.any(String), { tool_id: "5-3", content_type: "compare", content_slug: "marketing-analysis", placement: "analysis_preview", locale, state: "calculated" });
  fireEvent.change(inputs[0], { target: { value: "" } });
  expect(screen.queryByText("250% · 2.50×")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(MARKETING_ANALYSIS_TASKS[2][locale].question) }));
  expect(container.querySelector(".analysis-preview__channel h3").textContent).toBe("Apple Search Ads");
  expect(screen.getByText(locale === "en" ? "Estimated marginal / average CPI · multiples" : "추정 한계 CPI / 평균 CPI · 배")).toBeTruthy();
  expect(container.querySelector(`a[href="${locale === "en" ? "/en" : ""}/blog/marketing-analysis-example"]`)).toBeTruthy();
});
