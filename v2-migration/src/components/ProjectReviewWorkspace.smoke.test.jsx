// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import ProjectReviewWorkspace from "./ProjectReviewWorkspace";
import { confirmProjectExit, useReviewDraftGuard } from "@/lib/project/reviewDraftGuard";
vi.mock("./weekly-review/WeeklyReviewScreen", () => ({ default: function Review() { const [text, setText] = useState(""); useReviewDraftGuard(Boolean(text)); return <input aria-label="Draft decision" value={text} onChange={event => setText(event.target.value)} />; } }));
vi.mock("./ProjectsPage", () => ({ default: ({ onReview }) => <button onClick={onReview}>Open selected review</button> }));
beforeEach(() => { window.history.replaceState(null, "", "/weekly-review"); useAppStore.setState({ ...useAppStore.getInitialState(), projectsReady: true, activeProjectId: "a", projects: [{ id: "a", name: "Client A" }, { id: "b", name: "Client B" }] }); });
afterEach(cleanup);
it.each(["ko", "en"])("keeps the draft when managing projects and returning (%s)", locale => {
  const en = locale === "en";
  render(<ProjectReviewWorkspace locale={locale} />);
  fireEvent.click(screen.getByRole("button", { name: en ? "Compare weekly performance" : "주간 성과 비교" }));
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
  fireEvent.click(screen.getByRole("button", { name: "주간 성과 비교" }));
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

it("uploaded-file confirmation is owned by the shared switch guard", () => {
  const slice = { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "real.csv" };
  useAppStore.setState({ csvData: slice });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  expect(confirmProjectExit(useAppStore.getState())).toBe(false);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toContain("저장하지 않은 리뷰 입력");
  confirm.mockRestore();
});

it("잃을 것이 없으면 묻지 않는다 — 매번 묻는 확인창은 아무도 읽지 않는다", () => {
  const switchProject = vi.fn(async id => { useAppStore.setState({ activeProjectId: id }); return true; });
  useAppStore.setState({ switchProject });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ProjectReviewWorkspace />);
  fireEvent.change(screen.getByRole("combobox", { name: "현재 프로젝트" }), { target: { value: "b" } });
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("같은 목적지로 가는 버튼을 한 화면에 둘 두지 않는다", () => {
  // "내 프로젝트"와 "프로젝트 목록·백업"이 둘 다 show("manage")였다.
  useAppStore.setState({ activeProjectId: "a" });
  render(<ProjectReviewWorkspace />);
  expect(screen.getAllByRole("button", { name: /내 프로젝트|프로젝트 목록/ })).toHaveLength(1);
});

it("프로젝트를 연 뒤 결과가 비어 있는 이유를 말한다", async () => {
  // 저장된 파일은 복원되는데 분석 게이트는 닫힌 채로 온다 — 말하지 않으면
  // 파일 이름은 보이는데 결과가 없는 화면을 고장으로 읽는다.
  const switchProject = vi.fn(async id => { useAppStore.setState({ activeProjectId: id }); return true; });
  useAppStore.setState({ switchProject });
  render(<ProjectReviewWorkspace />);
  fireEvent.change(screen.getByRole("combobox", { name: "현재 프로젝트" }), { target: { value: "b" } });
  await waitFor(() => expect(switchProject).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/분석하기’를 다시/)).toBeTruthy());
});

it("keeps unsaved input when the user cancels leaving the weekly task", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<ProjectReviewWorkspace />);
  expect(screen.queryByRole("textbox", { name: "Draft decision" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "주간 성과 비교" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Draft decision" }), { target: { value: "Keep my work" } });
  fireEvent.click(screen.getByRole("button", { name: "결정 검토", exact: true }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole("textbox", { name: "Draft decision" }).value).toBe("Keep my work");
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "결정 검토", exact: true }));
  expect(screen.queryByRole("textbox", { name: "Draft decision" })).toBeNull();
  confirm.mockRestore();
});
