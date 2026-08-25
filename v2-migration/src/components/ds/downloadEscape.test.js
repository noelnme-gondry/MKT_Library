import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROUTES, isRoutePublished } from "@/lib/routeMap";

/**
 * 다운로드 탈출구 가드.
 *
 * 계약(`docs/product-ssot.md` §5.5): 공개 분석 도구는 `ResultActionCard`의 공통
 * XLSX 내보내기를 받는다. 각 도구가 `DownloadHub`를 직접 쓰는지와 무관하게
 * 원본·매핑·수식 경계·결과 근거가 같은 워크북 구조로 내려가야 한다.
 *
 * 대상은 라우트에서 파생한다. 손으로 쓴 도구 배열을 도는 커버리지 가드는 새 도구를
 * 그대로 놓친다 — `toolOg`·`routeSeo`에서 이미 두 번 그랬다(§7).
 *
 * XLSX는 원본과 근거를 함께 내보내므로 과거의 "계산 결과가 적다" 예외는 더 이상
 * 정당하지 않다. 공개 분석 도구 예외 목표는 0이다.
 */

const COMPONENTS = path.dirname(fileURLToPath(import.meta.url)).replace(/\/ds$/, "");

// routeMap의 `component`는 파일 이름이 아닐 수 있다 — 5-18 계열은 PageClient가
// `<MarketingResponse initialStage="trend" isolated />`로 디스패치하므로 같은 이름의
// 파일이 없다. 실제로 어떤 컴포넌트가 렌더되는지는 디스패치에서 파생한다.
function dispatchedComponent(routeId) {
  const pageClient = readFileSync(
    path.join(path.dirname(COMPONENTS), "app/(ko)/[[...slug]]/PageClient.jsx"),
    "utf-8",
  );
  const match = new RegExp(`routeId === "${routeId}"\\s*&&\\s*<([A-Z][\\w]*)`).exec(pageClient);
  return match ? match[1] : null;
}

// 문자열 포함으로 보면 주석 한 줄에 속는다 — 실제로 D-07 사유 주석의 "DownloadHub"
// 때문에 부채 두 건이 "해결됨"으로 잡혔다. import와 JSX 사용만 인정한다.
function usesResultActionCard(source) {
  return /<ResultActionCard[\s/>]/.test(source) && /from "@\/components\/ds\/ResultActionCard"/.test(source);
}

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
      const componentName = findComponent(route.component) ? route.component : dispatchedComponent(route.id);
      const file = componentName && findComponent(componentName);
      expect(file, `${route.id}(${route.component}) 컴포넌트를 찾지 못했다`).toBeTruthy();
      const source = readFileSync(file, "utf-8");
      if (usesResultActionCard(source)) continue;
      missing.push(`${route.id} ${route.component}`);
    }
    expect(
      missing,
      "공통 XLSX를 제공하는 ResultActionCard가 없다(product-ssot §5.5)",
    ).toEqual([]);
  });

  it("keeps the common workbook action mounted in ResultActionCard", () => {
    const source = readFileSync(path.join(COMPONENTS, "ds/ResultActionCard.jsx"), "utf-8");
    expect(source).toContain("<AnalysisExportProvider");
    expect(source).toContain("<DownloadHub");
  });
});
