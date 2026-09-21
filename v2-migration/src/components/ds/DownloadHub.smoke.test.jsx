// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import DownloadHub from "@/components/ds/DownloadHub";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { createAnalysisWorkbook } from "@/lib/analysis-export/workbookClient";
import { downloadXlsx } from "@/utils/download";
import { trackProductEvent } from "@/lib/analytics";
import { buildAnalysisExportPayload } from "@/lib/analysis-export/exportContract";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("@/lib/analysis-export/workbookClient", () => ({ createAnalysisWorkbook: vi.fn(async () => new ArrayBuffer(8)) }));
vi.mock("@/utils/download", () => ({ downloadJson: vi.fn(), downloadXlsx: vi.fn() }));

describe("DownloadHub", () => {
  it.each(["ko", "en"])("opens a free preview directly and gates its paid download (%s)", async locale => {
    useAppStore.setState({ entitlement: null, purchasePrompt: null });
    vi.clearAllMocks();
    const payload = buildAnalysisExportPayload({ toolId: "5-21", locale, headline: "Actual current result", source: { rows: [] } });
    render(<AnalysisExportProvider value={{ toolId: "5-21", buildPayload: () => payload }}><DownloadHub toolId="5-21" locale={locale} /></AnalysisExportProvider>);
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Preview my report · free" : "내 보고서 미리보기 · 무료" }));
    await screen.findByRole("dialog");
    expect(screen.getByText("Actual current result")).toBeTruthy();
    expect(useAppStore.getState().purchasePrompt).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Download Word report · Pro" : "Word 보고서 다운로드 · Pro" }));
    await waitFor(() => expect(useAppStore.getState().purchasePrompt?.toolId).toBe("5-21"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createAnalysisWorkbook).not.toHaveBeenCalled();
  });
  it.each(["ko", "en"])("previews actual evidence without a purchase, file generation or analytics disclosure (%s)", async locale => {
    useAppStore.setState({ entitlement: null, purchasePrompt: null });
    vi.clearAllMocks();
    const payload = buildAnalysisExportPayload({ toolId: "5-21", toolTitle: "Performance change", locale, headline: "Hold: private-campaign-17", stats: [{ label: "CPA", value: "12,345", detail: "Observed only" }], source: { rows: [{ privateRevenue: 12345 }] }, addon: { method: { name: "Bennet", limitations: ["No causal attribution"] } } });
    render(<AnalysisExportProvider value={{ toolId: "5-21", buildPayload: () => payload }}><DownloadHub toolId="5-21" locale={locale} /></AnalysisExportProvider>);
    const trigger = screen.getByRole("button", { name: "결과 받기" });
    trigger.focus(); fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: locale === "en" ? /Preview my report/ : /내 보고서 미리보기/ }));
    await screen.findByRole("dialog");
    expect(screen.getByText(payload.summary.headline)).toBeTruthy();
    expect(screen.getByText("12,345")).toBeTruthy();
    expect(screen.getByText("No causal attribution")).toBeTruthy();
    expect(createAnalysisWorkbook).not.toHaveBeenCalled();
    expect(downloadXlsx).not.toHaveBeenCalled();
    expect(useAppStore.getState().purchasePrompt).toBeNull();
    expect(JSON.stringify(trackProductEvent.mock.calls)).not.toMatch(/private|12,345|12345|No causal/);
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Close" : "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  beforeEach(() => { useAppStore.setState({ entitlement: { plan: "paid", payment: true, expiresAt: Date.now() + 3600000, offlineUntil: Date.now() + 3600000 }, purchasePrompt: null }); });
  it("blocks unpaid exports before opening the menu", () => {
    useAppStore.setState({ entitlement: null });
    const action = vi.fn();
    render(<DownloadHub toolId="5-2" label="Export" items={[{ label: "CSV", onSelect: action }]} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Export" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(useAppStore.getState().purchasePrompt.toolId).toBe("5-2");
  });
  it("does not generate or deliver files for trial-only accounts", () => {
    useAppStore.setState({ entitlement: { plan: "paid", account: true, trial: true, expiresAt: Date.now() + 3600000, offlineUntil: Date.now() + 3600000 } });
    const buildPayload = vi.fn();
    const action = vi.fn();
    render(<AnalysisExportProvider value={{ toolId: "5-2", buildPayload }}><DownloadHub label="Trial export" items={[{ label: "CSV", onSelect: action }]} /></AnalysisExportProvider>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Trial export" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "CSV" }));
    expect(buildPayload).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(useAppStore.getState().purchasePrompt).toBeTruthy();
  });
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
    await waitFor(() => expect(createAnalysisWorkbook).toHaveBeenCalledWith({ ...payload, charts: [] }));
    expect(downloadXlsx).toHaveBeenCalledWith(expect.any(ArrayBuffer), "5-21_analysis_workbook");
    expect(buildPayload).toHaveBeenCalledWith(null);
    // 시도가 먼저 찍혀야 "눌렀는데 못 받은 비율"의 분모가 생긴다.
    expect(trackProductEvent).toHaveBeenCalledWith("result_download_attempted", {
      tool_id: "5-21", source: "export", download_type: "xlsx", locale: "ko", state: "paid",
    });
    expect(trackProductEvent).toHaveBeenCalledWith("result_downloaded", {
      tool_id: "5-21", source: "export", download_type: "xlsx", locale: "ko", state: "paid",
    });
    expect(JSON.stringify(trackProductEvent.mock.calls)).not.toContain("never-send");
  });
});
