/* 숫자·통화 표시의 로케일 고정 가드.
 *
 * `utils/format.js`(표시 SSOT)는 `toLocaleString("en-US", …)`로 로케일을 고정한다.
 * `toLocaleString(undefined, …)`는 **브라우저 로케일**이 구분자를 정하므로 같은 값이
 * 기기마다 다르게 그려진다 — de-DE 브라우저에서 `$1,234.50`이 `$1.234,50`이 된다.
 * KO/EN 한 사이트에서 도구마다 금액 표기가 갈리는 정체가 이것이었다(5-4·5-21·5-2 viz
 * ·5-18 계열 6곳).
 *
 * 값이 아니라 **근거**를 고정한다: SSOT가 en-US를 쓰는 한 표시층도 로케일을 명시해야
 * 한다. SSOT가 다른 로케일로 옮겨가면 아래 단언이 먼저 무너져 이 가드도 같이 고쳐진다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("숫자 표시 로케일 고정", () => {
  const files = walk(SRC);

  it("표시 SSOT가 로케일을 명시한다 (이 가드의 근거)", () => {
    const format = fs.readFileSync(path.join(SRC, "utils/format.js"), "utf8");
    expect(format).toContain('toLocaleString("en-US"');
    expect(stripComments(format)).not.toContain("toLocaleString(undefined");
  });

  it("어떤 소스도 toLocaleString(undefined, …)로 브라우저 로케일에 맡기지 않는다", () => {
    const offenders = [];
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      if (source.includes("toLocaleString(undefined")) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders, `로케일을 명시할 것(예: "en-US"): ${offenders.join(", ")}`).toEqual([]);
  });

});
