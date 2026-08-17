import { describe, expect, it } from "vitest";

import { getAllTerms } from "@/lib/glossary";

/**
 * 용어집 FAQ 계약.
 *
 * 용어집에 실제로 들어오는 쿼리는 "리텐션 뜻"·"d30 리텐션"처럼 이미 질문이다.
 * FAQ는 그 질문에 그대로 답해 FAQPage 구조화 데이터로 나가는 자리이므로,
 * 형태가 깨지면 리치결과에서 통째로 빠진다.
 *
 * 여기서 "전 용어가 FAQ를 가져야 한다"고 강제하지는 않는다 — 짧은 정의만으로
 * 충분한 용어가 있고, 억지로 채우면 답이 아니라 분량이 된다(§8). 대신 **있는
 * FAQ가 쓸모 있는 형태인지**를 검사한다.
 */
describe.each(["ko", "en"])("용어집 FAQ (%s)", (locale) => {
  const terms = getAllTerms(locale);
  const withFaq = terms.filter((term) => term.faq.length > 0);

  it("FAQ를 가진 용어가 실제로 존재한다", () => {
    // 로더가 깨져 전부 빈 배열이 되면 아래 검사가 공허하게 통과한다.
    expect(withFaq.length).toBeGreaterThan(0);
  });

  it("질문은 물음표로 끝나고 답은 문장으로 쓴다", () => {
    for (const term of withFaq) {
      for (const item of term.faq) {
        expect(item.q.trim(), `${term.slug} 질문 비어 있음`).toBeTruthy();
        expect(item.q.trim().endsWith("?"), `${term.slug}: "${item.q}"`).toBe(true);
        const minAnswer = locale === "en" ? 60 : 40;
        expect(item.a.trim().length, `${term.slug} 답이 너무 짧음: "${item.a}"`).toBeGreaterThanOrEqual(minAnswer);
      }
    }
  });

  it("한 용어 안에서 질문이 중복되지 않는다", () => {
    for (const term of withFaq) {
      const questions = term.faq.map((item) => item.q.trim());
      expect(new Set(questions).size, `${term.slug} 질문 중복`).toBe(questions.length);
    }
  });

  // KR이 주 시장인데 EN만 배선되는 역전이 이 저장소에서 반복됐다(§7).
  it("FAQ를 가진 용어는 KO·EN 짝이 맞는다", () => {
    const other = getAllTerms(locale === "ko" ? "en" : "ko");
    const otherWithFaq = new Set(other.filter((term) => term.faq.length > 0).map((term) => term.slug));
    const missing = withFaq.map((term) => term.slug).filter((slug) => !otherWithFaq.has(slug));
    expect(missing, `짝 로케일에 FAQ 없음: ${missing.join(", ")}`).toEqual([]);
  });
});
