import { fireEvent, within } from "@testing-library/react";

// 설계·비교 조건(ds/DeclaredConditions)은 결과 위에 한 줄로 접혀 있고 질문은 창 안에 있다.
// 테스트는 사용자처럼 창을 열고 답한 뒤 닫는다 — 창이 열린 동안 뒤 화면은 보조기술에서 가려진다.
export function openDeclared() {
  const button = document.querySelector(".declared-conditions__open");
  if (!button) throw new Error("No declared-conditions line on screen");
  fireEvent.click(button);
  const dialog = document.querySelector(".declared-conditions-dialog");
  if (!dialog) throw new Error("Declared-conditions dialog did not open");
  return dialog;
}

export function closeDeclared() {
  const dialog = document.querySelector(".declared-conditions-dialog");
  if (!dialog) return;
  fireEvent.click(within(dialog).getByRole("button", { name: /^(닫기|Close)$/ }));
}

export function withDeclared(run) {
  openDeclared();
  try { return run(); } finally { closeDeclared(); }
}
