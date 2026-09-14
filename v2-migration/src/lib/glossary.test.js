import { describe, expect, it } from "vitest";
import { getAllTerms, getTermBySlug } from "./glossary";

// 설명의 내부 편집 예산. 검색엔진의 고정 글자 수 제한이 아니다.
// 제목은 searchTitleTerms와 본문 정합으로 검증한다. 30자 상한 때문에
// 정식 영문 용어를 제거했던 회귀를 다시 강제하지 않는다.
const LIMITS = {
  ko: { description: 80 },
  en: { description: 155 },
};

describe("glossary entity and SEO titles", () => {
  it("keeps a formal DefinedTerm name separate from a search-result title", () => {
    const term = getTermBySlug("multicollinearity");
    expect(term.term).toBe("다중공선성 (Multicollinearity)");
    expect(term.seoTitle).toBe("다중공선성 뜻 | VIF로 MMM 전에 확인하는 법");
  });

  it("keeps the English entity name separate from its question-form SEO title", () => {
    const term = getTermBySlug("uplift", "en");
    expect(term.term).toBe("Uplift");
    expect(term.seoTitle).toBe("What Is Uplift? Measure Incremental Ad Impact with a Holdout");
  });

  it("keeps Korean search spelling variants on the matching definitions", () => {
    const holdout = getTermBySlug("holdout-test");
    const deepLink = getTermBySlug("deep-link");

    expect(`${holdout.seoTitle} ${holdout.keywords} ${holdout.html}`).toContain("홀드 아웃");
    expect(`${deepLink.seoTitle} ${deepLink.keywords} ${deepLink.html}`).toContain("디퍼드딥링크");
  });
});

describe.each(["ko", "en"])("glossary SERP budget (%s)", (locale) => {
  const terms = getAllTerms(locale);
  const limit = LIMITS[locale];

  it("publishes at least one term", () => {
    expect(terms.length).toBeGreaterThan(0);
  });

  it("normalizes freshness and editorial metadata for every term", () => {
    for (const term of terms) {
      expect(typeof term.updated).toBe("string");
      expect(typeof term.reviewedAt).toBe("string");
      expect(typeof term.reviewer).toBe("string");
      expect(Array.isArray(term.sources)).toBe(true);
    }
  });

  it.each(terms.map((t) => [t.slug, t]))("%s keeps an explicit search title", (_slug, term) => {
    expect(term.seoTitle.trim()).not.toBe("");
    expect(term.seoTitle).not.toContain("Growth Opt Playbook");
  });

  it.each(terms.map((t) => [t.slug, t]))("%s keeps its description within budget", (_slug, term) => {
    expect(term.description).not.toBe("");
    expect(term.description.length).toBeLessThanOrEqual(limit.description);
  });
});
