// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DecisionFollowUp from "./DecisionFollowUp";
import DecisionEvidence from "./DecisionEvidence";
import ProjectReviewPortfolio from "./ProjectReviewPortfolio";
import { useAppStore } from "@/store/useDataStore";
import { serializeReviewEvidence } from "@/lib/reviewEvidence";
import { PROJECT_REVIEW_TOOL_EVENT } from "@/lib/decisionReviewUi";

const record = { id: "parent", toolId: "5-3", action: "Reduce budget", actual: "CPA 120", learning: "Check fatigue before scaling", reviewDate: "2020-01-01", baseline: "100", comparisonScope: "old scope", evidence: serializeReviewEvidence({ headline: "CPA increased", stats: [{ label: "CPA", value: "100", detail: "95% CI 80–120" }] }) };
beforeEach(() => useAppStore.setState({ decisionRecords: [record], csvData: { importSource: "upload" }, projects: [{ id: "default", name: "Acme" }], activeProjectId: "default" }));
it.each(["ko", "en"])("%s preserves evidence and creates a linked decision without reusing stale scoring inputs", locale => {
  const en = locale === "en";
  const view = render(<><DecisionEvidence record={record} locale={locale} /><DecisionFollowUp record={record} locale={locale} /></>);
  expect(view.container.textContent).toContain("95% CI 80–120");
  fireEvent.click(screen.getByRole("button", { name: en ? "Turn this learning into the next decision" : "배운 점으로 다음 결정 만들기" }));
  fireEvent.change(screen.getByLabelText(en ? "Next action" : "다음에 실행할 행동"), { target: { value: "Test a new creative" } });
  fireEvent.click(screen.getByRole("button", { name: en ? "Save next decision" : "다음 결정 저장" }));
  expect(useAppStore.getState().decisionRecords).toHaveLength(1);
  confirmReviewSave();
  const records = useAppStore.getState().decisionRecords;
  expect(records).toHaveLength(2);
  const child = records.find(item => item.id !== "parent");
  expect(child.parentDecisionId).toBe("parent");
  expect(child.hypothesis).toBe(record.learning);
  expect(child.baseline).toBe("");
  expect(child.comparisonScope).toBe("");
  expect(child.evidence).toBe("");
  expect(records.find(item => item.id === "parent")).toEqual(record);
});
it("derives tool agendas from actual records and routes the selection", () => {
  useAppStore.setState({ decisionRecords: [record, { id: "experiment", toolId: "5-4", action: "Rerun experiment", reviewDate: "2020-01-01" }] });
  const selected = vi.fn(); window.addEventListener(PROJECT_REVIEW_TOOL_EVENT, selected);
  const view = render(<ProjectReviewPortfolio />);
  expect(view.container.querySelectorAll("article")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("link", { name: "이 도구의 결정 검토" })[0]);
  expect(selected).toHaveBeenCalledOnce();
  expect(["5-3", "5-4"]).toContain(selected.mock.calls[0][0].detail.toolId);
  window.removeEventListener(PROJECT_REVIEW_TOOL_EVENT, selected);
});
