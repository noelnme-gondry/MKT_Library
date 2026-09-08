// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import PaidOrganicTrend from "@/components/tools/PaidOrganicTrend";
import { buildPaidOrganicTrendDemo } from "@/utils/paidOrganicTrend";
import { buildDemoCsv } from "@/utils/demoData";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice = EMPTY_CSV) {
  useAppStore.setState({
    currentRouteId: "5-18-paid-organic",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
    isDarkMode: false,
  });
}

function confirmConditions(locale = "ko") {
  for (const [ko, en, value] of [["추적·어트리뷰션 정책", "Tracking / attribution policy", "consistent"], ["계절성·프로모션 조건", "Seasonality / promotion conditions", "reviewed"], ["광고 집행 연속성", "Ad delivery continuity", "continuous"]]) {
    fireEvent.change(screen.getByLabelText(locale === "en" ? en : ko), { target: { value } });
  }
}

describe("PaidOrganicTrend render smoke", () => {
  beforeEach(() => seed());

  it("shows a low-friction upload state without loading a deep model", () => {
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByRole("heading", { name: "Paid·Organic 변화맵" })).toBeTruthy();
    expect(screen.getByText(/날짜·Paid 성과/)).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("renders the darker-is-newer movement map and detailed-diagnosis handoff", () => {
    seed(buildPaidOrganicTrendDemo());
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByText("주별 WoW 변화 궤적")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeTruthy();
    const link = screen.getByRole("link", { name: /카니발 정밀 진단 열기/ });
    expect(link.getAttribute("href")).toBe("/tools/cannibalization-diagnosis");
  });

  it("runs from the shared marketing-response demo without another upload", () => {
    seed(buildDemoCsv("response"));
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByText("주별 WoW 변화 궤적")).toBeTruthy();
    expect(screen.getByText("Organic = 전체 − Paid")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("offers a real-data movement-map decision for the weekly review loop", () => {
    const demo = buildPaidOrganicTrendDemo();
    seed({ ...demo, fileName: "uploaded-paid-organic.csv" });
    const { container } = render(<PaidOrganicTrend />);
    expect(container.querySelector('[data-decision-review-tool="5-18-paid-organic"]')).toBeNull();
    confirmConditions();
    expect(container.querySelector('[data-decision-review-tool="5-18-paid-organic"]')).toBeTruthy();
  });

  it.each(["ko", "en"])("withholds tracking-change and interruption interpretations (%s)", (locale) => {
    seed({ ...buildPaidOrganicTrendDemo(locale), fileName: "observed.csv" });
    const { container } = render(<PaidOrganicTrend locale={locale} />);
    confirmConditions(locale);
    expect(container.querySelector(".decision-review")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(locale === "en" ? "Tracking / attribution policy" : "추적·어트리뷰션 정책"), { target: { value: "changed" } });
    expect(container.querySelector(".decision-review")).toBeNull();
    confirmConditions(locale);
    fireEvent.change(screen.getByLabelText(locale === "en" ? "Ad delivery continuity" : "광고 집행 연속성"), { target: { value: "interrupted" } });
    expect(container.querySelector(".decision-review")).toBeNull();
    expect(container.textContent).toContain(locale === "en" ? "Treat patterns as descriptive" : "패턴은 현상 설명으로만");
    confirmConditions(locale);
    act(() => seed({ ...buildPaidOrganicTrendDemo(locale), fileName: "replacement.csv" }));
    expect(screen.getByLabelText(locale === "en" ? "Tracking / attribution policy" : "추적·어트리뷰션 정책").value).toBe("");
    expect(container.querySelector(".decision-review")).toBeNull();
  });

  it("keeps KR and EN routes functionally equivalent", () => {
    seed(buildPaidOrganicTrendDemo("en"));
    render(<PaidOrganicTrend locale="en" />);
    expect(screen.getByRole("heading", { name: "Paid · Organic Movement Map" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open detailed cannibalization diagnosis/ }).getAttribute("href"))
      .toBe("/en/tools/cannibalization-diagnosis");
  });

  it("loads deterministic example data from the empty state", () => {
    render(<PaidOrganicTrend />);
    fireEvent.click(screen.getByRole("button", { name: "예시로 보기" }));
    expect(useAppStore.getState().csvData.fileName).toBe("demo_paid_organic_trend.csv");
  });
});
