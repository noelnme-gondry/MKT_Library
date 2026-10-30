import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";
import { ADSTERRA_FRAME_ORIGIN } from "./adsterraHost.mjs";

describe("전역 보안 헤더", () => {
  it("모든 라우트에 HTTPS와 브라우저 방어 헤더를 적용한다", async () => {
    const rules = await nextConfig.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(globalRule?.headers.map(({ key, value }) => [key, value]) || []);

    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Strict-Transport-Security": "max-age=31536000",
    });
  });

  it("앱의 프레임 보호는 유지하고 광고 전용 호스트만 자체 부모 허용 목록을 사용한다", async () => {
    const rules = await nextConfig.headers();
    const appRule = rules.find(rule => rule.headers.some(header => header.key === "X-Frame-Options"));
    expect(appRule.source).toBe("/:path*");
    expect(appRule.missing).toEqual([{ type: "host", value: new URL(ADSTERRA_FRAME_ORIGIN).hostname.replaceAll(".", "\\.") }]);
    expect(Object.fromEntries(appRule.headers.map(({ key, value }) => [key, value]))).toMatchObject({
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });

  it("www DNS 복구 전에는 HSTS를 하위 도메인까지 확장하지 않는다", async () => {
    const rules = await nextConfig.headers();
    const hsts = rules
      .find((rule) => rule.source === "/:path*")
      ?.headers.find(({ key }) => key === "Strict-Transport-Security")?.value;

    expect(hsts).not.toMatch(/includeSubDomains|preload/i);
  });
});
