import { expect } from "@playwright/test";

export async function openLibraryOverview(page) {
  await page.getByRole("button", { name: /^(전체 도구와 가이드 둘러보기|Browse all tools and guides)$/ }).click();
  await expect(page.locator(".home-entry__situations")).toBeVisible();
}
