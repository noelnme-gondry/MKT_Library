// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkipLink from "@/components/SkipLink";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("SkipLink locale contract", () => {
  it("uses Korean copy on Korean routes", () => {
    pathname = "/campaign-dashboard";
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "본문으로 바로가기" }).getAttribute("href")).toBe("#main-content");
  });

  it("uses English copy on English routes", () => {
    pathname = "/en/campaign-dashboard";
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to main content" }).getAttribute("href")).toBe("#main-content");
  });
});
