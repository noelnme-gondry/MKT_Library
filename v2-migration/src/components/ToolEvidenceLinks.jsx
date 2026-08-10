import Link from "next/link";

const COPY = {
  ko: {
    eyebrow: "근거 읽기",
    title: "이 분석의 판단 기준을 더 알아보기",
    post: "실무 가이드",
    term: "용어",
  },
  en: {
    eyebrow: "Background reading",
    title: "Learn the reasoning behind this analysis",
    post: "Guide",
    term: "Glossary",
  },
};

// 도구 → 콘텐츠 역링크. 링크 목록은 서버(page.js)에서 `toolContentLinks` 역인덱스로
// 만들어 props로 내려온다(블로그·용어 로더가 server 전용이라 클라이언트 import 금지).
export default function ToolEvidenceLinks({ items = [], locale = "ko" }) {
  if (!items.length) return null;
  const T = COPY[locale === "en" ? "en" : "ko"];

  return <aside className="tool-evidence" aria-labelledby="tool-evidence-title">
    <span className="tool-evidence__eyebrow">{T.eyebrow}</span>
    <h2 id="tool-evidence-title">{T.title}</h2>
    <ul className="tool-evidence__list">
      {items.map((item) => <li key={item.href}>
        <Link href={item.href}>
          <span>{item.type === "term" ? T.term : T.post}</span>
          <strong>{item.title}</strong>
          {item.description ? <small>{item.description}</small> : null}
        </Link>
      </li>)}
    </ul>
  </aside>;
}
