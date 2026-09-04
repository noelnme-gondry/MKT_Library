import { describe, expect, it } from "vitest";

import { ACTION_COPY_TOOL_IDS } from "@/components/seo/ContentActionPanel";
import { PUBLISHED_BLOG_TOOL_MAP, PUBLISHED_GLOSSARY_TOOL_MAP } from "@/lib/contentToolRegistry";
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
