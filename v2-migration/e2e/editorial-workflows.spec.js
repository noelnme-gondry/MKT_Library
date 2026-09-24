import { expect, test } from "@playwright/test";
import { idToSlug } from "../src/lib/routeMap";
import { BLOG_INSIGHT_PLACEMENTS } from "../src/lib/blogInsightRegistry";

const articles = ["weekly-marketing-report-template", "cac-payback-period", "marketing-report-sheets-bigquery", "ga4-data-traps", "ltv-cac-ratio", "cpi-cpa-cpm-difference", "cannibalization-organic-paid"];
const localOnly = route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort();

for (const locale of ["ko", "en"]) {
  const prefix = locale === "en" ? "/en" : "";
  for (const theme of ["light", "dark"]) {
    test(`editorial workflows render readable resources (${locale}/${theme})`, async ({ page, request }) => {
      await page.addInitScript(value => localStorage.setItem("mkt-library-theme", value), theme);
      await page.route("**/*", localOnly);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      for (const slug of articles) {
        const response = await page.goto(`${prefix}/blog/${slug}`);
        expect(response.status()).toBe(200);
        await expect(page.locator("main h1")).toBeVisible();
        await page.evaluate(async () => { await document.fonts.ready; });
        expect(await page.locator("body").evaluate(node => node.classList.contains("light-mode"))).toBe(theme === "light");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), slug).toBe(true);
        const table = page.locator(".blog-prose .table-scroll").first();
        await table.focus();
        await expect(table).toBeFocused();
        for (const image of await page.locator(".blog-prose img").all()) {
          await expect(image).toHaveAttribute("alt", /\S/);
          await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        }
        const downloads = await page.locator('.blog-prose a[href^="/examples/"]').evaluateAll(links => links.map(link => link.getAttribute("href")));
        for (const href of new Set(downloads)) {
          const file = await request.get(href);
          expect(file.ok(), href).toBe(true);
          expect((await file.body()).subarray(0, 3).toString("hex")).toBe("efbbbf");
        }
      }
      expect(errors).toEqual([]);
    });
  }
  for (const slug of ["weekly-marketing-report-template", "marketing-report-sheets-bigquery"]) {
    test(`exact weekly demo opens from the article (${locale}/${slug})`, async ({ page }) => {
      await page.route("**/*", localOnly);
      await page.goto(`${prefix}/blog/${slug}`);
      const panel = page.locator("#blog-practice");
      await panel.getByRole("button", { name: locale === "en" ? "Open the full example result" : "예시 결과 전체 보기", exact: true }).click();
      await expect(page).toHaveURL(`${prefix}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const followup = slug === "weekly-marketing-report-template";
      await expect(page.locator(`[title="${followup ? "weekly-report-three-weeks.csv" : "weekly-report-campaigns.csv"}"]`)).toBeAttached();
      // 현재 입력은 본문 맨 위(§5.2 읽기 순서 1번), 설정 보관은 결과 뒤다.
      // 두 자리가 각각 제 역할을 갖는지 함께 확인한다 — 한쪽으로 몰리면
      // "아래 입력을 확인한 뒤" 문구가 거짓이 되거나 프로젝트 동선이 끊긴다.
      await expect(page.getByRole("region", { name: locale === "en" ? "Data and applied setup" : "데이터와 적용된 설정", exact: true })).toContainText(`${followup ? 42 : 28} ${locale === "en" ? "source rows" : "원본 행"}`);
      const keepSetup = page.getByRole("region", { name: locale === "en" ? "Keep this setup" : "이 설정 보관하기", exact: true });
      await expect(keepSetup.getByRole("button", { name: locale === "en" ? "Save this setup to the project" : "이 설정을 프로젝트에 저장", exact: true })).toBeVisible();
      await expect(keepSetup.getByRole("link", { name: locale === "en" ? "Open saved setups" : "저장한 설정 보관함", exact: true })).toBeVisible();
      if (slug === "weekly-marketing-report-template") {
        await expect(page.getByRole("heading", { level: 2, name: /CPI.*1,200.*1,091/ })).toBeVisible();
        const campaigns = page.getByRole("table", { name: locale === "en" ? "By Channel · Campaign table" : "채널·캠페인별 결과 데이터 표", exact: true });
        await expect(campaigns.getByRole("row").filter({ has: page.getByRole("cell", { name: "A", exact: true }) })).toContainText(/1,500.*1,200/);
        await expect(campaigns.getByRole("row").filter({ has: page.getByRole("cell", { name: "B", exact: true }) })).toContainText(/1,000.*1,000/);
      } else {
        const preview = page.getByRole("table", { name: locale === "en" ? "🔎 Data preview" : "🔎 데이터 미리보기", exact: true });
        await expect(preview).toContainText("2026-08-31");
        await expect(preview).toContainText("50000");
        await expect(page.getByRole("button", { name: locale === "en" ? "Analyze data" : "데이터 분석하기", exact: true })).toBeEnabled();
      }
    });
  }
  test(`payback article reaches the separate LTV demo (${locale})`, async ({ page }) => {
    await page.route("**/*", localOnly);
    await page.goto(`${prefix}/blog/cac-payback-period`);
    await page.locator("#blog-practice").getByRole("button", { name: locale === "en" ? "Open the full example result" : "예시 결과 전체 보기", exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/dashboard`);
    // 블로그에서 온 방문은 데모 모달 대신 출처 한 줄(시안 E)을 본다.
    await expect(page.locator(".blog-arrival")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: locale === "en" ? "Analyze data" : "데이터 분석하기", exact: true }).click();
    await page.getByRole("tab", { name: "LTV & ROAS", exact: true }).click();
    await expect(page.getByRole("tab", { name: "LTV & ROAS", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText(/LTV/);
    await expect(page.getByRole("tabpanel")).toContainText(locale === "en" ? "A ratio of 3× alone does not justify scaling." : "3× 이상이라는 이유만으로 증액을 결정할 수는 없습니다.");
  });
}
