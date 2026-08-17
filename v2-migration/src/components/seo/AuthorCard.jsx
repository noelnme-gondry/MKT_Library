import Link from "next/link";
import { AUTHOR } from "@/lib/authorProfile";

// 외부 프로필의 표시명. sameAs는 URL 배열이라 그대로 노출하면 앵커 텍스트가
// 주소가 된다(§12.29 — 앵커는 slug 원문이 아니라 표시명).
const PROFILE_LABELS = [
  { match: "blog.naver.com", ko: "네이버 블로그", en: "Naver blog" },
  { match: "instagram.com", ko: "Instagram", en: "Instagram" },
];

const labelFor = (url, lang) =>
  PROFILE_LABELS.find((item) => url.includes(item.match))?.[lang] || new URL(url).hostname;

/**
 * 글 하단 저자 소개.
 *
 * 저자 정보가 JSON-LD에만 있으면 크롤러는 읽어도 **사람은 못 본다**. 분석·방법론
 * 글에서 "누가 썼길래 이걸 믿나"는 독자가 실제로 하는 질문이라, 같은 사실을
 * 화면에도 둔다. 외부 프로필은 `rel="me"`로 걸어 같은 주체임을 표시한다.
 */
export default function AuthorCard({ locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const isEnglish = lang === "en";
  const profileHref = `${isEnglish ? "/en" : ""}${AUTHOR.profilePath}`;

  return (
    <aside className="author-card" aria-label={isEnglish ? "About the author" : "글쓴이 소개"}>
      <div className="author-card__head">
        <span className="author-card__label">{isEnglish ? "WRITTEN BY" : "글쓴이"}</span>
        <strong className="author-card__name">{AUTHOR.name}</strong>
        <span className="author-card__role">{AUTHOR[lang].role}</span>
      </div>
      <p className="author-card__bio">{AUTHOR[lang].bio}</p>
      <div className="author-card__links">
        <Link href={profileHref}>{isEnglish ? "Contact" : "문의하기"}</Link>
        {AUTHOR.sameAs.map((url) => (
          <a key={url} href={url} target="_blank" rel="me noopener noreferrer">
            {labelFor(url, lang)}
          </a>
        ))}
      </div>
    </aside>
  );
}
