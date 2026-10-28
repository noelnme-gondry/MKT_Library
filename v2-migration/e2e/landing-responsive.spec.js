import { test, expect } from "@playwright/test";

async function heroLayout(page) {
  return page.evaluate(() => {
    const box = selector => {
      const node = document.querySelector(selector);
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, font: parseFloat(getComputedStyle(node).fontSize) };
    };
    return {
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      main: box("#main-content"),
      art: box(".brand-hero__art"),
      title: box(".brand-hero h1"),
      description: box(".dc-hero__deck, .analysis-hub-intro .compare-page__lead"),
      entry: box(".home-entry, .analysis-hub-entry"),
      actions: [...document.querySelectorAll(".home-entry__situations a, .home-entry__no-file a, .analysis-hub-entry a")].map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height };
      }),
    };
  });
}

function expectReadableHero(layout) {
  expect(layout.overflow).toBeLessThanOrEqual(1);
  // Decoration spans the available page, including the responsive side gutters.
  expect(Math.abs(layout.art.left - layout.main.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.art.right - layout.main.right)).toBeLessThanOrEqual(1);
  expect(layout.title.bottom).toBeLessThanOrEqual(layout.description.top);
  expect(layout.description.bottom).toBeLessThanOrEqual(layout.entry.top);
  expect(layout.description.font).toBeGreaterThanOrEqual(14);
  for (const action of layout.actions) {
    expect(action.left).toBeGreaterThanOrEqual(layout.main.left);
    expect(action.right).toBeLessThanOrEqual(layout.main.right);
    expect(action.height).toBeGreaterThanOrEqual(44);
  }
  if (layout.main.width <= 720) {
    // Narrow layouts must not stretch the artwork through the stacked actions.
    expect(layout.art.bottom).toBeLessThanOrEqual(layout.description.top);
  }
}

for (const path of ["/", "/en", "/compare", "/en/compare"]) {
  test(`landing uses available width and reflows readable content (${path})`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const initialWidth = testInfo.project.use.viewport.width;
    // Effective CSS widths for wide displays and 80–200% zoom on a 1440px window.
    // This checks reflow; it does not pretend deviceScaleFactor is browser zoom.
    const widths = initialWidth === 1440 ? [2048, 2560, 1800, 1440, 1152, 960, 720] : [initialWidth];
    const layouts = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      const layout = await heroLayout(page);
      expectReadableHero(layout);
      layouts.push(layout);
    }
    if (layouts.length > 1) {
      // The title adapts to the available pane instead of one fixed desktop size.
      expect(layouts[0].title.font).toBeGreaterThan(layouts.at(-1).title.font);
    }
    const originalFont = layouts.at(-1).title.font;
    // A user's larger default font must still enlarge text, without clipping it.
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const enlarged = await heroLayout(page);
    expect(enlarged.title.font).toBeGreaterThan(originalFont);
    expectReadableHero(enlarged);
  });
}
