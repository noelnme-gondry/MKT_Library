import Link from "next/link";

// 글 하단 "관련 용어" — 예전에는 slug 원문(`marginal-cpa`)을 그대로 앵커 텍스트로
// 노출해 읽는 사람에게도, 내부 링크 문맥에도 의미가 없었다. 실제 용어명과 짧은 정의를
// 함께 보여 이동 여부를 판단할 수 있게 한다(용어 데이터는 server 로더에서 주입).
export default function RelatedGlossaryList({ items = [], locale = "ko" }) {
  if (!items.length) return null;
  const isEnglish = locale === "en";

  return (
    <nav className="related-glossary" aria-label={isEnglish ? "Related glossary terms" : "관련 용어"}>
      <span className="related-glossary__label">{isEnglish ? "Terms used in this article" : "이 글에 나오는 용어"}</span>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={item.href}>
              <strong>{item.term}</strong>
              {item.shortDef ? <small>{item.shortDef}</small> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
