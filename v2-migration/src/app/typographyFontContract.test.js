import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { stripSourceComments } from "@/test-utils/stripSourceComments";

const ROOT = process.cwd();
const rootDocument = stripSourceComments(readFileSync(path.join(ROOT, "src/components/RootDocument.jsx"), "utf8"));
const css = stripSourceComments(readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8"));

describe("Korean typography contract", () => {
  it("self-hosts one Wanted Sans variable font with an explicit weight range", () => {
    expect(rootDocument).toContain('import localFont from "next/font/local"');
    expect(rootDocument).toContain('src: "../../public/fonts/WantedSansVariable.woff2"');
    expect(rootDocument).toContain('variable: "--font-wanted-sans"');
    expect(rootDocument).toContain('weight: "400 1000"');
    expect(rootDocument).not.toMatch(/DM_Sans|Space_Grotesk|Noto_Sans_KR/);
    expect(existsSync(path.join(ROOT, "public/fonts/WantedSansVariable.woff2"))).toBe(true);
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
