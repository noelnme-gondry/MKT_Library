import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const locale of ["ko", "en"]) {
  for (const tool of ["campaign-variance", "campaign-saturation"]) {
    test(`recipe header inner alignment ${tool} (${locale})`, async ({ page }) => {
      await page.goto(`${locale === "en" ? "/en" : ""}/tools/${tool}?example=1`);
      const header = page.locator(".tool-instrument-header");
      await expect(header.getByRole("combobox")).toBeVisible();
      const measure = () => header.evaluate(element => {
        const box = element.getBoundingClientRect();
        const bounds = selector => {
          const node = element.querySelector(selector);
          const rect = node.getBoundingClientRect();
          return { left: rect.left - box.left, right: box.right - rect.right };
        };
        return {
          heading: bounds(".tool-instrument-header__heading"),
          label: bounds(".recipe-command__label"),
          input: bounds(".recipe-command__input"),
          scope: bounds(".recipe-scope-controls__segments > summary"),
          controls: bounds(".recipe-scope-controls__body"),
        };
      });
      const closed = await measure();
      // 서로 같은 x여도 박스 가장자리에 붙으면 실패다. 여백과 정렬을 함께 검사한다.
      expect(closed.heading.left).toBeGreaterThanOrEqual(16);
      expect(closed.input.right).toBeGreaterThanOrEqual(16);
      expect(Math.abs(closed.input.left - closed.input.right)).toBeLessThanOrEqual(1);
      for (const part of [closed.label, closed.input]) expect(Math.abs(part.left - closed.heading.left)).toBeLessThanOrEqual(1);
      // 5-22는 같은 행에 날짜가 먼저 있다. 다음 행으로 접혀도 컨테이너 밖으로 나가면 안 된다.
      expect(closed.scope.left).toBeGreaterThanOrEqual(closed.heading.left);
      if (tool === "campaign-variance") expect(Math.abs(closed.scope.left - closed.heading.left)).toBeLessThanOrEqual(1);
      await header.locator(".recipe-scope-controls__segments > summary").click();
      const opened = await measure();
      expect(opened.controls.right).toBeGreaterThanOrEqual(16);
      expect(opened.controls.left).toBeGreaterThanOrEqual(opened.heading.left);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
}

test.describe("direct periods in light mode", () => {
  test.use({ colorScheme: "light" });
  for (const locale of ["ko", "en"]) {
    for (const tool of ["campaign-variance", "campaign-saturation"]) {
      test(`${tool} date dialog contrast and apply (${locale})`, async ({ page }) => {
        const en = locale === "en";
        await page.goto(`${en ? "/en" : ""}/tools/${tool}?example=1`);
        await expect(page.locator("body")).toHaveClass(/light-mode/);
        await expect(page.locator(".result-action-card").first()).toBeVisible();
        const trigger = page.getByRole("button", { name: en ? /^Analysis period/ : /^분석 기간/ });
        const start = await trigger.locator("time").first().getAttribute("datetime");
        const nextDay = new Date(Date.parse(`${start}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: en ? "Analysis period" : "분석 기간", exact: true });
        await expect(dialog).toBeVisible();
        const audit = await new AxeBuilder({ page }).include(".result-period-picker__popover").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(audit.violations).toEqual([]);
        await dialog.getByLabel(en ? "Start date" : "시작일").fill(nextDay);
        await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
        await expect(trigger.locator("time").first()).toHaveAttribute("datetime", nextDay);
        await expect(page.locator(".result-action-card").first()).toBeVisible();
        if (tool === "campaign-saturation") {
          await expect(page.locator("#s-scale-map")).toBeVisible();
          await expect(page.locator("#s-sat-curve canvas")).toBeVisible();
          await expect(page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ })).toHaveCount(0);
        }
      });
    }
  }
});

for (const locale of ["ko", "en"]) {
  test(`independent direct date filters, keyboard and layout (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await page.goto(`${en ? "/en" : ""}/tools/campaign-variance?example=1`);
    await expect(page.locator("#s-pvm-result .result-action-card")).toBeVisible();
    const analysis = page.getByRole("button", { name: en ? /^Analysis period/ : /^분석 기간/ });
    const comparison = page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ });
    const prior = await comparison.innerText();
    const dates = await analysis.locator("time").evaluateAll(nodes => nodes.map(node => node.dateTime));
    expect((await analysis.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await analysis.click();
    const dialog = page.getByRole("dialog", { name: en ? "Analysis period" : "분석 기간", exact: true });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await dialog.getByLabel(en ? "Start date" : "시작일").fill(dates[1]);
    await dialog.getByRole("button", { name: en ? "Cancel" : "취소", exact: true }).click();
    await expect(analysis).toBeFocused();
    await expect(analysis.locator("time").first()).toHaveAttribute("datetime", dates[0]);
    await analysis.press("Enter");
    await dialog.getByLabel(en ? "Start date" : "시작일").fill(dates[1]);
    await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    await expect(analysis.locator("time").first()).toHaveAttribute("datetime", dates[1]);
    await expect(comparison).toHaveText(prior);
    await expect(page.locator(".analysis-period-notes")).toContainText(en ? "1 days" : "1일");
    await comparison.click();
    const priorDialog = page.getByRole("dialog", { name: en ? "Comparison period" : "비교 기간", exact: true });
    await priorDialog.getByLabel(en ? "Start date" : "시작일").fill("");
    await priorDialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    await expect(priorDialog.getByRole("alert")).toBeVisible();
    await priorDialog.getByLabel(en ? "Start date" : "시작일").press("Escape");
    await expect(comparison).toBeFocused();
    await expect(page.locator("#s-pvm-channels table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const locale of ["ko", "en"]) {
  test(`recipe scope rejection and recovery (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await page.goto(`${en ? "/en" : ""}/tools/campaign-variance?example=1`);
    const result = page.locator("#s-pvm-result .result-action-card");
    await expect(result).toBeVisible();
    const input = page.getByRole("combobox", { name: en ? "Analysis setup" : "분석 설정" });
    const choose = async (query, label) => {
      await input.fill(query);
      const option = page.getByRole("option").filter({ has: page.getByText(label, { exact: true }) });
      await expect(option).toHaveCount(1);
      await option.click();
    };

    await choose("Meta AAP", en ? "Analyze Meta AAP only" : "Meta AAP만 분석");
    const chip = page.getByRole("button", { name: en ? "Remove Channel: Meta AAP" : "채널: Meta AAP 빼기" });
    await expect(chip).toBeVisible();
    const rows = page.locator("#s-pvm-channels tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Meta AAP");

    await choose("Meta AAP", en ? "Analyze without Meta AAP" : "Meta AAP 제외하고 분석");
    const status = page.locator(".recipe-command [role=status]");
    await expect(status).toContainText(en ? "no values would remain" : "분석할 값이 남지 않아");
    await expect(status).toBeVisible();
    await expect(chip).toBeVisible();
    await expect(rows).toHaveCount(1);

    // 칩 삭제로 범위를 풀고, 같은 입력창에서 축 변경까지 정상적으로 이어진다.
    await chip.click();
    await expect(rows).not.toHaveCount(1);
    await choose("OS", en ? "By OS" : "OS별");
    await expect(page.locator("#s-pvm-channels h2")).toHaveText(en ? "By OS" : "OS별 결과");
    await expect(status).not.toContainText(en ? "no values would remain" : "분석할 값이 남지 않아");
  });
}


for (const locale of ["ko", "en"]) {
  test(`saturation recipe axis, scope, optional curve and PNG (${locale})`, async ({ page }) => {
    const en = locale === "en";
    // 결제는 실행하지 않는다. 실제 구매 이용권 API 응답만 fixture로 제공해 다운로드 경로를 검사한다.
    const entitlement = { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route("**/api/account/session", (route) => route.fulfill({ json: { enabled: true, account: { id: "recipe-owner", email: "recipe@example.com" }, entitlement } }));
    await page.route("**/api/payments/access", (route) => route.fulfill({ json: { entitlement } }));
    await page.goto(`${en ? "/en" : ""}/tools/campaign-saturation?example=1`);
    const result = page.locator("#s-sat-summary .result-action-card");
    await expect(result).toBeVisible();
    const input = page.getByRole("combobox", { name: en ? "Analysis setup" : "분석 설정" });
    const choose = async (query, label) => {
      await input.fill(query);
      const option = page.getByRole("option").filter({ has: page.getByText(label, { exact: true }) });
      await expect(option).toHaveCount(1);
      await option.click();
    };
    await choose("OS", en ? "By OS" : "OS별");
    await expect(page.locator("#s-sat th").nth(1)).toHaveText("OS");
    await expect(page.locator("#s-scale-map")).toContainText(en ? "by OS" : "OS별");
    const hide = en ? "Hide Response curve" : "응답곡선 숨기기";
    await choose(hide, hide);
    await expect(page.locator("#s-sat-curve")).toHaveCount(0);
    await expect(page.locator("#s-marginal-gap")).toBeVisible();
    await page.getByRole("button", { name: en ? `Remove ${hide}` : `${hide} 빼기`, exact: true }).click();
    await expect(page.locator("#s-sat-curve canvas")).toBeVisible();
    await choose("PNG", en ? "PNG without header" : "PNG에 머리글 넣지 않기");
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.locator("#s-sat-curve").getByRole("button", { name: en ? "Download PNG" : "PNG 받기" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(await download.failure()).toBeNull();
    const png = await readFile(await download.path());
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBeGreaterThan(200);
    expect(png.readUInt32BE(20)).toBeGreaterThan(200);
    await input.fill("OS");
    // 실제 DOM 소유 관계와 키보드 선택을 함께 확인한다.
    const listId = await input.getAttribute("aria-controls");
    await expect(page.locator(`[id="${listId}"]`)).toHaveAttribute("role", "listbox");
    await input.press("Escape");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(result).toBeVisible();
  });
}
