import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import nextConfig from "../../next.config.mjs";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/routeMap";

/**
 * 원고(.md) 안의 내부 링크가 실재하는 페이지를 가리키는지 검사한다.
 *
 * 이 가드가 없던 동안 `performance-marketing-analysis-order`(분석 순서 필라)가
 * 404 링크 2개(`/tools/experiment`·`/tools/vif-diagnosis`)를 KO·EN 양쪽에 달고
 * 나가고 있었다. 도구 slug가 바뀌어도 원고는 따라 바뀌지 않기 때문에, 링크는
 * 리팩토링에서 가장 조용히 썩는 자산이다 — 크롤러는 링크주스를 404로 흘려보내고,
 * 화면에서는 눌러보기 전까지 멀쩡해 보인다.
 *
 * 유효 목적지는 **sitemap에서 파생**한다(routeMap·블로그·용어집·compare·템플릿·
 * 계산기를 이미 전부 포함). 손으로 쓴 화이트리스트를 두면 그 목록이 다음 버그가 된다.
 */

const CONTENT_DIRS = ["content/blog", "content/blog-en", "content/glossary", "content/glossary-en"];
const LINK_PATTERN = /\]\((\/[a-z0-9/-]+)\)/g;

function readContentLinks() {
  const found = new Map();
  for (const dir of CONTENT_DIRS) {
    const abs = path.join(process.cwd(), dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs)) {
      if (!file.endsWith(".md") || file.startsWith("_")) continue;
      const body = fs.readFileSync(path.join(abs, file), "utf8");
      for (const match of body.matchAll(LINK_PATTERN)) {
        const href = match[1];
        if (!found.has(href)) found.set(href, new Set());
        found.get(href).add(`${dir}/${file}`);
      }
    }
  }
  return found;
}

// 원고는 KR 상대경로로만 쓰고 렌더러가 EN 접두를 붙인다(§12.24). 그래서 검사도
// /en 접두를 벗겨 KO 경로 하나로 모아서 한다.
const stripLocale = (href) => href.replace(/^\/en(?=\/|$)/, "") || "/";

const contentLinks = readContentLinks();
const sitemapPaths = new Set(sitemap().map((entry) => entry.url.replace(SITE_URL, "") || "/"));
const redirectSources = new Set((await nextConfig.redirects()).map((rule) => rule.source));

describe("원고 내부 링크", () => {
  it("검사할 링크를 실제로 수집한다", () => {
    // 정규식이 깨지면 0건이 되고 아래 검사가 전부 공허하게 통과한다.
    expect(contentLinks.size).toBeGreaterThan(50);
  });

  it("모든 내부 링크가 실재하는 페이지를 가리킨다", () => {
    const broken = [];
    for (const [href, files] of contentLinks) {
      const target = stripLocale(href);
      if (!sitemapPaths.has(target)) broken.push(`${href} <- ${[...files].join(", ")}`);
    }
    expect(broken, `실재하지 않는 링크:\n${broken.join("\n")}`).toEqual([]);
  });

  it("리다이렉트를 경유하지 않고 최종 주소로 바로 건다", () => {
    // 301 홉은 링크주스를 희석하고 크롤 예산을 낭비한다. 원고는 목적지를 직접 쓴다.
    const hops = [];
    for (const [href, files] of contentLinks) {
      if (redirectSources.has(stripLocale(href))) hops.push(`${href} <- ${[...files].join(", ")}`);
    }
    expect(hops, `리다이렉트 경유 링크:\n${hops.join("\n")}`).toEqual([]);
  });
});
