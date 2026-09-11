// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BlogCsvAnalysis from "./BlogCsvAnalysis";
import { useAppStore } from "@/store/useDataStore";
import { idToSlug } from "@/lib/routeMap";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./BlogInsightChart", () => ({ default: ({ visual }) => <figure>{JSON.stringify(visual.data)}</figure> }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
async function upload(locale = "ko", text = "impressions,clicks,installs\n1000,100,10\n2000,200,20") {
  const file = new File([text], "report.csv", { type: "text/csv" });
  file.text = async () => text;
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Choose CSV" : "CSV 선택"), { target: { files: [file] } });
  await screen.findByText(locale === "en" ? "Check columns" : "열 확인");
}
describe("blog CSV to full analysis", () => {
  beforeEach(() => {
    push.mockClear();
    useAppStore.setState({ ...useAppStore.getInitialState(), activeProjectId: "default", projectSwitching: false, decisionPersistenceEnabled: false });
  });
  afterEach(cleanup);
  it.each(["ko", "en"])("renders one real chart and carries full data through the actual %s route setter", async locale => {
    const { container } = render(<BlogCsvAnalysis config={{ toolId: "5-2", type: "funnel" }} slug="funnel-dropoff-analysis" locale={locale} />);
    await upload(locale);
    expect(useAppStore.getState().csvData.raw).toHaveLength(0);
    fireEvent.click(screen.getByText(locale === "en" ? "Show result" : "결과 보기"));
    await waitFor(() => expect(container.querySelectorAll("figure")).toHaveLength(1));
    expect(container.querySelector("figure").textContent).toContain("3000");
    expect(container.querySelector("figure").textContent).toContain("300");
    fireEvent.click(screen.getByText(locale === "en" ? "Open detailed analysis" : "더 자세한 분석 보기"));
    const state = useAppStore.getState();
    expect(state.csvGroups.efficiency.raw).toHaveLength(2);
    expect(state.csvData.mapping.clicks).toBe("clicks");
    expect(state.currentRouteId).toBe("5-2");
    expect(state.dashboardTab).toBe("funnel");
    expect(state.isGroupAnalyzed("5-2")).toBe(false);
    expect(push).toHaveBeenCalledWith(`${locale === "en" ? "/en" : ""}${idToSlug["5-2"]}`);
    act(() => state.setCurrentRouteId("5-21"));
    expect(useAppStore.getState().csvData.raw[0].impressions).toBe("1000");
  });
  it("does not plot invalid cells as zero", async () => {
    const { container } = render(<BlogCsvAnalysis config={{ toolId: "5-2", type: "funnel" }} slug="funnel-dropoff-analysis" />);
    await upload("ko", "impressions,clicks\n1000,invalid");
    fireEvent.click(screen.getByText("결과 보기"));
    await screen.findByRole("alert");
    expect(container.querySelector("figure")).toBeNull();
  });
  it("never overwrites another project's data after an in-flight project switch", async () => {
    render(<BlogCsvAnalysis config={{ toolId: "5-2", type: "funnel" }} slug="funnel-dropoff-analysis" />);
    await upload();
    act(() => useAppStore.setState({ activeProjectId: "another" }));
    fireEvent.click(screen.getByText("더 자세한 분석 보기"));
    expect(screen.getByRole("alert").textContent).toContain("프로젝트가 바뀌었습니다");
    expect(push).not.toHaveBeenCalled();
    expect(useAppStore.getState().csvData.raw).toHaveLength(0);
  });
  it("requires explicit replacement of existing detailed-tool data", async () => {
    const previous = { raw: [{ impressions: "1" }], headers: ["impressions"], mapping: { impressions: "impressions" } };
    useAppStore.getState().setCurrentRouteId("5-2");
    useAppStore.getState().setCsvData(previous);
    render(<BlogCsvAnalysis config={{ toolId: "5-2", type: "funnel" }} slug="funnel-dropoff-analysis" />);
    await upload();
    fireEvent.click(screen.getByText("더 자세한 분석 보기"));
    expect(push).not.toHaveBeenCalled();
    expect(useAppStore.getState().csvData.raw).toBe(previous.raw);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("더 자세한 분석 보기"));
    expect(push).toHaveBeenCalledOnce();
    expect(useAppStore.getState().csvData.raw).toHaveLength(2);
  });
});
