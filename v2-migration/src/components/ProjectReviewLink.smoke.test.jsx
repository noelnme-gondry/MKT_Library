// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectReviewLink from "./ProjectReviewLink";
import { useAppStore } from "@/store/useDataStore";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => { push.mockReset(); useAppStore.setState({ ...useAppStore.getInitialState(), activeProjectId: "a" }); });
afterEach(cleanup);
it.each(["ko", "en"])("opens the saved record's project before navigating (%s)", async locale => {
  const switchProject = vi.fn(async id => { useAppStore.setState({ activeProjectId: id }); return true; });
  useAppStore.setState({ switchProject });
  render(<ProjectReviewLink projectId="b" locale={locale} />);
  fireEvent.click(screen.getByRole("link"));
  await waitFor(() => expect(push).toHaveBeenCalledWith(`${locale === "en" ? "/en" : ""}/weekly-review#wr-history`));
  expect(switchProject).toHaveBeenCalledWith("b");
  expect(useAppStore.getState().activeProjectId).toBe("b");
});
it("does not navigate to an unrelated project when restoration fails", async () => {
  useAppStore.setState({ switchProject: vi.fn(async () => false) });
  render(<ProjectReviewLink projectId="b" />);
  fireEvent.click(screen.getByRole("link"));
  await screen.findByRole("alert");
  expect(push).not.toHaveBeenCalled();
  expect(useAppStore.getState().activeProjectId).toBe("a");
});
