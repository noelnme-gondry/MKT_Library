import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 유입 경로 서베이는 첫 방문에 화면 **가운데** 뜬다. 브라우저 테스트는 전부 첫
 * 방문이라 카드가 클릭을 가로채고, 스펙은 타임아웃까지 재시도하다 죽는다.
 *
 * `playwright.config.js`가 storageState로 "이미 답함"을 시드해 두지만 **그 시드는
 * `localStorage.clear()` 한 줄에 지워진다** — 실제로 그렇게 CI가 두 번 빨개졌다
 * (첫 번째는 지연 0으로 바꾸면서, 두 번째는 시드가 clear에 지워져서).
 *
 * 그래서 손으로 쓴 목록이 아니라 **스펙 전수에서 파생**해 강제한다.
 */
const SUPPORT = "e2e/support/sourceSurvey.js";
const KEY_NAME = "SOURCE_SURVEY_ANSWERED_KEY";

const specs = readdirSync("e2e")
  .filter((entry) => entry.endsWith(".spec.js"))
  .map((entry) => ({ file: join("e2e", entry), source: readFileSync(join("e2e", entry), "utf8") }));

describe("e2e에서 유입 경로 서베이가 다른 스펙을 가로막지 않는다", () => {
  it("검사 대상 스펙이 실제로 존재한다", () => {
    // 스캐너가 깨져 0건이 되면 아래 검사가 조용히 통과한다(§7 규모 단언).
    expect(specs.length).toBeGreaterThanOrEqual(20);
  });

  it("키는 한 곳이 소유한다", () => {
    const support = readFileSync(SUPPORT, "utf8");
    expect(support).toContain("mkt-library-source-survey-answered");
    // 설정이 그 상수를 실제로 쓴다 — 문자열을 다시 적으면 다음 리네임에 어긋난다.
    const config = readFileSync("playwright.config.js", "utf8");
    expect(config).toContain(KEY_NAME);
    expect(config).toMatch(/storageState/);
  });

  it("저장소를 비우는 스펙은 비운 뒤 서베이 키를 다시 세운다", () => {
    const clearing = specs.filter(({ source }) => /localStorage\.clear\(\)/.test(source));
    // 지금은 한 곳뿐이지만, 새로 생기면 여기서 먼저 잡힌다.
    const missing = clearing.filter(({ source }) => !source.includes(KEY_NAME));
    expect(missing.map((entry) => entry.file)).toEqual([]);
  });

  it("서베이를 실제로 여는 전용 스펙이 있다", () => {
    // 시드가 기능을 통째로 가리지 않도록, 한 스펙은 키를 지우고 카드를 본다.
    const dedicated = specs.find(({ file }) => file.endsWith("source-survey.spec.js"));
    expect(dedicated).toBeTruthy();
    expect(dedicated.source).toMatch(/removeItem/);
    expect(dedicated.source).toContain(KEY_NAME);
  });
});
