// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AnalysisDataGuide from "./AnalysisDataGuide";
import { dataGuideQuestions } from "@/lib/analysisDataGuide";
import { useAppStore } from "@/store/useDataStore";
import LandingPage from "./LandingPage";

beforeEach(() => { window.gtag = vi.fn(); window.sessionStorage.clear(); });
afterEach(() => { delete window.gtag; });

describe("question to analysis to data guide", () => {
  it.each(["ko", "en"])("changes the actual guidance for every question and tool without touching uploaded data (%s)", locale => {
    const before = useAppStore.getState().csvGroups;
    const { container } = render(<AnalysisDataGuide locale={locale} />);
    const questions = dataGuideQuestions(locale);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "data_guide_viewed", expect.objectContaining({ locale }));
    for (const stage of questions) {
      fireEvent.click(screen.getByRole("button", { name: stage.question }));
      for (const tool of stage.tools) {
        const button = within(container.querySelector("#data-guide-matches")).getByRole("button", { name: new RegExp(tool.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
        fireEvent.click(button);
        expect(button.getAttribute("aria-pressed")).toBe("true");
        expect(container.querySelector("#data-guide-detail-title").textContent).toBe(tool.name);
        expect(window.gtag).toHaveBeenLastCalledWith("event", "data_guide_analysis_selected", expect.objectContaining({ analysis_type: tool.href.split("/").at(-1), locale }));
        expect(container.querySelectorAll(".analysis-data-guide__fields tbody tr").length).toBeGreaterThan(0);
        expect(container.querySelectorAll(".analysis-data-guide__example tbody tr").length).toBeGreaterThan(0);
        expect(container.textContent).not.toMatch(/\b[59]-\d+\b/);
        if (locale === "en") expect(container.textContent).not.toMatch(/[가-힣]/);
        expect(container.querySelector(".analysis-data-guide__actions a[href]").getAttribute("href")).toContain(locale === "en" ? "/en/" : "/");
      }
    }
    expect(useAppStore.getState().csvGroups).toBe(before);
    for (const button of container.querySelectorAll("[aria-controls]")) expect(document.getElementById(button.getAttribute("aria-controls"))).toBeTruthy();
  });
  it("switches experiment methods without offering a holdout CSV for pre/post data", () => {
    const { container } = render(<AnalysisDataGuide />);
    fireEvent.click(screen.getByRole("button", { name: dataGuideQuestions().find(stage => stage.id === "prove").question }));
    fireEvent.click(within(container.querySelector("#data-guide-matches")).getByRole("button", { name: new RegExp(dataGuideQuestions().flatMap(stage => stage.tools).find(tool => tool.id === "5-23").name) }));
    fireEvent.click(screen.getByRole("button", { name: "광고를 켠 전후 비교" }));
    expect(screen.getByRole("button", { name: "빈 CSV 양식 받기" })).toBeTruthy();
    expect(container.querySelector(".analysis-data-guide__example").textContent).toContain("성과 지표");
    expect(window.gtag).toHaveBeenCalledWith("event", "data_guide_method_selected", expect.objectContaining({ tab_name: "on", tool_id: "5-23" }));
  });
  it("tracks the homepage guide CTA separately from the upload and demo actions", () => {
    render(<LandingPage />);
    const link = screen.getByRole("link", { name: "필요한 데이터 양식 확인" });
    link.addEventListener("click", event => event.preventDefault(), { once: true });
    fireEvent.click(link);
    expect(link.getAttribute("href")).toBe("/data-guide");
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_data_guide_clicked", expect.objectContaining({ locale: "ko", placement: "hero", interaction_source: "landing" }));
  });
});
