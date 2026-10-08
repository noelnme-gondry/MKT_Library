"use client";
import { useId, useRef } from "react";

export const ALLOCATION_RESULT_VIEWS = [
  { id: "allocation", ko: "배분안", en: "Allocation" },
  { id: "comparison", ko: "예산 비교", en: "Budget comparison" },
  { id: "curves", ko: "곡선", en: "Curves" },
  { id: "checks", ko: "확인", en: "Checks" },
];

export default function AllocationResultWorkspace({ value, onChange, panels, locale = "ko" }) {
  const id = useId();
  const tabs = useRef(null);
  const handleKey = (event, index) => {
    let target;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) target = (index + 1) % ALLOCATION_RESULT_VIEWS.length;
    else if (["ArrowLeft", "ArrowUp"].includes(event.key)) target = (index + ALLOCATION_RESULT_VIEWS.length - 1) % ALLOCATION_RESULT_VIEWS.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = ALLOCATION_RESULT_VIEWS.length - 1;
    if (target == null) return;
    event.preventDefault();
    onChange(ALLOCATION_RESULT_VIEWS[target].id);
    tabs.current.querySelectorAll('[role="tab"]')[target].focus();
  };
  return <section className="allocation-result-workspace" aria-label={locale === "en" ? "Allocation analysis" : "배분 분석"}>
    <div className="allocation-result-tabs" role="tablist" aria-label={locale === "en" ? "Allocation views" : "배분 보기"} ref={tabs}>
      {ALLOCATION_RESULT_VIEWS.map((view, index) => <button type="button" role="tab" id={`${id}-tab-${view.id}`} aria-controls={`${id}-panel-${view.id}`} aria-selected={value === view.id} tabIndex={value === view.id ? 0 : -1} key={view.id} onClick={() => onChange(view.id)} onKeyDown={event => handleKey(event, index)}>{locale === "en" ? view.en : view.ko}</button>)}
    </div>
    {ALLOCATION_RESULT_VIEWS.map(view => <div className="allocation-result-panel" key={view.id} id={`${id}-panel-${view.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${view.id}`} hidden={value !== view.id}>{panels[view.id]}</div>)}
  </section>;
}
