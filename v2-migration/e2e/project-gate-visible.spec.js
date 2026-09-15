import { test, expect } from "@playwright/test";

// 배포된 화면에서 "버튼을 눌러도 아무 일도 안 일어난다"는 제보가 있었다.
// 모달이 DOM에 있느냐가 아니라 **실제로 화면에 보이느냐**를 재야 한다.
for (const locale of ["ko", "en"]) {
  test(`project gate is actually visible on screen (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: null, entitlement: null } }));
    await page.goto(`${en ? "/en" : ""}/weekly-review`);
    const create = page.getByRole("button", { name: en ? "Create a project" : "새 프로젝트 만들기", exact: true });
    await expect(async () => {
      await create.click();
      await expect(page.getByRole("heading", { name: en ? "Projects are a Pro feature" : "프로젝트는 Pro 기능입니다" })).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20000 });

    // 화면 안에 있고, 자기 상자를 가지며, 오버레이가 뷰포트를 덮는다.
    const panel = page.locator(".project-gate");
    const box = await panel.boundingBox();
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeGreaterThan(100);
    const viewport = page.viewportSize();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    const overlayFixed = await page.locator(".review-save-overlay").evaluate(node => getComputedStyle(node).position);
    expect(overlayFixed).toBe("fixed");
    await expect(page.getByRole("button", { name: en ? "Cancel" : "취소", exact: true })).toBeVisible();
  });
}
