import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const koSource = stripSourceComments(readFileSync(fileURLToPath(new URL("./page.js", import.meta.url)), "utf8"));
const enSource = stripSourceComments(readFileSync(fileURLToPath(new URL("../../(en)/en/privacy/page.js", import.meta.url)), "utf8"));

describe("device-storage privacy contract", () => {
  it("states the Korean storage scope, retention, and deletion rules", () => {
    expect(koSource).toContain("CSV·XLSX 원본 파일, 파일명·헤더·매핑과 결정 기록 요약");
    expect(koSource).toContain("최대 90일 보관");
    expect(koSource).toContain("원본은 서버로 전송하지 않습니다");
    expect(koSource).toContain("저장된 원본 파일과 결정 기록의 영속 사본을 즉시 지우며");
    expect(koSource).toContain('href="/storage"');
    expect(koSource).toContain('updated="2026-08-01"');
  });

  it("keeps the English privacy contract equivalent", () => {
    expect(enSource).toContain("source CSV/XLSX files you upload yourself");
    expect(enSource).toContain("for up to 90 days");
    expect(enSource).toContain("Source files are never sent to our server");
    expect(enSource).toContain("immediately removes stored source files and the persistent copy of decision records");
    expect(enSource).toContain('href="/en/storage"');
    expect(enSource).toContain('updated="2026-08-01"');
  });
});
