import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const palette = readFileSync(new URL("./chart-table-system.css", import.meta.url), "utf8");
const library = readFileSync(new URL("./library-workspace.css", import.meta.url), "utf8");
const surfaces = [...library.matchAll(/--library-surface:\s*(#[\da-f]{6})/gi)].map(match => match[1]);
const background = { dark: surfaces[0], light: surfaces.at(-1) };
const categories = [...palette.matchAll(/--chart-category-(\d+)-(light|dark):\s*(#[\da-f]{6})/gi)];
function luminance(hex) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return linear.reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
}
describe("shared category colors remain visible on the actual content surface", () => {
  it("covers both CSS theme variants rather than a hand-maintained color list", () => {
    expect(surfaces.length).toBeGreaterThanOrEqual(2);
    expect(categories.filter(match => match[2] === "light")).toHaveLength(6);
    expect(categories.filter(match => match[2] === "dark")).toHaveLength(6);
  });
  it.each(categories.map(([, index, theme, color]) => [index, theme, color]))("category %s in %s has non-text contrast", (_, theme, color) => {
    const [low, high] = [luminance(color), luminance(background[theme])].sort((a,b) => a-b);
    expect((high + .05) / (low + .05)).toBeGreaterThanOrEqual(3);
  });
});
