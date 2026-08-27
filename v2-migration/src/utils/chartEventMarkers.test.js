import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventMarkerStyle } from "@/utils/chartEventMarkers";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const TYPES = ["listing", "creative", "price", "campaign", "release", "external", "other"];

function tokensFor(selector) {
  const tokens = {};
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const match of CSS.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))) {
    for (const [, name, value] of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();
  }
  return tokens;
}

function hexToLab(hex) {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const x = (rgb[0] * 0.4124 + rgb[1] * 0.3576 + rgb[2] * 0.1805) / 0.95047;
  const y = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const z = (rgb[0] * 0.0193 + rgb[1] * 0.1192 + rgb[2] * 0.9505) / 1.08883;
  const f = (value) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(first, second) {
  const a = hexToLab(first);
  const b = hexToLab(second);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

describe("chart event marker styles", () => {
  it("gives every supported event type a distinct semantic color and line pattern", () => {
    const styles = TYPES.map(eventMarkerStyle);

    expect(new Set(styles.map((style) => style.colorRole)).size).toBe(TYPES.length);
    expect(new Set(styles.map((style) => JSON.stringify(style.dash))).size).toBe(TYPES.length);
    expect(eventMarkerStyle("listing")).not.toMatchObject(eventMarkerStyle("creative"));
  });

  it("keeps resolved event colors perceptually separated in both themes", () => {
    const dark = tokensFor(":root");
    const themes = { dark, light: { ...dark, ...tokensFor("body.light-mode") } };
    const failures = [];
    for (const [theme, tokens] of Object.entries(themes)) {
      for (let i = 0; i < TYPES.length; i += 1) {
        for (let j = i + 1; j < TYPES.length; j += 1) {
          const first = tokens[eventMarkerStyle(TYPES[i]).colorToken];
          const second = tokens[eventMarkerStyle(TYPES[j]).colorToken];
          const distance = /^#[0-9a-f]{6}$/i.test(first) && /^#[0-9a-f]{6}$/i.test(second)
            ? deltaE(first, second)
            : 0;
          if (distance < 20) failures.push(`${theme} ${TYPES[i]}↔${TYPES[j]}: ΔE ${distance.toFixed(1)}`);
        }
      }
    }
    expect(failures, `이벤트 색 구분 실패:\n${failures.join("\n")}`).toEqual([]);
  });

  it("uses the explicit fallback style for an unknown type", () => {
    expect(eventMarkerStyle("unknown")).toMatchObject({ colorRole: "markerNeutral", dash: [6, 4] });
  });
});
