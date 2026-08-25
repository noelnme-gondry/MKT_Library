import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const COMPONENTS = path.join(process.cwd(), "src/components");
const GLOBALS = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf-8");

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = path.join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return full.endsWith(".jsx") && !full.includes(".test.") ? [full] : [];
});

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("도구 안 필터는 한 패턴을 쓴다", () => {
  it("정의가 없는 `.form-row`를 컨트롤 컨테이너로 쓰지 않는다", () => {
    // 이 가드의 근거는 "globals.css에 정의가 없다"이다. 누군가 나중에 정의를
    // 추가하면 이 단언이 먼저 깨져서 가드를 다시 판단하게 된다 — 근거가 사라지면
    // 예외도 무너져야 한다.
    expect(GLOBALS.includes(".form-row")).toBe(false);
    const offenders = walk(COMPONENTS)
      .filter((file) => stripComments(readFileSync(file, "utf-8")).includes('className="form-row"'))
      .map((file) => path.basename(file));
    expect(offenders, "스타일이 없는 클래스를 쓰면 그 도구의 필터만 날것으로 보인다").toEqual([]);
  });

  it("로컬 필터를 쓰는 도구는 공용 컨트롤 셸을 쓴다", () => {
    // `.analysis-local-controls`는 globals.css가 소유한 공용 필터 셸이다.
    expect(GLOBALS).toMatch(/\.analysis-local-controls\s*\{/);
    expect(GLOBALS).toMatch(/\.analysis-local-controls__inner\s*\{/);
    const users = walk(COMPONENTS)
      .filter((file) => stripComments(readFileSync(file, "utf-8")).includes("analysis-local-controls"));
    expect(users.length).toBeGreaterThanOrEqual(5);
  });
});
