import { enablePaidReports } from "./support/paidReports";
import { enableReviewLogin, confirmReviewDialog } from "./support/reviewSave";
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
  await enableReviewLogin(page);
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
  await page.getByRole("button", { name: en ? "Compare weekly performance" : "주간 성과 비교", exact: true }).click();
  const upload = async (buffer) => {
    // 결과 화면의 "다음 주 CSV" 상시 접기는 없앴다. 데이터를 바꿀 때만 명시적으로 연다.
    const replace = page.getByRole("button", { name: en ? "Use different data" : "데이터 바꾸기", exact: true });
    if (await replace.count()) await replace.click();
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
  await expect(page.locator(".wr-evidence")).toHaveCSS("border-left-width", "1px");
  // The conclusion heading sits between reading text and the page title.
  const typeSizes = await page.evaluate(() => {
    const size = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return { body: size(".wr-screen"), section: size("#wr-verdict"), title: size("main h1") };
  });
  expect(typeSizes.section).toBeGreaterThan(typeSizes.body);
  expect(typeSizes.section).toBeLessThan(typeSizes.title);
  expect(await page.locator(".wr-screen").evaluate(node => parseFloat(getComputedStyle(node).paddingLeft))).toBeGreaterThanOrEqual(12);
  await page.getByLabel(en ? "Project name" : "프로젝트 이름", { exact: true }).fill("App growth review");
  await page.getByLabel(en ? "KPI target (optional)" : "KPI 목표 (선택)", { exact: true }).fill("20");
  await expect(page.getByText(en ? "Target met" : "목표 범위 충족", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: en ? "Save setup for next week" : "다음 주를 위해 설정 저장", exact: true }).click();
  await expect(page.getByText(en ? "Setup saved on this device." : "이 기기에 설정을 저장했습니다.", { exact: true })).toBeVisible();
  if (en && process.env.GOP_VISUAL_CAPTURE) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "/tmp/gop-review-loop.png" });
  }
  await page.getByRole("button", { name: en ? "Record decision for: Google / Review Campaign" : "결정 기록: Google / Review Campaign", exact: true }).click();
  await expect(page.locator("#wr-decision-target")).toHaveValue("Google / Review Campaign");
  await expect(page.locator(".wr-report")).toContainText(en ? "■ Performance" : "■ 성과");
  if (en) await expect(page.locator(".wr-report")).not.toContainText(/[가-힣]/);
  await page.getByText(en ? "Review criteria · optional" : "재검토 기준 · 선택", { exact: true }).click();
  const guardrail = page.getByLabel(en ? "Guardrail value" : "가드레일 값", { exact: true });
  await guardrail.fill("20");
  await page.getByRole("button", { name: en ? "Save this decision" : "이 결정 저장", exact: true }).click();
  await confirmReviewDialog(page, en);
  await expect(page.locator(".wr-report")).toContainText(en ? "This week's decision" : "이번 주 결정");
  await expect(page.getByRole("dialog", { name: en ? "Past decisions now live in My projects." : "지난 결정은 이제 내 프로젝트에 있어요." })).toHaveCount(0);
  const reportBeforeEdit = await page.locator(".wr-report").innerText();
  await guardrail.fill("999");
  await expect.poll(() => page.locator(".wr-report").innerText()).toBe(reportBeforeEdit);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: en ? "Copy for Slack / Notion" : "Slack / Notion용 복사", exact: true }).click();
  const normalizeSpacing = text => text.replace(/\s+/g, " ").trim();
  expect(normalizeSpacing(await page.evaluate(() => navigator.clipboard.readText()))).toBe(normalizeSpacing(reportBeforeEdit));
  expect(await page.evaluate(() => window.__weeklyEvents.find(event => event[1] === "weekly_review_export")?.[2])).toMatchObject({ tool_id: "weekly-review", download_type: "clipboard", state: "completed", content_slug: "ad-performance-diagnosis" });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".wr-report")).toBeVisible();
  await expect(page.locator("#wr-verdict")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.reload();
  await expect(page.locator("#wr-project-title")).toHaveText("App growth review");
  await upload(campaignCsv(38, 7));
  await expect(page.getByText(en ? "The comparison period uses a saved aggregate snapshot." : "지난 기간은 저장된 집계 스냅샷을 사용합니다.", { exact: true })).toBeVisible();
  await expect(page.locator(".wr-report")).toContainText("2026-09-07");
  const evidence = page.locator("[data-information-section]").filter({ has: page.locator("caption", { hasText: en ? "Values used to assess historical variation" : "평소 변동 폭 비교에 사용한 값" }) });
  await expect(evidence).toBeVisible();
  await expect(evidence.getByRole("row")).toHaveCount(3); // 헤더 + 복원한 과거 2기간
  await expect(evidence.getByRole("table")).toContainText("2026-08-24 ~ 2026-08-30");
  await expect(evidence.getByRole("table")).toContainText("2026-08-31 ~ 2026-09-06");
  await expect(evidence.getByRole("table")).not.toContainText("2026-09-07");
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
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

async function dochiToWeekly(page, locale) {
  // This journey exports a report, so both account and payment mocks represent a purchase.
  await enableReviewLogin(page, { trial: false });
  await enablePaidReports(page);
  const en = locale === "en";
  await page.addInitScript(locale => {
    window.__journeyEvents = [];
    window.dataLayer = [];
    const push = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = (...items) => {
      for (const item of items) if (item?.[0] === "event") window.__journeyEvents.push(Array.from(item));
      return push(...items);
    };
    localStorage.setItem("mkt-library-dochi-welcome-dismissed", "1");
    if (locale === "en") localStorage.setItem("mkt-library-theme", "light");
  }, locale);
  await page.goto(en ? "/en" : "/");
  await expect(page.locator(".header-decision-inbox__label")).toBeVisible();
  await expect(page.locator("#dochi-upload")).not.toBeVisible();

  const hero = page.getByRole("navigation", { name: en ? "Start a task" : "바로 시작할 작업" });
  await expect(page.locator(".dc-loop a")).toHaveAttribute("href", `${en ? "/en" : ""}/weekly-review`);
  await hero.locator(".dc-action-route--primary").click();
  const intake = page.locator('.csv-uploader[data-hydrated="true"]');
  await expect(intake).toBeVisible();
  await intake.locator('input[type="file"][accept*="csv"]').setInputFiles({ name: "weekly-dochi.csv", mimeType: "text/csv", buffer: campaignCsv(24, 14) });
  await expect(page).toHaveURL(/\/start$/);
  await page.locator('[data-currency-scope="declare"]').first().getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
  const confirm = page.locator(".csv-analysis-action");
  await confirm.click();
  await page.locator(".tool-index__stage--ready .tool-index__chip").first().click();
  const decision = page.locator(".dochi-workspace__result.is-success .decision-review").first();
  await expect(decision).toBeVisible();
  await decision.locator(".decision-review-launch").click();
  await page.getByRole("dialog").getByRole("button", { name: en ? "Create it" : "이대로 만들기", exact: true }).click();
  await confirmReviewDialog(page, en);
  await expect(page.getByRole("dialog")).toContainText(en ? "Decision saved" : "결정 저장됨");
  const events = await page.evaluate(() => window.__journeyEvents);
  expect(events.find(event => event[1] === "data_import_success")?.[2]).toMatchObject({ journey_entry: "home" });
  for (const name of ["analysis_started", "analysis_completed", "analysis_result_viewed", "decision_record_added"]) {
    expect(events.find(event => event[1] === name && event[2].placement === "dochi_workspace")?.[2]).toMatchObject({ journey_entry: "home", locale });
  }
  expect(JSON.stringify(events)).not.toContain("Review Campaign");
  expect(JSON.stringify(events)).not.toContain("weekly-dochi.csv");
  await page.getByRole("dialog").getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
  const weekly = page.getByRole("link", { name: en ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기", exact: true });
  await expect(weekly).toBeEnabled();
  await weekly.click();
  await expect(page).toHaveURL(/\/weekly-review#weekly-performance$/);
  await expect(page.locator("#wr-verdict")).toBeVisible();
  await expect(page.locator(".wr-campaign-table")).toContainText("Review Campaign");
  await expect.poll(() => page.evaluate(() => window.__journeyEvents.some(event => event[1] === "weekly_review_completed" && event[2].journey_entry === "home"))).toBe(true);
  expect(await page.evaluate(() => window.__journeyEvents.some(event => event[1] === "decision_inbox_viewed"))).toBe(false);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: en ? "Download full comparison CSV" : "전체 캠페인 비교 CSV", exact: true }).click();
  const download = await downloadEvent;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Review Campaign");
  expect(csv).toContain("7000,10500,10,15");
  await page.getByRole("link", { name: en ? "See saved decisions" : "저장한 결정 확인", exact: true }).click();
  // 지난 결정은 접기가 아니라 버튼 목록이다 — 열기 전까지 몇 건인지 안 보이면
  // "무엇을 검토해야 하나"에 답하지 못한다.
  await expect(page.locator("#wr-history.wr-history-list")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__journeyEvents.some(event => event[1] === "decision_inbox_viewed"))).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);
}

test("Dochi upload continues into a weekly review and comparison export", async ({ page }) => dochiToWeekly(page, "ko"));
test("@light-en Dochi upload continues into an English weekly review", async ({ page }) => dochiToWeekly(page, "en"));
