import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { getAllPosts } from "@/lib/blog";
import { getAllTerms } from "@/lib/glossary";

describe("published editorial table accessibility", () => {
  for (const locale of ["ko", "en"]) for (const [kind, read] of [["blog", getAllPosts], ["glossary", getAllTerms]]) {
    it(`${kind}/${locale} keeps every table in a focusable, labeled scroll region`, () => {
      let checked = 0;
      for (const entry of read(locale)) {
        const dom = new JSDOM(entry.html);
        for (const table of dom.window.document.querySelectorAll("table")) {
          checked += 1;
          const parent = table.parentElement;
          expect(parent.classList.contains("table-scroll"), entry.slug).toBe(true);
          expect(parent.getAttribute("role")).toBe("region");
          expect(parent.getAttribute("tabindex")).toBe("0");
          expect(parent.getAttribute("aria-label")).toBe(locale === "en" ? "Data table" : "데이터 표");
        }
        dom.window.close();
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});
