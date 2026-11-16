// 운영 플래너(5-31)를 광고 운영의 출발점으로 두고, 같은 광고 성과 파일을 쓰는 도구를 그 단계의 상세로 잇는다
// (product-ssot §5.1 "운영 플래너는 광고 운영의 출발점이다", 2026-11-06 사용자 결정).
// 단계·상세 도구 목록은 여기 한 곳이다 — 플래너의 "자세히 보기" 링크와 상세 도구의 맥락 줄이 같은 표를 읽는다.
import { idToPath } from "@/lib/routeMap";
import { localizedHref } from "@/lib/localizedHref";
import { toolIndexEntry } from "@/lib/toolIndex";

export const OPERATIONS_HUB_ID = "5-31";

export const OPERATIONS_FLOW_STEPS = [
  { id: "changes", ko: "성과 변화", en: "Performance changes", tools: ["5-2", "5-21"] },
  // 5-22(증액 여력)는 5-3의 보기다(product-ssot §4.2a) — 링크는 idToPath가 ?view=headroom으로 푼다.
  { id: "budget", ko: "예산", en: "Budget", tools: ["5-3", "5-22"] },
  { id: "creative", ko: "소재", en: "Creatives", tools: ["9-6"] },
];


/** 상세 도구가 속한 플래너 단계. 상세 도구가 아니면 null. */
export function operationsFlowStep(toolId) {
  return OPERATIONS_FLOW_STEPS.find(step => step.tools.includes(toolId)) || null;
}

// 링크 이름은 목록·화면 제목과 같은 레지스트리 이름이다 — 같은 도구가 링크와 도착한 화면에서 다른 이름이면 안 된다.
export function operationsDetailLabel(toolId, locale = "ko") {
  return toolIndexEntry(toolId, locale)?.name || "";
}

/** 단계의 상세 링크 목록: [{ id, label, href }]. */
export function operationsDetailLinks(stepId, locale = "ko") {
  const step = OPERATIONS_FLOW_STEPS.find(item => item.id === stepId);
  return (step?.tools || []).map(id => ({ id, label: operationsDetailLabel(id, locale), href: localizedHref(idToPath(id), locale) }));
}

export function operationsHubHref(locale = "ko") {
  return localizedHref(idToPath(OPERATIONS_HUB_ID), locale);
}

// 예산 상세 설계(5-3)의 두 보기. 보기 이름은 탭에, 페이지 이름은 목록에 쓴다.
export const BUDGET_VIEW_TABS = [
  { view: "allocation", toolId: "5-3", ko: "예산 배분", en: "Allocation" },
  { view: "headroom", toolId: "5-22", ko: "증액 여력", en: "Headroom" },
];
