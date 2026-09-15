// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DecisionHistoryList from "./DecisionHistoryList";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";
import { activePro } from "@/test/proEntitlement";

vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));

const LOCAL = {
  id: "d-local", toolId: "5-2", action: "Meta 예산 30% 감액", reviewDate: "2026-09-20",
  conclusion: "강한 잠식 후보 2개", metric: "오가닉 전환수", baseline: "5,000",
  guardrailMetric: "conversions", guardrailOp: "gte", guardrailValue: "5000", guardrails: "cpa|lte|8000",
};
const REMOTE = { id: "d-remote", toolId: "5-3", action: "Google 증액", reviewDate: "2026-09-25", conclusion: "여력 있음" };

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  vi.clearAllMocks();
  useAppStore.setState({ entitlement: activePro({ trial: true }), decisionRecords: [LOCAL] });
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: activePro({ trial: true }) });
  accountRequest.mockResolvedValue({ memos: [REMOTE] });
});
afterEach(cleanup);

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
  await waitFor(() => expect(screen.getByText("강한 잠식 후보 2개")).toBeTruthy());
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
