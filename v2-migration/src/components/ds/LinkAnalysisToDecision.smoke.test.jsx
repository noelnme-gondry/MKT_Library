// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import LinkAnalysisToDecision from "./LinkAnalysisToDecision";
vi.mock("@/components/ReviewSaveDialog", () => ({ default: ({ onConfirm, onClose }) => <button onClick={async () => { await onConfirm(); onClose(); }}>Confirm save</button> }));
beforeEach(() => useAppStore.setState({ ...useAppStore.getInitialState(), decisionRecords: [{ id: "a", action: "Holdout", metric: "Organic users", dataOrigin: "real" }, { id: "b", action: "Other", metric: "CTR", dataOrigin: "real" }] }));
afterEach(cleanup);
it.each(["ko", "en"])("links a snapshot directly without creating a decision (%s)", async locale => {
  const commit = vi.fn(async () => true);
  useAppStore.setState({ commitDecisionRecord: commit });
  const en = locale === "en";
  render(<LinkAnalysisToDecision locale={locale} toolId="5-23" metric="Organic users" evidence={{ headline: "Recovery +300", stats: [{ label: "95% CI", value: "+100 to +500" }], scope: {} }} />);
  fireEvent.click(screen.getByText(en ? "Link this result to an existing decision" : "이 결과를 기존 결정에 연결"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
  const save = screen.getByRole("button", { name: en ? "Save linked result" : "연결한 결과 저장" });
  expect(save.disabled).toBe(true);
  expect(screen.getAllByText(/미확인|Unverified/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(save);
  fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
  await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
  expect(commit.mock.calls[0][0]).toBe("a");
  expect(JSON.parse(commit.mock.calls[0][1].effectEvidence).stats[0].value).toBe("+100 to +500");
  expect(useAppStore.getState().decisionRecords).toHaveLength(2);
  expect(screen.getByRole("link").getAttribute("href")).toBe(`${en ? "/en" : ""}/weekly-review#decision-a`);
});
it("requires conditions to be checked again when the displayed analysis changes", () => {
  const props = { toolId: "5-23", metric: "Organic users", evidence: { headline: "Recovery +300", scope: { metric: "Organic users" } } };
  const view = render(<LinkAnalysisToDecision {...props} />);
  fireEvent.click(screen.getByText("이 결과를 기존 결정에 연결"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "연결한 결과 저장" }).disabled).toBe(false);
  view.rerender(<LinkAnalysisToDecision {...props} evidence={{ headline: "Recovery -100", scope: { metric: "Organic users", channel: "Different population" } }} />);
  expect(screen.getByRole("checkbox").checked).toBe(false);
  expect(screen.getByRole("button", { name: "연결한 결과 저장" }).disabled).toBe(true);
});
