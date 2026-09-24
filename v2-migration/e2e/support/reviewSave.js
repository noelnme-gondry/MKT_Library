import { expect } from "@playwright/test";

export async function enableReviewLogin(page, { trial = true } = {}) {
  await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "review-test", email: "review@example.com" }, entitlement: { plan: "paid", account: true, trial, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } } }));
  await page.route("**/api/account/memos", route => route.fulfill({ json: { memos: [] } }));
}

export async function confirmReviewDialog(page, en = false) {
  const dialog = page.getByRole("dialog", { name: en ? /^(Make it my next marketing project|Save to My projects)$/ : /^(다음 마케팅 프로젝트로 만들기|내 프로젝트에 저장)$/ });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름", exact: true });
  if (await name.count()) await name.fill("Review project");
  await dialog.getByRole("button", { name: en ? /^(Create project and save|Save to My projects)$/ : /^(프로젝트 만들고 저장|내 프로젝트에 저장)$/ }).click();
  await expect.poll(async () => !await dialog.count() || await dialog.getByRole("heading", { name: en ? "Saved to My projects" : "내 프로젝트에 저장했습니다" }).count() > 0).toBe(true);
  if (await dialog.count()) await dialog.getByRole("button", { name: en ? "Done" : "닫기", exact: true }).click();
}
