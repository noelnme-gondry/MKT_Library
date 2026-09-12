// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import ProjectReviewWorkspace from "./ProjectReviewWorkspace";
vi.mock("./weekly-review/WeeklyReviewScreen", () => ({ default: function Review() { const [text, setText] = useState(""); return <input aria-label="Draft decision" value={text} onChange={event => setText(event.target.value)} />; } }));
vi.mock("./ProjectsPage", () => ({ default: ({ onReview }) => <button onClick={onReview}>Open selected review</button> }));
beforeEach(() => { window.history.replaceState(null, "", "/weekly-review"); useAppStore.setState({ ...useAppStore.getInitialState(), projectsReady: true, activeProjectId: "a", projects: [{ id: "a", name: "Client A" }, { id: "b", name: "Client B" }] }); });
afterEach(cleanup);
it.each(["ko", "en"])("keeps the draft when managing projects and returning (%s)", locale => {
  const en = locale === "en";
  render(<ProjectReviewWorkspace locale={locale} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Draft decision" }), { target: { value: "Keep current draft" } });
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Client A");
  fireEvent.click(screen.getByRole("button", { name: en ? "My projects" : "내 프로젝트" }));
  expect(screen.queryByRole("textbox", { name: "Draft decision" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open selected review" }));
  expect(screen.getByRole("textbox", { name: "Draft decision" }).value).toBe("Keep current draft");
});
it("switches through the project store before showing another project's review", async () => {
  const switchProject = vi.fn(async id => { useAppStore.setState({ activeProjectId: id }); return true; });
  useAppStore.setState({ switchProject });
  render(<ProjectReviewWorkspace />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Project A only" } });
  fireEvent.change(screen.getByRole("combobox", { name: "현재 프로젝트" }), { target: { value: "b" } });
  await waitFor(() => expect(switchProject).toHaveBeenCalledWith("b"));
  expect(screen.getByRole("textbox").value).toBe("");
});
it("opens project management from the account menu's hash entry", async () => {
  render(<ProjectReviewWorkspace />);
  window.location.hash = "project-management";
  await waitFor(() => expect(screen.getByRole("button", { name: "Open selected review" })).toBeTruthy());
});
