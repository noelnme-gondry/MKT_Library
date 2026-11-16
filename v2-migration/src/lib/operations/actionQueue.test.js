import { expect, it } from "vitest";
import { buildOperationQueue, operationQueuePage, operationQueueState } from "./actionQueue";
const target = { unit: "campaign", channel: "Meta", campaign: "A" };
const action = { version: 1, kind: "budget", target, state: "executed", plannedDate: "2026-09-01", executedDate: "2026-09-02", reviewDays: 7 };
it("queues due records even when observations are missing, and separates planned, reviewed and legacy records", () => {
  expect(operationQueueState({ operationAction: action }, "2026-09-09")).toBe("review");
  expect(operationQueueState({ operationAction: action }, "2026-09-08")).toBe("progress");
  expect(operationQueueState({ operationAction: { ...action, state: "planned" } }, "2026-10-01")).toBe("progress");
  expect(operationQueueState({ operationAction: action, status: "reviewed" }, "2026-10-01")).toBe("done");
  expect(operationQueueState({}, "2026-10-01")).toBeNull();
});
it("groups interleaved action kinds, paginates without losing records and clamps the page after review", () => {
  const items = Array.from({ length: 17 }, (_, index) => { const record = { id: `record-${index}`, operationAction: { ...action, kind: index % 2 ? "creative_replace" : "budget" }, reviewDate: "2026-09-09" }; return { record, review: { action: record.operationAction, state: "coverage" } }; });
  const queue = buildOperationQueue(items, "2026-10-01");
  const pages = [1, 2, 3].map(page => operationQueuePage(queue, { bucket: "review", page }));
  expect(pages.map(page => page.visible.length)).toEqual([8, 8, 1]);
  expect(new Set(pages.flatMap(page => page.visible.map(item => item.id))).size).toBe(17);
  expect(pages[0].groups.map(([kind]) => kind)).toEqual(["budget"]);
  expect(operationQueuePage(queue.slice(0, 3), { bucket: "review", page: 3 })).toMatchObject({ pages: 1, page: 1, total: 3 });
});
