import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

function campaignCsv(start, days) {
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7, start + index)).toISOString().slice(0, 10);
    return `${date},Review Campaign,Google,${date < "2026-08-31" ? 1000 : 1500},100,1000,10000`;
  });
  return Buffer.from(`Date,Campaign,Channel,Cost,Actions,Clicks,Impressions\r\n${rows.join("\r\n")}`);
}

async function runJourney(page, locale) {
  await page.addInitScript(() => {
    window.__weeklyEvents = [];
    window.dataLayer = [];
    const push = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = (...items) => {
      for (const item of items) if (item?.[0] === "event") window.__weeklyEvents.push(Array.from(item));
      return push(...items);
    };
  });
  const pageErrors = [];
  const exposedRows = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && `${request.url()} ${request.postData() || ""}`.includes("Review Campaign")) exposedRows.push(request.url());
  });
  const en = locale === "en";
  const url = `${en ? "/en" : ""}/weekly-review`;
  await page.goto(`${en ? "/en" : ""}/blog/ad-performance-diagnosis`);
  const articleLink = page.locator(`.blog-prose a[href="${url}"]`).first();
  await articleLink.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.__weeklyEvents.some(event => event[1] === "blog_cta_viewed" && event[2].tool_id === "weekly-review" && event[2].placement === "article_body"))).toBe(true);
  await articleLink.click();
  await expect(page).toHaveURL(new RegExp(`${url}$`));
  const upload = async (buffer) => {
    const details = page.locator("details").filter({ has: page.locator(".csv-uploader") }).first();
    if (await details.count() && !await details.evaluate(node => node.open)) await details.locator(":scope > summary").click();
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await expect(uploader).toBeVisible();
    const change = uploader.locator(".csv-change-btn");
    if (await change.count()) await change.click();
    await expect(uploader.locator(".csv-dropzone")).toBeVisible();
    const name = `weekly-${buffer.length}.csv`;
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name, mimeType: "text/csv", buffer });
    await expect(uploader.locator(".file-state")).toContainText(name);
    await uploader.locator('[data-currency-scope="declare"]').getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
    const analyze = uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true });
    await expect(analyze).toBeEnabled();
    await analyze.focus();
    await analyze.press("Enter");
    await expect(page.locator("#wr-verdict")).toBeVisible();
  };
  await upload(campaignCsv(24, 14));
  await expect.poll(() => page.evaluate(() => window.__weeklyEvents.filter(event => event[1] === "weekly_review_completed").length)).toBeGreaterThan(0);
  const funnel = await page.evaluate(() => window.__weeklyEvents);
  for (const name of ["data_import_start", "data_import_success", "mapping_confirmed", "weekly_review_completed"]) {
    expect(funnel.find(event => event[1] === name)?.[2]).toMatchObject({ tool_id: "weekly-review", locale, content_slug: "ad-performance-diagnosis" });
  }
  expect(funnel.find(event => event[1] === "weekly_review_completed")[2].elapsed_bucket).toBe("under_1m");
  expect(JSON.stringify(funnel)).not.toContain("Review Campaign");
  await expect(page.locator(".wr-verdict__big")).toContainText("CPA");
  await expect(page.locator(".wr-report")).toContainText(en ? "■ Performance" : "■ 성과");
  if (en) await expect(page.locator(".wr-report")).not.toContainText(/[가-힣]/);
  const guardrail = page.getByLabel(en ? "Guardrail value" : "가드레일 값", { exact: true });
  await guardrail.fill("20");
  await page.getByRole("button", { name: en ? "Save this decision" : "이 결정 저장", exact: true }).click();
  await expect(page.locator(".wr-report")).toContainText(en ? "This week's decision" : "이번 주 결정");
  await expect(page.getByRole("dialog", { name: en ? "The decision log now lives here." : "결정 검토함이 여기로 들어왔어요." })).toHaveCount(0);
  const reportBeforeEdit = await page.locator(".wr-report").innerText();
  await guardrail.fill("999");
  await expect(page.locator(".wr-report")).toHaveText(reportBeforeEdit);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: en ? "Copy for Slack / Notion" : "Slack / Notion용 복사", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(reportBeforeEdit);
  expect(await page.evaluate(() => window.__weeklyEvents.find(event => event[1] === "weekly_review_export")?.[2])).toMatchObject({ tool_id: "weekly-review", download_type: "clipboard", state: "completed", content_slug: "ad-performance-diagnosis" });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".wr-report")).toBeVisible();
  await expect(page.locator("#wr-verdict")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.reload();
  await upload(campaignCsv(38, 7));
  await expect(page.getByText(en ? "The comparison period uses a saved aggregate snapshot." : "지난 기간은 저장된 집계 스냅샷을 사용합니다.", { exact: true })).toBeVisible();
  await expect(page.locator(".wr-report")).toContainText("2026-09-07");
  await upload(campaignCsv(45, 7));
  await expect(page.locator(".wr-report")).toContainText("2026-09-14");
  await expect(page.getByText(en ? "The comparison period uses a saved aggregate snapshot." : "지난 기간은 저장된 집계 스냅샷을 사용합니다.", { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(exposedRows).toEqual([]);
}

test("weekly review: first upload, decision, report, returning upload", async ({ page }) => runJourney(page, "ko"));
test("@light-en weekly review: English first and returning upload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mkt-library-theme", "light"));
  await runJourney(page, "en");
});
