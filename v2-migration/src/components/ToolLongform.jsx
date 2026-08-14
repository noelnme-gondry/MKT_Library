import { getToolSearchContent } from "@/lib/toolSearchContent";

// 분석 종료 경계선은 `ToolPageOutro`가 소유한다. 여기서는 참고 자료 한 덩어리만
// 담당하고, 바깥 묶음 박스 안에서는 자기 테두리를 그리지 않는다(박스 중첩 방지).
export default function ToolLongform({ toolId, locale = "ko" }) {
  const localeKey = locale === "en" ? "en" : "ko";
  const sectionTitle = localeKey === "en" ? "Method and FAQ" : "판단 기준과 FAQ";
  const content = getToolSearchContent(toolId, localeKey);
  if (!content) return null;

  return <section className="tool-longform" aria-labelledby={`tool-longform-${toolId}`}>
    {/* 이 도구가 답하는 질문과 한 문장 답을 접기 **바깥**에 둔다. 방법론은 필요할 때만
        펼치면 되지만, "이걸로 뭘 하나"는 펼치기 전에 읽혀야 한다. 5-18 하위 화면은
        폴백 콘텐츠라 두 필드가 없을 수 있어 있을 때만 그린다. */}
    {content.question && content.answer ? <div className="tool-longform__answer">
      <p className="tool-longform__question">{content.question}</p>
      <p>{content.answer}</p>
    </div> : null}
    <details className="tool-longform__disclosure">
      <summary className="tool-longform__summary">
        <span id={`tool-longform-${toolId}`} className="tool-longform__title" role="heading" aria-level="2">{sectionTitle}</span>
        <span className="tool-longform__hint">{localeKey === "en" ? "Open only when you need the methodology" : "필요할 때만 펼쳐보세요"}</span>
      </summary>
      <div className="tool-longform__content">
        <details className="tool-longform__details">
          <summary>{content.detailsLabel}</summary>
          <div className="tool-longform__body">
            {content.sections.map(([title, body]) => <section key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </section>)}
          </div>
        </details>
        {content.faq?.length ? <section className="tool-longform__faq" aria-labelledby={`tool-longform-faq-${toolId}`}>
          <h3 id={`tool-longform-faq-${toolId}`}>{localeKey === "en" ? "Frequently asked questions" : "자주 묻는 질문"}</h3>
          {content.faq.map((item) => <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>)}
        </section> : null}
      </div>
    </details>
  </section>;
}
