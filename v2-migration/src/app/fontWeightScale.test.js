import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

// 굵기는 세 단만 쓴다: 본문 400 · 강조·라벨·버튼 600 · 제목 700.
// 2026-09-24 실측에서 CSS에 굵기가 25종(430·450·520·540·550·560·570·590·610·620·
// 640·650·680·690·720·730·740·750·760·780·800…)이었고, 한 화면 첫 화면에만 8~10종이
// 섞여 "볼드가 제멋대로"로 읽혔다(사용자 지적). 사이값은 눈으로 구분되지 않고 위계만
// 흐린다. 이 가드는 값이 아니라 "세 단에서만 고른다"는 계약을 지킨다.
// @font-face의 굵기 범위(`100 900`)는 글꼴이 지원하는 축이지 선택이 아니므로 대상 밖.
const ALLOWED = new Set(["400", "600", "700", "normal", "bold", "inherit"]);
const SRC_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function collect(dir, ext, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, ext, acc);
    else if (ext.some((e) => entry.name.endsWith(e)) && !entry.name.includes(".test.")) acc.push(full);
  }
  return acc;
}

export function offScaleCssWeights(css) {
  const found = [];
  for (const m of css.matchAll(/font-weight:\s*([^;}\n!]+)/g)) {
    const value = m[1].trim();
    if (/^\d+\s+\d+$/.test(value)) continue; // @font-face 범위
    if (!ALLOWED.has(value)) found.push(m[0]);
  }
  for (const m of css.matchAll(/\bfont:\s*(\d{3})\s/g)) if (!ALLOWED.has(m[1])) found.push(m[0]);
  return found;
}

export function offScaleInlineWeights(source) {
  // 조건식(`on ? 700 : 500`)의 모든 갈래를 본다.
  return [...source.matchAll(/fontWeight:\s*([^,}\n]+)/g)]
    .filter((m) => [...m[1].matchAll(/\b(\d{3})\b/g)].some((n) => !ALLOWED.has(n[1]))).map((m) => m[0].trim());
}

describe("글자 굵기는 400 · 600 · 700 세 단", () => {
  const cssFiles = collect(path.join(SRC_ROOT, "app"), [".css"]).concat(collect(path.join(SRC_ROOT, "components"), [".css"]));
  const jsFiles = collect(SRC_ROOT, [".jsx", ".js"]);

  it("스캐너가 실제로 무언가를 센다(0건으로 조용히 통과하지 않게)", () => {
    const total = cssFiles.reduce((n, f) => n + (readFileSync(f, "utf8").match(/font-weight:/g) || []).length, 0);
    expect(total).toBeGreaterThan(200);
    expect(offScaleCssWeights(".a{font-weight: 650} .b{font: 750 12px x}")).toHaveLength(2);
    expect(offScaleCssWeights("@font-face{font-weight:100 900} .a{font-weight: 600}")).toHaveLength(0);
    expect(offScaleInlineWeights("style={{ fontWeight: 650 }} x={{ fontWeight: on ? 700 : 500 }}")).toHaveLength(2);
  });

  it("CSS는 세 단 밖의 굵기를 쓰지 않는다", () => {
    const bad = cssFiles.flatMap((f) => offScaleCssWeights(stripSourceComments(readFileSync(f, "utf8"))).map((d) => `${path.relative(SRC_ROOT, f)}: ${d}`));
    expect(bad).toEqual([]);
  });

  it("인라인 style도 세 단 밖의 굵기를 쓰지 않는다", () => {
    const bad = jsFiles.flatMap((f) => offScaleInlineWeights(stripSourceComments(readFileSync(f, "utf8"))).map((d) => `${path.relative(SRC_ROOT, f)}: ${d}`));
    expect(bad).toEqual([]);
  });
});
