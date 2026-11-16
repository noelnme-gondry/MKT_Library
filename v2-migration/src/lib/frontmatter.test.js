import { describe, expect, it } from "vitest";
import parseFrontmatter from "./frontmatter";

describe("Markdown YAML frontmatter", () => {
  it("preserves typed metadata, nested FAQs and the exact body", () => {
    const result = parseFrontmatter("\uFEFF---\r\ntitle: '한글: 제목'\r\ndraft: false\r\ntags: [CPA, ROAS]\r\nfaq:\r\n  - q: Why?\r\n    a: Because.\r\n---\r\n\r\n## Body\r\n---\r\n");
    expect(result.data).toEqual({ title: "한글: 제목", draft: false, tags: ["CPA", "ROAS"], faq: [{ q: "Why?", a: "Because." }] });
    expect(result.content).toBe("\r\n## Body\r\n---\r\n");
  });

  it("does not treat body delimiters as frontmatter", () => {
    expect(parseFrontmatter("Body\n---\ntitle: text")).toEqual({ data: {}, content: "Body\n---\ntitle: text" });
    expect(parseFrontmatter("---\n---\nBody")).toEqual({ data: {}, content: "Body" });
  });

  it("fails on incomplete or non-mapping metadata instead of losing content", () => {
    expect(() => parseFrontmatter("---\ntitle: no end")).toThrow(SyntaxError);
    expect(() => parseFrontmatter("---\n- item\n---\nBody")).toThrow(TypeError);
  });

  it("does not enable executable YAML tags or duplicate keys", () => {
    expect(() => parseFrontmatter("---\nvalue: !!js/function 'function () {}'\n---\nBody")).toThrow();
    expect(() => parseFrontmatter("---\ntitle: first\ntitle: second\n---\nBody")).toThrow();
  });
});
