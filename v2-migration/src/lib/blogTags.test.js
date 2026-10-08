import { describe, expect, it } from "vitest";
import { getAllTags, getPostsByTag } from "./blog";
import { legacyBlogTagRedirects } from "./blogTags.mjs";

const rules = legacyBlogTagRedirects();
const destination = path => rules.find(rule => decodeURIComponent(rule.source) === path)?.destination;

describe("retired blog tags preserve their topic", () => {
  it.each([
    ["iOS", "매체·운영"],
    ["MMM", "측정·분석"],
    ["예산-배분", "예산·효율"],
    ["광고-소재", "소재·크리에이티브"],
    ["타겟·오디언스", "타겟·퍼널"],
    ["커리어·성장", "성장·커리어"],
    ["AI·자동화", "성장·커리어"],
  ])("moves %s to a populated %s category", (legacy, category) => {
    const path = destination(`/blog/tag/${legacy}`);
    expect(decodeURIComponent(path)).toBe(`/blog/tag/${category}`);
    expect(getPostsByTag(path.split("/").pop()).length).toBeGreaterThan(0);
  });
  it("keeps every current category terminal and unknown tags unresolved", () => {
    for (const tag of getAllTags()) expect(destination(`/blog/tag/${tag.slug}`)).toBeUndefined();
    expect(destination("/blog/tag/not-a-real-topic")).toBeUndefined();
    expect(rules.every(rule => !rule.source.includes(":"))).toBe(true);
    expect(new Set(rules.map(rule => rule.source)).size).toBe(rules.length);
  });
  it("follows the existing English tag fallback and dropped-tag contract", () => {
    expect(destination("/en/blog/tag/iOS")).toBe("/en/blog");
    expect(destination("/en/blog/tag/Budget-Allocation")).toBe("/en/blog");
    expect(destination("/blog/tag/퍼포먼스-마케팅")).toBe("/blog");
  });
});
