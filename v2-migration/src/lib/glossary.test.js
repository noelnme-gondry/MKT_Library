import { describe, expect, it } from "vitest";
import { getAllTerms, getTermBySlug } from "./glossary";

// 검색결과 제목·설명 길이 예산. 상세 라우트가 title을 absolute로 내보내므로
// 브랜드 접미(" | Growth Opt Playbook")는 붙지 않고, 아래 값이 곧 노출 길이다.
// KO 30자는 네이버 웹사이트 컬렉션 잘림선, KO 80자는 그 스니펫 길이 기준.
const LIMITS = {
  ko: { title: 30, description: 80 },
  en: { title: 60, description: 155 },
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

  // seoTitle이 비면 라우트가 "term 뜻 — 용어사전" 폴백을 쓰는데, 그러면 정식
  // 엔티티명(영문 풀네임 괄호 포함)이 그대로 제목 앞자리를 먹어 잘린다.
  it.each(terms.map((t) => [t.slug, t]))("%s keeps its search title within budget", (_slug, term) => {
    expect(term.seoTitle).not.toBe("");
    expect(term.seoTitle.length).toBeLessThanOrEqual(limit.title);
  });

  it.each(terms.map((t) => [t.slug, t]))("%s keeps its description within budget", (_slug, term) => {
    expect(term.description).not.toBe("");
    expect(term.description.length).toBeLessThanOrEqual(limit.description);
  });
});
