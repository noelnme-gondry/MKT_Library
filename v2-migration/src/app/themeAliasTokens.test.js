import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 다른 토큰을 그대로 가리키는 **별칭 토큰**은 라이트에서도 다시 선언해야 한다.
 *
 * `--bg-3: var(--surface-container)`를 `:root`에만 두면 그 값은 `:root`에서
 * 확정된다. `body.light-mode`가 `--surface-container`를 밝게 바꿔도 `--bg-3`은
 * 이미 결정된 뒤라 **다크값으로 굳는다**. 배경만 어두운 채 글자색은 라이트로
 * 뒤집히므로 대비가 무너진다 — 실측으로 1.08:1(`.date-range-presets button:hover`)
 * 까지 내려갔고, 새로 넣은 규칙 하나가 e2e `@light-en` 5건을 깨뜨린 적도 있다.
 *
 * **grep으로는 안 보인다**: `--surface-container`를 찾으면 라이트 정의가 멀쩡히
 * 나온다. 별칭을 한 단계 따라가야 드러나므로 여기서 파싱해 막는다.
 *
 * 색의 다크/라이트 쌍은 테마 시스템이라 값이 갈리는 것 자체는 정상이다. 여기서
 * 보는 것은 "값을 갈라 둔 토큰을 가리키면서 자기는 한쪽에만 있는" 경우뿐이다.
 */
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
// 주석 안의 옛 선언에 속지 않도록 먼저 지운다(§16).
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function blockBodies(selectorPattern) {
  const bodies = [];
  for (const match of SOURCE.matchAll(selectorPattern)) {
    const start = SOURCE.indexOf("{", match.index);
    if (start < 0) continue;
    let depth = 0;
    let index = start;
    for (; index < SOURCE.length; index += 1) {
      if (SOURCE[index] === "{") depth += 1;
      else if (SOURCE[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(SOURCE.slice(start + 1, index));
  }
  return bodies;
}

function declarations(bodies) {
  const found = new Map();
  for (const body of bodies) {
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
      found.set(name, value.trim()); // 마지막 정의가 이긴다(§7)
    }
  }
  return found;
}

const dark = declarations(blockBodies(/(?<![\w.#[-]):root\s*(?=\{)/g));
const light = declarations(blockBodies(/body\.light-mode\s*(?=\{)/g));

describe("테마 별칭 토큰", () => {
  it("스캐너가 토큰을 실제로 읽었다", () => {
    // 파서가 깨지면 위반 0건으로 조용히 통과한다 — 규모를 먼저 단언한다(§7).
    expect(dark.size).toBeGreaterThan(80);
    expect(light.size).toBeGreaterThan(30);
    expect(dark.get("--bg-3")).toBe("var(--surface-container)");
  });

  it("별칭이 가리키는 토큰의 라이트 재정의가 별칭에도 닿는다", () => {
    const aliases = [...dark].flatMap(([name, value]) => {
      const target = /^var\((--[\w-]+)\)$/.exec(value);
      return target ? [[name, target[1]]] : [];
    });
    expect(aliases.length, "별칭을 하나도 못 찾았다면 파서가 깨진 것이다").toBeGreaterThan(5);

    const frozen = aliases
      .filter(([name, target]) => !light.has(name) && light.has(target))
      .map(([name, target]) => `${name} → ${target} (라이트에서 ${light.get(target)}로 바뀌지만 ${name}은 다크로 굳는다)`);
    expect(frozen, frozen.join("\n")).toEqual([]);
  });
});
