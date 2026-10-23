import { act, fireEvent } from "@testing-library/react";

// 결과 화면의 "자세히 보기"(ds/ResultReport ResultDetails)는 기본 닫힘이다.
// 근거 구역을 다루는 스모크는 사람이 하듯 버튼을 눌러 연다 — 열린 상태를 셋업으로 주입하지 않는다(§7 진입 경로).
export function openResultDetails(root = document) {
  const toggles = [...root.querySelectorAll("[data-result-details-toggle]")].filter((button) => button.getAttribute("aria-expanded") !== "true");
  for (const button of toggles) act(() => { fireEvent.click(button); });
  return toggles.length;
}
