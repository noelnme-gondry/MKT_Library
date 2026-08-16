import { describe, expect, it } from "vitest";

import { AUTHOR, authorNode, knowsAbout, publisherNode } from "@/lib/authorProfile";
import { TOPIC_CLUSTERS } from "@/lib/topicClusters";
import { SITE_URL } from "@/lib/routeMap";
import sitemap from "@/app/sitemap";

// 프로필 페이지는 routeMap 밖 라우트(/contact)라 sitemap을 오라클로 쓴다 —
// 손으로 쓴 허용목록을 두면 그 목록이 다음 버그가 된다.
const sitemapUrls = new Set(sitemap().map((entry) => entry.url));

describe("저자·발행자 신원", () => {
  // 이 배선의 핵심. author가 publisher와 같은 노드면 "누가 썼는가"에 대한 답이
  // "이 사이트가"뿐이고, 검색엔진이 저자 신뢰도를 잴 재료가 없다.
  it("저자와 발행자를 별개 주체로 낸다", () => {
    const author = authorNode("ko");
    const publisher = publisherNode("ko");
    expect(author["@type"]).toBe("Person");
    expect(publisher["@type"]).toBe("Organization");
    expect(author["@id"]).not.toBe(publisher["@id"]);
  });

  it.each(["ko", "en"])("저자 프로필이 실재하는 페이지를 가리킨다 (%s)", (locale) => {
    const node = authorNode(locale);
    expect(node.url.startsWith(SITE_URL)).toBe(true);
    expect(sitemapUrls.has(node.url), `sitemap에 없는 프로필 URL: ${node.url}`).toBe(true);
  });

  // 다루는 주제가 바뀌면 클러스터가 먼저 바뀐다. 여기에 문자열을 따로 적으면
  // 그 목록이 조용히 낡는다(§7 — 목록은 파생, 하드코딩 금지).
  it.each(["ko", "en"])("knowsAbout을 토픽 클러스터에서 파생한다 (%s)", (locale) => {
    expect(knowsAbout(locale)).toEqual(TOPIC_CLUSTERS.map((cluster) => cluster[locale].title));
    expect(authorNode(locale).knowsAbout).toEqual(knowsAbout(locale));
  });

  // 정직성(§8): 검증 안 된 자격을 지어내지 않는다. 비면 키 자체가 빠져야 하고,
  // 빈 문자열·빈 배열이 JSON-LD에 새어 나가면 안 된다.
  it("빈 신원 필드를 구조화 데이터에 흘리지 않는다", () => {
    for (const locale of ["ko", "en"]) {
      for (const node of [authorNode(locale), publisherNode(locale)]) {
        for (const [key, value] of Object.entries(node)) {
          expect(value, `${key} 비어 있음`).toBeTruthy();
          if (Array.isArray(value)) expect(value.length, `${key} 빈 배열`).toBeGreaterThan(0);
        }
      }
    }
    if (AUTHOR.credentials.length === 0) {
      expect(authorNode("ko")).not.toHaveProperty("hasCredential");
    }
  });

  it("sameAs는 절대 URL만 담는다", () => {
    for (const url of AUTHOR.sameAs) expect(url).toMatch(/^https:\/\//);
  });
});
