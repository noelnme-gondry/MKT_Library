import { describe, expect, it } from "vitest";
import { ITEM_KEYWORDS, ITEM_KEYWORDS_EN, buildPageKeywords, PAGE_KEYWORDS_BASE, PAGE_KEYWORDS_BASE_EN } from "./pageKeywords";
import { ROUTES, isRoutePublished, EN_READY_TOOL_IDS, EN_READY_GUIDE_IDS } from "./routeMap";

// 감사 P1-9: 이 파일엔 테스트가 하나도 없어서 5-24·5-25·5-26이 배포된 뒤에도
// keywords 없이 나갔다(KR이 주 시장이고 네이버가 meta keywords에 민감한데도).
// 목록은 ROUTES에서 파생한다 — 손으로 나열하면 다음 도구에서 또 빠진다.
const publishedToolIds = ROUTES
  .filter((route) => isRoutePublished(route) && /^(5|9)-\d+$/.test(route.id))
  .map((route) => route.id);

// 가이드도 항목 단위 keywords를 갖는다. GROUP_KEYWORDS 폴백만 있으면 같은 그룹의
// 3~4개 페이지가 동일한 keywords로 나가 서로 잡아먹는다.
const publishedGuideIds = ROUTES
  .filter((route) => isRoutePublished(route) && /^([1-4]-\d+|8-1)$/.test(route.id))
  .map((route) => route.id);

describe("pageKeywords 커버리지", () => {
  it.each(publishedToolIds)("%s 는 KO keywords를 갖는다", (id) => {
    expect(ITEM_KEYWORDS[id], `ITEM_KEYWORDS["${id}"] 누락`).toBeTruthy();
  });

  it.each(publishedToolIds.filter((id) => EN_READY_TOOL_IDS.has(id)))(
    "%s 는 EN_READY이므로 EN keywords를 갖는다",
    (id) => {
      expect(ITEM_KEYWORDS_EN[id], `ITEM_KEYWORDS_EN["${id}"] 누락`).toBeTruthy();
    },
  );

  it.each(publishedGuideIds)("%s 가이드는 KO keywords를 갖는다", (id) => {
    expect(ITEM_KEYWORDS[id], `ITEM_KEYWORDS["${id}"] 누락`).toBeTruthy();
  });

  it.each(publishedGuideIds.filter((id) => EN_READY_GUIDE_IDS.has(id)))(
    "%s 가이드는 EN_READY이므로 EN keywords를 갖는다",
    (id) => {
      expect(ITEM_KEYWORDS_EN[id], `ITEM_KEYWORDS_EN["${id}"] 누락`).toBeTruthy();
    },
  );

  it("같은 그룹 가이드끼리 keywords가 겹치지 않는다", () => {
    const values = publishedGuideIds.map((id) => ITEM_KEYWORDS[id]);
    expect(new Set(values).size).toBe(publishedGuideIds.length);
  });

  // EN 페이지에 한글 키워드가 새면 검색엔진이 언어를 오판한다(§2.11).
  it("EN keywords에 한글이 없다", () => {
    for (const [id, value] of Object.entries(ITEM_KEYWORDS_EN)) {
      expect(/[가-힣]/.test(value), `ITEM_KEYWORDS_EN["${id}"]에 한글 포함`).toBe(false);
    }
  });

  it("buildPageKeywords가 base를 항상 포함하고 중복을 제거한다", () => {
    const ko = buildPageKeywords({ id: "5-2" }, "ko");
    expect(ko.startsWith(PAGE_KEYWORDS_BASE)).toBe(true);
    expect(new Set(ko.split(", ")).size).toBe(ko.split(", ").length);

    const en = buildPageKeywords({ id: "5-2" }, "en");
    expect(en.startsWith(PAGE_KEYWORDS_BASE_EN)).toBe(true);
    expect(/[가-힣]/.test(en)).toBe(false);
  });

  it("매핑 없는 페이지는 base만 반환한다", () => {
    expect(buildPageKeywords({ id: "home" }, "ko")).toBe(PAGE_KEYWORDS_BASE);
  });
});
