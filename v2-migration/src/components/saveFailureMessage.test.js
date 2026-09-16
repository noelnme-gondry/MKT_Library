import { describe, it, expect } from "vitest";
import { saveFailureMessage } from "@/components/ReviewSaveDialog";

/**
 * 저장 실패 안내가 "다시 시도하세요" 하나로 수렴하던 시절, 거기엔 재시도로
 * 절대 안 풀리는 것이 섞여 있었다. 사용자를 무한 재시도로 보내는 안내는
 * 안내가 아니다(§8).
 */
const RETRY_KO = /다시 시도/;


describe("saveFailureMessage", () => {
  it("재시도로 절대 안 풀리는 실패는 그렇다고 말하고 다른 길을 준다", () => {
    // 10 MiB 상한은 몇 번을 눌러도 그대로다 — 필요한 것은 백업과 새 프로젝트다.
    // "다시 시도"라는 말 자체를 금지하면 "다시 시도해도 안 된다"는 정확한 문장까지
    // 막는다. 금지할 것은 단어가 아니라 **재시도를 시키는 것**이다.
    const ko = saveFailureMessage("PROJECT_METADATA_LIMIT", false);
    expect(ko).toMatch(/다시 시도해도.*않습니다/);
    expect(ko).toContain("백업");
    expect(ko).toContain("새 프로젝트");
    const en = saveFailureMessage("PROJECT_METADATA_LIMIT", true);
    expect(en).toMatch(/retrying will not help/i);
    expect(en).toMatch(/backup/i);
  });

  it("원인이 다른 실패를 로그인·저장 설정 탓으로 돌리지 않는다", () => {
    // 저장 중 프로젝트가 바뀐 것은 로그인과도 기기 저장과도 무관하다.
    const ko = saveFailureMessage("SAVE_CONTEXT_CHANGED", false);
    expect(ko).not.toContain("로그인");
    expect(ko).toContain("프로젝트");
  });

  it("기기 저장이 꺼진 경우에는 켜라고 말한다", () => {
    expect(saveFailureMessage("STORAGE_DISABLED", false)).toContain("기기 저장");
  });

  it("모르는 실패에는 지어내지 않고 일반 안내로 떨어진다", () => {
    expect(saveFailureMessage("SOMETHING_NEW", false)).toMatch(RETRY_KO);
  });

  it("어느 경우에도 작성 내용이 남는다는 사실을 함께 말한다", () => {
    // 저장 실패 화면에서 사용자가 가장 먼저 걱정하는 것이다.
    for (const code of ["PRO_REQUIRED", "LOGIN_REQUIRED", "PROJECT_METADATA_LIMIT", "SAVE_CONTEXT_CHANGED", "STORAGE_DISABLED", "SOMETHING_NEW"]) {
      expect(saveFailureMessage(code, false), code).toContain("작성 내용은 그대로");
    }
  });

  it("EN은 한글 없이 답한다", () => {
    for (const code of ["PRO_REQUIRED", "LOGIN_REQUIRED", "PROJECT_METADATA_LIMIT", "SAVE_CONTEXT_CHANGED", "STORAGE_DISABLED", "PROJECT_NAME_REQUIRED", "INVALID_REVIEW", "PROJECT_MISSING", "SOMETHING_NEW"]) {
      expect(saveFailureMessage(code, true), code).not.toMatch(/[가-힣]/);
    }
  });
});
