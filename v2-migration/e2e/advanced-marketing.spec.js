import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ADVANCED_TOOLS } from "../src/lib/advanced-marketing/registry";
import { buildAdvancedDemo, advancedDemoOptions } from "../src/lib/advanced-marketing/demo";
import { csvBody } from "../src/utils/download";
import { enablePaidReports } from "./support/paidReports";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  for (const tool of ADVANCED_TOOLS) {
    test(`advanced real worker ${tool.id} (${locale})`, async ({ page }) => {
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${en ? "/en" : ""}${tool.slug}`);
      const root = page.locator(".advanced-analysis");
      await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
      await expect(root.locator('[data-advanced-result="ready"]')).toHaveCount(0);
      await root.getByRole("button", { name: /예시|example|sample/i }).first().click();
      await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
      await expect(root.locator(".advanced-table table").first()).toBeVisible();
      if (en) expect(await root.innerText()).not.toMatch(/[가-힣]/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const axe = await new AxeBuilder({ page }).include(".advanced-analysis").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
test("native CUPED upload, signed outcomes, mapping, declarations and replacement", async ({ page }) => {
  await page.goto("/tools/cuped-experiment");
  const demo = buildAdvancedDemo("5-34"), marker = "private-advanced-unit-";
  const raw = demo.raw.map((row, i) => ({ ...row, [demo.headers[0]]: `${marker}${i}` }));
  const content = csvBody(demo.headers, raw.map(row => demo.headers.map(header => row[header])));
  const leaked = [];
  page.on("request", request => { if (`${request.url()} ${request.postData() || ""}`.includes(marker)) leaked.push(request.url()); });
  const root = page.locator(".advanced-analysis"), input = root.locator('input[type="file"]').first();
  await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await input.setInputFiles({ name: "actual.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
  await expect(root.locator(".csv-loaded-stats")).toBeVisible();
  await expect(root.locator('[data-advanced-result="ready"]')).toHaveCount(0);
  await expect(root.getByLabel("배정 단위별 무작위 실험입니다")).not.toBeChecked();
  await root.getByRole("combobox", { name: "Treatment (0/1): 이렇게 읽음", exact: true }).selectOption("treatment");
  await root.getByLabel("배정 단위별 무작위 실험입니다").check();
  await root.getByLabel("공변량·세그먼트는 처치 전에 정했습니다").check();
  const analyze = root.getByRole("button", { name: "데이터 분석하기", exact: true });
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
  await root.locator(".advanced-settings summary").click();
  await root.getByLabel("사전 처치 배정 비율 (0~1)").fill("0.51");
  await expect(root.locator('[data-advanced-result="ready"]')).toHaveCount(0);
  await root.getByRole("button", { name: "설정 적용 후 분석", exact: true }).click();
  await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
  await root.getByRole("button", { name: "데이터·매핑 바꾸기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "⟳ CSV 변경", exact: true }).click();
  await root.locator('input[type="file"]').setInputFiles({ name: "replacement.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
  await expect(root.locator('[data-advanced-result="ready"]')).toHaveCount(0);
  await expect(page.getByRole("dialog").locator(".file-state")).toContainText("replacement.csv");
  await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
  await expect(root.getByLabel("배정 단위별 무작위 실험입니다")).not.toBeChecked();
  expect(leaked).toEqual([]);
});

// Imported options also have to be valid native form values; min/step offsets
// can otherwise silently prevent the Apply action even when the engine is valid.
test("all example settings can be submitted by the native form", async ({ page }) => {
  for (const tool of ADVANCED_TOOLS) {
    await page.goto(tool.slug);
    const root = page.locator(".advanced-analysis"), options = advancedDemoOptions(tool.id);
    await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    for (const option of tool.options) {
      const input = ["textarea", "select"].includes(option.type) ? root.getByRole(option.type === "select" ? "combobox" : "textbox", { name: option.label.ko, exact: true }) : root.getByLabel(option.label.ko, { exact: true });
      if (option.type === "checkbox") await input.setChecked(Boolean(options[option.key]));
      else if (option.type === "select") await input.selectOption(String(options[option.key]));
      else await input.fill(String(options[option.key]));
    }
    expect(await root.locator("form").evaluate(form => form.checkValidity()), tool.id).toBe(true);
  }
});

for (const tool of ADVANCED_TOOLS) {
  test(`native file analysis ${tool.id} with actual semantic mapping`, async ({ page }) => {
    await page.goto(`/en${tool.slug}`);
    const root = page.locator(".advanced-analysis"), demo = buildAdvancedDemo(tool.id), options = advancedDemoOptions(tool.id);
    await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await root.locator('input[type="file"]').first().setInputFiles({ name: "actual.csv", mimeType: "text/csv", buffer: Buffer.from(csvBody(demo.headers, demo.raw.map(row => demo.headers.map(header => row[header])))) });
    await expect(root.locator(".csv-loaded-stats")).toBeVisible();
    for (const key of tool.required) {
      const header = demo.headers.find(header => demo.mapping[header] === key);
      const select = root.getByRole("combobox", { name: `${header}: Read as`, exact: true });
      await expect(select.locator(`option[value="${key}"]`)).toHaveCount(1);
    }
    expect(await root.innerText()).not.toMatch(/[가-힣]/);
    for (const option of tool.options) {
      const input = ["textarea", "select"].includes(option.type) ? root.getByRole(option.type === "select" ? "combobox" : "textbox", { name: option.label.en, exact: true }) : root.getByLabel(option.label.en, { exact: true });
      if (option.type === "checkbox") await input.setChecked(Boolean(options[option.key]));
      else if (option.type === "select") await input.selectOption(String(options[option.key]));
      else await input.fill(String(options[option.key]));
    }
    const analyze = root.getByRole("button", { name: "Analyze data", exact: true });
    await expect(analyze).toBeEnabled(); await analyze.click();
    await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
    await expect(root.locator(".advanced-table table").first()).toBeVisible();
  });
}

test("paid local downloads contain all computed rows, settings and the SVG chart", async ({ page }) => {
  await enablePaidReports(page);
  await page.goto("/en/tools/cuped-experiment");
  const root = page.locator(".advanced-analysis");
  await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await root.getByRole("button", { name: /example/i }).first().click();
  await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
  await root.getByRole("button", { name: /Get results/ }).click();
  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Detailed workbook/ }).click();
  const xlsx = XLSX.read(await readFile(await (await xlsxDownload).path()));
  expect(xlsx.SheetNames).toContain("ADVANCED_1");
  expect(xlsx.SheetNames).toContain("ANALYSIS_SETTINGS");
  const result = XLSX.utils.sheet_to_json(xlsx.Sheets.ADVANCED_1, { header: 1 });
  expect(result.flat()).toContain("CUPED (ANCOVA2 · HC3)");
  expect(result[2][1]).toBeCloseTo(1.9784458730468077, 10);
  await root.getByRole("button", { name: /Get results/ }).click();
  const docxDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Analysis report/ }).click();
  const entries = unzipSync(new Uint8Array(await readFile(await (await docxDownload).path())));
  expect(Object.keys(entries).filter(name => /^word\/media\/.*\.png$/.test(name))).toHaveLength(1);
});

// 도구별로 브라우저·시간 제한을 격리한다. 12개 axe 검사에 60초를 공유하면
// CI에서 뒤쪽 도구가 검사를 시작하기도 전에 전체 테스트가 만료된다.
for (const tool of ADVANCED_TOOLS) {
  test(`advanced result ${tool.id} retains contrast and layout in light English @light-en`, async ({ page }) => {
    await page.goto(`/en${tool.slug}`);
    const root = page.locator(".advanced-analysis");
    await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await root.getByRole("button", { name: /example/i }).first().click();
    await expect(root.locator('[data-advanced-result="ready"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const axe = await new AxeBuilder({ page }).include(".advanced-analysis").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.map(v => v.id), tool.id).toEqual([]);
  });
}
