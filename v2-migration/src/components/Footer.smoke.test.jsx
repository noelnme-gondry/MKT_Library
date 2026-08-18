// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";
import { workspaceNavItem } from "@/lib/workspaceNav";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

afterEach(() => cleanup());

describe("Footer localized policy links", () => {
  it("links Korean visitors to Korean policy and contact pages", () => {
    pathname = "/";
    render(<Footer />);
    expect(screen.getByRole("link", { name: "개인정보처리방침" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "이용약관" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "문의하기" }).getAttribute("href")).toBe("/contact");
    expect(screen.getByRole("link", { name: workspaceNavItem("review").name }).getAttribute("href")).toBe("/weekly-review");
  });

  it("links English visitors to English policy and contact pages", () => {
    pathname = "/en";
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/en/privacy");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/en/terms");
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("/en/contact");
    expect(screen.getByRole("link", { name: workspaceNavItem("review", "en").name }).getAttribute("href")).toBe("/en/weekly-review");
  });

  // 분석 화면은 전체 푸터를 숨기지만, CSV를 올리는 화면이 곧 신뢰 판단 지점이라
  // 정책 경로까지 사라지면 안 된다 → 슬림 스트립으로 정책 링크가 남아야 한다.
  it("분석 화면(도구·대시보드·콘텐츠)에서도 정책 링크가 유지된다", () => {
    for (const path of ["/dashboard", "/tools/budget-allocation", "/content/freshness"]) {
      cleanup();
      pathname = path;
      render(<Footer />);
      expect(screen.getByRole("link", { name: "개인정보처리방침" }).getAttribute("href"), path).toBe("/privacy");
      expect(screen.getByRole("link", { name: "이용약관" }).getAttribute("href"), path).toBe("/terms");
      // 전체 내비게이션(도구 목록)은 계속 접혀 있어야 한다 — 도구 화면 노이즈 방지.
      expect(screen.queryByRole("link", { name: "운영 대시보드" }), path).toBeNull();
    }
  });

  it("EN 분석 화면은 EN 정책 경로로 연결된다", () => {
    pathname = "/en/tools/budget-allocation";
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/en/privacy");
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("/en/contact");
  });
});
