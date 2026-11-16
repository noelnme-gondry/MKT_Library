import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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

  it("프레임 보호는 호스트 예외 없이 모든 페이지에 적용한다", async () => {
    const rules = await nextConfig.headers();
    const appRule = rules.find(rule => rule.headers.some(header => header.key === "X-Frame-Options"));
    expect(appRule.source).toBe("/:path*");
    expect(appRule.missing).toBeUndefined();
    expect(appRule.has).toBeUndefined();
    expect(Object.fromEntries(appRule.headers.map(({ key, value }) => [key, value]))).toMatchObject({
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });

  it.each(["/start", "/ad-frame/rail", "/ad-frame/wide", "/ad-frame/compact"])("기존 광고 호스트도 %s를 운영 도메인으로 이동한다", pathname => {
    const host = "mktlibrary-production.up.railway.app";
    const response = proxy(new NextRequest(`https://${host}${pathname}`, { headers: { host } }));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`https://growthoptplaybook.com${pathname}`);
  });

  it("www DNS 복구 전에는 HSTS를 하위 도메인까지 확장하지 않는다", async () => {
    const rules = await nextConfig.headers();
    const hsts = rules
      .find((rule) => rule.source === "/:path*")
      ?.headers.find(({ key }) => key === "Strict-Transport-Security")?.value;

    expect(hsts).not.toMatch(/includeSubDomains|preload/i);
  });
});
