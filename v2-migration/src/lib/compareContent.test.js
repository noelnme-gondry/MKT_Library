import { describe, expect, it } from "vitest";

import { COMPARE_SLUGS, getComparePage, getCompareFaq, getComparesForTool } from "./compareContent";
import { getBrandFacts, getBrandLimits, getPublishedToolCount } from "./brandFacts";
import { ROUTES, isRoutePublished } from "./routeMap";
import { getRouteSeo } from "./routeSeo";

const LOCALES = ["ko", "en"];

describe("compareContent", () => {
  it.each(LOCALES)("gives every comparison a complete block (%s)", (locale) => {
    for (const slug of COMPARE_SLUGS) {
      const page = getComparePage(slug, locale);
      expect(page, slug).toBeTruthy();
      expect(page.eyebrow, slug).toBeTruthy();
      expect(page.title, slug).toBeTruthy();
      expect(page.lead.length, slug).toBeGreaterThan(60);
      expect(page.guidance.length, slug).toBeGreaterThanOrEqual(3);
      expect(page.faq.length, slug).toBeGreaterThanOrEqual(3);
    }
  });

  // 이 페이지들의 존재 이유가 "답을 앞에 두는 것"이라 질문·답 형식을 강제한다.
  it.each(LOCALES)("opens with a question and a short answer (%s)", (locale) => {
    for (const slug of COMPARE_SLUGS) {
      const page = getComparePage(slug, locale);
      expect(page.question.endsWith("?"), slug).toBe(true);
      expect(page.answer.length, `${slug} answer too long`).toBeLessThanOrEqual(90);
      expect(getCompareFaq(slug, locale)[0].q, slug).toBe(page.question);
    }
  });

  // 표는 인용 단위라 열 수가 어긋나면 셀이 밀린다. 행 길이를 헤더에 고정한다.
  it.each(LOCALES)("keeps every table row aligned with its header (%s)", (locale) => {
    for (const slug of COMPARE_SLUGS) {
      const { table } = getComparePage(slug, locale);
      expect(table.columns.length, slug).toBeGreaterThanOrEqual(3);
      expect(table.rows.length, slug).toBeGreaterThanOrEqual(3);
      for (const row of table.rows) {
        expect(row.length, `${slug} row "${row[0]}"`).toBe(table.columns.length);
        for (const cell of row) expect(String(cell).length, `${slug} ${row[0]}`).toBeGreaterThan(0);
      }
      // 첫 열은 행 헤더(<th scope="row">)로 렌더되므로 중복되면 안 된다.
      const heads = table.rows.map((row) => row[0]);
      expect(new Set(heads).size, slug).toBe(heads.length);
    }
  });

  it("keeps KO and EN structurally identical", () => {
    for (const slug of COMPARE_SLUGS) {
      const ko = getComparePage(slug, "ko");
      const en = getComparePage(slug, "en");
      expect(en.table.columns.length, slug).toBe(ko.table.columns.length);
      expect(en.table.rows.length, slug).toBe(ko.table.rows.length);
      expect(en.guidance.length, slug).toBe(ko.guidance.length);
      expect(en.faq.length, slug).toBe(ko.faq.length);
    }
  });

  // 관련 도구 링크는 routeSeo에서 파생한다 — 존재하지 않는 id를 적어두면 링크가 죽는다.
  it("links only to published tool routes", () => {
    const published = new Set(ROUTES.filter((route) => isRoutePublished(route)).map((route) => route.id));
    for (const slug of COMPARE_SLUGS) {
      const { toolIds } = getComparePage(slug, "ko");
      expect(toolIds.length, slug).toBeGreaterThan(0);
      for (const toolId of toolIds) {
        expect(published.has(toolId), `${slug} → ${toolId}`).toBe(true);
        expect(getRouteSeo(toolId, "ko"), `${slug} → ${toolId}`).toBeTruthy();
        expect(getRouteSeo(toolId, "en"), `${slug} → ${toolId}`).toBeTruthy();
      }
    }
  });

  // 만든 페이지가 사이트와 접점 없이 혼자 놓이는 것을 막는 가드.
  // 비교 → 도구(페이지 하단 링크)와 도구 → 비교(근거 링크) 양방향이 모두 있어야 한다.
  describe("사이트 접점", () => {
    it("makes every comparison reachable from at least one tool page", () => {
      const reachable = new Set();
      const toolIds = new Set(ROUTES.filter((route) => isRoutePublished(route)).map((route) => route.id));
      for (const toolId of toolIds) {
        for (const page of getComparesForTool(toolId, "ko")) reachable.add(page.slug);
      }
      for (const slug of COMPARE_SLUGS) {
        expect(reachable.has(slug), `${slug}: 어떤 도구에서도 도달할 수 없다`).toBe(true);
      }
    });

    it.each(LOCALES)("resolves the reverse index in both locales (%s)", (locale) => {
      for (const slug of COMPARE_SLUGS) {
        for (const toolId of getComparePage(slug, "ko").toolIds) {
          const slugs = getComparesForTool(toolId, locale).map((page) => page.slug);
          expect(slugs, `${toolId} → ${slug}`).toContain(slug);
        }
      }
    });

    it("shares the parent's comparisons with 5-18 subtool routes", () => {
      const parent = getComparesForTool("5-18", "ko").map((page) => page.slug);
      expect(parent.length).toBeGreaterThan(0);
      expect(getComparesForTool("5-18-mmm", "ko").map((page) => page.slug)).toEqual(parent);
    });

    it("returns an empty list for tools with no comparison", () => {
      expect(getComparesForTool("guide-index", "ko")).toEqual([]);
      expect(getComparesForTool(undefined, "ko")).toEqual([]);
    });
  });

  it("returns null for an unknown slug instead of throwing", () => {
    expect(getComparePage("does-not-exist")).toBeNull();
    expect(getCompareFaq("does-not-exist")).toEqual([]);
  });
});

describe("brandFacts", () => {
  it.each(LOCALES)("exposes every fact and limit in both locales (%s)", (locale) => {
    const facts = getBrandFacts(locale);
    const limits = getBrandLimits(locale);
    expect(facts.length).toBeGreaterThanOrEqual(5);
    expect(limits.length).toBeGreaterThanOrEqual(3);
    for (const item of [...facts, ...limits]) {
      expect(item.claim, item.id).toBeTruthy();
      expect(item.detail, item.id).toBeTruthy();
      // 인용 단위라 한 문장으로 유지한다.
      expect(item.claim.length, `${item.id} claim too long`).toBeLessThanOrEqual(70);
    }
  });

  it("keeps fact ids stable across locales", () => {
    expect(getBrandFacts("ko").map((f) => f.id)).toEqual(getBrandFacts("en").map((f) => f.id));
    expect(getBrandLimits("ko").map((f) => f.id)).toEqual(getBrandLimits("en").map((f) => f.id));
  });

  // 손으로 센 도구 수를 적으면 도구가 늘어난 순간 거짓말이 된다.
  it("derives the tool count from the route map", () => {
    const expected = ROUTES.filter((route) => isRoutePublished(route))
      .filter((route) => route.id.startsWith("5-") || route.id.startsWith("9-"))
      .filter((route) => route.publication !== "subtool").length;
    expect(getPublishedToolCount()).toBe(expected);
    expect(getPublishedToolCount()).toBeGreaterThan(0);
  });
});
