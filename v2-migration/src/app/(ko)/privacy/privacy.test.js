import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const koSource = stripSourceComments(readFileSync(fileURLToPath(new URL("./page.js", import.meta.url)), "utf8"));
const enSource = stripSourceComments(readFileSync(fileURLToPath(new URL("../../(en)/en/privacy/page.js", import.meta.url)), "utf8"));

describe("decision-review privacy contract", () => {
  it("states the Korean opt-in, exclusion, opt-out, and deletion rules", () => {
    expect(koSource).toContain("결정 기록은 기본적으로 현재 세션에서만 유지");
    expect(koSource).toContain("이 기기에 결정 요약 저장");
    expect(koSource).toContain("도구 ID·언어");
    expect(koSource).toContain("분석 결과에서 자동으로 채운 채널·캠페인·소재·행동·분석 요소명과 요약 수치");
    expect(koSource).toContain("원본 CSV 행 전체·파일명·매핑·필터·입력 서명·차트 데이터");
    expect(koSource).toContain("저장을 끄면 영속 사본이 제거");
    expect(koSource).toContain("주간 검토의 전체 삭제");
    expect(koSource).toContain('updated="2026-08-01"');
  });

  it("keeps the English privacy contract equivalent", () => {
    expect(enSource).toContain("Decision records stay in the current session by default");
    expect(enSource).toContain("Keep decision summaries on this device");
    expect(enSource).toContain("tool ID and language");
    expect(enSource).toContain("accepted from an analysis-result prefill");
    expect(enSource).toContain("Full source CSV rows, file names, mappings, filters, input signatures, and chart data");
    expect(enSource).toContain("Turning storage off removes the persistent copy");
    expect(enSource).toContain("Delete all records in Weekly Review");
    expect(enSource).toContain('updated="2026-08-01"');
  });
});
