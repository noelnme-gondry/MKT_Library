import { enablePaidReports } from "./support/paidReports";
import { expect, test } from "@playwright/test";
import Papa from "papaparse";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

async function bytesOf(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const examples = [
  { blog: "aso-basics-guide", file: "aso-mix-only.csv", tool: "/tools/aso-store-conversion", result: "#aso-result", kind: "aso" },
  { blog: "apple-search-ads-guide", file: "asa-mature-candidate.csv", tool: "/tools/asa-keyword-finder", result: "#asa-summary", kind: "asa" },
  { blog: "budget-scaling-limit", file: "saturation-sparse.csv", tool: "/tools/campaign-saturation", result: ".result-action-card", kind: "saturation" },
];

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  for (const example of examples) {
    test(`public example ${example.kind}: blog download → analysis → export (${locale})${en ? " @light-en" : ""}`, async ({ page }) => {
      await page.addInitScript(theme => localStorage.setItem("mkt-library-theme", theme), en ? "light" : "dark");
      await enablePaidReports(page);
      await page.goto(`${prefix}/blog/${example.blog}`);
      const inputDownload = page.waitForEvent("download");
      await page.locator(`main a[href="/examples/${example.file}"]`).click();
      const source = await inputDownload;
      expect(source.suggestedFilename()).toBe(example.file);
      const input = await bytesOf(source);
      const originalRows = Papa.parse(input.toString("utf8"), { header: true, skipEmptyLines: true });
      expect(originalRows.errors).toEqual([]);
      expect(originalRows.data.length).toBe(example.kind === "aso" ? 8 : example.kind === "asa" ? 4 : 24);

      await page.locator(`main a[href="${prefix}${example.tool}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${prefix}${example.tool}$`));
      await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
      await page.locator('.csv-uploader input[type="file"]').first().setInputFiles({ name: example.file, mimeType: "text/csv", buffer: input });
      await expect(page.locator(".csv-uploader .file-state")).toBeVisible();
      const currency = page.locator('.csv-uploader [data-currency-scope="declare"]').first();
      if (await currency.count()) await currency.getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
      const coach = page.locator(".dochi-mapping-coach");
      if (await coach.isVisible()) await coach.getByRole("button").click();
      await page.locator(".csv-uploader .csv-analysis-action").click();
      const result = page.locator(example.result).first();
      await expect(result).toBeVisible();

      if (example.kind === "aso") {
        await expect(result).toContainText("34.00%");
        await expect(result).toContainText("16.00%");
        await expect(result).toContainText(en ? "Traffic mix drove it" : "트래픽 구성 변화가 주도");
      } else if (example.kind === "asa") {
        const maturity = page.getByLabel(en ? "Conversion maturity of the uploaded period" : "업로드 기간의 전환 성숙도");
        await expect(maturity).toHaveValue("unknown");
        await expect(page.getByText(en ? "Conversion maturity unknown" : "전환 성숙도 미확인", { exact: true }).first()).toBeVisible();
        await maturity.selectOption("mature");
        await expect(page.locator("#asa-actions")).toContainText("budget app");
      } else {
        await expect(result).toContainText(en ? "Abstain — no analyzable items" : "판단 보류 — 분석 가능한 항목 없음");
        await expect(result).toContainText("0/24");
        await expect(page.locator('[data-decision-review-tool="5-22"]')).toHaveCount(0);
      }
      await result.getByRole("button", { name: /결과 받기|Download results|Get results|실행 정보|Run details/ }).click();
      const outputDownload = page.waitForEvent("download");
      const menuName = example.kind === "aso" ? /소스별 분해 \(CSV\)|Per-source decomposition \(CSV\)/
        : example.kind === "asa" ? /권장 조치 \(CSV\)|Recommended actions \(CSV\)/
          : /실행 정보\(JSON\)|Run details \(JSON\)/;
      await page.getByRole("menuitem", { name: menuName }).click();
      const output = (await bytesOf(await outputDownload)).toString("utf8");
      if (example.kind === "saturation") {
        expect(JSON.parse(output.replace(/^\uFEFF/, "")).status).toBe("ABSTAIN");
      } else {
        const parsed = Papa.parse(output, { header: true, skipEmptyLines: true });
        expect(parsed.errors).toEqual([]);
        if (example.kind === "aso") {
          expect(parsed.data).toHaveLength(2);
          expect(parsed.data.every(row => row.effect_unit === "views_per_install" && row.share_basis === "installs")).toBe(true);
          expect(parsed.data.reduce((sum, row) => sum + Number(row.efficiency_effect), 0)).toBeCloseTo(0, 10);
          expect(parsed.data.reduce((sum, row) => sum + Number(row.mix_effect), 0)).toBeCloseTo(1 / 0.16 - 1 / 0.34, 10);
        } else {
          expect(parsed.data).toHaveLength(1);
          expect(Number(parsed.data[0].recommended_cpt)).toBeCloseTo(115, 8);
          expect(Number(parsed.data[0].actual_cpa)).toBeCloseTo(4000 / 12, 8);
          expect(parsed.data[0].quality_status).toBe("reviewable");
        }
      }
      await expectNoSeriousAccessibilityViolations(page);
    });
  }
}
