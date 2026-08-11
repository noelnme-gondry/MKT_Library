import Link from "next/link";

const COPY = {
  ko: {
    eyebrow: "근거 읽기",
    title: "이 분석의 판단 기준을 더 알아보기",
    intro: "결론을 해석할 때 필요한 실무 맥락과 핵심 개념을 종류별로 모았습니다.",
    post: "실무 가이드",
    term: "핵심 용어",
    postDescription: "판단을 실제 운영에 적용하는 방법",
    termDescription: "분석에 쓰인 모델·측정 개념",
    count: (value) => `${value}개`,
  },
  en: {
    eyebrow: "Background reading",
    title: "Learn the reasoning behind this analysis",
    intro: "Practical context and core concepts are separated so you can find the evidence you need quickly.",
    post: "Guide",
    term: "Key glossary terms",
    postDescription: "How to apply the judgment in practice",
    termDescription: "Model and measurement concepts used here",
    count: (value) => `${value} item${value === 1 ? "" : "s"}`,
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
      description: T.postDescription,
      items: items.filter((item) => item.type !== "term"),
    },
    {
      key: "term",
      title: T.term,
      description: T.termDescription,
      items: items.filter((item) => item.type === "term"),
    },
  ].filter((group) => group.items.length > 0);

  return <aside className="tool-evidence" aria-labelledby="tool-evidence-title">
    <header className="tool-evidence__header">
      <span className="tool-evidence__eyebrow">{T.eyebrow}</span>
      <h2 id="tool-evidence-title">{T.title}</h2>
      <p>{T.intro}</p>
    </header>
    <div className="tool-evidence__groups">
      {groups.map((group) => <section className={`tool-evidence__group tool-evidence__group--${group.key}`} key={group.key} aria-labelledby={`tool-evidence-${group.key}-title`}>
        <div className="tool-evidence__group-head">
          <div>
            <strong id={`tool-evidence-${group.key}-title`}>{group.title}</strong>
            <span>{group.description}</span>
          </div>
          <small>{T.count(group.items.length)}</small>
        </div>
        <ul className="tool-evidence__list">
          {group.items.map((item) => <li key={item.href}>
            <Link href={item.href}>
              <span className="tool-evidence__link-copy">
                <strong>{item.title}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              <span className="tool-evidence__arrow" aria-hidden="true">→</span>
            </Link>
          </li>)}
        </ul>
      </section>)}
    </div>
  </aside>;
}
