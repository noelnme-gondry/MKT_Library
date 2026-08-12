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
