import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const buildFail = { value: false };
vi.mock("@/lib/analysis-export/sampleReport", () => ({ buildSampleReport: () => { if (buildFail.value) throw new Error("secret-file.csv failed"); return { title: "x" }; } }));
vi.mock("@/lib/analysis-export/sampleChartImage", () => ({ addSampleChartImage: async () => {} }));
vi.mock("@/lib/analysis-export/analysisDocument", () => ({ createAnalysisDocument: async () => new Blob(["doc"]) }));
vi.mock("@/lib/analysis-export/workbookClient", () => ({ createAnalysisWorkbook: async () => ({}) }));
vi.mock("@/utils/download", () => ({ downloadFile: vi.fn(), downloadXlsx: vi.fn() }));

import SampleReportDownloads from "./SampleReportDownloads";

afterEach(() => { delete window.gtag; buildFail.value = false; });

// 구매 전 샘플 파일을 실제로 받은 사람 수는 Pro 가치 경험의 신호다. 성공과 실패를 나누고,
// 실제 분석 다운로드(result_downloaded)와 다른 이름으로 센다. 오류 원문은 싣지 않는다.
it("records a successful sample download by format only", async () => {
  window.gtag = vi.fn();
  render(<SampleReportDownloads />);
  fireEvent.click(screen.getAllByRole("button")[0]);
  await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "sample_report_downloaded", expect.objectContaining({ placement: "report_preview", locale: "ko" })));
  const params = window.gtag.mock.calls.find(call => call[1] === "sample_report_downloaded")[2];
  expect(["docx", "xlsx"]).toContain(params.download_type);
  expect(window.gtag.mock.calls.some(call => call[1] === "result_downloaded")).toBe(false);
});

it("records a failed sample build without the error text", async () => {
  window.gtag = vi.fn();
  buildFail.value = true;
  render(<SampleReportDownloads locale="en" />);
  fireEvent.click(screen.getAllByRole("button")[0]);
  await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "sample_report_download_failed", expect.objectContaining({ state: "build_failed", locale: "en" })));
  expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("secret-file");
  expect(window.gtag.mock.calls.some(call => call[1] === "sample_report_downloaded")).toBe(false);
});
