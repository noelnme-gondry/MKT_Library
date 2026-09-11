import { unzipSync } from "fflate";
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
    await expect(page).toHaveURL(new RegExp(`${prefix}/dashboard$`));
    await expect(page.locator(".analysis-setup")).toBeVisible();
    await page.getByRole("button", { name: en ? "Compare current CSV" : "현재 CSV와 비교" }).click();
    await page.getByRole("button", { name: en ? "Apply checked setup" : "확인한 설정 적용" }).click();
    await expect(page.locator(".saved-setup-review")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.goto(`${prefix}/subscription`);
    for (const format of ["Word", "Excel"]) {
      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: en ? `Download sample ${format}` : `${format} 샘플 받기` }).click();
      const file = await downloading;
      const bytes = await readFile(await file.path());
      expect(bytes.subarray(0, 2).toString()).toBe("PK");
      expect(bytes.length).toBeGreaterThan(1000);
      const files = Object.keys(unzipSync(bytes));
      expect(files.some(name => format === "Word" ? name.startsWith("word/media/") && name.endsWith(".png") : name.startsWith("xl/charts/chart") && name.endsWith(".xml"))).toBe(true);
    }
  });
}
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`restores model thresholds without a CSV (${locale})${en ? " @light-en" : ""}`, async ({ page }) => {
    await page.goto(`${prefix}/projects`);
    await page.getByRole("textbox", { name: en ? "New project name" : "새 프로젝트 이름" }).fill("Threshold project");
    await page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true }).click();
    await expect(page).toHaveURL(/weekly-review/);
    await page.goto(`${prefix}/tools/asa-keyword-finder`);
    const target = page.getByRole("textbox", { name: en ? "Target CPA" : "목표 CPA", exact: true });
    await expect(target).toBeEnabled();
    const bar = page.locator(".analysis-setup");
    await expect(bar.getByRole("button", { name: en ? "Save analysis setup" : "분석 설정 저장" })).toBeEnabled();
    await target.fill("7250");
    await bar.getByRole("button", { name: en ? "Save analysis setup" : "분석 설정 저장" }).click();
    await bar.getByRole("textbox").fill("CPA 7250");
    await bar.getByRole("button", { name: en ? "Save" : "저장", exact: true }).click();
    await expect(bar.getByRole("status")).toContainText(en ? "Saved." : "저장했습니다.");
    await target.fill("9999");
    await bar.getByRole("link").click();
    await page.getByRole("button", { name: en ? "Keep current period" : "현재 기간으로 불러오기" }).click();
    await page.getByRole("button", { name: en ? "Compare current CSV" : "현재 CSV와 비교" }).click();
    await page.getByRole("button", { name: en ? "Apply checked setup" : "확인한 설정 적용" }).click();
    await expect(page.getByRole("textbox", { name: en ? "Target CPA" : "목표 CPA", exact: true })).toHaveValue("7250");
    await page.goto(`${prefix}/subscription`);
    await page.locator(".checkout-existing > summary").click();
    await expect(page.locator(".pass-recovery-help")).toBeVisible();
    await expect(page.getByRole("link", { name: en ? "Request purchase verification" : "구매 확인·복원 요청" })).toHaveAttribute("href", /^mailto:/);
  });
}
