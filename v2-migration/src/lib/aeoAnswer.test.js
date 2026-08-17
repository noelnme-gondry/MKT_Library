import { describe, expect, it } from "vitest";
import { getAllPosts } from "./blog";
import { getBlogSeo } from "./blogSeo";

/**
 * AEO 답변 가드.
 *
 * 배경: 블로그 상단 "검색 질문에 대한 짧은 답"(`seoAnswer`)은 AI 검색·발췌가 그대로
 * 인용하는 블록이다. 그런데 답변들이 핵심어를 **일부러 우회해 풀어 쓰고** 있었다 —
 * `correlation-vs-causation`의 답변에는 "상관관계"도 "인과관계"도 없었고
 * (EN도 correlation·causation 둘 다 없음), `asa-keyword-expansion`에는 "ASA"가,
 * `attribution-data-mismatch`에는 "어트리뷰션"이 없었다.
 *
 * 찾는 말이 답변에 없으면 그 질의로 인용될 확률이 떨어진다. 그래서 검사는 하나다 —
 * **제목이 내세운 핵심어가 답변 본문에 실제로 등장하는가.**
 *
 * 목록은 발행 글에서 파생한다(§7). 새 글은 자동으로 검사 대상이 된다.
 */

// 제목에서 핵심어를 뽑을 때 걸러낼 기능어. 이 단어들은 어느 글에나 있어 변별력이 없다.
const KO_STOPWORDS = new Set(["가이드", "방법", "차이", "기준", "원인", "진단", "분석", "이란", "무엇", "까지", "부터", "때문", "이유", "순서", "법은", "보는", "읽는", "찾는", "하는", "위한", "전에", "쓰는"]);
const EN_STOPWORDS = new Set(["the", "a", "an", "of", "to", "and", "for", "with", "how", "what", "why", "vs", "your", "you", "when", "does", "do", "is", "are", "in", "on", "it", "that", "guide", "explained"]);

// 제목의 부제(콜론 뒤)는 부연이라 핵심어에서 뺀다 — 앞부분이 그 글이 노리는 질의다.
function headTerms(title, locale) {
  const head = String(title).split(/[:：]/)[0];
  if (locale === "en") {
    return [...new Set(head.match(/[A-Za-z][A-Za-z0-9+.]{1,}/g) || [])]
      .filter((word) => !EN_STOPWORDS.has(word.toLowerCase()));
  }
  return [...new Set(head.match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9+.]{1,}/g) || [])]
    // 한국어는 조사가 붙으므로 어간 2자 이상만 남겨 부분일치로 본다.
    .filter((word) => !KO_STOPWORDS.has(word) && word.length > 1);
}

// 한국어는 "상관관계와" 처럼 조사가 붙어 나오므로 어간 포함 여부로 판정한다.
function mentions(answer, term, locale) {
  const haystack = answer.toLowerCase();
  const needle = term.toLowerCase();
  if (locale === "en") return haystack.includes(needle);
  if (haystack.includes(needle)) return true;
  // 조사·활용이 붙은 형태를 흡수: 2자 이상 어간이 답변에 있으면 언급으로 본다.
  const stem = needle.length > 3 ? needle.slice(0, -1) : needle;
  return haystack.includes(stem);
}

for (const locale of ["ko", "en"]) {
  describe(`AEO 답변 (${locale})`, () => {
    const posts = getAllPosts(locale);

    it("발행 글을 실제로 수집한다", () => {
      // 로더가 깨지면 0편이 되고 아래 검사가 공허하게 통과한다.
      expect(posts.length).toBeGreaterThan(30);
    });

    it("모든 글이 검색 답변을 갖는다", () => {
      const missing = posts.filter((post) => !post.seoAnswer).map((post) => post.slug);
      expect(missing, `seoAnswer 없음:\n${missing.join("\n")}`).toEqual([]);
    });

    it("제목이 내세운 핵심어가 답변 안에 등장한다", () => {
      const offenders = [];
      for (const post of posts) {
        const title = getBlogSeo(locale, post.slug)?.title || post.title;
        const terms = headTerms(title, locale);
        if (!terms.length) continue;
        const hit = terms.filter((term) => mentions(post.seoAnswer, term, locale));
        // 핵심어를 하나도 안 담은 답변은 그 질의로 인용될 여지가 거의 없다.
        if (!hit.length) offenders.push(`${post.slug}: "${title}" → 답변에 ${terms.join("·")} 없음`);
      }
      expect(offenders, `핵심어가 빠진 AEO 답변:\n${offenders.join("\n")}`).toEqual([]);
    });
  });
}
