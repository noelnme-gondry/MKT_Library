import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdvancedMarketingAnalysis from "./AdvancedMarketingAnalysis";
import { useAppStore } from "@/store/useDataStore";
import { ADVANCED_TOOLS } from "@/lib/advanced-marketing/registry";
import { buildAdvancedDemo } from "@/lib/advanced-marketing/demo";
import { executeAdvanced } from "@/lib/advanced-marketing/execute";

let workers, paused;
class EngineWorker {
  constructor() { workers.push(this); this.stopped = false; }
  postMessage(job) {
    this.job = job;
    if (paused) return;
    queueMicrotask(() => {
      if (this.stopped) return;
      try { this.onmessage({ data: { report: executeAdvanced(job.toolId, job.rows, job.options) } }); }
      catch (error) { this.onmessage({ data: { error: { code: error.code, context: error.context } } }); }
    });
  }
  terminate() { this.stopped = true; }
}
beforeEach(() => {
  workers = []; paused = false;
  vi.stubGlobal("Worker", EngineWorker);
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function enter(id) {
  useAppStore.getState().setCurrentRouteId(id);
  expect(useAppStore.getState().currentRouteId).toBe(id);
}
async function demo(id, locale = "ko") {
  enter(id);
  const view = render(<AdvancedMarketingAnalysis toolId={id} locale={locale} />);
  expect(workers).toHaveLength(0);
  const buttons = screen.getAllByRole("button").filter(button => /예시|example|sample/i.test(button.textContent));
  expect(buttons.length).toBeGreaterThan(0);
  fireEvent.click(buttons[0]);
  expect(useAppStore.getState().isGroupAnalyzed(id)).toBe(true);
  await waitFor(() => expect(view.container.querySelector('[data-advanced-result="ready"]')).not.toBeNull());
  return view;
}
describe.each(["ko", "en"])("advanced tools actual uploader path (%s)", locale => {
  it.each(ADVANCED_TOOLS)("renders $id result and all tables through route entry and demo", async tool => {
    const view = await demo(tool.id, locale);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name[locale]);
    expect(view.container.querySelectorAll(".advanced-table table").length).toBeGreaterThan(0);
    expect(view.container.querySelector('[data-advanced-result="blocked"]')).toBeNull();
    if (locale === "en") expect(view.container.textContent).not.toMatch(/[가-힣]/);
  });
});
it("invalidates a result on settings changes and rejects a missing design attestation", async () => {
  const view = await demo("5-34");
  fireEvent.click(screen.getByLabelText("배정 단위별 무작위 실험입니다"));
  expect(view.container.querySelector('[data-advanced-result="ready"]')).toBeNull();
  expect(workers.at(-1).stopped).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "설정 적용 후 분석" }));
  await waitFor(() => expect(view.container.querySelector('[data-advanced-result="blocked"]')).not.toBeNull());
  expect(view.container.textContent).toContain("실제 무작위 배정 실험인지 확인");
});
it("resets demo declarations on a real file replacement", async () => {
  const view = await demo("5-34");
  const csv = buildAdvancedDemo("5-34");
  act(() => useAppStore.getState().setCsvData({ ...csv, raw: csv.raw.map(row => ({ ...row })), fileName: "actual.csv", importSource: "csv" }));
  expect(screen.getByLabelText("배정 단위별 무작위 실험입니다").checked).toBe(false);
  expect(view.container.querySelector('[data-advanced-result="ready"]')).toBeNull();
});
it("cancels running workers and ignores a stale completion", async () => {
  paused = true;
  enter("5-34");
  act(() => { useAppStore.getState().setCsvData(buildAdvancedDemo("5-34")); useAppStore.getState().setGroupAnalyzed("5-34"); });
  const view = render(<AdvancedMarketingAnalysis toolId="5-34" />);
  expect(workers).toHaveLength(1);
  const worker = workers[0];
  fireEvent.click(screen.getByRole("button", { name: "계산 취소" }));
  expect(worker.stopped).toBe(true);
  act(() => worker.onmessage({ data: { report: executeAdvanced(worker.job.toolId, worker.job.rows, worker.job.options) } }));
  expect(view.container.querySelector('[data-advanced-result="ready"]')).toBeNull();
  expect(view.container.textContent).toContain("계산을 취소했습니다");
});
