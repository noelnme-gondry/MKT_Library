import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROUTES, isRoutePublished } from "./routeMap";

// docs/product-ssot.md §4.2는 "공개 분석 도구" 표를 대외 카피의 정본으로 선언한다(§2.12).
// 그런데 그 표는 손으로 적혀 있어 도구가 늘어도 따라오지 않는다 — 실제로 5-29가 발행된
// 뒤에도 표는 19개인 채였고, 거기서 문장을 가져오면 틀린 수가 그대로 대외로 나간다.
// 표를 없애는 대신(사람이 읽는 카탈로그라 가치가 있다) 라우트에서 파생 검사한다.
const SSOT = path.join(process.cwd(), "../docs/product-ssot.md");

function publishedTools() {
  return ROUTES.filter((route) => isRoutePublished(route) && /^(5-|9-)/.test(route.id));
}

function catalogRows(markdown) {
  const section = markdown.split(/^### 4\.2 /m)[1];
  if (!section) return null;
  const body = section.split(/^### /m)[0];
  return [...body.matchAll(/^\|\s*([0-9][\w-]*)\s*\|([^|]*)\|\s*`([^`]+)`/gm)]
    .map((match) => ({ id: match[1].trim(), slug: match[3].trim() }));
}

describe("product-ssot 공개 도구 카탈로그", () => {
  const markdown = readFileSync(SSOT, "utf8");

  it("표가 파싱된다 — 형식이 바뀌면 검사가 조용히 0건이 되면 안 된다", () => {
    const rows = catalogRows(markdown);
    expect(rows, "§4.2 표를 찾지 못했다. 파서와 문서 형식을 함께 확인할 것").not.toBeNull();
    expect(rows.length).toBeGreaterThan(10);
  });

  it("발행 라우트와 정확히 같은 도구를 같은 slug로 싣는다", () => {
    const rows = catalogRows(markdown);
    const documented = new Set(rows.map((row) => row.id));
    const published = publishedTools();
    const missing = published.filter((route) => !documented.has(route.id)).map((route) => route.id);
    const extra = rows.filter((row) => !published.some((route) => route.id === row.id)).map((row) => row.id);
    expect(missing, "발행됐는데 §4.2에 없는 도구").toEqual([]);
    expect(extra, "§4.2에 있는데 발행되지 않은 도구").toEqual([]);
    const slugMismatch = rows
      .map((row) => [row, published.find((route) => route.id === row.id)])
      .filter(([row, route]) => route && !row.slug.startsWith(route.slug))
      .map(([row, route]) => `${row.id}: 문서 ${row.slug} ≠ 라우트 ${route.slug}`);
    expect(slugMismatch).toEqual([]);
  });

  // §10 백로그는 각 항목이 "그때 몇 개였는가"를 기록한 이력이라 지금 수와 달라야
  // 정직하다. 살아 있는 카탈로그(§1~§4)만 현재 개수와 맞춘다.
  it("살아 있는 카탈로그의 도구 수가 실제 개수와 일치한다", () => {
    const count = publishedTools().length;
    const live = markdown.split(/^## 10\. /m)[0];
    expect(live).toContain(`### 4.2 공개 분석 도구 ${count}개`);
    const claimed = [...live.matchAll(/공개 분석 도구 (\d+)개|"(\d+)개 분석 도구"/g)]
      .map((match) => Number(match[1] || match[2]));
    expect(claimed.length).toBeGreaterThan(1);
    expect([...new Set(claimed)]).toEqual([count]);
  });
});
