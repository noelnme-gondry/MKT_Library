import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildBrandIconAssets } from "../../scripts/generate-brand-icons.mjs";
import manifest from "./manifest";

const ROOT = process.cwd();
const rootDocument = readFileSync(path.join(ROOT, "src/components/RootDocument.jsx"), "utf8");
const brandMark = readFileSync(path.join(ROOT, "src/components/BrandMark.jsx"), "utf8");

function pngMetadata(relativePath) {
  const buffer = readFileSync(path.join(ROOT, relativePath));
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

function icoSizes(relativePath) {
  const icon = readFileSync(path.join(ROOT, relativePath));
  expect(icon.readUInt16LE(0)).toBe(0);
  expect(icon.readUInt16LE(2)).toBe(1);
  const count = icon.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16;
    return icon[offset] || 256;
  });
}

describe("Growth Opt brand icons", () => {
  it.each([
    ["public/assets/brand/dochi-app-icon.png", 1254],
    ["public/icons/dochi-favicon-64.png", 64],
    ["public/icons/dochi-192.png", 192],
    ["public/icons/dochi-512.png", 512],
    ["public/icons/dochi-maskable-512.png", 512],
    ["public/apple-touch-icon.png", 180],
    ["src/app/apple-icon.png", 180],
  ])("keeps %s square at %ipx", (file, size) => {
    expect(pngMetadata(file)).toMatchObject({ width: size, height: size });
  });

  it("keeps the modern browser SVG and stable public fallback identical", () => {
    const appIcon = readFileSync(path.join(ROOT, "src/app/icon.svg"), "utf8");
    const publicIcon = readFileSync(path.join(ROOT, "public/favicon.svg"), "utf8");
    expect(appIcon).toBe(publicIcon);
    expect(appIcon).toContain("#1f60d2");
    expect(appIcon).toContain('fill="#fff"');
    expect(appIcon).toContain('data-brand-shape="dochi-right"');
  });

  it("keeps every raster and Windows icon generated from the shared SVG", async () => {
    const generated = await buildBrandIconAssets(ROOT);
    generated.pngAssets.forEach(({ path: relativePath, buffer }) => {
      expect(readFileSync(path.join(ROOT, relativePath)).equals(buffer)).toBe(true);
    });
    expect(readFileSync(path.join(ROOT, "src/app/favicon.ico")).equals(generated.ico)).toBe(true);
  });

  it("uses the favicon vector as the shared in-app brand mark", () => {
    expect(brandMark).toContain('src="/favicon.svg"');
    expect(brandMark).not.toContain("dochi-mark.png");
    expect(existsSync(path.join(ROOT, "public/assets/brand/dochi-mark.png"))).toBe(false);
  });

  it("publishes any and maskable PWA variants", () => {
    const icons = manifest().icons;
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
  });

  it("publishes pixel-fit Windows favicon sizes including Google's 48px recommendation", () => {
    expect(icoSizes("src/app/favicon.ico")).toEqual([16, 32, 48, 64]);
  });

  it("lets Next.js own icon, Apple, and manifest metadata without duplicate head links", () => {
    expect(rootDocument).not.toMatch(/rel="(?:icon|apple-touch-icon|manifest)"/);
  });
});
