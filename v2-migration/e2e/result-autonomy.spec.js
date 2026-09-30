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
