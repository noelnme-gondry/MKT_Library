// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  SIDEBAR_COLLAPSED_CLASS,
  SIDEBAR_STORAGE_KEY,
  collapsedByDefaultPaths,
  isCollapsedByDefault,
  normalizePath,
  readStoredPreference,
  resolveCollapsed,
} from "./sidebarCollapse";
import { ROUTES, isRoutePublished } from "./routeMap";

describe("collapsedByDefaultPaths", () => {
  it("derives the list from published analysis routes rather than a hand-written array", () => {
    // 손목록이면 도구가 하나 늘 때마다 어긋난다(§7). 라우트에서 파생하는지 대조한다.
    const expected = ROUTES
      .filter((route) => !route.legacy && /^(5-|9-)/.test(route.id) && isRoutePublished(route))
      .map((route) => route.slug)
      .sort();
    expect(collapsedByDefaultPaths()).toEqual(expected);
    // 규모 단언 — 필터가 깨져 빈 배열이 되면 조용히 통과한다.
    expect(collapsedByDefaultPaths().length).toBeGreaterThan(15);
  });

  it("covers the dashboard and a tools route, and excludes non-tool shells", () => {
    const paths = collapsedByDefaultPaths();
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/tools/budget-allocation");
    expect(paths).not.toContain("/");
    expect(paths).not.toContain("/start");
    // subtool·preview는 목록 밖이다(공개 도구가 아니다).
    expect(paths).not.toContain("/tools/marketing-response");
  });
});

describe("normalizePath", () => {
  it("strips the English prefix and trailing slashes so one list serves both locales", () => {
    expect(normalizePath("/en/dashboard")).toBe("/dashboard");
    expect(normalizePath("/dashboard/")).toBe("/dashboard");
    expect(normalizePath("/en")).toBe("/");
    expect(normalizePath("/")).toBe("/");
    // "/endpoint"가 "/en" 접두로 잘리면 안 된다.
    expect(normalizePath("/endpoint")).toBe("/endpoint");
  });
});

describe("isCollapsedByDefault", () => {
  it("collapses on a tool route and stays open elsewhere", () => {
    expect(isCollapsedByDefault("/dashboard")).toBe(true);
    expect(isCollapsedByDefault("/en/tools/budget-allocation")).toBe(true);
    expect(isCollapsedByDefault("/")).toBe(false);
    expect(isCollapsedByDefault("/start")).toBe(false);
    expect(isCollapsedByDefault("/blog")).toBe(false);
  });
});

describe("resolveCollapsed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.classList.remove(SIDEBAR_COLLAPSED_CLASS);
  });

  it("lets an explicit choice win over the route default in both directions", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "expanded");
    expect(resolveCollapsed("/dashboard")).toBe(false);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    expect(resolveCollapsed("/blog")).toBe(true);
  });

  it("treats an absent or unrecognised value as no choice at all", () => {
    // "선택 없음"과 "펼침 선택"을 한 값에 섞으면 둘을 구분할 수 없다.
    expect(readStoredPreference()).toBe(null);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "garbage");
    expect(readStoredPreference()).toBe(null);
    expect(resolveCollapsed("/dashboard")).toBe(true);
    expect(resolveCollapsed("/blog")).toBe(false);
  });
});
