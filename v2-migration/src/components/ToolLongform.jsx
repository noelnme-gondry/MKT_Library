import { getToolSearchContent } from "@/lib/toolSearchContent";

export default function ToolLongform({ toolId, locale = "ko" }) {
  const localeKey = locale === "en" ? "en" : "ko";
  const sectionTitle = localeKey === "en" ? "Method and FAQ" : "판단 기준과 FAQ";
  const content = getToolSearchContent(toolId, localeKey);
  if (!content) return null;

  return <section className="tool-longform" aria-labelledby={`tool-longform-${toolId}`}>
    <div className="tool-longform__boundary">
      <span>{localeKey === "en" ? "End of analysis" : "분석 결과는 여기까지"}</span>
    </div>
    <details className="tool-longform__disclosure">
      <summary className="tool-longform__summary">
        <span className="tool-longform__eyebrow">{localeKey === "en" ? "Reference" : "참고 자료"}</span>
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
