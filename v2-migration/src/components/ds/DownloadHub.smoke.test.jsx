// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DownloadHub from "@/components/ds/DownloadHub";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { createAnalysisWorkbook } from "@/lib/analysis-export/workbookClient";
import { downloadXlsx } from "@/utils/download";
import { trackProductEvent } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("@/lib/analysis-export/workbookClient", () => ({ createAnalysisWorkbook: vi.fn(async () => new ArrayBuffer(8)) }));
vi.mock("@/utils/download", () => ({ downloadJson: vi.fn(), downloadXlsx: vi.fn() }));

describe("DownloadHub", () => {
  it("portals the menu, supports keyboard navigation, and runs the selected download", () => {
    const onSelect = vi.fn();
    render(<DownloadHub label="Export" items={[{ label: "CSV", onSelect }]} />);

    const trigger = screen.getByRole("button", { name: "Export" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const menuItem = screen.getByRole("menuitem", { name: "CSV" });
    expect(menuItem.parentElement?.parentElement?.parentElement).toBe(document.body);
    const menu = screen.getByRole("menu");
    expect(document.activeElement).toBe(menu);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItem);

    fireEvent.keyDown(menuItem, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "CSV" })).toBeNull();
  });

  it("prepends the common XLSX action from the result-card context", async () => {
    const payload = { toolId: "5-21", source: { rows: [{ Secret: "never-send" }] } };
    const buildPayload = vi.fn(() => payload);
    render(
      <AnalysisExportProvider value={{ toolId: "5-21", locale: "ko", buildPayload }}>
        <DownloadHub toolId="5-21" label="결과 받기" />
      </AnalysisExportProvider>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "결과 받기" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: /상세 워크북 \(XLSX\)/ }));
    await waitFor(() => expect(createAnalysisWorkbook).toHaveBeenCalledWith(payload));
    expect(downloadXlsx).toHaveBeenCalledWith(expect.any(ArrayBuffer), "5-21_analysis_workbook");
    expect(buildPayload).toHaveBeenCalledWith(null);
    expect(trackProductEvent).toHaveBeenCalledWith("result_downloaded", {
      tool_id: "5-21",
      source: "export",
      download_type: "xlsx",
    });
    expect(JSON.stringify(trackProductEvent.mock.calls)).not.toContain("never-send");
  });
});
