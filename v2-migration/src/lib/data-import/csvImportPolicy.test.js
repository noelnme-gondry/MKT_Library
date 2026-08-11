import { describe, expect, it } from "vitest";
import {
  CSV_IMPORT_LIMITS,
  CsvImportPolicyError,
  assertCsvFileSize,
  csvFailureState,
  csvImportErrorMessage,
} from "./csvImportPolicy";

// CSV 경로엔 크기 상한이 전혀 없어 과대 파일이 탭 프로세스를 죽였다(error.js가
// 잡을 수 없는 유일한 실패). 사전 차단이 유일한 방어이므로 계약을 고정한다.
describe("csvImportPolicy", () => {
  it("상한 이하 크기는 통과한다", () => {
    expect(() => assertCsvFileSize(1024)).not.toThrow();
    expect(() => assertCsvFileSize(CSV_IMPORT_LIMITS.maxFileBytes)).not.toThrow();
  });

  it("상한 초과는 csv_file_too_large로 막는다", () => {
    try {
      assertCsvFileSize(CSV_IMPORT_LIMITS.maxFileBytes + 1);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportPolicyError);
      expect(error.code).toBe("csv_file_too_large");
    }
  });

  it("빈 파일·비정상 크기는 csv_empty_file로 막는다", () => {
    for (const value of [0, -1, NaN, undefined]) {
      expect(() => assertCsvFileSize(value)).toThrow(CsvImportPolicyError);
    }
  });

  it("에러 메시지가 원인과 다음 행동을 함께 준다 (KR/EN)", () => {
    const ko = csvImportErrorMessage("csv_file_too_large", "ko");
    const en = csvImportErrorMessage("csv_file_too_large", "en");
    expect(ko).toContain("100MB");
    expect(ko).toMatch(/나누|지운/); // 다음 행동 제시
    expect(en).toContain("100MB");
    expect(en).toMatch(/Split|remove/);
    expect(/[가-힣]/.test(en)).toBe(false);
  });

  it("실패 상태를 계측용으로 구분한다", () => {
    expect(csvFailureState({ code: "csv_file_too_large" })).toBe("file_too_large");
    expect(csvFailureState({ code: "csv_empty_file" })).toBe("parse_error");
    expect(csvFailureState(null)).toBe("parse_error");
  });
});
