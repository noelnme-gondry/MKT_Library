import { describe, expect, it } from "vitest";

import { getAllPosts } from "@/lib/blog";
import { getBlogSeo } from "@/lib/blogSeo";
import {
  TOPIC_CLUSTERS,
  allClusteredSlugs,
  clusterForPost,
  clusterLinksFor,
  isPillar,
} from "@/lib/topicClusters";

// 커버리지는 발행물에서 파생한다 — 손으로 쓴 배열을 돌면 새 글이 가드에서도
// 똑같이 빠지고, 가드가 있다는 사실이 가드가 없다는 사실을 가린다(§7).
const publishedSlugs = getAllPosts("ko").map((post) => post.slug);

describe("토픽 클러스터", () => {
  it("발행 글을 하나도 빠짐없이 덮는다", () => {
    const missing = publishedSlugs.filter((slug) => !clusterForPost(slug));
    expect(missing, `클러스터 미등록: ${missing.join(", ")}`).toEqual([]);
  });

  it("발행되지 않은 글을 클러스터에 넣지 않는다", () => {
    const published = new Set(publishedSlugs);
    const stale = allClusteredSlugs().filter((slug) => !published.has(slug));
    expect(stale, `발행되지 않았는데 링크됨: ${stale.join(", ")}`).toEqual([]);
  });

  it("한 글이 두 클러스터에 속하지 않는다", () => {
    const seen = new Set();
    const dupes = [];
    for (const slug of allClusteredSlugs()) {
      if (seen.has(slug)) dupes.push(slug);
      seen.add(slug);
    }
    expect(dupes, `중복 등록: ${dupes.join(", ")}`).toEqual([]);
  });

  it("모든 클러스터에 필라와 멤버가 있다", () => {
    for (const cluster of TOPIC_CLUSTERS) {
      expect(isPillar(cluster.pillar), cluster.id).toBe(true);
      expect(cluster.members.length, `${cluster.id} 멤버 없음`).toBeGreaterThan(0);
      expect(cluster.members).not.toContain(cluster.pillar);
      for (const locale of ["ko", "en"]) {
        expect(cluster[locale].title, `${cluster.id}.${locale}.title`).toBeTruthy();
        expect(cluster[locale].blurb, `${cluster.id}.${locale}.blurb`).toBeTruthy();
      }
    }
  });

  it("measurement 클러스터는 iOS ATT·SKAN 가이드를 필라로 둔다", () => {
    const measurement = TOPIC_CLUSTERS.find((cluster) => cluster.id === "measurement");
    expect(measurement?.pillar).toBe("ios-att-skan-guide");
    expect(measurement?.members).toContain("attribution-data-mismatch");
  });

  // 이 배선의 존재 이유 자체가 "인바운드 0편을 없앤다"이므로, 그 결과를 직접 잰다.
  it("모든 발행 글이 최소 1개의 인바운드 클러스터 링크를 받는다", () => {
    const inbound = Object.fromEntries(publishedSlugs.map((slug) => [slug, 0]));
    for (const slug of publishedSlugs) {
      const links = clusterLinksFor(slug);
      const targets = [...(links.pillar ? [links.pillar] : []), ...links.siblings];
      for (const target of targets) inbound[target] += 1;
    }
    const orphans = publishedSlugs.filter((slug) => inbound[slug] === 0);
    expect(orphans, `인바운드 0: ${orphans.join(", ")}`).toEqual([]);
  });

  it("형제 선택이 결정론적이고 자기 자신을 가리키지 않는다", () => {
    for (const slug of publishedSlugs) {
      const first = clusterLinksFor(slug);
      const second = clusterLinksFor(slug);
      expect(second.siblings).toEqual(first.siblings);
      expect(first.siblings).not.toContain(slug);
      expect(first.pillar).not.toBe(slug);
    }
  });

  // 앵커 텍스트는 slug가 아니라 표시 제목이어야 한다(§12.29). 제목 SSOT는 blogSeo다.
  it("링크 대상 전부가 표시 제목을 갖는다", () => {
    for (const locale of ["ko", "en"]) {
      const untitled = allClusteredSlugs().filter((slug) => !getBlogSeo(locale, slug)?.title);
      expect(untitled, `${locale} 제목 없음: ${untitled.join(", ")}`).toEqual([]);
    }
  });
});
