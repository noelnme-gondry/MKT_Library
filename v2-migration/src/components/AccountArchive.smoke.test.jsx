// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import AccountArchive from "./AccountArchive";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: mocks.refresh, accountRequest: mocks.request }));
describe("account archive consent and re-entry", () => {
  beforeEach(() => {
    useAppStore.setState({ ...useAppStore.getInitialState(), decisionPersistenceEnabled: false });
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue({ enabled: true, account: { id: "owner", email: "owner@example.com", trialStartedAt: null }, mailEnabled: false, entitlement: null });
    mocks.request.mockImplementation(async path => path === "memos" ? { memos: [], trialStarted: true } : {});
  });
  afterEach(cleanup);
  it("refreshes every archive after a successful account mutation", async () => {
    render(<><AccountArchive record={{ id: "decision_1", action: "Review budget" }} /><AccountArchive /></>);
    await waitFor(() => expect(screen.getAllByText(/첫 저장 시 체험 시작/)).toHaveLength(2));
    mocks.refresh.mockResolvedValue({ enabled: true, account: { id: "owner", email: "owner@example.com", trialStartedAt: Date.now() }, entitlement: { expiresAt: Date.now() + 14 * 86400000 }, mailEnabled: false });
    // The real client emits only for mutations; reads must not emit recursively.
    mocks.request.mockImplementation(async (path, options) => { if (options?.method === "POST") window.dispatchEvent(new Event("gop-account-changed")); return { trialStarted: true, memos: [] }; });
    fireEvent.click(screen.getByLabelText("선택한 메모를 계정에 보관합니다."));
    fireEvent.click(screen.getByRole("button", { name: "결정 메모 계정에 저장" }));
    await waitFor(() => expect(screen.getAllByText(/owner@example.com · Pro 만료/)).toHaveLength(2));
    expect(screen.queryByText(/첫 저장 시 체험 시작/)).toBeNull();
  });
  it.each(["ko", "en"])("only sends the selected memo after consent, never source rows (%s)", async locale => {
    const en = locale === "en";
    render(<AccountArchive locale={locale} record={{ id: "decision_1", action: "Review budget", goalMetric: "CPA", raw: [{ confidential: 123 }], fileName: "customer.csv", comparisonScope: { private: true } }} />);
    const save = await screen.findByRole("button", { name: en ? "Save decision to account" : "결정 메모 계정에 저장" });
    expect(save.disabled).toBe(true);
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다."));
    fireEvent.click(save);
    await waitFor(() => expect(mocks.request).toHaveBeenCalled());
    const body = JSON.parse(mocks.request.mock.calls[0][1].body);
    expect(body.memo).toMatchObject({ id: "decision_1", action: "Review budget", goalMetric: "CPA" });
    expect(body.reminder).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/confidential|customer.csv|comparisonScope/);
  });
  it("copies a remote memo to local review without overwriting local records", async () => {
    mocks.request.mockResolvedValue({ memos: [{ id: "remote-1", toolId: "5-2", action: "Review budget" }] });
    useAppStore.setState({ decisionRecords: [{ id: "local-1", action: "Keep this" }] });
    render(<AccountArchive />);
    fireEvent.click(await screen.findByRole("button", { name: "이 기기의 검토 목록으로 복사" }));
    expect(useAppStore.getState().decisionRecords.map(record => record.id)).toEqual(["remote-1", "local-1"]);
    expect(screen.getByRole("button", { name: "이 기기의 검토 목록으로 복사" }).disabled).toBe(true);
  });
});
