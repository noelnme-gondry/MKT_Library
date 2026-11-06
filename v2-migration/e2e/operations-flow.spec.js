import { expect, test } from "@playwright/test";
import { toolIndexEntry } from "../src/lib/toolIndex";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

// 운영 플래너가 출발점이고, 같은 광고 성과 파일을 쓰는 도구는 그 단계의 상세다(product-ssot §5.1).
// 증액 여력(5-22)은 예산 상세 설계(5-3)의 보기로 흡수됐다(§4.2a) — 옛 주소는 그 보기로 영구 이동한다.
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";

  test(`old headroom address opens the budget detail headroom view and switches views (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/tools/campaign-saturation`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/budget-allocation\\?view=headroom$`));
    const nav = page.getByRole("navigation", { name: en ? "Operations planner step" : "운영 플래너 단계" });
    await expect(nav.getByRole("link", { name: en ? "Headroom" : "증액 여력" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("h1")).toHaveText(toolIndexEntry("5-22", locale).name);
    await expect(nav.getByRole("link", { name: en ? "Operations planner" : "운영 플래너" })).toHaveAttribute("href", `${prefix}/tools/operations-planner`);
    await nav.getByRole("link", { name: en ? "Allocation" : "예산 배분" }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/budget-allocation$`));
    await expect(page.locator("h1")).toHaveText(toolIndexEntry("5-3", locale).name);
    await expect(nav.getByRole("link", { name: en ? "Allocation" : "예산 배분" })).toHaveAttribute("aria-current", "page");
    await expectNoSeriousAccessibilityViolations(page);
  });

  test(`planner steps link to their detail tools with the same data (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/tools/operations-planner?example=1`);
    await expect(page.locator("#ops-plan-title")).toBeVisible();
    const budget = page.locator(".ops-plan .ops-detail-links");
    // 링크 이름은 도착한 화면의 제목과 같은 레지스트리 이름이다.
    await expect(budget.getByRole("link")).toHaveText([`${toolIndexEntry("5-3", locale).name} →`, `${toolIndexEntry("5-22", locale).name} →`]);
    await page.locator(".ops-evidence .ops-detail-links").getByRole("link", { name: new RegExp(toolIndexEntry("5-21", locale).name) }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/campaign-variance$`));
    // 같은 효율 파일이라 다시 올리지 않고 결과가 열린다.
    await expect(page.locator(".result-action-card__headline").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: en ? "Operations planner step" : "운영 플래너 단계" })).toContainText(en ? "Performance changes detail" : "성과 변화 상세");
  });
}
