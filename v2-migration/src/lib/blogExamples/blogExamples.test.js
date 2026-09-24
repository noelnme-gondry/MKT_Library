import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeBlogExamples } from "./compute";
import { BLOG_INSIGHT_PLACEMENTS } from "@/lib/blogInsightRegistry";

const DATA = fileURLToPath(new URL("./data.json", import.meta.url));

// 화면이 읽는 data.json은 엔진 결과의 사본이다. 엔진이나 데모가 바뀌면 이 테스트가
// 먼저 실패한다 — 옛 숫자가 글에 남아 있으면 그게 곧 거짓 숫자다(§8).
// 갱신: UPDATE_BLOG_EXAMPLES=1 npx vitest run src/lib/blogExamples
describe("blog example results (plan A)", () => {
  const computed = computeBlogExamples();

  it("data.json matches a fresh engine run", () => {
    const serialized = `${JSON.stringify(computed, null, 1)}\n`;
    if (process.env.UPDATE_BLOG_EXAMPLES) writeFileSync(DATA, serialized);
    expect(readFileSync(DATA, "utf8")).toBe(serialized);
  });

  it("every post with an inline analysis has an example", () => {
    const slugs = Object.keys(BLOG_INSIGHT_PLACEMENTS);
    expect(slugs.length).toBeGreaterThan(30);
    for (const slug of slugs) expect(computed[slug], slug).toBeTruthy();
  });

  it("every card says one thing in both languages and marks at most one bar", () => {
    for (const [slug, ex] of Object.entries(computed)) {
      for (const lang of ["ko", "en"]) {
        expect(ex[lang].headline, `${slug} ${lang}`).toMatch(/\S/);
        expect(ex[lang].caption, `${slug} ${lang}`).toMatch(lang === "ko" ? /예시 데이터/ : /example data/i);
      }
      expect(ex.bars.filter((b) => b.highlight).length, slug).toBeLessThanOrEqual(1);
      expect(ex.bars.length, slug).toBeLessThanOrEqual(5);
      for (const bar of ex.bars) expect(Number.isFinite(bar.value), `${slug} ${bar.label.ko}`).toBe(true);
    }
  });
});
