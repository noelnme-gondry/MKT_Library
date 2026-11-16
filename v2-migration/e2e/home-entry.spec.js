import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";
import { toolIndexByStage } from "../src/lib/toolIndex";
import { filterFinderCards, finderCards } from "../src/lib/finder/analysisFinder";

async function checkHome(page, locale) {
  const hydrationErrors = [];
  page.on("console", message => { if (/hydration|hydrated/i.test(message.text())) hydrationErrors.push(message.text()); });
  const en = locale === "en";
  await page.addInitScript((lang) => {
    localStorage.setItem("mkt-library-dochi-welcome-dismissed", "1");
    if (lang === "en") localStorage.setItem("mkt-library-theme", "light");
  }, locale);
  await page.goto(en ? "/en" : "/");
  await expect(page.locator("#dochi-upload")).not.toBeVisible();
  // 홈: 상황 7개 + 파일 놓기. 상황을 키보드로 골라 분석 찾기로 간다(product-ssot §1.1c).
  const stages = toolIndexByStage(locale);
  const situations = page.locator(".home-entry__situations li:not(.home-entry__all-tile) a");
  await expect(situations).toHaveCount(stages.length);
  await expect(situations.first()).toBeVisible();
  await expect(page.locator(".home-entry__file .csv-uploader")).toHaveCount(1);
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await situations.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${en ? "/en" : ""}/start\\?situation=${stages[1].id}`));
  // 같은 파일 도구는 대표 카드 하나로 묶인다(product-ssot §5.1) — 카드 수는 분석 수가 아니라 그 상황에 보이는 카드 수다.
  await expect(page.locator(".finder-card")).toHaveCount(filterFinderCards(finderCards(locale), { situation: stages[1].id }).length);
  // 분석 찾기: 검색 → 저장 → 다시 와도 저장한 분석이 남는다.
  await page.getByRole("button", { name: en ? /^Show all/ : /^전체 보기/ }).click();
  const search = page.getByRole("searchbox", { name: en ? "Search analyses" : "분석 검색" });
  await search.fill("ROAS");
  await expect(page.locator(".finder-card").first()).toBeVisible();
  const saved = page.locator(".finder-card").first().getByRole("button", { name: en ? /^Save:/ : /^저장:/ });
  await saved.click();
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: en ? /^Saved analyses/ : /^저장한 분석/ }).click();
  await expect(page.locator(".finder-card")).toHaveCount(1);
  await expectNoSeriousAccessibilityViolations(page);
  // 키보드로 카드의 "내 파일로 하기"를 열면 그 도구의 업로더가 준비돼 있다.
  await page.getByRole("button", { name: en ? /^Show all/ : /^전체 보기/ }).click();
  // 묶음 카드는 관련 상황마다 보여 전체 보기에 두 번 나온다 — 첫 번째로 들어간다.
  await page.locator('.finder-card[data-tool-id="5-31"] .finder-card__tool').first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/operations-planner$/);
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator(".dochi-workspace")).toHaveCount(0);
  expect(hydrationErrors).toEqual([]);
}

test("home situations, finder search, saved analyses and keyboard intake", async ({ page }) => checkHome(page, "ko"));
test("@light-en home situations, finder search, saved analyses and keyboard intake", async ({ page }) => checkHome(page, "en"));
