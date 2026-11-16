import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import OperationsActionQueue from "./OperationsActionQueue";
const makeItems = (count = 6) => Array.from({ length: count }, (_, index) => {
  const action = { version: 1, kind: index % 3 === 0 ? "creative_replace" : "budget", target: { channel: "Meta", campaign: "A" }, state: "executed", plannedDate: "2026-09-01", executedDate: "2026-09-02", reviewDays: 7, beforeBudget: 100, afterBudget: 120, creative: "Video A" };
  return { record: { id: `record-${index}`, actionTarget: `Campaign ${index}`, operationAction: action, reviewDate: "2026-09-09", status: "pending" }, review: { action, due: "2026-09-09", state: "ready", comparison: null } };
});
const props = { today: "2026-10-01", currency: "KRW", metricName: "CPI", isDemo: false, onEdit: vi.fn(), onReview: vi.fn(), onFollowup: vi.fn(), concurrent: () => 0 };
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
it("keeps recorded budget currency when the loaded data uses another currency", () => {
  const item = makeItems(2)[1];
  item.record.operationAction.currency = "KRW";
  item.review.state = "scope";
  const { container } = render(<OperationsActionQueue {...props} currency="USD" items={[item]} locale="ko" />);
  expect(container.querySelector(".operations-queue__choice").textContent).toContain("₩100 → ₩120");
  expect(container.querySelector(".operations-queue__detail").textContent).toContain("₩100 → ₩120");
  expect(screen.getByRole("button", { name: "전후 검토" }).disabled).toBe(true);
});
it("shows a single empty line without proposals and reveals the first saved record without a manual state change", () => {
  const { container, rerender } = render(<OperationsActionQueue {...props} items={[]} locale="ko" />);
  expect(container.querySelector(".operations-queue__states")).toBeNull();
  expect(container.querySelector(".operations-queue__empty").textContent).toContain("아직 기록한 액션이 없습니다");
  const item = makeItems(2)[1];
  item.record.operationAction = item.review.action = { ...item.review.action, state: "planned", executedDate: "" };
  rerender(<OperationsActionQueue {...props} items={[item]} locale="ko" />);
  expect(within(screen.getByRole("group", { name: "액션 진행 상태" })).getByRole("button", { name: /진행 중/ }).getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelectorAll(".operations-queue__choice")).toHaveLength(1);
});
it("shows the saved forecast before execution and expected vs actual once the window is covered", () => {
  const item = makeItems(2)[1];
  const forecast = { days: 7, dailySpend: 120, dailyResults: 10, currentDailySpend: 100, currentDailyResults: 9 };
  item.record.operationAction = item.review.action = { ...item.review.action, beforeBudget: null, afterBudget: 120, currency: "KRW", metric: "installs", state: "planned", executedDate: "", forecast };
  const { container, rerender } = render(<OperationsActionQueue {...props} items={[item]} locale="ko" />);
  expect(container.querySelector(".operations-queue__choice").textContent).toContain("관측 ₩100 → ₩120");
  expect(screen.getByRole("region", { name: "저장한 예상" }).textContent).toContain("₩840");
  expect(screen.getByRole("region", { name: "저장한 예상" }).textContent).toContain("실제 실행일을 기록하면");
  const executed = { ...item, review: { ...item.review, action: { ...item.review.action, state: "executed", executedDate: "2026-09-02" },
    forecastCheck: { ok: true, days: 7, plannedSpend: 840, actualSpend: 840, expectedResults: 70, actualResults: 56, expectedCpr: 12, actualCpr: 15, spendGap: 0, resultsGap: -0.2, cprGap: 0.25 } } };
  executed.record = { ...executed.record, operationAction: executed.review.action };
  rerender(<OperationsActionQueue {...props} items={[executed]} locale="en" />);
  const region = screen.getByRole("region", { name: "Expected vs actual" });
  expect(region.textContent).toContain("+25.0%");
  expect(region.textContent).toContain("−20.0%");
  expect(region.textContent).toContain("Spend matched the plan");
});
