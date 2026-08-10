import { describe, expect, it } from "vitest";
import { sanitizePageLocation } from "@/components/GaPageviews";

// page_location은 GA4로 URL 전문을 보낸다. /share의 `d`는 결정 요약 토큰(base64url)
// 이라 디코드하면 결론·근거·수치가 그대로 나온다 → 반드시 제거.
// 반대로 utm_*·gclid 등 유입 파라미터는 어트리뷰션에 필요하므로 보존해야 한다.
describe("sanitizePageLocation", () => {
  it("공유 토큰(d)을 제거한다", () => {
    const out = sanitizePageLocation("https://x.test/share?d=eyJ2IjoxfQ");
    expect(out).not.toContain("eyJ2IjoxfQ");
    expect(out).not.toContain("d=");
  });

  it("utm·gclid 유입 파라미터는 보존한다 (어트리뷰션 유지)", () => {
    const out = sanitizePageLocation("https://x.test/?utm_source=naver&utm_medium=cpc&gclid=abc");
    expect(out).toContain("utm_source=naver");
    expect(out).toContain("utm_medium=cpc");
    expect(out).toContain("gclid=abc");
  });

  it("토큰과 utm이 섞여 있으면 토큰만 제거한다", () => {
    const out = sanitizePageLocation("https://x.test/share?d=SECRET&utm_source=blog");
    expect(out).not.toContain("SECRET");
    expect(out).toContain("utm_source=blog");
  });

  it("쿼리가 없으면 원본 그대로 반환한다", () => {
    const href = "https://x.test/tools/budget-allocation";
    expect(sanitizePageLocation(href)).toBe(href);
  });

  it("파싱 불가 입력은 쿼리를 버려 유출을 막는다", () => {
    expect(sanitizePageLocation("not-a-url?d=SECRET")).toBe("not-a-url");
    expect(sanitizePageLocation("")).toBe("");
  });
});
