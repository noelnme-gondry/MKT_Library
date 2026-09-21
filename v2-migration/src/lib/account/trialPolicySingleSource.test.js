import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import {
  PRO_TRIAL_DAYS,
  trialUntilSql,
} from "./archiveContract";

// 이 파일이 막는 사고: 체험 길이가 JS 상수와 SQL 리터럴로 갈리는 것.
// 고치기 전 `trial_started_at+INTERVAL '14 days'`가 결제 시작일 계산과 만료
// 알림 두 곳에 각각 박혀 있었다. JS만 7일로 바꿨다면 화면은 7일인데 메일과
// 결제 기산일은 14일로 남아, 아무도 눈치채지 못한 채 두 진실이 공존했을 것이다.
// 대상을 손으로 적지 않고 소스 전체에서 파생한다(§7).
const SOURCES = globSync("src/**/*.{js,jsx}", { cwd: process.cwd() })
  .filter((file) => !file.includes("archiveContract") && !/\.test\./.test(file))
  .map((file) => ({ file, code: stripComments(readFileSync(file, "utf8")) }));

// 주석을 먼저 지운다 — 문자열 포함 검사는 자기 설명 주석에 속는다(§16).
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("trial length has one source", () => {
  it("scans a meaningful number of files, so a broken glob cannot pass silently", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
  });

  it("no file re-declares the trial window as its own SQL interval", () => {
    // 체험 기간에 붙는 INTERVAL만 본다. `x.until-INTERVAL '7 days'`처럼
    // 알림 선행 기간은 체험 길이가 아니므로 대상이 아니다.
    const offenders = SOURCES
      .filter(({ code }) => /trial_started_at\s*\+\s*INTERVAL/i.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the shared SQL expression carries the one policy", () => {
    const sql = trialUntilSql("a");
    expect(sql).toContain("a.trial_started_at");
    expect(sql).toContain(`INTERVAL '${PRO_TRIAL_DAYS} days'`);
    // 길이가 시작 시점으로 갈리지 않는다 — 분기가 남아 있으면 계정마다 다른
    // 만료일이 나오고 화면·메일·결제 기산일이 어긋난다.
    expect(sql).not.toContain("CASE WHEN");
    // 별칭 없이도 같은 컬럼을 가리켜야 한다(결제 경로가 이 형태를 쓴다).
    expect(trialUntilSql()).toBe(`(trial_started_at+INTERVAL '${PRO_TRIAL_DAYS} days')`);
  });

  // 주의: "파일에 INTERVAL이 있나"로 세면 OAuth 시도·세션 TTL 같은 무관한
  // 기간까지 잡힌다(실제로 accountServer.js가 그렇게 오탐으로 걸렸다).
  // 체험 만료를 실제로 계산하는 자리의 표식은 `GREATEST(... gop_paid_until)`이다.
  it("every query that computes trial expiry goes through the shared expression", () => {
    // `GREATEST(...)`로 유료 만료와 체험 만료 중 큰 쪽을 고르는 질의가 대상이다.
    // `gop_paid_until`만 읽는 자리(accountServer의 세션 조회)는 체험을 SQL에서
    // 계산하지 않으므로 대상이 아니다 — JS의 accountEntitlement가 적용한다.
    const callers = SOURCES.filter(({ code }) => /GREATEST/.test(code) && /gop_paid_until/.test(code));
    expect(callers.length).toBeGreaterThan(0);
    for (const { file, code } of callers) {
      expect(code, `${file} computes trial expiry without trialUntilSql`).toContain("trialUntilSql");
    }
  });
});
