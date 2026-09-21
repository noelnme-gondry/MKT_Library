import { describe, expect, it, vi } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { sanitizeProductEventParams } from "@/lib/analytics";
import { DOWNLOAD_OUTCOMES, downloadFailureReason, runGatedDownload } from "./downloadTelemetry";

const sent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", async (importActual) => ({
  ...(await importActual()),
  trackProductEvent: (...args) => { sent(...args); return true; },
}));
const gate = vi.hoisted(() => vi.fn(() => true));
vi.mock("./paidExport", () => ({ requirePaidExport: (...args) => gate(...args) }));

const names = () => sent.mock.calls.map(([name]) => name);

describe("gated download telemetry", () => {
  it("counts an attempt before the gate, so blocked downloads have a denominator", async () => {
    sent.mockClear(); gate.mockReturnValue(false);
    const run = vi.fn();
    expect(await runGatedDownload({ toolId: "5-2", format: "docx", run })).toBe("blocked");
    expect(run).not.toHaveBeenCalled();
    // 차단은 requirePaidExport가 이미 찍는다 — 여기서 또 찍으면 두 번 세어진다.
    expect(names()).toEqual(["result_download_attempted"]);
  });

  it("counts a success, including a free item", async () => {
    sent.mockClear(); gate.mockReturnValue(true);
    expect(await runGatedDownload({ toolId: "5-2", format: "csv", free: true, run: async () => true })).toBe("succeeded");
    expect(names()).toEqual(["result_download_attempted", "result_downloaded"]);
    // 무료 성공은 예전에 아예 안 세어졌다. state로 갈라 종전 시계열을 복원할 수 있게 한다.
    expect(sent.mock.calls.every(([, params]) => params.state === "free")).toBe(true);
  });

  it("keeps the paid series reproducible by state", async () => {
    sent.mockClear(); gate.mockReturnValue(true);
    await runGatedDownload({ toolId: "5-2", format: "docx", run: async () => true });
    expect(sent).toHaveBeenLastCalledWith("result_downloaded", expect.objectContaining({ state: "paid", tool_id: "5-2", download_type: "docx" }));
  });

  it("treats a false return as declined and does not claim a download", async () => {
    sent.mockClear(); gate.mockReturnValue(true);
    expect(await runGatedDownload({ toolId: "5-2", run: async () => false })).toBe("declined");
    expect(names()).toEqual(["result_download_attempted"]);
  });

  it("counts a failure and rethrows so the screen still shows its message", async () => {
    sent.mockClear(); gate.mockReturnValue(true);
    const boom = new TypeError("bad");
    await expect(runGatedDownload({ toolId: "5-2", run: async () => { throw boom; } })).rejects.toBe(boom);
    expect(names()).toEqual(["result_download_attempted", "result_download_failed"]);
    expect(sent).toHaveBeenLastCalledWith("result_download_failed", expect.objectContaining({ state: "build_failed" }));
  });

  it("sends only categorical reasons, never the error text", () => {
    // 원문 메시지에는 파일명·컬럼명 같은 사용자 데이터가 섞일 수 있다.
    const reason = downloadFailureReason(new Error("failed on 고객_결제.csv"));
    expect(reason).toBe("unknown");
    for (const state of ["free", "paid", "storage_full", "aborted", "too_large", "build_failed", "unknown"]) {
      expect(sanitizeProductEventParams({ state }, "result_download_failed").state, state).toBe(state);
    }
    expect(sanitizeProductEventParams({ state: "고객_결제.csv" }, "result_download_failed").state).toBeUndefined();
  });

  it("names every outcome it can return", () => {
    expect(DOWNLOAD_OUTCOMES).toEqual(["succeeded", "blocked", "declined", "failed"]);
  });

  // 이 검사가 막는 사고: 다운로드를 부르는 화면이 계측 없이 늘어나는 것.
  // 실제로 DownloadHub와 WeeklyReport의 catch가 실패를 한 건도 안 찍고 있었다.
  it("no surface counts result_downloaded by hand any more", () => {
    const files = globSync("src/**/*.{js,jsx}", { cwd: process.cwd() })
      .filter((file) => !/\.test\.|downloadTelemetry|growthFunnel|GrowthFunnelReport/.test(file))
      .map((file) => ({ file, code: readFileSync(file, "utf8") }));
    expect(files.length).toBeGreaterThan(100);
    // 예외는 주석 문구가 아니라 코드 표식 + 사유로만 통과한다(§16).
    const offenders = files
      .filter(({ code }) => /trackProductEvent\w*\(\s*"result_download/.test(code))
      .filter(({ code }) => !code.includes("DOWNLOAD_TELEMETRY_EXEMPT"))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
    // 표식이 실제로 쓰이고 있는지도 단언한다 — 낡은 예외는 예외가 아니다.
    expect(files.some(({ code }) => code.includes("DOWNLOAD_TELEMETRY_EXEMPT"))).toBe(true);
  });
});
