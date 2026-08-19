"use client";

import { useEffect } from "react";

let labelSequence = 0;

// P1-15의 남은 legacy `.ab-pillgroup` 46곳을 위한 호환 어댑터.
// 각 도구의 조건부 버튼·상태 계산은 그대로 두고, 선택형 pill 집합에만 표준
// radiogroup/roving-tabindex 계약을 부여한다. 새 화면은 PillGroup을 직접 쓴다.
function optionButtons(group) {
  return [...group.querySelectorAll("button.ab-pill:not([disabled])")]
    .filter((button) => button.closest(".ab-pillgroup") === group);
}

function syncGroup(group) {
  // 다중선택 그룹에 radiogroup을 씌우면 "여럿 켜져 있는데 하나만 선택됨"으로 읽힌다 —
  // ARIA가 없는 것보다 나쁘다. DOM만으로는 단일/다중을 가를 수 없으므로(한 개만 켜진
  // 순간의 다중선택 그룹은 단일과 구분되지 않는다) 마크업이 말하게 한다.
  // (2026-08-19: LtvTab의 성숙 기준일·표시 방법 두 그룹이 실제로 잘못 표기되고 있었다.)
  if (group.dataset.pillgroup === "multi") {
    for (const button of optionButtons(group)) {
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    }
    return;
  }
  const buttons = optionButtons(group);
  if (buttons.length < 2) return;
  const label = group.querySelector(":scope > .ab-pillgroup-label");
  if (label && !label.id) {
    labelSequence += 1;
    label.id = `pillgroup-label-${labelSequence}`;
  }
  group.setAttribute("role", "radiogroup");
  if (label) group.setAttribute("aria-labelledby", label.id);
  else if (!group.hasAttribute("aria-label")) group.setAttribute("aria-label", "Option group");

  const active = buttons.findIndex((button) => button.classList.contains("active") || button.getAttribute("aria-pressed") === "true");
  const tabStop = active >= 0 ? active : 0;
  buttons.forEach((button, index) => {
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(index === tabStop));
    button.tabIndex = index === tabStop ? 0 : -1;
  });
}

function onKeyDown(event) {
  const button = event.target.closest("button[role='radio']");
  const group = button?.closest(".ab-pillgroup[role='radiogroup']");
  if (!button || !group) return;
  const buttons = optionButtons(group);
  const index = buttons.indexOf(button);
  if (index < 0) return;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = buttons.length - 1;
  if (next == null) return;
  event.preventDefault();
  buttons[next].focus();
  buttons[next].click();
  buttons.forEach((item, itemIndex) => {
    item.setAttribute("aria-checked", String(itemIndex === next));
    item.tabIndex = itemIndex === next ? 0 : -1;
  });
}

export default function LegacyPillGroupA11y() {
  useEffect(() => {
    const syncAll = () => document.querySelectorAll(".ab-pillgroup").forEach(syncGroup);
    syncAll();
    document.addEventListener("keydown", onKeyDown);
    const observer = new MutationObserver(syncAll);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "disabled", "aria-pressed"] });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
    };
  }, []);

  return null;
}
