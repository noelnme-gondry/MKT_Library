// @vitest-environment jsdom
import { useAppStore } from "@/store/useDataStore";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PeriodSensitivityPanel from "./PeriodSensitivityPanel";
import * as downloads from "@/utils/download";

describe("period sensitivity explicit execution", () => {
  it.each(["ko", "en"])("runs on request, exports the same evidence and clears on input replacement (%s)", async (locale) => {
    useAppStore.setState({ entitlement: { plan: "paid", expiresAt: Date.now() + 3600000, offlineUntil: Date.now() + 3600000 } });
    const compute = vi.fn(() => ({ periods: [{ start: "2026-08-01", end: "2026-08-08" }, { start: "2026-08-09", end: "2026-08-16" }], rows: [{ name: "A", status: "changed", before: { direction: "scale", n: 8, min: 100, max: 200 }, after: { direction: "saturated", n: 8, min: 100, max: 200 } }] }));
    const download = vi.spyOn(downloads, "downloadCsv").mockReturnValue(true);
    try {
      const { rerender } = render(<PeriodSensitivityPanel key="old" locale={locale} compute={compute} />);
      expect(compute).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Check period sensitivity" : "기간 민감도 확인" }));
      await waitFor(() => expect(screen.getByText(locale === "en" ? "A: Direction changed" : "A: 방향 변경")).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Download period evidence CSV" : "기간 근거 CSV 받기" }));
      expect(download).toHaveBeenCalledWith(expect.stringContaining("A,changed,2026-08-01,2026-08-08,2026-08-09,2026-08-16,scale,saturated,8,8,100,200,100,200"), "period_sensitivity");
      rerender(<PeriodSensitivityPanel key="new" locale={locale} compute={compute} />);
      expect(screen.queryByText(locale === "en" ? "A: Direction changed" : "A: 방향 변경")).toBeNull();
      expect(compute).toHaveBeenCalledTimes(1);
    } finally { download.mockRestore(); }
  });
});
