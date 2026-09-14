import { describe, expect, it } from "vitest";
import { ROUTES, isRouteIndexable } from "./routeMap";
import { getRouteSeo } from "./routeSeo";

// 색인 가능한 라우트는 전부 전용 SEO 카피를 가져야 한다. 이 목록을 손으로 적으면
// 새 라우트가 "가드에서도 똑같이 빠져" 결함이 통과한다 — toolOg.test.js가 정확히
// 5-25·5-26을 그렇게 놓쳤다(§7). 전용 메타·검색 의도를 SSOT에서 파생해 검증한다.
// home은 layout.js의 buildRootMetadata가 담당하므로 제외한다.
const SEO_ROUTE_IDS = ROUTES.filter((route) => isRouteIndexable(route) && route.id !== "home").map((route) => route.id);

// 렌더된 <title>은 layout.js의 template("%s | Growth Opt Playbook")을 거친다.
const TITLE_SUFFIX = " | Growth Opt Playbook";

it("gives the unindexed results page a localized title instead of its internal ID", () => {
  expect(getRouteSeo("dochi-result", "ko")?.title).toBe("분석 결과");
  expect(getRouteSeo("dochi-result", "en")?.title).toBe("Analysis Results");
  expect(isRouteIndexable(ROUTES.find((route) => route.id === "dochi-result"))).toBe(false);
});

describe("indexable route SEO copy", () => {
  it("covers every indexable route (derived, not hand-listed)", () => {
    const missing = SEO_ROUTE_IDS.filter((id) => !getRouteSeo(id, "ko") || !getRouteSeo(id, "en"));
    expect(missing).toEqual([]);
  });

  it.each(SEO_ROUTE_IDS)("%s has localized metadata without duplicate branding", (routeId) => {
    const ko = getRouteSeo(routeId, "ko");
    const en = getRouteSeo(routeId, "en");

    expect(ko?.title).toBeTruthy();
    expect(ko?.description).toBeTruthy();
    expect(en?.title).toBeTruthy();
    expect(en?.description).toBeTruthy();
    expect(ko.title).not.toContain(TITLE_SUFFIX);
    expect(en.title).not.toContain(TITLE_SUFFIX);
    expect([...ko.description].length).toBeLessThanOrEqual(80);
    expect(en.description.length).toBeLessThanOrEqual(160);
  });

  it.each(["ko", "en"])("keeps distinct route titles instead of internal IDs (%s)", (locale) => {
    // 문자 수는 검색 의도를 증명하지 않는다. 빈 제목·중복·내부 ID 폴백을 막고,
    // 아래의 도구별 핵심 개념 검사로 실제 검색 의도를 확인한다.
    const titles = SEO_ROUTE_IDS.map(id => {
      const title = getRouteSeo(id, locale).title.trim();
      expect(title).not.toBe("");
      expect(title).not.toBe(id);
      return title;
    });
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("gives every SOP guide its own description instead of the group fallback", () => {
    // 가이드에 엔트리가 없으면 generateMetadata가 `${title} — ${group.desc}`로
    // 폴백해 같은 그룹 가이드끼리 설명이 통째로 겹친다.
    const guideIds = SEO_ROUTE_IDS.filter((id) => /^[1-4]-\d+$|^8-1$/.test(id));
    expect(guideIds.length).toBe(15);
    const descriptions = guideIds.map((id) => getRouteSeo(id, "ko").description);
    expect(new Set(descriptions).size).toBe(guideIds.length);
  });

  it("separates parent, cannibalization, and budget search intent", () => {
    expect(getRouteSeo("5-18", "ko").title).toContain("MMM");
    expect(getRouteSeo("5-18-cannibal", "ko").title).toContain("카니발라이제이션");
    expect(getRouteSeo("5-3", "ko").title).toContain("시뮬레이터");
  });
});
