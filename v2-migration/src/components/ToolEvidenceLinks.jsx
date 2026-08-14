import Link from "next/link";

const COPY = {
  ko: {
    title: "관련 가이드와 용어",
    post: "실무 가이드",
    term: "핵심 용어",
    compare: "이 방법을 써야 하나",
    tool: "내 데이터로 확인하기",
  },
  en: {
    title: "Related guides and terms",
    post: "Guide",
    term: "Key glossary terms",
    compare: "Should you use this method",
    tool: "Check this with your data",
  },
};

// 도구 → 콘텐츠 역링크. 링크 목록은 서버(page.js)에서 `toolContentLinks` 역인덱스로
// 만들어 props로 내려온다(블로그·용어 로더가 server 전용이라 클라이언트 import 금지).
export default function ToolEvidenceLinks({ items = [], locale = "ko" }) {
  if (!items.length) return null;
  const T = COPY[locale === "en" ? "en" : "ko"];
  // 가이드에서는 "읽었으니 이제 내 데이터로 확인" 링크가 가장 앞이다. 이 그룹이
  // 생기기 전까지 가이드 15개는 도구로 나가는 링크가 하나도 없는 막다른 페이지였다.
  // 비교 그룹은 그다음 — "이 도구를 써야 하나"가 "어떻게 쓰나"보다 앞선다.
  const groups = [
    {
      key: "tool",
      title: T.tool,
      items: items.filter((item) => item.type === "tool"),
    },
    {
      key: "compare",
      title: T.compare,
      items: items.filter((item) => item.type === "compare"),
    },
    {
      key: "post",
      title: T.post,
      items: items.filter((item) => item.type !== "term" && item.type !== "compare" && item.type !== "tool"),
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
