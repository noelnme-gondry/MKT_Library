import { afterEach, describe, expect, it } from "vitest";
import { clearPasswordAttempts, hashPassword, passwordLoginAllowed, passwordLoginEmails, verifyPassword } from "./passwordLogin";

const original = process.env.ACCOUNT_PASSWORD_LOGINS;
afterEach(() => {
  if (original === undefined) delete process.env.ACCOUNT_PASSWORD_LOGINS;
  else process.env.ACCOUNT_PASSWORD_LOGINS = original;
  clearPasswordAttempts("reviewer@example.com");
});

describe("비밀번호 해시", () => {
  it("같은 비밀번호를 확인하고 다른 비밀번호는 거절한다", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    await expect(verifyPassword(stored, "correct horse battery")).resolves.toBe(true);
    await expect(verifyPassword(stored, "correct horse batterz")).resolves.toBe(false);
  });

  it("같은 비밀번호라도 저장값이 매번 다르다", async () => {
    expect(await hashPassword("correct horse battery")).not.toBe(await hashPassword("correct horse battery"));
  });

  it("짧은 비밀번호는 저장 자체를 거절한다", async () => {
    await expect(hashPassword("short")).rejects.toThrow("INVALID_LOGIN");
  });

  it("손상되거나 비어 있는 저장값을 통과시키지 않는다", async () => {
    // 형식이 깨진 값에 빈 비밀번호가 맞아떨어지면 계정이 통째로 열린다.
    for (const stored of ["", null, undefined, "scrypt$1$1$1$zz$zz", "plain-text"]) {
      await expect(verifyPassword(stored, "")).resolves.toBe(false);
      await expect(verifyPassword(stored, "correct horse battery")).resolves.toBe(false);
    }
  });
});

describe("허용 목록", () => {
  it("목록이 비어 있으면 아무 아이디도 허용하지 않는다", () => {
    delete process.env.ACCOUNT_PASSWORD_LOGINS;
    expect(passwordLoginEmails()).toEqual([]);
    expect(passwordLoginAllowed("reviewer@example.com")).toBe(false);
    process.env.ACCOUNT_PASSWORD_LOGINS = "";
    expect(passwordLoginAllowed("reviewer@example.com")).toBe(false);
  });

  it("대소문자·공백과 무관하게 목록의 아이디만 허용한다", () => {
    process.env.ACCOUNT_PASSWORD_LOGINS = " Reviewer@Example.com , other@example.com ";
    expect(passwordLoginAllowed("reviewer@example.com")).toBe(true);
    expect(passwordLoginAllowed("REVIEWER@EXAMPLE.COM ")).toBe(true);
    expect(passwordLoginAllowed("someone@example.com")).toBe(false);
  });
});
