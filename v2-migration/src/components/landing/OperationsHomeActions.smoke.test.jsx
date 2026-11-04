import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import OperationsHomeActions from "./OperationsHomeActions";
beforeEach(() => useAppStore.setState({ decisionRecords: [] }));
it.each(["ko", "en"])("shows actual saved-action counts and the locale-specific planner entry (%s)", locale => {
  const action = { version: 1, target: { channel: "Meta", campaign: "A" }, kind: "budget", state: "executed", plannedDate: "2020-01-01", executedDate: "2020-01-01", reviewDays: 7 };
  useAppStore.setState({ decisionRecords: [
    { id: "due", operationAction: action, actionTarget: "Campaign A" },
    { id: "plan", operationAction: { ...action, state: "planned" }, actionTarget: "Campaign B" },
    { id: "done", operationAction: action, status: "reviewed" },
    { id: "legacy", action: "Old record" },
  ] });
  render(<OperationsHomeActions locale={locale} />);
  const en = locale === "en";
  expect(screen.getByRole("region").textContent).toContain(en ? "1 reviews due · 1 in progress" : "검토일이 된 액션 1건 · 진행 중 1건");
  expect(screen.getByRole("link").getAttribute("href")).toBe(`${en ? "/en" : ""}/tools/operations-planner`);
  expect(screen.getByText(/Campaign A/)).toBeTruthy();
});
it("does not invent a live count without saved actions", () => {
  const { container } = render(<OperationsHomeActions />);
  expect(container.childElementCount).toBe(0);
});
