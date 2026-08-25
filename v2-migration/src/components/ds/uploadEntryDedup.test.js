import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const COMPONENTS = path.join(process.cwd(), "src/components");

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = path.join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return full.endsWith(".jsx") && !full.includes(".test.") ? [full] : [];
});

// 주석은 먼저 지운다 — "왜 이렇게 하지 않는가"를 적어 둔 문장에 걸리면
// 가드가 통과 여부를 거꾸로 판정한다(§16 자기 설명 주석에 속는 검사).
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("업로드 화면 중복 방지", () => {
  it("예시 데이터 진입 버튼은 한 화면에 하나만 그린다", () => {
    // CsvGuide가 예시 버튼을 그리는 화면에서 CsvUploader가 같은 버튼을 또 그리면
    // 나란히 놓인 같은 동작의 버튼 둘이 되어 "무엇이 다른가"를 먼저 묻게 만든다.
    const source = stripComments(readFileSync(path.join(COMPONENTS, "CsvUploader.jsx"), "utf-8"));
    expect(source).toMatch(/showGuide\s*&&\s*<CsvGuide/);
    expect(source).toMatch(/!showGuide\s*&&\s*\(\s*<div className="csv-entry-actions"/);
  });

  it("CsvUploader를 쓰는 도구는 그 위에 같은 빈 상태 문구를 다시 쓰지 않는다", () => {
    /* 자체 업로더를 가진 도구(9-1)는 자기 화면의 제목이 필요하다 — 중복은
     * "공용 업로더가 이미 말한 것을 도구가 또 말하는" 경우만이다. */
    const offenders = walk(COMPONENTS)
      .filter((file) => file.includes(`${path.sep}tools${path.sep}`))
      .filter((file) => {
        const source = stripComments(readFileSync(file, "utf-8"));
        if (!source.includes("<CsvUploader")) return false;
        return /데이터를 준비하세요|Prepare your data/.test(source);
      })
      .map((file) => path.basename(file));
    expect(offenders, "공용 업로더를 쓰면 빈 상태 문구도 업로더가 소유한다").toEqual([]);
  });
});
