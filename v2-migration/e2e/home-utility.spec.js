import { test, expect } from "@playwright/test";

for (const en of [false, true]) {
  const prefix = en ? "/en" : "";
  test(`home entry and shared utility dialog remain coherent (${en ? "en" : "ko"})`, async ({ page }, testInfo) => {
    if (testInfo.project.use.viewport.width === 768) await page.setViewportSize({ width: 980, height: 1000 });
    await page.goto(prefix || "/");
    const intro = page.locator(".dc-hero__intro");
    const preview = page.locator(".home-result-preview");
    await expect(preview.locator("canvas")).toHaveAttribute("data-chart-ready", "true");
    // 큰 소개 상자가 실제 결과를 밀어내지 않도록 결과까지의 간격을 확인한다.
    await expect(intro).toHaveCSS("border-top-width", "0px");
    // 첫 화면 입구는 상황 7개 + "모두 보기" 한 칸과 파일 놓기다(product-ssot §5.1.1).
    await expect(page.locator(".home-entry__situations a")).toHaveCount(8);
    await expect(page.locator(".home-entry__file")).toBeVisible();
    const introBox = await intro.boundingBox();
    const entry = await page.locator(".home-entry").boundingBox();
    const noFile = await page.locator(".home-entry__no-file").boundingBox();
    const result = await preview.boundingBox();
    expect(entry.y - introBox.y - introBox.height).toBeLessThanOrEqual(40);
    expect(result.y - noFile.y - noFile.height).toBeLessThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    const utilities = page.getByRole("button", { name: en ? "More settings" : "기타 설정", exact: true });
    await utilities.click();
    const panel = page.getByRole("dialog", { name: en ? "More settings" : "기타 설정", exact: true });
    const rows = panel.locator(".utility-popover-row:visible");
    const boxes = await rows.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { x: rect.x, width: rect.width, height: rect.height, border: style.borderTopWidth, underline: style.textDecorationLine };
    }));
    expect(boxes.length).toBeGreaterThanOrEqual(7);
    for (const box of boxes) {
      expect(Math.abs(box.x - boxes[0].x)).toBeLessThan(1);
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.border).toBe("0px");
      expect(box.underline).toBe("none");
    }
    const menu = await panel.boundingBox();
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize().width);
    await expect(panel.getByRole("link", { name: en ? "한국어" : "English", exact: true })).toHaveAttribute("href", en ? "/" : "/en");
    await page.keyboard.press("Escape");
    await expect(utilities).toBeFocused();
    await expect(panel).not.toBeVisible();

    await utilities.click();
    await panel.getByRole("button", { name: en ? "Project settings" : "프로젝트 설정", exact: true }).click();
    const project = page.getByRole("dialog", { name: en ? "Project settings" : "프로젝트 설정", exact: true });
    await expect(project).toBeVisible();
    await expect(panel).not.toBeVisible();
    await expect(project.getByRole("button", { name: en ? "Export settings" : "설정 내보내기", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(project).not.toBeVisible();
    await expect(utilities).toBeFocused();

    // 같은 공용 메뉴가 도구에서도 유지되고, 인쇄와 언어 전환이 현재 도구에 속한다.
    await page.goto(`${prefix}/tools/operations-planner`);
    await utilities.click();
    await expect(panel.getByRole("button", { name: en ? "Print / PDF" : "인쇄 / PDF", exact: true })).toBeVisible();
    await expect(panel.getByRole("link", { name: en ? "한국어" : "English", exact: true })).toHaveAttribute("href", `${en ? "" : "/en"}/tools/operations-planner`);
  });
}
