// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { trackProductEvent } from "@/lib/analytics";
import FigurePngButton from "./FigurePngButton";
import ResultActionCard from "./ResultActionCard";
import { downloadElementAsPNG } from "@/utils/figureImage";
import { useAppStore } from "@/store/useDataStore";

vi.mock("@/lib/analytics", async importOriginal => ({ ...await importOriginal(), trackProductEvent: vi.fn(), trackProductEventOnce: vi.fn() }));
vi.mock("@/utils/figureImage", () => ({ downloadElementAsPNG: vi.fn(async () => true) }));
vi.mock("@/lib/subscription/paidExport", () => ({ requirePaidExport: () => true }));

describe("PNG context from the result card", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it.each([true, false])("counts PNG generation outcome without file names (success: %s)", async success => {
    downloadElementAsPNG.mockResolvedValueOnce(success);
    useAppStore.setState({ currentRouteId: "5-3" });
    render(<FigurePngButton target={document.createElement("figure")} title="Private campaign" fileName="private-source" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() => expect(trackProductEvent).toHaveBeenCalledWith(success ? "result_downloaded" : "result_download_failed", expect.objectContaining({ tool_id: "5-3", download_type: "png", source: "core_figure" })));
    expect(trackProductEvent).toHaveBeenCalledWith("result_download_attempted", expect.objectContaining({ download_type: "png" }));
    expect(JSON.stringify(trackProductEvent.mock.calls)).not.toMatch(/Private campaign|private-source/);
    expect(screen.queryByRole("alert") !== null).toBe(!success);
    if (!success) expect(trackProductEvent.mock.calls.some(([event]) => event === "result_downloaded")).toBe(false);
  });
  it("exports the card's real period and withheld state with the figure title", async () => {
    useAppStore.setState({ csvData: { raw: [], headers: [], mapping: {}, fileName: "demo_efficiency.csv" } });
    const figure = document.createElement("figure");
    render(<ResultActionCard toolId="5-2" headline="Exploratory result" locale="en" resultState="inconclusive" decisionReview={false} analysisBasis={false}
      scopeEvidence={{ periods: [{ id: "after", start: "2026-08-08", end: "2026-08-14" }] }}
      coreFigure={<FigurePngButton target={figure} title="Channel comparison" fileName="channels" locale="en" />} />);
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() => expect(downloadElementAsPNG).toHaveBeenCalledWith(figure, "channels", { context: expect.objectContaining({ title: "Channel comparison", details: expect.arrayContaining(["Period: 2026-08-08 – 2026-08-14", "Sample data", "Decision withheld. Check the result's limitations."]) }) }));
  });
});
