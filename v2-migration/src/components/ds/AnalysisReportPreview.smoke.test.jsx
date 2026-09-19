// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AnalysisReportPreview from "./AnalysisReportPreview";
import { buildAnalysisExportPayload } from "@/lib/analysis-export/exportContract";
import { trackProductEvent } from "@/lib/analytics";
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it.each(["ko", "en"])("%s copies actual evidence and records conversion only on clipboard success", async locale => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const payload = buildAnalysisExportPayload({ toolId: "5-3", toolTitle: "Budget", locale, headline: "Observed CPA", stats: [{ label: "CPA", value: "100", detail: "95% CI 80–120" }], scope: { currency: "KRW" }, reviewRecords: [{ action: "Test creative", learning: "Watch fatigue" }], addon: { method: { limitations: ["Not causal"] } } });
  render(<AnalysisReportPreview payload={payload} locale={locale} onClose={() => {}} />);
  const copy = screen.getByRole("button", { name: locale === "en" ? "Copy review brief" : "검토 브리프 복사" });
  fireEvent.click(copy);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain(locale === "en" ? "Could not copy" : "복사하지 못했습니다"));
  expect(trackProductEvent).not.toHaveBeenCalled();
  fireEvent.click(copy);
  await waitFor(() => expect(trackProductEvent).toHaveBeenCalledWith("report_brief_copied", { tool_id: "5-3", locale, source: "report_preview" }));
  expect(writeText.mock.calls[1][0]).toContain("95% CI 80–120");
  expect(writeText.mock.calls[1][0]).toContain("Watch fatigue");
  expect(writeText.mock.calls[1][0]).toContain("Not causal");
});
