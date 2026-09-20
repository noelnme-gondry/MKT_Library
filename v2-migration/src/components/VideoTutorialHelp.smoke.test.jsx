import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("@/components/ds/ModalDialog", () => ({ default: ({ open, children }) => open ? <div role="dialog">{children}</div> : null }));
import VideoTutorialHelp, { VideoHelpButton } from "./VideoTutorialHelp";
afterEach(cleanup);
it("keeps an upload-help click until the page tutorial host mounts", () => {
  render(<VideoHelpButton topic="import">Upload guide</VideoHelpButton>);
  fireEvent.click(screen.getByRole("button", { name: /Upload guide/ }));
  render(<VideoTutorialHelp />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "데이터 준비와 첫 분석" })).toBeTruthy();
});
it("does not replay a request from a page that has already unmounted", () => {
  const entry = render(<VideoHelpButton topic="import">Upload guide</VideoHelpButton>);
  fireEvent.click(screen.getByRole("button", { name: /Upload guide/ }));
  entry.unmount();
  render(<VideoTutorialHelp />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
