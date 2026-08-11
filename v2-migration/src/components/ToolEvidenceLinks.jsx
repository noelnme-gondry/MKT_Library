import Link from "next/link";

const COPY = {
  ko: {
    title: "관련 가이드와 용어",
    post: "실무 가이드",
    term: "핵심 용어",
  },
  en: {
    title: "Related guides and terms",
    post: "Guide",
    term: "Key glossary terms",
  },
};

// 도구 → 콘텐츠 역링크. 링크 목록은 서버(page.js)에서 `toolContentLinks` 역인덱스로
// 만들어 props로 내려온다(블로그·용어 로더가 server 전용이라 클라이언트 import 금지).
export default function ToolEvidenceLinks({ items = [], locale = "ko" }) {
  if (!items.length) return null;
  const T = COPY[locale === "en" ? "en" : "ko"];
  const groups = [
    {
      key: "post",
      title: T.post,
      items: items.filter((item) => item.type !== "term"),
    },
    {
      key: "term",
      title: T.term,
      items: items.filter((item) => item.type === "term"),
    },
  ].filter((group) => group.items.length > 0);

  return <aside className="tool-evidence" aria-labelledby="tool-evidence-title">
    <header className="tool-evidence__header">
      <h2 id="tool-evidence-title">{T.title}</h2>
    </header>
    <div className="tool-evidence__groups">
      {groups.map((group) => <section className={`tool-evidence__group tool-evidence__group--${group.key}`} key={group.key} aria-labelledby={`tool-evidence-${group.key}-title`}>
        <div className="tool-evidence__group-head">
          <strong id={`tool-evidence-${group.key}-title`}>{group.title}</strong>
        </div>
        <ul className="tool-evidence__list">
          {group.items.map((item) => <li key={item.href}>
            <Link href={item.href}>
              <span className="tool-evidence__link-copy">
                <strong>{item.title}</strong>
              </span>
              <span className="tool-evidence__arrow" aria-hidden="true">→</span>
            </Link>
          </li>)}
        </ul>
      </section>)}
    </div>
  </aside>;
}
