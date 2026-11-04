import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import OperationsActionQueue from "./OperationsActionQueue";
const makeItems = (count = 6) => Array.from({ length: count }, (_, index) => {
  const action = { version: 1, kind: index % 3 === 0 ? "creative_replace" : "budget", target: { channel: "Meta", campaign: "A" }, state: "executed", plannedDate: "2026-09-01", executedDate: "2026-09-02", reviewDays: 7, beforeBudget: 100, afterBudget: 120, creative: "Video A" };
  return { record: { id: `record-${index}`, actionTarget: `Campaign ${index}`, operationAction: action, reviewDate: "2026-09-09", status: "pending" }, review: { action, due: "2026-09-09", state: "ready", comparison: null } };
});
const props = { proposals: [], today: "2026-10-01", currency: "KRW", metricName: "CPI", isDemo: false, onNew: vi.fn(), onEdit: vi.fn(), onReview: vi.fn(), onFollowup: vi.fn(), concurrent: () => 0 };
it.each(["ko", "en"])("shows grouped reviews with no singleton pagination and completes only the selected record (%s)", locale => {
  const en = locale === "en", items = makeItems(), onReview = vi.fn();
  const { rerender, container } = render(<OperationsActionQueue {...props} {...{ items, locale, onReview }} />);
  const headings = [...container.querySelectorAll(".operations-queue__group > h3")];
  expect(headings).toHaveLength(2);
  expect(headings[0].parentElement.querySelectorAll(".operations-queue__choice")).toHaveLength(2);
  expect(container.querySelector(".operations-queue__pagination")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Campaign 3/ }));
  fireEvent.click(screen.getByRole("button", { name: en ? "Review before/after" : "전후 검토" }));
  expect(onReview.mock.lastCall[0].record.id).toBe("record-3");
  rerender(<OperationsActionQueue {...props} locale={locale} items={items.map(item => item.record.id === "record-3" ? { ...item, record: { ...item.record, status: "reviewed", learning: "Checked" } } : item)} />);
  expect(container.querySelectorAll(".operations-queue__choice")).toHaveLength(5);
  expect(screen.queryByRole("button", { name: /Campaign 3/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: en ? /^Completed/ : /^완료/ }));
  expect(container.querySelectorAll(".operations-queue__choice")).toHaveLength(1);
  expect(screen.getByText("Checked")).toBeTruthy();
  expect(screen.getByRole("button", { name: en ? "Follow-up" : "후속 액션", exact: true })).toBeTruthy();
});
it("keeps all records reachable across multiple pages and disables review without matching data", () => {
  const items = makeItems(17).map(item => ({ ...item, review: { ...item.review, state: "coverage" } }));
  const { container } = render(<OperationsActionQueue {...props} items={items} locale="ko" />);
  const seen = new Set();
  for (let page = 1; page <= 3; page++) {
    container.querySelectorAll(".operations-queue__choice strong").forEach(node => seen.add(node.textContent));
    expect(screen.getByRole("button", { name: "전후 검토" }).disabled).toBe(true);
    if (page < 3) fireEvent.click(screen.getByRole("button", { name: "다음 액션 목록" }));
  }
  expect(seen.size).toBe(17);
  expect(screen.getByText("전체 17건 중 17번째")).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "액션 진행 상태" })).getByRole("button", { name: /검토할 결과/ }).textContent).toContain("17");
});
