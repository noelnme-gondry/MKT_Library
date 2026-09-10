import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`saved setup and editable sample reports (${locale})${en ? " @light-en" : ""}`, async ({ page }) => {
    await page.goto(`${prefix}/projects`);
    await page.getByRole("textbox", { name: en ? "New project name" : "새 프로젝트 이름" }).fill("Weekly test");
    await page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true }).click();
    await expect(page).toHaveURL(/weekly-review/);
    await page.goto(`${prefix}/dashboard`);
    await expect(page.locator('.csv-uploader input[type="file"]').first()).toBeEnabled();
    await page.locator('.csv-uploader input[type="file"]').first().setInputFiles("e2e/fixtures/efficiency.csv");
    const bar = page.locator(".analysis-setup");
    await bar.getByRole("button", { name: en ? "Save analysis setup" : "분석 설정 저장" }).click();
    await bar.getByRole("textbox").fill("Weekly CPA");
    await bar.getByRole("button", { name: en ? "Save" : "저장", exact: true }).click();
    await expect(bar.getByRole("status")).toContainText(en ? "Saved." : "저장했습니다.");
    await bar.getByRole("link").click();
    await expect(page.locator(".saved-analysis-list")).toContainText("Weekly CPA");
    await page.reload();
    await page.getByRole("button", { name: en ? "Keep current period" : "현재 기간으로 불러오기" }).click();
    await expect(page).toHaveURL(/dashboard$/);
    await expect(page.locator(".analysis-setup")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.goto(`${prefix}/subscription`);
    for (const format of ["Word", "Excel"]) {
      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: en ? `Download sample ${format}` : `${format} 샘플 받기` }).click();
      const file = await downloading;
      const bytes = await readFile(await file.path());
      expect(bytes.subarray(0, 2).toString()).toBe("PK");
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });
}
