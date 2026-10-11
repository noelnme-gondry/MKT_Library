import { expect } from "@playwright/test";

// 홈의 대표 예시는 운영 플래너다. 기존 도치 작업대 회귀는 계속 열려 있는
// /start의 공용 예시 진입을 밟아 확인한다.
export async function openDochiSample(page, locale = "ko") {
  await page.goto(`${locale === "en" ? "/en" : ""}/start?example=1`);
  await expect(page).toHaveURL(/\/dochi-result$/);
  await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
}
