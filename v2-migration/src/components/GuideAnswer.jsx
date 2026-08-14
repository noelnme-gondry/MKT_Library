import { getGuideSearchContent } from "@/lib/guideSearchContent";

// 가이드가 답하는 질문과 한 문장 답. LLM·검색은 페이지 앞쪽에서 답을 뽑으므로
// 접기 **바깥**, 본문 위에 둔다(§12.29). 같은 문자열이 FAQ JSON-LD의 첫 항목으로도
// 올라간다 — 두 곳이 갈리지 않게 SSOT는 `lib/guideSearchContent.js` 하나다.
export default function GuideAnswer({ guideId, locale = "ko" }) {
  const content = getGuideSearchContent(guideId, locale === "en" ? "en" : "ko");
  if (!content) return null;

  return (
    <section className="guide-answer" aria-labelledby={`guide-answer-${guideId}`}>
      <h2 id={`guide-answer-${guideId}`} className="guide-answer__question">
        {content.question}
      </h2>
      <p className="guide-answer__answer">{content.answer}</p>
    </section>
  );
}
