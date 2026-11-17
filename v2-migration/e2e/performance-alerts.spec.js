import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { enableReviewLogin } from "./support/reviewSave";
const csv = (rise = true) => {
  const lines = ["Date,Channel,Campaign,Cost,Installs,Impressions,Clicks"];
  for (let index = 0; index < 84; index++) {
    const date = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10);
    lines.push(`${date},Meta,Test campaign,${index >= 77 && rise ? 14000 : 10000},10,10000,100`);
  }
  return Buffer.from(lines.join("\r\n"));
};
async function upload(page, en, rise = true) {
  const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
  await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "same-name.csv", mimeType: "text/csv", buffer: csv(rise) });
  await uploader.getByRole("button", { name: en ? "KRW ₩" : "원 ₩", exact: true }).click();
  await uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
  await expect(page.locator("#ops-plan-title")).toBeVisible();
}
for (const scenario of [{ en: false, tag: "" }, { en: false, tag: " @mobile-only" }, { en: true, tag: " @light-en" }]) {
  test(`project performance alerts: save multiple, chart, replace CSV and persist project${scenario.tag}`, async ({ page }, info) => {
    const { en } = scenario, prefix = en ? "/en" : "";
    await enableReviewLogin(page);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/tools/operations-planner`); await upload(page, en);
    const manager = page.locator("#performance-alerts");
    await manager.getByRole("textbox", { name: en ? "New project name" : "새 프로젝트 이름", exact: true }).fill("Alert test project");
    await manager.getByRole("textbox", { name: en ? "Condition name" : "조건 이름", exact: true }).fill("Meta CPR rise");
    await manager.getByRole("button", { name: en ? "Preview with current CSV" : "현재 CSV로 미리보기" }).click();
    await expect(manager.locator("canvas")).toBeVisible();
    await manager.getByRole("button", { name: en ? "Create project and save condition" : "프로젝트 만들고 조건 저장" }).click();
    await expect(manager.getByRole("heading", { name: "Meta CPR rise", exact: true })).toBeVisible();
    await manager.getByRole("button", { name: en ? "New condition" : "새 조건", exact: true }).click();
    await manager.getByRole("textbox", { name: en ? "Condition name" : "조건 이름", exact: true }).fill("Meta second condition");
    await manager.getByRole("button", { name: en ? "Save another condition" : "조건 추가 저장" }).click();
    await expect(manager.getByRole("article")).toHaveCount(2);
    await expect(manager.locator("canvas")).toBeVisible();
    await manager.getByRole("combobox", { name: en ? "Chart history" : "차트 표시 기간" }).selectOption("56");
    await expect(manager.locator("canvas")).toHaveAttribute("aria-label", /56/);
    await manager.getByRole("combobox", { name: en ? "Chart history" : "차트 표시 기간" }).selectOption("84");
    await manager.scrollIntoViewIfNeeded();
    const overflow = await manager.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, document: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1); expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
    const reviewImage = await manager.screenshot({ path: info.outputPath(`entry-review-alerts-detail-${en ? "en" : "ko"}-${info.project.name}.png`) });
    // This branch's visual review can also read the same synthetic capture via
    // job logs when artifact downloads are unavailable. No user CSV is used.
    // Other PRs and main retain only the normal screenshot artifact.
    if (process.env.CI && process.env.GITHUB_HEAD_REF === "feat/project-performance-alerts" && info.retry === 0) {
      const encoded = reviewImage.toString("base64");
      console.log(`ALERT_REVIEW_START ${info.project.name} ${reviewImage.length} ${createHash("sha256").update(reviewImage).digest("hex")}`);
      for (let offset = 0; offset < encoded.length; offset += 4000) console.log(`ALERT_REVIEW_DATA ${info.project.name} ${offset / 4000} ${encoded.slice(offset, offset + 4000)}`);
      console.log(`ALERT_REVIEW_END ${info.project.name}`);
    }
    await page.screenshot({ path: info.outputPath(`entry-review-alerts-${en ? "en" : "ko"}-${info.project.name}.png`), fullPage: true });
    const paused = manager.getByRole("article").filter({ has: page.getByRole("heading", { name: "Meta second condition", exact: true }) });
    await paused.getByRole("button", { name: en ? "Pause" : "일시 중지", exact: true }).click();
    await expect(paused.getByText(en ? "Paused" : "일시 중지됨", { exact: true })).toBeVisible();
    // Replacing identical filename and row count must require a new confirmation.
    await page.getByRole("button", { name: en ? "File, scope & metric" : "파일·대상·지표 변경", exact: true }).click();
    await page.getByRole("button", { name: en ? "Change data or mapping" : "데이터·매핑 바꾸기", exact: true }).click();
    await page.getByRole("button", { name: en ? "⟳ Change CSV" : "⟳ CSV 변경", exact: true }).click();
    await upload(page, en, false);
    await page.keyboard.press("Escape");
    const first = manager.getByRole("article").filter({ has: page.getByRole("heading", { name: "Meta CPR rise", exact: true }) });
    await expect(first.locator('[data-alert-status="clear"]')).toBeVisible();
    await expect(paused.getByText(en ? "Paused" : "일시 중지됨", { exact: true })).toBeVisible();
    await page.goto(`${prefix}/projects#performance-alerts`);
    await expect(page.getByRole("heading", { name: "Meta CPR rise", exact: true })).toBeVisible();
    const persisted = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open("mkt_workspace", 1); request.onsuccess = () => resolve(request.result); request.onerror = reject; });
      try { return await new Promise((resolve, reject) => { const request = db.transaction("meta").objectStore("meta").get("project:default"); request.onsuccess = () => resolve(request.result.performanceAlerts.map(rule => ({ name: rule.name, days: rule.history.length, enabled: rule.enabled }))); request.onerror = reject; }); } finally { db.close(); }
    });
    expect(persisted).toHaveLength(2); expect(persisted[0].days).toBe(84); expect(persisted[1].enabled).toBe(false);
    expect(errors).toEqual([]);
  });
}
