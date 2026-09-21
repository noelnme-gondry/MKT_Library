// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MyAccountMenu from "./MyAccountMenu";
vi.mock("./AccountArchive", () => ({ default: ({ locale, profile }) => <button data-profile={profile}>{locale === "en" ? "Continue with Google" : "Google로 계속"}</button> }));
afterEach(cleanup);
it.each(["ko", "en"])("links directly to account settings and mappings (%s)", locale => {
  render(<MyAccountMenu locale={locale} />);
  expect(screen.getByRole("link", { name: locale === "en" ? "My account" : "마이페이지" }).getAttribute("href")).toBe(locale === "en" ? "/en/account" : "/account");
  expect(document.querySelector("details")).toBeNull();
});
