import { analysisCatalogEntry } from "./analysisCatalog";

export const RUN_STATES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  HANDOFF: "handoff",
  COMPLETE: "complete",
  FAILED: "failed",
  CANCELLED: "cancelled",
  STALE: "stale",
});

function confirmationKey(toolId, signature) {
  return `${toolId}:${signature}`;
}

function isAutomaticBaseline(eligibility) {
  return eligibility.status === "ready" && eligibility.runMode === "baseline" && eligibility.executionCost === "light";
}

function normalizeQueueItem(eligibility, signature, automatic) {
  return {
    toolId: eligibility.toolId,
    signature,
    // 확인이 필요한 분석은 이 작업대에서 계산하지 않는다. 현재 입력에 대한
    // 사용자 승인은 남기되, 상세 도구의 설계·모델 화면으로 넘길 때까지 handoff
    // 상태로 둔다. 그래야 승인 자체가 숫자 생성으로 오해되지 않는다.
    state: automatic ? RUN_STATES.QUEUED : RUN_STATES.HANDOFF,
    automatic,
    result: null,
    error: null,
  };
}

// 큐에는 서명으로 묶인 승인만 들어간다. 이 모듈은 adapter import나 실행을 하지
// 않으므로, confirm_model/confirm_design이 승인 전에 무겁게 로드될 경로도 없다.
export function createAnalysisQueue({ inputSignature, mappingSignature, eligibility = [], confirmedAnalysisIds = [] } = {}) {
  const signature = `${inputSignature || ""}:${mappingSignature || ""}`;
  const confirmed = new Set(confirmedAnalysisIds);
  const queue = eligibility
    .filter((item) => {
      if (isAutomaticBaseline(item)) return true;
      const key = confirmationKey(item.toolId, signature);
      return ["confirm_model", "confirm_design", "manual"].includes(item.status) && confirmed.has(key);
    })
    .map((item) => normalizeQueueItem(item, signature, isAutomaticBaseline(item)));
  return Object.freeze({
    signature,
    cancelled: false,
    items: queue,
  });
}

function replaceItem(queue, toolId, transform) {
  return {
    ...queue,
    items: queue.items.map((item) => item.toolId === toolId ? transform(item) : item),
  };
}

export function beginNextAnalysis(queue) {
  if (!queue || queue.cancelled || queue.items.some((item) => item.state === RUN_STATES.RUNNING)) return queue;
  const next = queue.items.find((item) => item.state === RUN_STATES.QUEUED);
  return next ? replaceItem(queue, next.toolId, (item) => ({ ...item, state: RUN_STATES.RUNNING })) : queue;
}

export function settleAnalysis(queue, { toolId, result = null, error = null } = {}) {
  const nextState = error ? RUN_STATES.FAILED : RUN_STATES.COMPLETE;
  return replaceItem(queue, toolId, (item) => item.state === RUN_STATES.RUNNING
    ? { ...item, state: nextState, result: error ? null : result, error: error ? String(error) : null }
    : item);
}

export function cancelPendingAnalyses(queue) {
  return {
    ...queue,
    cancelled: true,
    items: queue.items.map((item) => item.state === RUN_STATES.QUEUED ? { ...item, state: RUN_STATES.CANCELLED } : item),
  };
}

// 매핑 또는 입력이 바뀌면 기존 완료 결과도 현재 데이터의 결과인 척 보이면 안 된다.
export function markQueueStale(queue, { inputSignature, mappingSignature } = {}) {
  const signature = `${inputSignature || ""}:${mappingSignature || ""}`;
  if (!queue || queue.signature === signature) return queue;
  return {
    ...queue,
    signature,
    cancelled: true,
    items: queue.items.map((item) => ({ ...item, state: RUN_STATES.STALE })),
  };
}

export function confirmAnalysis({ queue, toolId, inputSignature, mappingSignature, eligibility } = {}) {
  const signature = `${inputSignature || ""}:${mappingSignature || ""}`;
  const entry = analysisCatalogEntry(toolId);
  if (!entry || !eligibility || queue?.signature !== signature || eligibility.toolId !== toolId) return queue;
  if (!["confirm_model", "confirm_design", "manual"].includes(eligibility.status)) return queue;
  if (queue.items.some((item) => item.toolId === toolId)) return queue;
  return {
    ...queue,
    items: [...queue.items, normalizeQueueItem(eligibility, signature, false)],
  };
}

export function analysisProgress(queue) {
  const approved = queue?.items.length || 0;
  const completed = queue?.items.filter((item) => item.state === RUN_STATES.COMPLETE).length || 0;
  return { approved, completed, pending: approved - completed };
}

export { confirmationKey };
