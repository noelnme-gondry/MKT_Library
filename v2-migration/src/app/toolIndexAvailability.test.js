import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 업로드 화면의 "이 CSV로 되는 분석"은 판정만으로는 부족하고 화면에 드러나야 한다.
 *
 * 한동안 그렇지 않았다. `globals.css`가 못 쓰는 도구를 흐리게 했는데
 * `library-workspace.css`가 `.app`을 앞에 붙여 특이도 0,3,0으로 `opacity: 1`을
 * 되돌려 놓아서, 20개 중 5개만 가능한 상태인데 화면에는 차이가 한 픽셀도 없었다.
 * 두 규칙 다 파일만 보면 멀쩡해 보이므로(§7 "개수가 아니라 캐스케이드를 볼 것)
 * 여기서 두 파일을 함께 읽어 취소를 막는다.
 */
const CSS_DIR = join(process.cwd(), "src/app");
const read = (name) => readFileSync(join(CSS_DIR, name), "utf8");
// 주석 안의 옛 규칙에 속지 않도록 먼저 지운다(§16).
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("업로드 화면 도구 자격 표시", () => {
  it("자격 묶음을 그릴 규칙이 있다", () => {
    // 자격은 묶음(되는 것 / 컬럼이 더 필요한 것)과 개수로 말한다.
    const globals = stripComments(read("globals.css"));
    expect(globals).toMatch(/\.tool-index__count\s*\{/);
    expect(globals).toMatch(/\.tool-index__stage--blocked\b/);
  });

  it("어느 전역 CSS도 흐림 표식을 되돌리지 않는다", () => {
    for (const name of ["globals.css", "library-workspace.css"]) {
      const rules = stripComments(read(name)).split("}");
      const cancels = rules.filter((rule) => {
        const [selector, body = ""] = rule.split("{");
        if (!selector.includes("is-dim") || !selector.includes("tool-index")) return false;
        return /opacity\s*:\s*1\b/.test(body);
      });
      expect(cancels, `${name}: ${cancels.join(" / ")}`).toHaveLength(0);
    }
  });

  it("흐림 규칙 자체는 남아 있다 — 가드가 지킬 대상이 사라지면 가드도 무의미하다", () => {
    // 예외가 아니라 근거를 고정한다: 이 줄이 사라지면 위 가드는 아무것도 안 지킨다.
    expect(stripComments(read("globals.css"))).toMatch(/\.tool-index__item\.is-dim[^{]*\{[^}]*opacity\s*:\s*\.48/);
  });
});
