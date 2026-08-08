import { describe, expect, it } from "vitest";
import { getTermBySlug } from "./glossary";

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
});
