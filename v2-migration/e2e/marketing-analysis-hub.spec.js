import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { measureDesignRules } from "./support/designRules";

for (const locale of ["ko", "en"]) {
  test(`marketing analysis connects channel evidence and the next action (${locale})`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "tablet-768") await page.setViewportSize({ width: 980, height: 1000 });
    const en = locale === "en", prefix = en ? "/en" : "";
    await page.goto(`${prefix}/compare`);
    await page.getByRole("link", { name: en ? "Explore the examples" : "예시로 분석해 보기", exact: true }).click();
    await expect(page.locator("#analysis-examples")).toBeInViewport();
    const questions = page.getByRole("group", { name: en ? "Choose your question" : "확인할 질문 선택" }).getByRole("button");
    const finding = page.locator(".analysis-preview__channel");
    await expect(finding).toContainText("Meta AAP");
    await page.getByRole("button", { name: en ? "Inspect TikTok" : "TikTok 확인", exact: true }).click();
    await expect(finding).toContainText("TikTok");
    await expect(finding).toContainText("-4");
    await questions.nth(2).click();
    await expect(finding).toContainText("Apple Search Ads");
    await page.getByRole("button", { name: en ? "Inspect Google UAC" : "Google UAC 확인", exact: true }).click();
    await expect(finding).toContainText("Google UAC");
    await expect(page.locator(".analysis-preview__finding > strong")).toContainText("1.50");
    await questions.nth(1).click();
    const inputs = page.getByRole("spinbutton");
    await inputs.nth(0).fill("200");
    await inputs.nth(1).fill("500");
    await expect(page.getByText("250% · 2.50×", { exact: true })).toBeVisible();
    await inputs.nth(0).fill("");
    await expect(page.getByText("250% · 2.50×", { exact: true })).toHaveCount(0);
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      // Theme transitions interpolate colors; contrast belongs to the settled theme.
      await page.evaluate(() => Promise.all(document.getAnimations()
        .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map(animation => animation.finished.catch(() => {}))));
      for (let index = 0; index < 3; index++) {
        await questions.nth(index).click();
        await expect(questions.nth(index)).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".analysis-preview__actions .btn")).toHaveAttribute("href", `${prefix}${["/tools/campaign-variance", "/tools/budget-allocation", "/tools/budget-allocation"][index]}`);
        const design = await measureDesignRules(page);
        expect(design.overlaps).toEqual([]);
        expect(design.hugging).toEqual([]);
        expect(design.smallHeadings).toEqual([]);
        expect(design.nested).toEqual([]);
        expect(design.horizontalOverflow).toBeLessThanOrEqual(1);
        const audit = await new AxeBuilder({ page }).include(".marketing-analysis-hub").withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(audit.violations).toEqual([]);
        if (index === 0 && ((locale === "ko" && light && testInfo.project.name === "desktop-1440")
          || (locale === "ko" && !light && testInfo.project.name === "mobile-320")
          || (en && light && testInfo.project.name === "tablet-768"))) {
          await page.evaluate(() => { scrollTo(0, 0); document.activeElement.blur(); });
          const article = await page.locator(".marketing-analysis-hub").boundingBox();
          const preview = await page.locator(".analysis-preview").boundingBox();
          await page.screenshot({ path: testInfo.outputPath("analysis-hub-preview.png"), fullPage: true, clip: { x: article.x, y: article.y, width: article.width, height: preview.y + preview.height - article.y } });
        }
      }
    }
    await questions.first().click();
    await page.locator(".analysis-preview__actions .btn").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/campaign-variance$`));
  });
}
