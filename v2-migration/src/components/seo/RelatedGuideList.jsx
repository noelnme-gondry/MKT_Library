import Link from "next/link";

// 글 하단 "운영 절차" 링크. 발행 글 12편이 같은 주제 가이드와 주제가 겹치는데,
// 양쪽이 서로를 가리키지 않으면 같은 쿼리에 두 URL이 붙어 신호가 갈린다.
// 역할을 문구로 못 박는다 — 글은 "왜/무엇"(진단·사례), 가이드는 "어떻게"(절차).
export default function RelatedGuideList({ items = [], locale = "ko" }) {
  if (!items.length) return null;
  const isEnglish = locale === "en";

  return (
    <nav className="related-guide" aria-label={isEnglish ? "Operating guides" : "운영 가이드"}>
      <span className="related-guide__label">
        {isEnglish ? "The step-by-step procedure lives in the guide" : "실제 운영 절차는 가이드에 있습니다"}
      </span>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <strong>{item.title}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
