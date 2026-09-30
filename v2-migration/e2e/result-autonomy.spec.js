import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

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
