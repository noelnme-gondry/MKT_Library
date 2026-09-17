import { activePro } from "@/test/proEntitlement";
// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewSaveDialog, { saveFailureState } from "./ReviewSaveDialog";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount } from "@/lib/account/accountClient";
import { listProjects, readProject } from "@/lib/project/repository";
import { saveProjectReview } from "@/lib/project/saveReview";
import { trackProductEvent } from "@/lib/analytics";

vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("./AccountArchive", () => ({ default: ({ onSession, record }) => record ? <p>Optional account memo consent</p> : <button onClick={() => onSession({ account: { id: "owner" }, entitlement: activePro() })}>Complete sign-in</button> }));
const record = { toolId: "5-3", action: "Hold budget", dataOrigin: "real" };
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState({ ...useAppStore.getInitialState(), activeProjectId: "default", projectsReady: true, projects: [], decisionRecords: [], decisionPersistenceEnabled: true });
  refreshAccount.mockReset().mockResolvedValue({ account: { id: "owner" }, entitlement: activePro() });
  trackProductEvent.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["ko", "en"])("requires sign-in and project name, then atomically saves without moving the CSV (%s)", async locale => {
  const en = locale === "en";
  const onSaved = vi.fn();
  useAppStore.getState().setCurrentRouteId("5-3");
  useAppStore.getState().setCsvData({ raw: [{ cost: "private" }], mapping: { cost: "cost" } });
  const csv = useAppStore.getState().csvData;
  render(<ReviewSaveDialog locale={locale} record={record} onSaved={onSaved} onClose={vi.fn()} />);
  const save = screen.getByRole("button", { name: en ? "Create project and save" : "프로젝트 만들고 저장" });
  expect(save.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름" }), { target: { value: "Client A" } });
  fireEvent.click(save);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(refreshAccount).toHaveBeenCalledOnce();
  expect((await readProject("default")).decisions[0].action).toBe(record.action);
  expect(useAppStore.getState().decisionRecords[0].action).toBe(record.action);
  expect(useAppStore.getState().csvData).toBe(csv);
  expect(screen.getByText("Optional account memo consent")).toBeTruthy();
});
it("rechecks the session at commit and preserves the pending review after logout or cancellation", async () => {
  const onSaved = vi.fn(), onClose = vi.fn();
  render(<ReviewSaveDialog record={record} onSaved={onSaved} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  fireEvent.change(screen.getByRole("textbox", { name: "프로젝트 이름" }), { target: { value: "Draft project" } });
  refreshAccount.mockResolvedValue({ account: null });
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들고 저장" }));
  await screen.findByRole("alert");
  expect(onSaved).not.toHaveBeenCalled();
  expect(await listProjects()).toEqual([]);
  expect(screen.getByRole("textbox", { name: "프로젝트 이름" }).value).toBe("Draft project");
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(onClose).toHaveBeenCalledOnce();
});
it("saves a standalone decision to the chosen project without switching source data", async () => {
  await saveProjectReview({ entitlement: activePro(), name: "Client A", record });
  const entitlement = { plan: "paid", expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 };
  // Existing multiple projects are readable even when paid access later expires.
  const { projectTransaction, migrateLegacyProject } = await import("@/lib/project/repository");
  await projectTransaction("readwrite", meta => meta.put({ ...migrateLegacyProject(null, [], [], Date.now()), id: "b", key: "project:b", name: "Client B" }));
  useAppStore.setState({ projects: await listProjects(), entitlement });
  render(<ReviewSaveDialog record={{ ...record, action: "B follow-up" }} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  fireEvent.change(screen.getByRole("combobox", { name: "저장할 프로젝트" }), { target: { value: "b" } });
  fireEvent.click(screen.getByRole("button", { name: "리뷰 저장" }));
  await screen.findByRole("heading", { name: "리뷰를 저장했습니다" });
  expect((await readProject("b")).decisions[0].action).toBe("B follow-up");
  expect((await readProject("default")).decisions).toHaveLength(1);
  expect(useAppStore.getState().activeProjectId).toBe("default");
  expect(useAppStore.getState().decisionRecords).toEqual([]);
});
it("also gates updates and completion, including a changed project during sign-in", async () => {
  const onConfirm = vi.fn();
  const view = render(<ReviewSaveDialog onConfirm={onConfirm} onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "리뷰 저장" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  useAppStore.setState({ activeProjectId: "different" });
  view.rerender(<ReviewSaveDialog onConfirm={onConfirm} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "리뷰 저장" }));
  await screen.findByRole("alert");
  expect(onConfirm).not.toHaveBeenCalled();
});

// 저장 실행 자체를 세는 이벤트가 없어서 "리뷰 저장을 쓰는 사람이 몇인가"에 답할 수
// 없었다. 성공만 재면 실패는 영영 안 보이므로 두 방향을 함께 고정한다.
it("counts the save itself, separating a new project from an existing one", async () => {
  await saveProjectReview({ entitlement: activePro(), name: "Client A", record });
  useAppStore.setState({ projects: await listProjects(), entitlement: activePro() });
  render(<ReviewSaveDialog record={{ ...record, action: "Follow-up" }} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  fireEvent.click(screen.getByRole("button", { name: "리뷰 저장" }));
  await screen.findByRole("heading", { name: "리뷰를 저장했습니다" });
  expect(trackProductEvent).toHaveBeenCalledWith("project_review_saved", { tool_id: "5-3", state: "existing_project", result_state: "review", locale: "ko" });
});

it("records a new project save and reports the failure reason as a category code only", async () => {
  render(<ReviewSaveDialog record={record} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  fireEvent.change(screen.getByRole("textbox", { name: "프로젝트 이름" }), { target: { value: "Client A" } });
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들고 저장" }));
  await screen.findByRole("heading", { name: "리뷰를 저장했습니다" });
  expect(trackProductEvent).toHaveBeenCalledWith("project_review_saved", { tool_id: "5-3", state: "new_project", result_state: "review", locale: "ko" });

  cleanup();
  trackProductEvent.mockReset();
  render(<ReviewSaveDialog record={record} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Complete sign-in" }));
  refreshAccount.mockResolvedValue({ account: null });
  fireEvent.click(screen.getByRole("button", { name: "리뷰 저장" }));
  await screen.findByRole("alert");
  expect(trackProductEvent).toHaveBeenCalledWith("project_review_save_failed", { tool_id: "5-3", state: "login_required", locale: "ko" });
  expect(trackProductEvent).not.toHaveBeenCalledWith("project_review_saved", expect.anything());
});

it("folds an unlisted failure message into unknown so raw text never reaches GA", () => {
  expect(saveFailureState("PROJECT_LIMIT")).toBe("project_limit");
  expect(saveFailureState("IndexedDB write failed for Client A")).toBe("unknown");
  expect(saveFailureState(undefined)).toBe("unknown");
});
