import { describe, expect, it } from "vitest";

import { COMPARE_SLUGS, getComparePage, getCompareFaq, getComparesForTool } from "./compareContent";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, getBrandFacts, getBrandLimits, getPublishedToolCount } from "./brandFacts";
import { OPEN_GRAPH_SITE_NAME } from "./openGraph";
import { PUBLISHER_NAME } from "./authorProfile";
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

  // 이 사실들은 llms.txt로 그대로 나가 AI 답변에 인용된다. 인용된 뒤에는 조건을
  // 붙일 기회가 없으므로, 제품 전체로는 참이 아닌 보편 주장이 섞이면 안 된다
  // (product-ssot §2 F-06 · §3.1). 실제로 "추정값에는 95% 신뢰구간을 함께
  // 표시합니다"가 무조건문으로 나가고 있었다 — PVM 분해·Aha 그리드·ASA 키워드처럼
  // 신뢰구간이 정의되지 않는 출력이 있다.
  it.each(LOCALES)("keeps every published claim inside what the product can guarantee (%s)", (locale) => {
    // 근거를 확인할 수 없는 절대·보편 표현. 한계(BRAND_LIMITS)에는 "…하지 않습니다"가
    // 정직한 부정이라 적용하지 않고, 사실(BRAND_FACTS)의 주장에만 적용한다.
    const absolutes = [
      // "모든 분석 도구가 무료"(F-01)는 검증 가능한 범위라 대상이 아니다. 도구마다
      // 성립 여부가 갈리는 출력 단위의 보편 주장만 막는다.
      { pattern: /모든 (숫자|추정|출력|지표)/, why: "도구별로 성립 여부가 갈리는데 전체로 단정한다" },
      { pattern: /\b(all|every) (number|estimate|output|metric)s?\b/i, why: "not verified across every tool" },
      { pattern: /벗어나지 않습니다/, why: "브라우저 확장·네트워크·외부 URL까지 포괄하는 절대 주장이 된다" },
      { pattern: /\bnever leaves\b/i, why: "absolute security claim beyond what the product controls" },
      { pattern: /영구|forever|permanently free/i, why: "정책이 확정되지 않았다" },
      { pattern: /절대 |guarantee[ds]?\b/i, why: "보장 표현" },
    ];
    for (const fact of getBrandFacts(locale)) {
      const text = `${fact.claim} ${fact.detail}`;
      for (const { pattern, why } of absolutes) {
        expect(pattern.test(text), `${fact.id}: ${why} — ${text}`).toBe(false);
      }
      // 95%처럼 특정 통계 산출물을 말할 때는 그것이 성립하는 조건이 같은 문장에 있어야 한다.
      if (/95%/.test(text)) {
        expect(/정의되는|경우|where|when/i.test(text), `${fact.id}: 95% 주장에 적용 조건이 없다`).toBe(true);
      }
    }
  });

  // 제품명이 갈리면 인용하는 쪽마다 다른 이름을 가져간다(product-ssot §1.1).
  it("uses the canonical product name", () => {
    expect(BRAND.name).toBe("Growth Opt Playbook");
    expect(BRAND.ko.shortName).toBe(BRAND.name);
  });

  // 사람이 읽는 카피의 제품명 리터럴까지 전부 파생시키지는 않는다(~70곳이고
  // "문의하기 | Growth Opt Playbook"처럼 합성된 문자열이 많다). 대신 **기계가 읽는
  // 정체성**은 SSOT에서 파생해야 한다 — JSON-LD·OG·publisher가 갈리면 인용하는
  // 엔진이 다른 이름을 가져간다. 실제로 BRAND.name만 확장형으로 갈라져 있었다.
  it("derives the machine-readable identity from the single source", () => {
    expect(OPEN_GRAPH_SITE_NAME).toBe(BRAND.name);
    expect(PUBLISHER_NAME).toBe(BRAND.name);
    const rootDocument = readFileSync(
      path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "components/RootDocument.jsx"),
      "utf-8",
    );
    expect(rootDocument).toMatch(/name: BRAND\.name/);
    expect(rootDocument, "JSON-LD에 제품명을 리터럴로 다시 적지 말 것").not.toMatch(/name: "Growth/);
  });

  // 확장형은 설명 문구로만 쓴다. 이름 자리에 남아 있으면 두 표기가 다시 공존한다.
  it("keeps the expanded name out of the codebase", () => {
    const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const walk = (dir) => readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(js|jsx)$/.test(entry) ? [full] : [];
    });
    const legacyName = ["Growth", "Optimization", "Playbook"].join(" "); // 이 파일 자신이 걸리지 않게 조립한다
    const offenders = walk(root)
      .filter((file) => readFileSync(file, "utf-8").includes(legacyName))
      .map((file) => path.relative(root, file));
    expect(offenders, "확장형 제품명이 남아 있다(product-ssot §1.1)").toEqual([]);
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
