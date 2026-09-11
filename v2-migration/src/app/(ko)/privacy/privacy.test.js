import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const koSource = stripSourceComments(readFileSync(fileURLToPath(new URL("./page.js", import.meta.url)), "utf8"));
const enSource = stripSourceComments(readFileSync(fileURLToPath(new URL("../../(en)/en/privacy/page.js", import.meta.url)), "utf8"));

describe("device-storage privacy contract", () => {
  it("discloses actual email processing in both locales before activation", () => {
    for (const source of [koSource, enSource]) {
      expect(source).toContain("Plus Five Five, Inc.");
      expect(source).toContain("ap-northeast-1");
      expect(source).toContain("TLS SMTP");
      expect(source).toContain('href="https://resend.com/security/gdpr"');
    }
    expect(koSource).toContain("미국에 저장");
    expect(koSource).toContain("30일, 백업은 7일");
    expect(koSource).toContain("일회용 로그인 링크");
    expect(koSource).toContain("CSV와 결정 메모 내용은 전달하지 않습니다");
    expect(enSource).toContain("stored in the United States");
    expect(enSource).toContain("30 days and backups for 7 days");
    expect(enSource).toContain("a one-time sign-in link");
    expect(enSource).toContain("CSV data and decision memo contents are excluded");
    expect(koSource).not.toContain("실제 메일 제공자·처리 지역은 운영 활성화 전에 고지합니다");
    expect(enSource).not.toContain("Actual email providers and processing locations must be disclosed before activation");
  });
  it("states the Korean storage scope, retention, and deletion rules", () => {
    expect(koSource).toContain("CSV·XLSX 원본 파일, 파일명·헤더·매핑과 결정 기록 요약");
    expect(koSource).toContain("마지막 사용 후 90일까지 보관");
    expect(koSource).toContain("원본은 서버로 전송하지 않습니다");
    expect(koSource).toContain("저장된 원본 파일과 결정 기록의 영속 사본을 즉시 지우며");
    expect(koSource).toContain('href="/storage"');
    expect(koSource).toContain('updated="2026-09-11"');
  });

  it("keeps the English privacy contract equivalent", () => {
    expect(enSource).toContain("source CSV/XLSX files you upload yourself");
    expect(enSource).toContain("until 90 days after their last use");
    expect(enSource).toContain("Source files are never sent to our server");
    expect(enSource).toContain("immediately removes stored source files and the persistent copy of decision records");
    expect(enSource).toContain('href="/en/storage"');
    expect(enSource).toContain('updated="2026-09-11"');
  });
});
