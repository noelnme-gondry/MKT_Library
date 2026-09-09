import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

async function readStored(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open("mkt_workspace", 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const read = name => new Promise((resolve, reject) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const [meta, files] = await Promise.all([read("meta"), read("datasets")]);
    const result = { meta, files: await Promise.all(files.map(async file => ({ ...file, text: await file.sourceBlob.text(), sourceBlob: undefined }))) };
    db.close(); return result;
  });
}
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "", tag = en ? " @light-en" : "";
  test(`project migration, complete backup restore and report-pass gate (${locale})${tag}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__projectEvents = [];
      window.dataLayer = [];
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = (...items) => { for (const item of items) if (item?.[0] === "event") window.__projectEvents.push(Array.from(item)); return push(...items); };
    });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/projects`);
    // SSR의 제목은 저장소 준비 신호가 아니다. 실제 생성 작업이 열릴 때까지 기다린다.
    await expect(page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true })).toBeEnabled();
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open("mkt_workspace", 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
      const tx = db.transaction(["meta", "datasets"], "readwrite");
      tx.objectStore("meta").put({ key: "weekly-review:project", project: { name: "Client Alpha", metric: "cpa", basis: "actions", currency: "KRW", target: "9" }, updatedAt: new Date().toISOString() });
      const text = "Date,Campaign,Cost,Actions\r\n2026-08-24,Private Campaign,100,10\r\n";
      tx.objectStore("datasets").put({ group: "efficiency", fileName: "renamed-export.csv", sourceBlob: new Blob([text]), sourceKind: "csv", headers: ["Date", "Campaign", "Cost", "Actions"], mapping: { Date: "date", Campaign: "campaign", Cost: "cost", Actions: "actions" }, byteSize: new Blob([text]).size, rowCount: 1, savedAt: Date.now(), lastUsedAt: Date.now() });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; }); db.close();
    });
    await page.goto(`${prefix}/projects`);
    await expect(page.getByRole("heading", { name: /Client Alpha/ })).toBeVisible();
    const initial = await readStored(page);
    expect(initial.meta.some(record => record.key === "weekly-review:project")).toBe(false);
    expect(initial.meta.find(record => record.id === "default").settings.target).toBe("9");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Export backup" : "백업 내보내기", exact: true }).click();
    const backupPath = await (await download).path();
    const exported = JSON.parse(await readFile(backupPath, "utf8"));
    expect(exported.project.settings.name).toBe("Client Alpha");
    expect(Buffer.from(exported.files[0].base64, "base64").toString()).toBe(initial.files[0].text);
    expect(JSON.stringify(exported)).not.toContain("keyHash");
    const invalid = { ...exported, files: exported.files.map(file => ({ ...file, base64: Buffer.from('"unterminated').toString("base64") })) };
    await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({ name: "bad-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: en ? "Replace current project" : "현재 프로젝트에 복원", exact: true }).click();
    await expect(page.locator(".projects-page").getByRole("status")).toContainText(en ? "Could not complete" : "작업을 완료하지 못했습니다");
    expect((await readStored(page)).files[0].text).toBe(initial.files[0].text);
    // Second project attempts open the report-pass page; existing data remains accessible.
    await page.getByRole("textbox", { name: en ? "New project name" : "새 프로젝트 이름" }).fill("Second project");
    await page.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription$`));
    await page.locator(".subscription-hero").getByRole("link", { name: en ? "Refund policy" : "환불정책", exact: true }).click();
    await expect(page).toHaveURL(/#refund-policy$/);
    const refundPolicy = page.locator("#refund-policy");
    await expect(refundPolicy.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(refundPolicy).toContainText(en ? "regardless of whether" : "사용 여부나 보고서 다운로드 여부와 관계없이");
    await expect(refundPolicy).toContainText(en ? "3 business days" : "3영업일");
    await expect(refundPolicy.getByRole("link")).toHaveAttribute("href", `${prefix}/contact`);
    await expect(page.locator("#purchase")).toContainText("5,900");
    await expect(page.locator("#purchase")).toContainText("Word");
    await expect(page.locator("#purchase")).toContainText("Excel");
    const events = await page.evaluate(() => window.__projectEvents);
    expect(events.some(event => event[1] === "subscription_gate_viewed" && event[2].source === "project_limit")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("Client Alpha");
    await expectNoSeriousAccessibilityViolations(page);
    await page.goto(`${prefix}/projects`);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: en ? "Delete" : "삭제", exact: true }).click();
    await expect(page.locator(".project-card")).toHaveCount(0);
    await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles(backupPath);
    await expect(page.locator(".project-import-preview")).toContainText("Client Alpha");
    await page.getByRole("button", { name: en ? "Restore as new project" : "새 프로젝트로 복원", exact: true }).click();
    await expect(page.locator(".projects-page").getByRole("status")).toContainText(en ? "Backup restored" : "백업을 복원했습니다");
    const restored = await readStored(page);
    expect(restored.files).toHaveLength(1);
    expect(restored.files[0].text).toBe(initial.files[0].text);
    expect(restored.meta.filter(record => record.id)).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: /Client Alpha/ })).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("existing projects remain separate and readable without a license", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "프로젝트 만들기", exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open("mkt_workspace", 1); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction(["meta", "datasets"], "readwrite");
    for (const id of ["client_a", "client_b"]) {
      tx.objectStore("meta").put({ key: `project:${id}`, id, name: id, snapshots: [], decisions: [], settings: null, eventMarkers: [{ id: "note", date: "2026-08-24", label: id, type: "campaign" }], createdAt: Date.now(), lastUsedAt: Date.now() });
      const text = `Date,Campaign,Cost,Actions\r\n2026-08-24,${id},100,10\r\n`;
      tx.objectStore("datasets").put({ group: `${id}::efficiency`, dataGroup: "efficiency", projectId: id, fileName: `${id}.csv`, sourceBlob: new Blob([text]), sourceKind: "csv", headers: ["Date", "Campaign", "Cost", "Actions"], mapping: { Date: "date", Campaign: "campaign", Cost: "cost", Actions: "actions" }, byteSize: new Blob([text]).size, rowCount: 1, savedAt: Date.now(), lastUsedAt: Date.now() });
    }
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; }); db.close();
  });
  for (const id of ["client_b", "client_a"]) {
    await page.goto("/projects");
    await expect(page.locator(".project-card")).toHaveCount(2);
    await page.locator(".project-card").filter({ has: page.getByRole("heading", { name: new RegExp(id) }) }).getByRole("button", { name: "리뷰 열기", exact: true }).click();
    await expect(page).toHaveURL(/\/weekly-review$/);
    await expect(page.locator(".csv-uploader .file-state").first()).toContainText(`${id}.csv`);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mkt_view_config")).state.eventMarkers[0]?.label)).toBe(id);
  }
  const stored = await readStored(page);
  expect(stored.files).toHaveLength(2);
  expect(stored.files.find(file => file.projectId === "client_a").text).toContain("client_a");
  expect(stored.files.find(file => file.projectId === "client_b").text).toContain("client_b");
});

test("measures an uploaded 10000-row source in actual IndexedDB", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "One desktop capacity observation, not a device capacity guarantee.");
  const rows = Array.from({ length: 10000 }, (_, index) => `2026-08-${String(1 + index % 28).padStart(2, "0")},Synthetic ${index % 10},Google,1000,10,100,10000`);
  const buffer = Buffer.from(`Date,Campaign,Channel,Cost,Actions,Clicks,Impressions\r\n${rows.join("\r\n")}`);
  await page.goto("/weekly-review");
  const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
  await expect(uploader).toBeVisible();
  await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "renamed-10000.csv", mimeType: "text/csv", buffer });
  await expect.poll(async () => (await readStored(page)).files[0]?.rowCount).toBe(10000);
  const stored = await readStored(page);
  expect(stored.files[0].byteSize).toBe(buffer.length);
  const estimate = await page.evaluate(() => navigator.storage.estimate());
  const measurement = JSON.stringify({ rows: 10000, columns: 7, sourceBytes: buffer.length, metadataJsonBytes: Buffer.byteLength(JSON.stringify(stored.meta)), browserEstimate: estimate }, null, 2);
  await writeFile(testInfo.outputPath("storage-measurement.json"), measurement);
  await testInfo.attach("storage-measurement", { path: testInfo.outputPath("storage-measurement.json"), contentType: "application/json" });
});
