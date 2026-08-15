import { describe, expect, it } from "vitest";
import { ROUTES, isRouteIndexable } from "./routeMap";
import { getRouteSeo } from "./routeSeo";

// 색인 가능한 라우트는 전부 전용 SEO 카피를 가져야 한다. 이 목록을 손으로 적으면
// 새 라우트가 "가드에서도 똑같이 빠져" 결함이 통과한다 — toolOg.test.js가 정확히
// 5-25·5-26을 그렇게 놓쳤고(§7), 이 파일도 같은 두 도구를 놓쳐 5-26 KO 제목 32자·
// EN 69자(한도 30·60)가 배포된 채로 통과하고 있었다. SSOT에서 파생할 것.
// home은 layout.js의 buildRootMetadata가 담당하므로 제외한다.
const SEO_ROUTE_IDS = ROUTES.filter((route) => isRouteIndexable(route) && route.id !== "home").map((route) => route.id);

// 렌더된 <title>은 layout.js의 template("%s | Growth Opt Playbook")을 거친다.
const TITLE_SUFFIX = " | Growth Opt Playbook";

describe("indexable route SEO copy", () => {
  it("covers every indexable route (derived, not hand-listed)", () => {
    const missing = SEO_ROUTE_IDS.filter((id) => !getRouteSeo(id, "ko") || !getRouteSeo(id, "en"));
    expect(missing).toEqual([]);
  });

  it.each(SEO_ROUTE_IDS)("%s has concise KO and EN metadata", (routeId) => {
    const ko = getRouteSeo(routeId, "ko");
    const en = getRouteSeo(routeId, "en");

    expect(ko?.title).toBeTruthy();
    expect(ko?.description).toBeTruthy();
    expect(en?.title).toBeTruthy();
    expect(en?.description).toBeTruthy();
    expect([...ko.title].length).toBeLessThanOrEqual(30);
    expect([...ko.description].length).toBeLessThanOrEqual(80);
    expect(en.title.length).toBeLessThanOrEqual(60);
    expect(`${en.title}${TITLE_SUFFIX}`.length).toBeLessThanOrEqual(60);
    expect(en.description.length).toBeLessThanOrEqual(160);
  });

  it("keeps KO titles from collapsing into bare feature names", () => {
    // 30자 예산의 절반도 안 쓰는 제목은 쿼리 단어가 하나도 안 들어간 기능명이었다
    // (21개 중 11개). 최소한 검색어 하나는 담기게 하한을 둔다.
    const tooThin = SEO_ROUTE_IDS.filter((id) => [...getRouteSeo(id, "ko").title].length < 13);
    expect(tooThin).toEqual([]);
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
