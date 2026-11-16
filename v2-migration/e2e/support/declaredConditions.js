import { expect } from "@playwright/test";

// 사용자가 답하는 조건(ds/DeclaredConditions)은 결과 위 한 줄 + 창이다. 창은 모달이라 열린 동안
// 뒤 화면이 가려진다 — 창 안에서 답하고 닫은 뒤 결과를 본다.
export async function openDeclaredConditions(page, name) {
  await page.getByRole("region", { name }).locator(".declared-conditions__open").click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function closeDeclaredConditions(dialog, en) {
  await dialog.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

export async function withDeclaredConditions(page, name, en, run) {
  const dialog = await openDeclaredConditions(page, name);
  try { return await run(dialog); } finally { await closeDeclaredConditions(dialog, en); }
}
