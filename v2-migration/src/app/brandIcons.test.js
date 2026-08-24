import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "./manifest";

const ROOT = process.cwd();

function pngMetadata(relativePath) {
  const buffer = readFileSync(path.join(ROOT, relativePath));
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

describe("Dochi brand icons", () => {
  it.each([
    ["public/icons/dochi-192.png", 192],
    ["public/icons/dochi-512.png", 512],
    ["public/icons/dochi-maskable-512.png", 512],
    ["public/apple-touch-icon.png", 180],
    ["src/app/apple-icon.png", 180],
    ["src/app/icon.png", 512],
  ])("keeps %s square at %ipx", (file, size) => {
    expect(pngMetadata(file)).toMatchObject({ width: size, height: size });
  });

  it("keeps the shared in-app mark transparent", () => {
    // PNG color type 6 = RGBA. A generated checkerboard without alpha must fail.
    expect(pngMetadata("public/assets/brand/dochi-mark.png").colorType).toBe(6);
  });

  it("publishes any and maskable PWA variants", () => {
    const icons = manifest().icons;
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
  });

  it("keeps a real 32px Windows favicon", () => {
    const icon = readFileSync(path.join(ROOT, "src/app/favicon.ico"));
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    expect(icon.readUInt16LE(4)).toBeGreaterThan(0);
    expect(icon[6]).toBe(32);
    expect(icon[7]).toBe(32);
  });
});
