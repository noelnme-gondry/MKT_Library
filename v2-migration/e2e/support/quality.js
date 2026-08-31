import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

const PRIMARY_ACTION_SELECTOR = [
  ".btn.primary",
  ".ab-button",
  ".csv-dropzone",
].join(",");

export async function expectPageHierarchy(page, { primaryRegion = "main" } = {}) {
  await expect(page.locator("main h1")).toHaveCount(1);

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);

  const overlappingSticky = await page.evaluate(() => {
    const visible = [...document.querySelectorAll("main *")].filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.position === "sticky" && rect.width > 0 && rect.height > 0;
    });
    const collisions = [];
    for (let index = 0; index < visible.length; index += 1) {
      const first = visible[index].getBoundingClientRect();
      for (let otherIndex = index + 1; otherIndex < visible.length; otherIndex += 1) {
        const second = visible[otherIndex].getBoundingClientRect();
        const horizontal = first.left < second.right && first.right > second.left;
        const vertical = first.top < second.bottom && first.bottom > second.top;
        if (horizontal && vertical) collisions.push([visible[index].className, visible[otherIndex].className]);
      }
    }
    return collisions;
  });
  expect(overlappingSticky).toEqual([]);

  const region = page.locator(primaryRegion).first();
  const visiblePrimaryActions = region.locator(PRIMARY_ACTION_SELECTOR).filter({ visible: true });
  const count = await visiblePrimaryActions.count();
  expect(count, `한 판단 영역(${primaryRegion})에 주 행동이 ${count}개 노출됨`).toBeLessThanOrEqual(1);
}

export async function expectKeyboardFocusVisible(page) {
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const focusState = await focused.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(focusState.height).toBeGreaterThanOrEqual(24);
  expect(focusState.left).toBeGreaterThanOrEqual(-1);
  expect(focusState.right).toBeLessThanOrEqual(focusState.viewportWidth + 1);
  expect(focusState.top).toBeGreaterThanOrEqual(-1);
  expect(focusState.bottom).toBeLessThanOrEqual(focusState.viewportHeight + 1);
  expect(focusState.outlineStyle).not.toBe("none");
  expect(focusState.outlineWidth).toBeGreaterThanOrEqual(2);
}

export async function expectNoSeriousAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
}
