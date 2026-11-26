import { expect } from "@playwright/test";

export async function openLibraryOverview(page) {
  await page.getByRole("button", { name: /^(전체 도구와 가이드 둘러보기|Browse all tools and guides)$/ }).click();
  await expect(page.locator(".home-entry__situations")).toBeVisible();
}

export async function openLegacyPlannerImport(page, en) {
  await page.locator("details.diagnosis-directory > summary").click();
  await page.getByRole("button", { name: en ? "Import a legacy report or Google Sheet" : "기존 형식·Google Sheets에서 불러오기", exact: true }).click();
}
