import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// 도구 화면의 핵심 그림(ToolCoreFigure)은 HTML로 그린다. 캔버스 차트를 걷어낸 자리의 PNG 받기가
// 실제 브라우저에서 이미지 파일을 만드는지 본다 — jsdom은 SVG foreignObject를 그리지 못한다.
const CASES = [
  { path: "/tools/campaign-variance", file: /^pvm_mix_rate_\d{4}-\d{2}-\d{2}\.png$/ },
  { path: "/tools/budget-allocation", file: /^budget_shift_\d{4}-\d{2}-\d{2}\.png$/ },
  { path: "/tools/vif-multicollinearity", file: /^vif_by_channel_\d{4}-\d{2}-\d{2}\.png$/ },
  { path: "/content/freshness", file: /^creative_status_\d{4}-\d{2}-\d{2}\.png$/ },
];

function pngSize(buffer) {
  // PNG 시그니처 + IHDR의 너비·높이(빅엔디언)
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const { path, file } of CASES) {
  test(`core figure downloads as a real PNG (${path})`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "figure-owner", email: "figure@example.com" }, entitlement: { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
    await page.goto(path);
    const example = page.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }).first();
    const figure = page.locator(".tool-core-figure").first();
    await expect(async () => {
      if (await example.isVisible()) await example.click();
      await expect(figure).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 120_000 });
    const button = figure.getByRole("button", { name: "PNG 받기" });
    // 이용권이 세션에서 읽히기 전에 누르면 결제 안내가 뜬다 — 다운로드가 올 때까지 다시 누른다.
    let download;
    await expect(async () => {
      const waiting = page.waitForEvent("download", { timeout: 5_000 });
      await button.click();
      download = await waiting;
    }).toPass({ timeout: 60_000 });
    expect(download.suggestedFilename()).toMatch(file);
    if (process.env.FIGURE_SAVE_DIR) await download.saveAs(`${process.env.FIGURE_SAVE_DIR}/${download.suggestedFilename()}`);
    const size = pngSize(readFileSync(await download.path()));
    // 2배 해상도: 그림 폭(수백 px) × 2 이상, 빈 캔버스가 아니라 실제 크기가 있어야 한다.
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(200);
    await expect(figure.getByRole("alert")).toHaveCount(0);
  });
}
