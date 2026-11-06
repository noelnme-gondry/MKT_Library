"use client";
import Link from "next/link";
import { BUDGET_VIEW_TABS, operationsFlowStep, operationsHubHref } from "@/lib/operationsFlow";
import { idToPath } from "@/lib/routeMap";
import { localizedHref } from "@/lib/localizedHref";

/**
 * 상세 도구 제목 위 한 줄: 운영 플래너의 어느 단계를 자세히 보는 화면인지와 돌아갈 길.
 * 예산 상세 설계(5-3)에서는 같은 줄에 두 보기(예산 배분·증액 여력)를 고른다(product-ssot §4.2a·§5.1).
 * 저장·Pro 안내는 여기 두지 않는다 — 조건은 저장 행동 옆(결과의 기록 단계)에 있어야 한다(design.md 반복 지적).
 */
export default function OperationsFlowNav({ toolId, view = "allocation", locale = "ko" }) {
  const step = operationsFlowStep(toolId);
  if (!step) return null;
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const isBudget = toolId === "5-3";
  return <nav className="ops-flow-nav no-print" aria-label={tr("운영 플래너 단계", "Operations planner step")}>
    <p className="ops-flow-nav__trail">
      <Link href={operationsHubHref(locale)}>{tr("운영 플래너", "Operations planner")}</Link>
      <span aria-hidden="true">›</span>
      <span>{tr(`${step.ko} 상세`, `${step.en} detail`)}</span>
    </p>
    {isBudget && <ul className="ops-flow-nav__views" aria-label={tr("예산 상세 설계 보기", "Budget detail views")}>
      {BUDGET_VIEW_TABS.map(tab => <li key={tab.view}>
        <Link href={localizedHref(idToPath(tab.toolId), locale)} aria-current={view === tab.view ? "page" : undefined} scroll={false}>{en ? tab.en : tab.ko}</Link>
      </li>)}
    </ul>}
  </nav>;
}
