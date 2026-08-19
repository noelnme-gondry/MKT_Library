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

// 허브를 쓰지 않는 것이 **맞는** 도구와 그 이유. 늘리려면 코드에도 사유를 남겨야 한다.
const EXEMPT = {
  "5-18-paid-organic": "산출물이 판정 한 줄과 수치 3개뿐이라 내보낼 계산 결과가 없다. 원천 데이터 되돌려주기는 §12.27 금지.",
  "5-18-cannibal": "맨밑 상세문서 탈출구(claude-ux §6)를 쓴다. 한 항목짜리 드롭다운은 클릭만 늘린다.",
  "5-18-mmm": "맨밑 상세문서 탈출구(claude-ux §6)를 쓴다.",
};

// 정당한 예외가 아니라 **부채**. PR #696이 5-18 안의 분석 다섯을 개별 도구로 승격하면서,
// 허브 안에서는 형제 단계가 제공하던 탈출구가 없는 채로 독립 랜딩이 된 자리다.
// 예외와 섞어 두면 "괜찮은 것"으로 굳으므로 따로 센다 — 이 목록은 줄어들기만 한다.
const KNOWN_GAPS = ["5-18-trend", "5-18-forecast"];

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
function usesDownloadHub(source) {
  return /<DownloadHub[\s/>]/.test(source) || /from "@\/components\/ds\/DownloadHub"/.test(source);
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
      if (usesDownloadHub(source)) continue;
      if (EXEMPT[route.id] || KNOWN_GAPS.includes(route.id)) continue;
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
      const componentName = findComponent(route.component) ? route.component : dispatchedComponent(route.id);
      const source = readFileSync(findComponent(componentName), "utf-8");
      expect(source, `${toolId} 예외 사유(${reason})가 코드에 없다`).toContain("D-07");
    }
  });

  // 부채는 늘지 않고 줄어들기만 한다. 고쳤으면 목록에서 지운다 — 남겨 두면
  // 다음 사람이 "원래 이런 것"으로 읽는다.
  it("never grows the known download gaps", () => {
    const stillMissing = KNOWN_GAPS.filter((toolId) => {
      const route = publishedTools.find((item) => item.id === toolId);
      if (!route) return false;
      const componentName = findComponent(route.component) ? route.component : dispatchedComponent(route.id);
      const file = componentName && findComponent(componentName);
      return file && !usesDownloadHub(readFileSync(file, "utf-8"));
    });
    expect(stillMissing.length, `고친 항목은 KNOWN_GAPS에서 지울 것: 현재 ${stillMissing.join(", ")}`).toBe(KNOWN_GAPS.length);
  });
});
