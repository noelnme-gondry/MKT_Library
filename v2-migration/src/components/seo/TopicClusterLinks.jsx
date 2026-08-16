import Link from "next/link";

/**
 * 같은 주제 글끼리 잇는 링크 블록.
 *
 * 필라 화면은 멤버 전체를, 멤버 화면은 필라 + 형제 몇 개를 그린다. 목적은
 * 읽을거리 추천이 아니라 **내부 링크 구조를 만드는 것**이다 — 인바운드
 * 중앙값이 1회면 검색엔진이 사이트의 중요도 서열을 읽을 재료가 없다.
 *
 * 링크 텍스트는 slug가 아니라 표시 제목을 쓴다(§12.29 앵커 텍스트 규칙).
 */
export default function TopicClusterLinks({ links, titleFor, locale = "ko" }) {
  if (!links) return null;
  const isEnglish = locale === "en";
  const { cluster, role, pillar, siblings } = links;
  const copy = isEnglish ? cluster.en : cluster.ko;
  const hrefFor = (slug) => (isEnglish ? `/en/blog/${slug}` : `/blog/${slug}`);

  const items = [];
  if (role === "member" && pillar) {
    items.push({ slug: pillar, isPillar: true });
  }
  for (const slug of siblings) items.push({ slug, isPillar: false });
  if (!items.length) return null;

  return (
    <nav className="topic-cluster" aria-label={isEnglish ? `More on ${copy.title}` : `${copy.title} 주제의 다른 글`}>
      <div className="topic-cluster__head">
        <span className="topic-cluster__label">
          {role === "pillar"
            ? (isEnglish ? `Everything in ${copy.title}` : `${copy.title} — 이 주제의 글 ${siblings.length}편`)
            : (isEnglish ? `More on ${copy.title}` : `${copy.title} 주제의 다른 글`)}
        </span>
        <small>{copy.blurb}</small>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={hrefFor(item.slug)}>
              {item.isPillar && (
                <span className="topic-cluster__pin">{isEnglish ? "START HERE" : "이 주제의 출발점"}</span>
              )}
              <strong>{titleFor(item.slug)}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
