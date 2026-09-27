// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FigurePngButton from "./FigurePngButton";
import ResultActionCard from "./ResultActionCard";
import { downloadElementAsPNG } from "@/utils/figureImage";
import { useAppStore } from "@/store/useDataStore";

vi.mock("@/utils/figureImage", () => ({ downloadElementAsPNG: vi.fn(async () => true) }));
vi.mock("@/lib/subscription/paidExport", () => ({ requirePaidExport: () => true }));

describe("PNG context from the result card", () => {
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
