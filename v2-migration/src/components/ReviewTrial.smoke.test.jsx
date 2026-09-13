// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewSaveDialog from "./ReviewSaveDialog";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";
import { activePro } from "@/test/proEntitlement";
import { listProjects, readProject } from "@/lib/project/repository";
import { listWorkspaceDatasets } from "@/lib/workspace-storage/datasets";
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", NodeBlob);
  useAppStore.setState(useAppStore.getInitialState(), true);
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["ko", "en"])("starts a trial from a consented draft before any local project exists (%s)", async locale => {
  const en = locale === "en";
  let session = { enabled: true, account: { id: "account", email: "test@example.com", trialStartedAt: null }, entitlement: null };
  refreshAccount.mockImplementation(async () => { useAppStore.getState().setEntitlement(session.entitlement); return session; });
  accountRequest.mockImplementation(async () => {
    session = { ...session, account: { ...session.account, trialStartedAt: new Date().toISOString() }, entitlement: activePro({ trial: true }) };
    return { trialStarted: true };
  });
  const state = useAppStore.getState();
  state.setCurrentRouteId("5-2");
  state.setCsvData({ raw: [{ date: "2026-09-01", cost: "50", secret: "private-row" }], headers: ["date", "cost"], mapping: { date: "date", cost: "cost" }, fileName: "private-file.csv", workspaceSource: { blob: new Blob(["date,cost\r\n2026-09-01,50"]), kind: "csv" } });
  const onSaved = vi.fn();
  render(<ReviewSaveDialog locale={locale} record={{ toolId: "5-2", action: "Review budget", raw: [{ secret: "private-row" }] }} onSaved={onSaved} onClose={vi.fn()} />);
  const localSave = screen.getByRole("button", { name: en ? "Create project and save" : "프로젝트 만들고 저장" });
  fireEvent.change(screen.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름" }), { target: { value: "Client A" } });
  const accountSave = await screen.findByRole("button", { name: en ? "Save decision to account" : "결정 메모 계정에 저장" });
  expect(localSave.disabled).toBe(true);
  expect(accountSave.disabled).toBe(true);
  expect(accountRequest).not.toHaveBeenCalled();
  expect(await listProjects()).toEqual([]);
  expect(await listWorkspaceDatasets()).toEqual([]);
  fireEvent.click(screen.getByRole("checkbox", { name: en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다." }));
  fireEvent.click(accountSave);
  await waitFor(() => expect(localSave.disabled).toBe(false));
  expect(accountRequest).toHaveBeenCalledOnce();
  const body = JSON.parse(accountRequest.mock.calls[0][1].body);
  expect(body.memo).toMatchObject({ action: "Review budget", toolId: "5-2" });
  expect(body.consent).toBe("decision-memo-v1");
  expect(JSON.stringify(body)).not.toMatch(/private-row|private-file|raw|mapping/);
  expect(await listProjects()).toEqual([]);
  fireEvent.click(localSave);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect((await readProject("default")).decisions[0].id).toBe(body.memo.id);
  expect((await listWorkspaceDatasets())[0].fileName).toBe("private-file.csv");
});

it("keeps an expired user's draft and never invokes an update callback", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "account", email: "test@example.com", trialStartedAt: "2026-01-01" }, entitlement: null });
  const onConfirm = vi.fn();
  render(<ReviewSaveDialog onConfirm={onConfirm} onClose={vi.fn()} />);
  await screen.findByText(/체험이 종료되었습니다/);
  expect(screen.getByRole("button", { name: "리뷰 저장" }).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "결정 메모 계정에 저장" })).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(accountRequest).not.toHaveBeenCalled();
  expect(await listProjects()).toEqual([]);
});
