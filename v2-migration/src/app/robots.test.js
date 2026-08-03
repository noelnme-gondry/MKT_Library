import { describe, expect, it } from "vitest";
import robots from "./robots";
import { SITE_URL } from "@/lib/routeMap";

describe("robots", () => {
  it("preserves the current public-crawl policy and publishes the canonical sitemap", () => {
    const policy = robots();

    // 검색·AI·학습 봇을 따로 구분하지 않는 현재 공개 정책을 의도적으로 고정한다.
    expect(policy.rules).toEqual([{ userAgent: "*", allow: "/" }]);
    expect(policy.rules[0].disallow).toBeUndefined();
    expect(policy.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(policy.host).toBe(SITE_URL);
  });
});
