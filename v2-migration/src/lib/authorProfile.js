import { SITE_URL } from "@/lib/routeMap";
import { BRAND } from "@/lib/brandFacts";
import { TOPIC_CLUSTERS } from "@/lib/topicClusters";

// Published articles use the site's brand. Seller records are separate.
export const AUTHOR = {
  name: BRAND.name,
  ko: { bio: BRAND.ko.definition },
  en: { bio: BRAND.en.definition },
  profilePath: "/contact",
  sameAs: ["https://blog.naver.com/growthoptplaybook"],
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

export function publisherNode(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: PUBLISHER_NAME,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/dochi-512.png` },
    knowsAbout: knowsAbout(lang),
    sameAs: AUTHOR.sameAs,
  };
}

export function authorNode(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  return {
    ...publisherNode(lang),
    url: `${SITE_URL}${lang === "en" ? "/en" : ""}${AUTHOR.profilePath}`,
    description: AUTHOR[lang].bio,
  };
}

/** /contact가 저자 URL인 사실을 화면·구조화 데이터에서 같은 노드로 설명한다. */
export function profilePageNode(locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const path = `${lang === "en" ? "/en" : ""}${AUTHOR.profilePath}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${SITE_URL}${path}#profile`,
    url: `${SITE_URL}${path}`,
    name: lang === "en" ? `About ${AUTHOR.name}` : `${AUTHOR.name} 소개`,
    inLanguage: lang === "en" ? "en" : "ko-KR",
    // ProfilePage는 DateTime을 요구한다 — 날짜만 쓰면 Search Console이 잘못된 값으로 본다.
    dateModified: "2026-11-22T00:00:00+09:00",
    mainEntity: authorNode(lang),
  };
}
