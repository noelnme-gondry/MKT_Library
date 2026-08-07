import { describe, it, expect } from "vitest";
import { decodeCsvBuffer, countReplacement } from "./decodeCsv.js";

describe("decodeCsvBuffer (CP949/EUC-KR 자동 재디코딩)", () => {
  it("유효 UTF-8은 그대로 둔다(재디코딩 안 함)", () => {
    const bytes = new TextEncoder().encode("날짜,비용,설치\n2026-01-01,1000,10");
    const r = decodeCsvBuffer(bytes);
    expect(r.reencoded).toBe(false);
    expect(r.encoding).toBe("utf-8");
    expect(r.text).toContain("날짜");
  });

  it("CP949(EUC-KR) 한글 바이트를 재디코딩해 복원", () => {
    // EUC-KR: '가'=0xB0A1, '나'=0xB3AA — UTF-8로는 치환문자(U+FFFD)로 깨진다.
    const euckrBytes = new Uint8Array([0xb0, 0xa1, 0xb3, 0xaa]);
    const utf8Bad = countReplacement(new TextDecoder("utf-8").decode(euckrBytes));
    expect(utf8Bad).toBeGreaterThan(0);
    const r = decodeCsvBuffer(euckrBytes);
    expect(r.reencoded).toBe(true);
    expect(r.encoding).toBe("euc-kr");
    expect(r.text).toBe("가나");
  });

  it("UTF-8 BOM은 명시적 UTF-8로 취급(재디코딩 안 함)", () => {
    const body = new TextEncoder().encode("날짜,비용");
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
    const r = decodeCsvBuffer(bytes);
    expect(r.reencoded).toBe(false);
    expect(r.text).toContain("날짜");
  });

  it("ArrayBuffer 입력도 처리", () => {
    const u8 = new TextEncoder().encode("a,b,c");
    const r = decodeCsvBuffer(u8.buffer);
    expect(r.text).toBe("a,b,c");
    expect(r.reencoded).toBe(false);
  });
});
