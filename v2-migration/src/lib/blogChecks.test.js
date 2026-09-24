import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getAllPosts } from "@/lib/blog";
import { BLOG_INSIGHT_EXCLUSIONS, BLOG_INSIGHT_PLACEMENTS } from "@/lib/blogInsightRegistry";
import { PUBLISHED_BLOG_TOOL_MAP } from "@/lib/contentToolRegistry";
import { BLOG_SELF_CHECKS, blogSelfCheckFor } from "@/lib/blogSelfCheck";
import { blogSituationCheckFor } from "@/lib/blogSituationCheck";
import { hasEnVersion, idToSlug, slugToId } from "@/lib/routeMap";
import { EN_BLOG_SLUGS } from "@/lib/localizedHref";

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const published = getAllPosts("ko").map((post) => post.slug);

// 글 속 넛지 계약(시안 A·B·D): 발행 글 전부가 파생 목록에서 빠짐없이 덮여야 한다.
// 손으로 쓴 목록을 돌지 않는다 — 발행 글에서 파생한다(§7 가드는 파생이어야 한다).
describe("blog nudges cover every published post", () => {
  it("found a realistic number of published posts", () => {
    expect(published.length).toBeGreaterThan(40);
  });

  it("every published post gets either the example card (A) or the self-check (D)", () => {
    for (const slug of published) {
      const a = Boolean(BLOG_INSIGHT_PLACEMENTS[slug]);
      const d = Boolean(BLOG_SELF_CHECKS[slug]);
      expect(a || d, slug).toBe(true);
      expect(a && d, `${slug} should not get both`).toBe(false);
    }
  });

  it("every excluded (non-CSV) post has a self-check with two questions and four outcomes in both languages", () => {
    for (const slug of Object.keys(BLOG_INSIGHT_EXCLUSIONS)) {
      for (const locale of ["ko", "en"]) {
        const check = blogSelfCheckFor(slug, locale);
        expect(check, `${slug} ${locale}`).toBeTruthy();
        expect(check.questions).toHaveLength(2);
        expect(Object.keys(check.results).sort()).toEqual(["nn", "ny", "yn", "yy"]);
        for (const [verdict, detail] of Object.values(check.results)) {
          expect(verdict).toMatch(/\S/);
          expect(detail).toMatch(/\S/);
        }
      }
    }
  });

  it("every published post ends with a situation check (B) whose three targets exist in both languages", () => {
    for (const slug of published) {
      for (const locale of ["ko", "en"]) {
        const check = blogSituationCheckFor(slug, PUBLISHED_BLOG_TOOL_MAP[slug], locale);
        expect(check, `${slug} ${locale}`).toBeTruthy();
        expect(check.options).toHaveLength(3);
        for (const option of check.options) {
          expect(Boolean(option.tool) !== Boolean(option.path), `${slug}: one target`).toBe(true);
          if (option.tool) {
            expect(idToSlug[option.tool], `${slug} → ${option.tool}`).toBeTruthy();
            if (locale === "en") expect(hasEnVersion(option.tool), `${slug} EN → ${option.tool}`).toBe(true);
            continue;
          }
          const [, section, name] = option.path.split("/");
          if (section === "blog") {
            expect(published, `${slug} → ${option.path}`).toContain(name);
            if (locale === "en") expect(EN_BLOG_SLUGS.has(name), `${slug} EN → ${option.path}`).toBe(true);
          } else if (section === "glossary") {
            expect(existsSync(root(`content/${locale === "en" ? "glossary-en" : "glossary"}/${name}.md`)), option.path).toBe(true);
          } else {
            const id = slugToId[option.path.replace(/^\//, "")];
            expect(id, option.path).toBeTruthy();
            if (locale === "en") expect(hasEnVersion(id), `EN ${option.path}`).toBe(true);
          }
        }
      }
    }
  });
});
