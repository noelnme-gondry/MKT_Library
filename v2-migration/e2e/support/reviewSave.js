import { expect } from "@playwright/test";

export async function enableReviewLogin(page) {
  await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "review-test", email: "review@example.com" }, entitlement: null } }));
  await page.route("**/api/account/memos", route => route.fulfill({ json: { memos: [] } }));
}

export async function confirmReviewDialog(page, en = false) {
  const dialog = page.getByRole("dialog", { name: en ? "Save review" : "리뷰 저장", exact: true });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름", exact: true });
  if (await name.count()) await name.fill("Review project");
  await dialog.getByRole("button", { name: en ? /^(Create project and save|Save review)$/ : /^(프로젝트 만들고 저장|리뷰 저장)$/ }).click();
  await expect.poll(async () => !await dialog.count() || await dialog.getByRole("heading", { name: en ? "Review saved" : "리뷰를 저장했습니다" }).count() > 0).toBe(true);
  if (await dialog.count()) await dialog.getByRole("button", { name: en ? "Done" : "닫기", exact: true }).click();
}
