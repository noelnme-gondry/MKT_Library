import { describe, expect, it } from "vitest";
import { getAllTerms } from "./glossary";
import { getAllPosts } from "./blog";

// 검증 대상은 발행 원고에서 파생한다. searchTitleTerms는 편집자가 선택한
// 핵심 개념이며 유입 수치나 제목 사본이 아니다. 모든 동의어를 강제하지 않는다.
describe.each(["ko", "en"])("published search concepts (%s)", (locale) => {
  const records = [
    ...getAllTerms(locale).map(term => ({ ...term, kind: "glossary", title: term.seoTitle, evidence: `${term.term} ${term.shortDef} ${term.html}` })),
    ...getAllPosts(locale).map(post => ({ ...post, kind: "blog", evidence: post.seoAnswer })),
  ];

  it("keeps distinct titles and validates explicit concept contracts", () => {
    const titles = records.map(record => record.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    // 초기 복원 범위 5개 용어 + 2개 글. 로더에서 필드를 빠뜨리면 0건 통과 금지.
    expect(records.filter(record => record.searchTitleTerms.length).length).toBeGreaterThanOrEqual(7);
    for (const record of records) {
      expect(Array.isArray(record.searchTitleTerms), record.slug).toBe(true);
      for (const concept of record.searchTitleTerms) {
        expect(typeof concept, record.slug).toBe("string");
        expect(concept.trim(), record.slug).not.toBe("");
        expect(record.title.toLowerCase(), `${record.kind}/${record.slug}: title`).toContain(concept.toLowerCase());
        expect(record.evidence.toLowerCase(), `${record.kind}/${record.slug}: visible explanation`).toContain(concept.toLowerCase());
      }
    }
  });
});
