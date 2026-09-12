// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyAccountMenu from "./MyAccountMenu";
vi.mock("./AccountArchive", () => ({ default: ({ locale, profile }) => <button data-profile={profile}>{locale === "en" ? "Continue with Google" : "Google로 계속"}</button> }));
afterEach(cleanup);
it.each(["ko", "en"])("offers sign-in and workspace management, closes on Escape (%s)", async locale => {
  const en = locale === "en";
  const { container } = render(<MyAccountMenu locale={locale} />);
  const details = container.querySelector("details");
  const summary = details.querySelector("summary");
  details.open = true; fireEvent(details, new Event("toggle"));
  await screen.findByRole("button", { name: en ? "Continue with Google" : "Google로 계속" });
  expect(screen.getByRole("link", { name: en ? "My projects" : "내 프로젝트" }).getAttribute("href")).toBe(`${en ? "/en" : ""}/weekly-review#project-management`);
  expect(screen.queryByRole("link", { name: en ? "Current project review" : "현재 프로젝트 리뷰" })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(details.open).toBe(false));
  expect(document.activeElement).toBe(summary);
});
