import { SITE_URL } from "@/lib/routeMap";
import { BRAND } from "@/lib/brandFacts";
import { TOPIC_CLUSTERS } from "@/lib/topicClusters";

/* ============================================================
 * authorProfile — 저자·발행자 신원의 SSOT
 *
 * 왜 필요했나: `BlogPosting`의 `author`가 `publisher`와 **같은 Organization
 * 객체**였다(`author: publisher`). 즉 "누가 썼는가"에 대한 답이 "이 사이트가"
 * 뿐이었고, 코드베이스 전체에 `sameAs`가 0건이라 이 사이트를 운영하는 주체가
 * 다른 어디에서도 확인되지 않았다. 분석·방법론을 다루는 글에서 저자 신원은
 * 검색엔진이 신뢰도를 재는 몇 안 되는 기계 판독 신호다.
 *
 * 정직성 규칙(§8·§11): **여기에 없는 사실은 지어내지 않는다.**
 * 실명·경력·수상·소속은 본인이 공개한 것만 적는다. 지금 채워진 값은 전부
 * 이미 사이트나 프로필에 공개돼 있는 것들이다(바이라인·문의 채널·Instagram).
 * `credentials`와 `sameAs` 추가 항목은 본인이 값을 줄 때 채운다 —
 * 비어 있으면 JSON-LD에서 통째로 빠지므로 빈 필드가 새어 나가지 않는다.
 * ============================================================ */

export const AUTHOR = {
  // 현재 사이트·네이버에서 실제로 쓰는 공개 바이라인. 실명 공개를 원하시면 여기만 바꾸면
  // JSON-LD·바이라인·프로필 링크가 한 번에 따라온다.
  name: BRAND.name,
  ko: {
    role: "퍼포먼스 마케팅 5년 · 데이터 분석 3년",
    bio: "앱 퍼포먼스 마케팅 5년, 데이터 분석 3년. 실무에서 쓰던 분석을 도구로 만들어 무료로 공개하고 있습니다.",
  },
  en: {
    role: "5 years in performance marketing · 3 in data analysis",
    bio: "Five years in app performance marketing and three in data analysis. I turn the analyses I used at work into free, browser-only tools.",
  },
  // 저자를 식별하는 실제 페이지. /contact가 운영자 연락 채널을 공개하는 자리다.
  profilePath: "/contact",
  // 외부에서 같은 주체임을 확인할 수 있는 주소만 넣는다. 네이버 블로그는 같은
  // 사람이 운영하는 다른 발행면이라, 이 연결이 있어야 검색엔진이 두 자산을
  // 별개 주체로 보지 않는다.
  sameAs: [
    "https://blog.naver.com/growthoptplaybook",
    "https://www.instagram.com/gondry__workshop/",
  ],
  // schema.org `hasCredential`은 학위·자격증처럼 **발급 주체가 있는** 것을 위한
  // 필드다. 경력 연수는 여기 넣으면 스키마 오용이라 `bio`·`role`로만 표기한다.
  credentials: [],
};

export const PUBLISHER_NAME = BRAND.name;

/**
 * 이 사이트가 실제로 다루는 주제. 문자열을 새로 적지 않고 **토픽 클러스터에서
 * 파생**한다 — 다루는 주제가 바뀌면 클러스터가 먼저 바뀌므로 여기가 낡을 수 없다.
 */
export function knowsAbout(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  return TOPIC_CLUSTERS.map((cluster) => cluster[lang].title);
}

const omitEmpty = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

/** JSON-LD `author`용 Person 노드. 빈 필드는 넣지 않는다. */
export function authorNode(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const profileUrl = `${SITE_URL}${lang === "en" ? "/en" : ""}${AUTHOR.profilePath}`;
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/#author`,
    name: AUTHOR.name,
    jobTitle: AUTHOR[lang].role,
    description: AUTHOR[lang].bio,
    url: profileUrl,
    knowsAbout: knowsAbout(lang),
    ...(omitEmpty(AUTHOR.sameAs) ? { sameAs: AUTHOR.sameAs } : {}),
    ...(omitEmpty(AUTHOR.credentials) ? { hasCredential: AUTHOR.credentials } : {}),
  };
}

/** JSON-LD `publisher`용 Organization 노드. 저자와 `@id`가 달라야 별개 주체로 읽힌다. */
export function publisherNode(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: PUBLISHER_NAME,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/dochi-512.png` },
    knowsAbout: knowsAbout(lang),
    ...(omitEmpty(AUTHOR.sameAs) ? { sameAs: AUTHOR.sameAs } : {}),
  };
}
