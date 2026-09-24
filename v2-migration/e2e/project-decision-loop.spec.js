import { test, expect } from "@playwright/test";
import { enableReviewLogin, confirmReviewDialog } from "./support/reviewSave";

for (const locale of ["ko", "en"]) {
  test(`project evidence → learning → next decision → report (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    await enableReviewLogin(page);
    await page.goto(`${prefix}/projects`);
    await expect(page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true })).toBeEnabled();
    await page.evaluate(async () => {
      const db = await new Promise(resolve => { const request = indexedDB.open("mkt_workspace"); request.onsuccess = () => resolve(request.result); });
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "project:default", id: "default", name: "Decision loop", snapshots: [], settings: null, createdAt: Date.now(), lastUsedAt: Date.now(), decisions: [{ id: "parent", toolId: "5-3", action: "Budget review", actual: "CPA 120", learning: "Check fatigue before scaling", reviewDate: "2026-01-01", createdAt: "2025-12-25T00:00:00Z", status: "reviewed", metric: "CPA", baseline: "100", targetDirection: "lower", evidence: JSON.stringify({ version: 1, headline: "CPA increased", stats: [{ label: "CPA", value: "100", detail: "95% CI 80–120" }], scope: { currency: "KRW" } }) }, { id: "experiment", toolId: "5-4", action: "Experiment review", reviewDate: "2026-01-01" }] });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; }); db.close();
    });
    await page.goto(`${prefix}/weekly-review`);
    const agenda = page.locator(".project-review-portfolio");
    await expect(agenda.locator("article")).toHaveCount(2);
    await agenda.getByText(en ? "Browse decisions by tool" : "도구별 결정 찾아보기", { exact: true }).click();
    await agenda.locator("article").filter({ hasText: en ? "Budget" : "예산" }).getByRole("link").click();
    const editor = page.locator(".weekly-review-page.is-embedded");
    await expect(editor.getByRole("heading", { name: "Budget review", exact: true })).toBeVisible();
    await expect(editor.getByRole("heading", { name: "Experiment review", exact: true })).toHaveCount(0);
    await expect(editor.locator(".decision-evidence")).toBeVisible();
    await expect(editor.getByText("95% CI 80–120", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: en ? "Turn this learning into the next decision" : "배운 점으로 다음 결정 만들기" }).click();
    await editor.getByRole("textbox", { name: en ? "Next action" : "다음에 실행할 행동", exact: true }).fill("Test new creative next week");
    await editor.getByRole("button", { name: en ? "Save next decision" : "다음 결정 저장", exact: true }).click();
    await confirmReviewDialog(page, en);
    await page.reload();
    await expect(agenda).toContainText(en ? "3" : "3");
    const decisions = await page.evaluate(async () => {
      const db = await new Promise(resolve => { const request = indexedDB.open("mkt_workspace"); request.onsuccess = () => resolve(request.result); });
      return new Promise(resolve => { const request = db.transaction("meta").objectStore("meta").get("project:default"); request.onsuccess = () => { resolve(request.result.decisions); db.close(); }; });
    });
    const child = decisions.find(record => record.action === "Test new creative next week");
    expect(child.parentDecisionId).toBe("parent");
    expect(child.baseline).toBe("");
    expect(decisions.find(record => record.id === "parent").actual).toBe("CPA 120");
    await agenda.getByRole("button", { name: en ? "Share / download project" : "프로젝트 공유·다운로드" }).click();
    await page.getByRole("menuitem", { name: en ? /Preview my report/ : /내 보고서 미리보기/ }).click();
    const preview = page.getByRole("dialog", { name: en ? "Your report preview" : "내 보고서 미리보기" });
    await expect(preview).toContainText("Test new creative next week");
    await expect(preview).toContainText("Check fatigue before scaling");
    await expect(preview).toContainText("95% CI 80–120");
  });
}
