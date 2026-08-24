import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

/**
 * 도구에 들어가자마자 샘플 데이터가 뜨면 두 가지가 동시에 가려진다 — "여기가 내
 * 데이터를 올리는 곳"이라는 사실과, 화면의 숫자가 내 것인지 예시인지. 예시는
 * 업로드 안내의 버튼으로 **명시적으로만** 들어온다.
 *
 * 한 파일만 고치면 옆 도구에서 그대로 재발한다(§7) — 소스에서 파생해 전부 훑는다.
 */
const SRC = path.join(process.cwd(), "src");

function collectSources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSources(full);
    if (!/\.jsx?$/.test(entry.name) || /\.test\.jsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe("도구 진입 시 데모 자동 로드 금지", () => {
  const files = collectSources(SRC);

  it("마운트 시 데모를 자동으로 불러오는 코드가 없다", () => {
    const offenders = files.filter((file) => {
      const source = stripSourceComments(fs.readFileSync(file, "utf8"));
      // `if (!hasData && !demoDisabled) loadDemo()` 형태 — 진입 자동 로드의 서명.
      return /!\s*hasData\s*&&\s*!\s*demoDisabled/.test(source);
    });
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it("demoDisabled를 읽는 곳은 store와 진입 게이트뿐이다", () => {
    // 도구 컴포넌트가 이 값을 읽는다면 자동 로드 분기를 다시 만들었다는 뜻이다.
    const readers = files
      .filter((file) => /state\.demoDisabled|s\.demoDisabled/.test(stripSourceComments(fs.readFileSync(file, "utf8"))))
      .map((file) => path.relative(SRC, file));
    expect(readers).toEqual([]);
  });
});
