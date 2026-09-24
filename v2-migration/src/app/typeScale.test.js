import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const RAW_CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));
// 폰 하한 블록 — 폰에서 작은 두 단(xs·sm)을 본문 크기로 올리는 단 하나의 예외. 스케일 정의(한 번씩만)
// 검사에서는 빼고, 모양은 아래 테스트가 따로 고정한다.
const PHONE_FLOOR = /@media \(max-width: 768px\)\s*\{\s*:root\s*\{([^{}]*)\}\s*\}/;
const CSS = RAW_CSS.replace(PHONE_FLOOR, "");
const SRC_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 크기를 안 정하면 앱은 제일 작은 쪽으로 수렴한다(§7). 2026-09-04에 그 진단을
// 적고 12px 하한만 걸었는데, 하한은 "몇 종을 쓰는가"를 전혀 안 본다 — 그 사이
// 폰트 선언이 912곳·27종에서 1,084곳·29종으로 **더 늘었다**. 교훈을 적었다는
// 사실이 교훈이 지켜지지 않았다는 사실을 가린 셈이다.
//
// 스케일 자체는 새로 만든 게 아니라 `globals.css`가 이미 갖고 있던 것이다
// (`--fs-xs`~`--fs-2xl`, 7단 + 히어로 fluid clamp를 위한 `--fs-3xl`). 정의만 있고 소비처가 3곳뿐이라 아무 일도 하지
// 않고 있었다 — §16 "신호를 만들어 놓고 읽는 곳을 안 배선한 자리"의 재발.
// 이 가드는 값이 아니라 **한 곳에서 고른다**는 계약을 지킨다: 스케일 밖 px를
// 새로 적을 수 없고, 그러려면 먼저 스케일을 고쳐야 한다.
const SCALE_TOKEN = /^--fs-(?:xs|sm|base|md|lg|xl|2xl|3xl)$/;

export function collectScaleDefinitions(css) {
  const scale = new Map();
  for (const match of css.matchAll(/(--fs-[a-z0-9-]+):\s*([^;]+);/g)) {
    const list = scale.get(match[1]) || [];
    list.push(match[2].trim());
    scale.set(match[1], list);
  }
  return scale;
}

// `font-size: 12px` 와 `font: 700 12px/1.4 …` 두 형태. shorthand는 단위가 붙은
// 첫 px가 크기 슬롯이다(weight는 단위 없음). line-height(`/16px`)는 크기가
// 아니므로 슬래시 뒤는 세지 않는다.
export function collectOffScaleDeclarations(css) {
  const found = [];
  css.split("\n").forEach((line, index) => {
    if (/--(?:fs|radius)[a-z0-9-]*\s*:/.test(line)) return;
    for (const match of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      found.push(`${index + 1}: ${match[0]}`);
    }
    for (const match of line.matchAll(/font:\s*([^;{}]+)/g)) {
      const sizeSlot = match[1].split("/")[0];
      for (const size of sizeSlot.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)px/g)) {
        found.push(`${index + 1}: font … ${size[0]}`);
      }
    }
  });
  return found;
}

export function collectOffScaleInline(source) {
  return [...source.matchAll(/fontSize:\s*"?(\d+(?:\.\d+)?)(?:px)?"?\s*[,}]/g)].map((m) => m[0].trim());
}

function collectJsxFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsxFiles(full, acc);
    else if (entry.name.endsWith(".jsx") && !entry.name.includes(".test.")) acc.push(full);
  }
  return acc;
}

describe("타입 스케일은 한 곳에서만 정해진다", () => {
  it("가드의 근거 — 스케일 7단이 조건 없는 :root에 한 번씩만 선언돼 있다", () => {
    const scale = collectScaleDefinitions(CSS);
    const steps = [...scale.keys()].filter((token) => SCALE_TOKEN.test(token));
    expect(steps.sort()).toEqual(["--fs-2xl", "--fs-3xl", "--fs-base", "--fs-lg", "--fs-md", "--fs-sm", "--fs-xl", "--fs-xs"]);
    for (const [token, values] of scale) {
      expect(values, `${token}이 두 번 선언되면 앞엣것을 읽는 사람이 속는다(§7)`).toHaveLength(1);
    }
  });

  it("스케일 단은 커지는 순서고 중복 값이 없다", () => {
    const scale = collectScaleDefinitions(CSS);
    const sizes = ["--fs-xs", "--fs-sm", "--fs-base", "--fs-md", "--fs-lg", "--fs-xl", "--fs-2xl", "--fs-3xl"].map((token) =>
      Number(scale.get(token)[0].replace("px", "")),
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("폰 하한은 작은 두 단만 본문 크기로 올린다(다른 단은 건드리지 않는다)", () => {
    const block = RAW_CSS.match(PHONE_FLOOR);
    expect(block, "폰 하한 블록이 사라지면 폰 글자가 다시 12px로 돌아간다").toBeTruthy();
    const scale = collectScaleDefinitions(CSS);
    const floor = collectScaleDefinitions(block[1]);
    expect([...floor.keys()].sort()).toEqual(["--fs-sm", "--fs-xs"]);
    for (const values of floor.values()) expect(values).toEqual([scale.get("--fs-base")[0]]);
  });

  it("globals.css에 스케일 밖 px 폰트가 없다", () => {
    expect(collectOffScaleDeclarations(CSS)).toEqual([]);
  });

  it("JSX 인라인에도 px 폰트 리터럴이 없다", () => {
    const offenders = [];
    for (const file of collectJsxFiles(SRC_ROOT)) {
      const hits = collectOffScaleInline(stripSourceComments(readFileSync(file, "utf8")));
      for (const hit of hits) offenders.push(`${path.relative(SRC_ROOT, file)}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("스케일 밖 px가 다시 들어오면 잡는다", () => {
    expect(collectOffScaleDeclarations(".x { font-size: 11px; }")).toHaveLength(1);
    expect(collectOffScaleDeclarations(".y { font: 700 9px var(--font-mono); }")).toHaveLength(1);
    expect(collectOffScaleInline('<i style={{ fontSize: "11px" }} />')).toHaveLength(1);
  });

  it("line-height·padding·반경을 크기 슬롯으로 오인하지 않는다", () => {
    const safe = ".x { padding: 2px 4px; font: 700 var(--fs-xs)/16px var(--font-mono); border-radius: 6px; }";
    expect(collectOffScaleDeclarations(safe)).toEqual([]);
  });
});
