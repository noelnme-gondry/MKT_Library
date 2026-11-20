import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  const prefix = locale === "en" ? "/en" : "";
  test(`${locale} retention definition to cohort comparison to dashboard`, async ({ page }) => {
    await page.goto(`${prefix}/glossary/retention`);
    await page.locator(".content-answer__action a").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/calculator/cohort-retention$`));
    const result = page.locator(".calculator-result");
    await expect(result).toContainText("24.0%");
    await page.getByRole("spinbutton", { name: locale === "en" ? /Recent cohort returners/ : /최근 코호트 복귀자/ }).fill("15");
    await expect(result).toContainText("10.0%");
    await expect(result).toContainText(locale === "en" ? "-10.0 pp" : "-10.0%p");
    await result.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/dashboard(?:[?#].*)?$`));
  });
}
