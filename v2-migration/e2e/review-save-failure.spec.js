import { test, expect } from "@playwright/test";
import { enableReviewLogin } from "./support/reviewSave";

for (const locale of ["ko", "en"]) {
  test(`review edit keeps its draft after disk failure, then survives reload (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    await enableReviewLogin(page);
    await page.goto(`${prefix}/projects`);
    await expect(page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true })).toBeEnabled();
    await page.evaluate(async () => {
      const db = await new Promise(resolve => { const request = indexedDB.open("mkt_workspace"); request.onsuccess = () => resolve(request.result); });
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "project:default", id: "default", name: "Review retry", snapshots: [], settings: null, createdAt: Date.now(), lastUsedAt: Date.now(), decisions: [{ id: "review-retry", toolId: "5-3", action: "Budget review", actual: "100", learning: "", reviewDate: "2026-01-01", createdAt: "2025-12-25T00:00:00Z", status: "scheduled", metric: "CPA", baseline: "100", targetDirection: "lower" }] });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; }); db.close();
    });
    await page.goto(`${prefix}/weekly-review`);
    await page.getByRole("button", { name: en ? "Review / export device records" : "기기 기록 검토·내보내기" }).click();
    const actual = page.getByRole("textbox", { name: en ? "Actual outcome — Budget review" : "실제 결과 — Budget review", includeHidden: true });
    await actual.fill("2500");
    await page.getByRole("button", { name: en ? "Save review changes" : "검토 내용 저장", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Save review" : "리뷰 저장", exact: true });
    const save = dialog.getByRole("button", { name: en ? "Save review" : "리뷰 저장", exact: true });
    await expect(save).toBeEnabled();
    await page.evaluate(() => {
      window.__rejectReviewWrite = true;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (window.__rejectReviewWrite && this.name === "meta" && value?.key === "project:default") {
          this.transaction.abort(); throw new DOMException("Audit quota failure", "QuotaExceededError");
        }
        return put.call(this, value, ...args);
      };
    });
    await save.click();
    await expect(dialog.getByRole("alert")).toContainText(en ? "Could not save" : "저장하지 못했습니다");
    await expect(actual).toHaveValue("2500");
    await page.evaluate(() => { window.__rejectReviewWrite = false; });
    await save.click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: en ? "Review / export device records" : "기기 기록 검토·내보내기" }).click();
    await expect(actual).toHaveValue("2500");
  });
}
