import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { stripSourceComments } from "@/test-utils/stripSourceComments";

const ROOT = process.cwd();
const rootDocument = stripSourceComments(readFileSync(path.join(ROOT, "src/components/RootDocument.jsx"), "utf8"));
const css = stripSourceComments(readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8"));

describe("Korean typography contract", () => {
  it("loads self-hosted Unicode subsets without preloading full Korean fonts", () => {
    const fonts = readFileSync(path.join(ROOT, "src/app/korean-fonts.css"), "utf8");
    expect(rootDocument).toContain('import "@/app/korean-fonts.css"');
    expect(rootDocument).not.toContain("Variable.woff2");
    expect(fonts).toContain('font-weight:400 1000');
    expect(fonts).toContain('font-weight:100 900');
    expect(fonts).toContain('unicode-range:');
    const files = [...fonts.matchAll(/url\("(.*?)"\)/g)].map(match => match[1]);
    expect(files.length).toBeGreaterThan(2);
    expect(files.every(file => file.startsWith("/fonts/subsets/") && existsSync(path.join(ROOT, "public", file)))).toBe(true);
    const common = files.filter(file => /-0-[a-f0-9]+\.woff2$/.test(file));
    expect(common).toHaveLength(2);
    expect(common.reduce((sum, file) => sum + statSync(path.join(ROOT, "public", file)).size, 0)).toBeLessThan(850000);
    expect(readFileSync(path.join(ROOT, "public/fonts/WantedSans-OFL.txt"), "utf8")).toContain("SIL Open Font License");
  });

  it("uses Wanted Sans for body and display hierarchy", () => {
    expect(css).toContain("--font-sans: var(--font-wanted-sans)");
    expect(css).not.toMatch(/--font-display\s*:/);
    expect(css).not.toMatch(/var\(--font-display\)/);
  });

  it("keeps mono limited to the numeric and code override", () => {
    expect(css.match(/var\(--font-mono\)/g)).toHaveLength(1);
    expect(css).toMatch(/:where\(pre, code, kbd, samp, \.mono, \.tnum, \.kpi-card \.value\)/);
  });

  it("raises shared body and Korean metadata sizes", () => {
    expect(css).toContain("--type-body: 14px");
    expect(css).toContain("--type-meta: 11px");
    expect(css).toMatch(/table\.data thead th[\s\S]*font-size:\s*11px/);
  });
});
