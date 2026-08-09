import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shellFiles = [
  "(ko)/[[...slug]]/PageClient.jsx",
  "(en)/en/[...slug]/PageClient.jsx",
  "(en)/en/page.js",
  "(ko)/blog/layout.js",
  "(en)/en/blog/layout.js",
  "(ko)/glossary/layout.js",
  "(en)/en/glossary/layout.js",
  "(en)/en/guide/layout.js",
  "(ko)/diagnose/layout.js",
  "(en)/en/diagnose/layout.js",
  "(ko)/weekly-review/layout.js",
  "(en)/en/weekly-review/layout.js",
];

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

describe("shared application-shell semantics", () => {
  it.each(shellFiles)("keeps the global banner outside main in %s", (relativePath) => {
    const source = readFileSync(`${appDirectory}${relativePath}`, "utf8");
    const headerIndex = source.indexOf("<Header");
    const mainIndex = source.indexOf('<main id="main-content" tabIndex="-1"');
    expect(source).not.toMatch(/<main[^>]*className="main"/);
    expect(headerIndex).toBeGreaterThan(-1);
    expect(mainIndex).toBeGreaterThan(headerIndex);
  });
});
