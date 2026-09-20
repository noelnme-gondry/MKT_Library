// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DecisionHistoryList from "./DecisionHistoryList";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";
import { IDBFactory } from "fake-indexeddb";
import { createProjectRecord, updateProject, readProject } from "@/lib/project/repository";
import { activePro } from "@/test/proEntitlement";

vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));

const LOCAL = {
  id: "d-local", actual: "", learning: "", toolId: "5-2", action: "Meta 예산 30% 감액", reviewDate: "2026-09-20",
  conclusion: "강한 잠식 후보 2개", metric: "오가닉 전환수", baseline: "5,000",
  guardrailMetric: "conversions", guardrailOp: "gte", guardrailValue: "5000", guardrails: "cpa|lte|8000",
};
const REMOTE = { id: "d-remote", toolId: "5-3", action: "Google 증액", reviewDate: "2026-09-25", conclusion: "여력 있음" };

beforeEach(() => {
  window.history.replaceState(null, "", "/weekly-review");
  useAppStore.setState(useAppStore.getInitialState(), true);
  vi.clearAllMocks();
  useAppStore.setState({ entitlement: activePro({ trial: true }), decisionRecords: [LOCAL] });
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: activePro({ trial: true }) });
  accountRequest.mockResolvedValue({ memos: [REMOTE] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("이 기기와 계정의 결정을 한 목록으로 보여준다", async () => {
  render(<DecisionHistoryList locale="ko" />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Meta 예산 30% 감액/ })).toBeTruthy());
  // 계정에만 있는 결정도 같은 목록에 뜬다 — 두 목록으로 나누면 "뭐가 다르냐"가 반복된다.
  expect(screen.getByRole("button", { name: /Google 증액/ })).toBeTruthy();
  expect(screen.getByText(/계정에만 있음/)).toBeTruthy();
});

it("접기가 아니라 버튼이고, 누르면 상세가 열린다", async () => {
  render(<DecisionHistoryList locale="ko" />);
  const row = await screen.findByRole("button", { name: /Meta 예산 30% 감액/ });
  expect(row.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(row);
  await screen.findByText("결정 당시 근거·비교 조건");
  fireEvent.click(screen.getByText("결정 당시 근거·비교 조건"));
  expect(screen.getByText("강한 잠식 후보 2개")).toBeTruthy();
  // 가드레일 목록이 단수·복수 양쪽에서 합쳐져 보인다.
  expect(screen.getByText(/conversions ≥ 5000 · cpa ≤ 8000/)).toBeTruthy();
});

it("결정이 없으면 그냥 없다고 말한다", async () => {
  useAppStore.setState({ decisionRecords: [] });
  accountRequest.mockResolvedValue({ memos: [] });
  render(<DecisionHistoryList locale="ko" />);
  await waitFor(() => expect(screen.getByText("아직 저장한 결정이 없습니다.")).toBeTruthy());
});

it("로그인하지 않아도 이 기기의 결정은 보이고, 계정 쪽은 사유를 말한다", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, account: null, entitlement: null });
  render(<DecisionHistoryList locale="ko" />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Meta 예산 30% 감액/ })).toBeTruthy());
  expect(screen.getByText(/로그인하면 계정에 보관한 결정도/)).toBeTruthy();
});

it("이용권이 없어도 읽기는 막지 않는다 — 막히는 것은 계정 보관뿐", async () => {
  // 사이트가 "만료 후 기존 기록의 열람·내보내기·삭제는 유지"를 이미 약속했다.
  // 읽기를 막으면 그 약속을 깬다(§8).
  useAppStore.setState({ entitlement: null });
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: null });
  render(<DecisionHistoryList locale="ko" />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Meta 예산 30% 감액/ })).toBeTruthy());
  expect(screen.getByText(/기록은 계속 읽고 내보낼 수 있습니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Meta 예산 30% 감액/ }));
  expect(screen.getByRole("button", { name: "계정에 보관" }).disabled).toBe(true);
});

it("이 기기에만 있는 결정은 계정 보관을 제안한다", async () => {
  accountRequest.mockResolvedValue({ memos: [] });
  render(<DecisionHistoryList locale="ko" />);
  fireEvent.click(await screen.findByRole("button", { name: /Meta 예산 30% 감액/ }));
  const save = await screen.findByRole("button", { name: "계정에 보관" });
  fireEvent.click(save);
  await waitFor(() => expect(accountRequest).toHaveBeenCalledWith("memos", expect.objectContaining({ method: "POST" })));
});

it("EN도 같은 구조로 렌더된다", async () => {
  render(<DecisionHistoryList locale="en" />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Past decisions" })).toBeTruthy());
});

it.each(["ko", "en"])("keeps the device review editor reachable from the actual history surface (%s)", async locale => {
  render(<DecisionHistoryList locale={locale} />);
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Review / export device records" : "기기 기록 검토·내보내기" }));
  await waitFor(() => expect(document.querySelector(".weekly-review-page.is-embedded")).toBeTruthy());
  expect(screen.getByRole("textbox", { name: `${locale === "en" ? "Actual outcome" : "실제 결과"} — ${LOCAL.action}` })).toBeTruthy();
});
it("does not fetch real account decisions inside a sample", async () => {
  render(<DecisionHistoryList locale="ko" records={[]} isSample />);
  await screen.findByText("아직 저장한 결정이 없습니다.");
  expect(accountRequest).not.toHaveBeenCalled();
  expect(refreshAccount).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "기기 기록 검토·내보내기" })).toBeNull();
});
it("hides already loaded account decisions when switching to a sample", async () => {
  const view = render(<DecisionHistoryList locale="ko" />);
  await screen.findByRole("button", { name: /Google 증액/ });
  view.rerender(<DecisionHistoryList locale="ko" records={[]} isSample />);
  expect(screen.queryByRole("button", { name: /Google 증액/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Meta 예산/ })).toBeNull();
});


it.each(["ko", "en"])("shows a retry instead of an empty account on read failure (%s)", async locale => {
  useAppStore.setState({ decisionRecords: [] });
  accountRequest.mockRejectedValue(new Error("offline"));
  render(<DecisionHistoryList locale={locale} />);
  await screen.findByRole("alert");
  expect(screen.queryByText(locale === "en" ? "No saved decisions yet." : "아직 저장한 결정이 없습니다.")).toBeNull();
  accountRequest.mockResolvedValue({ memos: [REMOTE] });
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Retry loading" : "다시 불러오기" }));
  await screen.findByRole("button", { name: /Google 증액/ });
  expect(screen.queryByRole("alert")).toBeNull();
});
it("does not require a successful second read to acknowledge an account write", async () => {
  accountRequest.mockResolvedValueOnce({ memos: [] }).mockResolvedValueOnce({ memo: LOCAL }).mockRejectedValue(new Error("offline"));
  render(<DecisionHistoryList />);
  fireEvent.click(await screen.findByRole("button", { name: /Meta 예산 30% 감액/ }));
  fireEvent.click(screen.getByRole("button", { name: "계정에 보관" }));
  await screen.findByText("계정에 보관했습니다.");
  expect(accountRequest).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/계정 보관됨/)).toBeTruthy();
});
it.each(["ko", "en"])("shows both versions and explicit conflict choices (%s)", async locale => {
  accountRequest.mockResolvedValue({ memos: [{ ...LOCAL, actual: "CPA 3000", learning: "Remote learning", status: "reviewed" }] });
  render(<DecisionHistoryList locale={locale} />);
  fireEvent.click(await screen.findByRole("button", { name: /Meta 예산 30% 감액/ }));
  expect(screen.getByText("Remote learning")).toBeTruthy();
  expect(screen.getByRole("button", { name: locale === "en" ? "Keep account copy as a separate record" : "계정 내용을 별도 기록으로 보관" })).toBeTruthy();
  expect(screen.getByRole("button", { name: locale === "en" ? "Update account with device copy" : "기기 내용으로 계정 갱신" })).toBeTruthy();
});

it.each(["ko", "en"])("keeps local review history when importing a conflicting account memo (%s)", async locale => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const local = { ...LOCAL, sourcePeriod: "Private device comparison history", actual: "100" };
  await createProjectRecord("default", "Original", activePro());
  const project = await updateProject("default", { decisions: [local] }, () => true, activePro());
  useAppStore.setState({ projectSwitching: true, projectsReady: true, projects: [project], decisionRecords: [local], decisionPersistenceEnabled: true });
  useAppStore.setState({ projectSwitching: false });
  accountRequest.mockResolvedValue({ memos: [{ ...LOCAL, actual: "2500", learning: "Remote learning" }] });
  render(<DecisionHistoryList locale={locale} />);
  fireEvent.click(await screen.findByRole("button", { name: /Meta 예산 30% 감액/ }));
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Keep account copy as a separate record" : "계정 내용을 별도 기록으로 보관" }));
  const dialog = await screen.findByRole("dialog", { name: locale === "en" ? "Save review" : "리뷰 저장" });
  const save = within(dialog).getByRole("button", { name: locale === "en" ? "Save review" : "리뷰 저장", exact: true });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(within(dialog).getByRole("heading", { name: locale === "en" ? "Review saved" : "리뷰를 저장했습니다" })).toBeTruthy());
  const saved = await readProject("default");
  expect(saved.decisions).toHaveLength(2);
  expect(saved.decisions.find(record => record.id === LOCAL.id)).toMatchObject({ actual: "100", sourcePeriod: "Private device comparison history" });
  expect(saved.decisions.find(record => record.id !== LOCAL.id)).toMatchObject({ actual: "2500", learning: "Remote learning" });
});
