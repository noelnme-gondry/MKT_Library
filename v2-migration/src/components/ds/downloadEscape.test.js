import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROUTES, isRoutePublished } from "@/lib/routeMap";

/**
 * 다운로드 탈출구 가드.
 *
 * 계약(`docs/product-ssot.md` §5.5 · §12.27): 공개 분석 도구는 결과에서 빠져나갈
 * 길을 준다 — 결론 카드 우상단의 `ds/DownloadHub`. 일부 도구만 내보내기를 주면
 * 사용자는 도구마다 다른 조작법을 학습해야 한다.
 *
 * 대상은 라우트에서 파생한다. 손으로 쓴 도구 배열을 도는 커버리지 가드는 새 도구를
 * 그대로 놓친다 — `toolOg`·`routeSeo`에서 이미 두 번 그랬다(§7).
 *
 * 예외는 **셀 수 있게** 둔다. "허브가 필요 없는 화면도 있다"를 주석으로만 선언하면
 * 그 예외가 지금도 맞는지 아무도 모른다(§7 — glossaryFaq의 알리바이 주석 사례).
 * 그래서 예외 파일은 사유를 코드에 적었다는 표식(D-07)을 갖고 있어야 한다.
 */

const COMPONENTS = path.dirname(fileURLToPath(import.meta.url)).replace(/\/ds$/, "");

// 허브를 쓰지 않는 도구와 그 이유. 늘리려면 코드에도 사유를 남겨야 한다.
const EXEMPT = {
  "5-18": "CSV·매핑 허브라 산출물은 각 subtool이 소유한다. 맨밑 상세문서 탈출구(claude-ux §6)를 쓴다.",
};

function findComponent(name) {
  const walk = (dir) => readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry === `${name}.jsx` ? [full] : [];
  });
  return walk(COMPONENTS)[0] || null;
}

const publishedTools = ROUTES
  .filter((route) => isRoutePublished(route) && /^(5-|9-)/.test(route.id));

describe("download escape", () => {
  it("covers every published analysis tool", () => {
    // 대상이 비면 검사가 통째로 무의미해진다 — 파생이 끊겼는지 먼저 본다.
    expect(publishedTools.length).toBeGreaterThan(10);

    const missing = [];
    for (const route of publishedTools) {
      const file = findComponent(route.component);
      expect(file, `${route.id}(${route.component}) 컴포넌트 파일을 찾지 못했다`).toBeTruthy();
      const source = readFileSync(file, "utf-8");
      if (source.includes("DownloadHub")) continue;
      if (EXEMPT[route.id]) continue;
      missing.push(`${route.id} ${route.component}`);
    }
    expect(
      missing,
      "결론 카드에서 결과를 받아갈 길이 없다. ds/DownloadHub를 붙이거나 EXEMPT에 사유와 함께 등록할 것(product-ssot §5.5)",
    ).toEqual([]);
  });

  it("keeps every exemption explained where the reader is", () => {
    for (const [toolId, reason] of Object.entries(EXEMPT)) {
      const route = publishedTools.find((item) => item.id === toolId);
      expect(route, `EXEMPT의 ${toolId}는 더 이상 공개 도구가 아니다 — 예외를 지울 것`).toBeTruthy();
      const source = readFileSync(findComponent(route.component), "utf-8");
      expect(source, `${toolId} 예외 사유(${reason})가 코드에 없다`).toContain("D-07");
    }
  });
});
