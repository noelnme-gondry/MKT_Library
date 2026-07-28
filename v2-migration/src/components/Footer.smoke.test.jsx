// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

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
  });

  it("links English visitors to English policy and contact pages", () => {
    pathname = "/en";
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/en/privacy");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/en/terms");
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("/en/contact");
  });
});
