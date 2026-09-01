import { describe, expect, it } from "vitest";

import { getAllTerms } from "@/lib/glossary";

/**
 * 용어집 FAQ 계약.
 *
 * 용어집에 실제로 들어오는 쿼리는 "리텐션 뜻"·"d30 리텐션"처럼 이미 질문이다.
 * FAQ는 그 질문에 그대로 답하고 같은 내용이 FAQPage 구조화 데이터로 나가는
 * 자리다. 일반 사이트의 FAQ 리치결과를 보장하는 장치는 아니다.
 *
 * 한때 이 주석은 "전 용어가 FAQ를 가져야 한다고 강제하지 않는다"고 적혀 있었다.
 * 그 결과 기초 용어 19편(cpi·cpa·ctr·roas·funnel…)이 faq 0건으로 남아 FAQPage
 * JSON-LD 자체를 못 내보내고 있었다 — 상세 라우트가 term.faq가 비면 그 블록을
 * 통째로 생략하기 때문에, 검색·AI 인용 경로가 조용히 사라진 상태였다. 지금은
 * 45편 전부 채웠고, 아래 커버리지 검사가 그 상태를 고정한다.
 */
describe.each(["ko", "en"])("용어집 FAQ (%s)", (locale) => {
  const terms = getAllTerms(locale);
  const withFaq = terms.filter((term) => term.faq.length > 0);

  it("FAQ를 가진 용어가 실제로 존재한다", () => {
    // 로더가 깨져 전부 빈 배열이 되면 아래 검사가 공허하게 통과한다.
    expect(withFaq.length).toBeGreaterThan(0);
  });

  // 발행 목록에서 파생 — 슬러그를 손으로 나열하면 새 용어가 검사 밖으로 샌다(§7).
  it("발행된 용어는 전부 FAQ를 2건 이상 갖는다", () => {
    const missing = terms.filter((term) => term.faq.length < 2).map((term) => `${term.slug}(${term.faq.length})`);
    expect(missing, `FAQ 2건 미만: ${missing.join(", ")}`).toEqual([]);
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
