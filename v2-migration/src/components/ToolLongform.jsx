import { getToolSearchContent } from "@/lib/toolSearchContent";

export default function ToolLongform({ toolId, locale = "ko" }) {
  const localeKey = locale === "en" ? "en" : "ko";
  const content = getToolSearchContent(toolId, localeKey);
  if (!content) return null;

  return <section className="tool-longform" aria-labelledby={`tool-longform-${toolId}`}>
    <span className="tool-longform__eyebrow">{content.eyebrow}</span>
    <h2 id={`tool-longform-${toolId}`}>{content.title}</h2>
    <p className="tool-longform__lead">{content.lead}</p>
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
  </section>;
}
