import { describe, expect, it } from "vitest";

import { getAllPosts } from "@/lib/blog";
import { splitArticleForAction, topLevelBoundaries } from "@/lib/blogArticleSplit";

const para = (n) => `<p>본문 ${n}. ${"가".repeat(60)}</p>\n`;
const longArticle = (count = 14) => Array.from({ length: count }, (_, i) => para(i + 1)).join("");

describe("splitArticleForAction", () => {
  it("marker wins over the derived position", () => {
    const html = `${para(1)}<!-- CONTENT_ACTION -->${para(2)}`;
    const result = splitArticleForAction(html);
    expect(result.source).toBe("marker");
    expect(result.before).toBe(para(1));
    expect(result.after).toBe(para(2));
    expect(result.before + result.after).not.toContain("CONTENT_ACTION");
  });

  it("splits a long article without a marker at a top-level block boundary", () => {
    const html = longArticle();
    const result = splitArticleForAction(html);
    expect(result.source).toBe("auto");
    expect(result.before + result.after).toBe(html);
    expect(result.before.endsWith("</p>\n")).toBe(true);
    expect(result.after.startsWith("<p>")).toBe(true);
  });

  it("leaves short articles alone — the outro CTA is already on screen", () => {
    const result = splitArticleForAction(longArticle(4));
    expect(result.source).toBe("none");
    expect(result.after).toBe("");
  });

  it("keeps at least three blocks after the panel", () => {
    const html = longArticle(10);
    const { before, after } = splitArticleForAction(html);
    expect(topLevelBoundaries(after).length).toBeGreaterThanOrEqual(3);
    expect(before.length).toBeGreaterThan(0);
  });

  it("prefers a boundary that leads into an h2 section", () => {
    const html = `${para(1)}${para(2)}${para(3)}${para(4)}${para(5)}<h2>다음 섹션</h2>\n${para(6)}${para(7)}${para(8)}${para(9)}`;
    const result = splitArticleForAction(html);
    expect(result.after.startsWith("<h2>다음 섹션</h2>")).toBe(true);
  });

  // 중첩 </p>에서 자르면 <li>가 열린 채 끊긴다 — depth를 세지 않으면 통과하는 케이스.
  it("never cuts inside a nested block", () => {
    const nested = `<ul>${Array.from({ length: 6 }, (_, i) => `<li><p>항목 ${i}</p></li>`).join("")}</ul>\n`;
    const html = `${para(1)}${para(2)}${nested}${para(3)}${para(4)}${para(5)}${para(6)}${para(7)}${para(8)}${para(9)}`;
    const { before } = splitArticleForAction(html);
    const opened = (before.match(/<ul>/g) || []).length;
    const closed = (before.match(/<\/ul>/g) || []).length;
    expect(opened).toBe(closed);
  });

  it("is deterministic", () => {
    const html = longArticle();
    expect(splitArticleForAction(html)).toEqual(splitArticleForAction(html));
  });

  it("handles empty and null input", () => {
    expect(splitArticleForAction("")).toEqual({ before: "", after: "", source: "none" });
    expect(splitArticleForAction(null)).toEqual({ before: "", after: "", source: "none" });
  });
});

// 이 가드가 이 파일의 존재 이유다. 예전 계약(마커 수기 삽입)에서는 발행 글 48편 중
// 14편에만 중간 행동 경로가 있었고, 그 사실을 잡는 검사가 없었다(손으로 쓴 감사 목록
// 3편만 검사). 개수를 적지 말고 발행 글 전체에서 파생한다.
describe("published articles all carry a mid-article action slot", () => {
  for (const locale of ["ko", "en"]) {
    it(`${locale}: every post splits into before/after`, () => {
      const posts = getAllPosts(locale);
      expect(posts.length).toBeGreaterThan(20);
      const missing = posts.filter((post) => !splitArticleForAction(post.html).after);
      expect(missing.map((post) => post.slug)).toEqual([]);
    });

    it(`${locale}: the split never loses or duplicates body content`, () => {
      for (const post of getAllPosts(locale)) {
        const { before, after } = splitArticleForAction(post.html);
        expect(before + after).toBe(post.html.replace("<!-- CONTENT_ACTION -->", ""));
      }
    });
  }
});
