import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const SRC_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 기사("바이브 코딩 대시보드가 형편없어 보이는 10가지 이유") 5번은 "0~9라는 눈금이
// 무엇을 뜻하는지 바로 알 수 없다"였다. 실측하니 차트를 그리는 파일 28개 중
// **13개가 축 제목 0건**이었고, 하필 5-2 대시보드 탭이 통째로 거기 있었다 —
// 제일 많이 보는 화면이다.
//
// 대상은 손으로 쓴 목록이 아니라 **직교 좌표계를 선언한 파일**에서 파생한다
// (§7 "커버리지 가드가 손으로 쓴 배열을 돌면 가드가 아니다"). 원형·도넛은 축이
// 없으므로 `scales:` 자체가 없어 자연히 대상 밖이다.
//
// 예외는 주석이 아니라 **코드의 표식**으로 선언한다(§16 — 표식을 주석에 두면
// 가드가 주석에 속는다). 파일이 `CHART_AXIS_TITLE_EXEMPT`를 export하면서 사유
// 문자열을 담아야 통과한다.
const EXEMPT_MARKER = /export const CHART_AXIS_TITLE_EXEMPT\s*=\s*"([^"]{10,})"/;

function collectJsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, acc);
    else if (/\.(jsx|js)$/.test(entry.name) && !entry.name.includes(".test.")) acc.push(full);
  }
  return acc;
}

export function describesCartesianChart(source) {
  return /new Chart\(/.test(source) && /\bscales:\s*\{/.test(source);
}

export function declaresAxisTitle(source) {
  return /title:\s*\{\s*display:\s*true/.test(source);
}

describe("직교 좌표 차트는 축이 무엇인지 말한다", () => {
  const files = collectJsFiles(SRC_ROOT).map((file) => ({
    file,
    source: stripSourceComments(readFileSync(file, "utf8")),
  }));

  it("가드의 근거 — 검사 대상이 실제로 여러 개다", () => {
    const targets = files.filter((entry) => describesCartesianChart(entry.source));
    // 스캐너가 깨지면 0건이 되어 조용히 통과한다(§7). 규모를 함께 단언한다.
    expect(targets.length).toBeGreaterThan(15);
  });

  it("모든 직교 차트 파일이 축 제목을 선언하거나 사유 표식을 갖는다", () => {
    const offenders = [];
    for (const { file, source } of files) {
      if (!describesCartesianChart(source)) continue;
      if (declaresAxisTitle(source)) continue;
      if (EXEMPT_MARKER.test(readFileSync(file, "utf8"))) continue;
      offenders.push(path.relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it("축 제목이 빠진 파일을 실제로 잡는다", () => {
    const regressed = 'new Chart(el, { options: { scales: { x: { ticks: {} } } } });';
    expect(describesCartesianChart(regressed)).toBe(true);
    expect(declaresAxisTitle(regressed)).toBe(false);
  });
});
