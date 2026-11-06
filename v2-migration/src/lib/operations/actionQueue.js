import { readOperationAction } from "./actionContract";
import { shiftDate } from "./changeHistory";

export const OPERATION_QUEUE_STATES = [
  { id: "review", ko: "검토할 결과", en: "Review results" },
  { id: "progress", ko: "진행 중", en: "In progress" },
  { id: "done", ko: "완료", en: "Completed" },
];
export function operationQueueState(record, today) {
  const action = readOperationAction(record.operationAction);
  if (!action) return null;
  if (action.state === "cancelled" || record.status === "reviewed") return "done";
  if (action.state === "planned" || !action.executedDate) return "progress";
  return shiftDate(action.executedDate, action.reviewDays) <= today ? "review" : "progress";
}
export function operationTargetKey(target) {
  return JSON.stringify([target.country, target.platform, target.channel, target.source, target.campaignId || target.campaign]);
}
// 제안(아직 기록하지 않은 액션)은 결과 위 예산안·소재 목록이 소유한다. 큐는 기록한 액션만 다룬다 —
// 같은 제안을 두 곳에 두면 단위(기간 합계 vs 하루)까지 갈려 같은 캠페인이 다른 숫자로 보인다.
export function buildOperationQueue(items, today) {
  const records = items.filter(item => item.review.action).map(item => ({ ...item, id: item.record.id,
    action: item.review.action, bucket: operationQueueState(item.record, today), name: item.record.actionTarget,
    due: item.review.due || item.record.reviewDate || "", date: item.record.updatedAt || item.record.createdAt || "" }));
  return records;
}
export function operationQueuePage(queue, { bucket, target = "all", page = 1, pageSize = 8 }) {
  const filtered = queue.filter(item => item.bucket === bucket && (target === "all" || operationTargetKey(item.action.target) === target));
  filtered.sort((a, b) => bucket === "done" ? b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
    : (bucket === "progress" ? Number(a.action.state !== "planned") - Number(b.action.state !== "planned") : 0)
      || a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  const groups = new Map();
  for (const item of filtered) {
    if (!groups.has(item.action.kind)) groups.set(item.action.kind, []);
    groups.get(item.action.kind).push(item);
  }
  const ordered = [...groups.values()].flat(), pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const current = Math.max(1, Math.min(page, pages)), start = (current - 1) * pageSize;
  const visible = ordered.slice(start, start + pageSize), visibleGroups = new Map();
  for (const item of visible) {
    if (!visibleGroups.has(item.action.kind)) visibleGroups.set(item.action.kind, []);
    visibleGroups.get(item.action.kind).push(item);
  }
  return { groups: [...visibleGroups], groupCounts: Object.fromEntries([...groups].map(([kind, entries]) => [kind, entries.length])), visible, page: current, pages, total: ordered.length, start: start + 1, end: start + visible.length };
}
