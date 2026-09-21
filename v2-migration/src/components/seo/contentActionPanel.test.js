import { describe, expect, it } from "vitest";

import { ACTION_COPY_TOOL_IDS } from "@/components/seo/ContentActionPanel";
import { PRIMARY_CALCULATOR_MAPS, PUBLISHED_BLOG_TOOL_MAP, PUBLISHED_GLOSSARY_TOOL_MAP } from "@/lib/contentToolRegistry";
import { CALCULATOR_ORDER, getCalculator } from "@/lib/calculators";
import { idToSlug } from "@/lib/routeMap";

// 이 파일이 막는 사고: 레지스트리는 올바른 도구를 지정하는데 패널에 카피가 없어서
// `TOOL_COPY[candidate] ? candidate : "5-2"` 폴백이 조용히 운영 대시보드로 보내는 것.
// 실제로 블로그 7편(5-27·5-24·9-1)과 용어 3편이 그 상태로 배포돼 있었다.
// 대상을 손으로 나열하지 않고 레지스트리 값 전체에서 파생한다.
describe("content action panel copy coverage", () => {
  const registries = {
    blog: PUBLISHED_BLOG_TOOL_MAP,
    glossary: PUBLISHED_GLOSSARY_TOOL_MAP,
  };

  for (const [type, registry] of Object.entries(registries)) {
    it(`${type}: every mapped tool has action copy, so no entry silently falls back to 5-2`, () => {
      const mapped = [...new Set(Object.values(registry))];
      expect(mapped.length).toBeGreaterThan(5);
      const missing = mapped.filter((toolId) => !ACTION_COPY_TOOL_IDS.includes(toolId));
      expect(missing).toEqual([]);
    });

    it(`${type}: every mapped tool resolves to a real route`, () => {
      for (const toolId of new Set(Object.values(registry))) {
        expect(idToSlug[toolId], `${toolId} has no slug`).toBeTruthy();
      }
    });
  }

  it("copy keys themselves point at real routes", () => {
    for (const toolId of ACTION_COPY_TOOL_IDS) {
      expect(idToSlug[toolId], `${toolId} has no slug`).toBeTruthy();
    }
  });
});

// 계산기를 1차 CTA로 올린 용어의 목적지가 실재하는지 — 슬러그를 손으로 적으면
// 계산기 이름이 바뀌는 순간 CTA가 404로 나가고, 화면에서만 드러난다.
// 대상은 레지스트리 값 전체에서 파생한다(개수를 적지 않는다).
describe("content action panel calculator destinations", () => {
  const mapped = Object.entries(PRIMARY_CALCULATOR_MAPS)
    .flatMap(([type, registry]) => Object.entries(registry).map(([slug, calc]) => ({ type, slug, calc })));

  it("every mapped calculator slug is a published calculator", () => {
    for (const { type, slug, calc } of mapped) {
      expect(CALCULATOR_ORDER, `${type}/${slug} → ${calc}`).toContain(calc);
    }
  });

  it("every mapped calculator has copy in both locales, so the CTA never renders blank", () => {
    for (const { type, slug, calc } of mapped) {
      for (const locale of ["ko", "en"]) {
        const entry = getCalculator(calc, locale);
        expect(entry, `${type}/${slug} → ${calc} (${locale})`).toBeTruthy();
        expect(entry.name?.trim(), `${type}/${slug} → ${calc} (${locale}) name`).toBeTruthy();
        expect(entry.title?.trim(), `${type}/${slug} → ${calc} (${locale}) title`).toBeTruthy();
        expect(entry.summary?.trim(), `${type}/${slug} → ${calc} (${locale}) summary`).toBeTruthy();
      }
    }
  });
});
