import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { getAllPosts, getPostBySlug } from "./blog";
import { BLOG_PRACTICES, blogPracticeFor } from "./blogPractice";
import { BLOG_INSIGHT_EXCLUSIONS, splitBlogInsight } from "./blogInsightRegistry";
import { buildBlogPracticeDownload, matchesBlogPracticeDemo } from "./blogPracticeData";
import { TOOL_GROUP } from "./toolGroups";

describe("optional blog practice", () => {
  it.each(["ko", "en"])("keeps %s narrative intact and places practice after the relevant concept", locale => {
    const concepts = locale === "ko"
      ? { "budget-scaling-limit": "판정 보류", "aso-basics-guide": "2. 전환", "apple-search-ads-guide": "CPT를 올리세요" }
      : { "budget-scaling-limit": "withheld", "aso-basics-guide": "2. Conversion", "apple-search-ads-guide": "Raise CPT" };
    for (const slug of Object.keys(BLOG_PRACTICES)) {
      const post = getPostBySlug(slug, locale);
      const practice = blogPracticeFor(slug, locale);
      const split = splitBlogInsight(post.html, slug);
      expect(split.before + split.after).toBe(post.html.replaceAll("<!-- CONTENT_ACTION -->", ""));
      const headings = [...split.before.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)];
      expect(headings.length).toBeGreaterThanOrEqual(3);
      expect(headings.at(-1)[1]).toContain(concepts[slug]);
      expect(post.html).not.toMatch(/같은 결과를 재현해 보세요|Reproduce the result/);
      expect(split.after).toMatch(/^<h2/);
      expect(practice.steps).toHaveLength(3);
      expect(practice.title).toBeTruthy();
      expect(practice.limit).toBeTruthy();
      const csv = Papa.parse(fs.readFileSync(path.join(process.cwd(), "public", practice.href), "utf8"), { header: true, skipEmptyLines: true });
      expect(csv.errors).toEqual([]);
      expect(csv.data.length).toBeGreaterThan(0);
    }
  });
  it.each(["ko", "en"])("covers all eligible %s posts with a real downloadable dataset and a reachable practice boundary", locale => {
    const posts = getAllPosts(locale);
    expect(posts.length).toBeGreaterThan(40);
    for (const post of posts) {
      const practice = blogPracticeFor(post.slug, locale);
      if (BLOG_INSIGHT_EXCLUSIONS[post.slug]) {
        expect(practice).toBeNull();
        continue;
      }
      const split = splitBlogInsight(post.html, post.slug);
      expect(practice, post.slug).toBeTruthy();
      expect(split, post.slug).toBeTruthy();
      expect(practice.title, post.slug).toBeTruthy();
      expect(split.before).toContain("<h2");
      if (!practice.demoGroup) continue; // Static editorial CSVs are verified above.
      expect(practice.demoGroup).toBe(TOOL_GROUP[split.config.toolId]);
      expect(practice.mode).toBe("detail");
      expect(practice.steps[2]).not.toMatch(/[:：]\s*\./);
      const download = buildBlogPracticeDownload(practice);
      const parsed = Papa.parse(download.text, { header: true, skipEmptyLines: true });
      expect(download.text).toMatch(/^\uFEFF/);
      expect(download.text).toContain("\r\n");
      expect(parsed.errors).toEqual([]);
      expect(parsed.data.length).toBeGreaterThan(0);
      expect(matchesBlogPracticeDemo(parsed, download.demo)).toBe(true);
      parsed.data[0][parsed.meta.fields[0]] += "changed";
      expect(matchesBlogPracticeDemo(parsed, download.demo)).toBe(false);
    }
  });
  it("does not offer a fabricated dataset on unknown or excluded posts", () => {
    expect(blogPracticeFor("unknown-post")).toBeNull();
    for (const slug of Object.keys(BLOG_INSIGHT_EXCLUSIONS)) expect(blogPracticeFor(slug)).toBeNull();
  });
});
