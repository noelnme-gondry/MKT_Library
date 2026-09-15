// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectHandoffNote from "./ProjectHandoffNote";
import { useAppStore } from "@/store/useDataStore";
import { activePro } from "@/test/proEntitlement";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  vi.clearAllMocks();
  refreshAccount.mockResolvedValue({ enabled: true, account: null, entitlement: null });
});
afterEach(cleanup);

it("프로젝트가 못 돌리는 분석에는 왜 여기서 넘어가는지 적는다", () => {
  // 못 하는 것을 말하지 않으면 사용자는 없는 경로를 찾아 헤맨다(§8).
  render(<ProjectHandoffNote toolId="5-18-cannibal" locale="ko" />);
  expect(screen.getByRole("heading", { name: "이 결과를 프로젝트로 이어가기" })).toBeTruthy();
  expect(screen.getByText(/데이터의 단위가 달라서/)).toBeTruthy();
});

it("프로젝트가 직접 돌리는 분석에는 그 문장을 쓰지 않는다", () => {
  // 5-2는 선택기에 이미 떠 있다 — "여기서 안 돈다"는 문장이 거짓이 된다.
  render(<ProjectHandoffNote toolId="5-2" locale="ko" />);
  expect(screen.queryByText(/데이터의 단위가 달라서/)).toBeNull();
});

it("Pro가 아니면 관문을 먼저 열고, 통과하면 프로젝트로 보낸다", async () => {
  accountRequest.mockResolvedValue({ trialStarted: true, entitlement: activePro({ trial: true }) });
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: null });
  render(<ProjectHandoffNote toolId="5-18-cannibal" locale="ko" />);
  fireEvent.click(screen.getByRole("button", { name: "프로젝트로 넘기기" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/weekly-review"));
});

it("이미 Pro면 관문 없이 바로 프로젝트로 간다", () => {
  useAppStore.setState({ entitlement: activePro({ trial: false }) });
  render(<ProjectHandoffNote toolId="5-18-cannibal" locale="ko" />);
  fireEvent.click(screen.getByRole("button", { name: "내 프로젝트 열기" }));
  expect(push).toHaveBeenCalledWith("/weekly-review");
});

it("EN은 EN 경로로 보낸다", () => {
  useAppStore.setState({ entitlement: activePro({ trial: false }) });
  render(<ProjectHandoffNote toolId="5-18-cannibal" locale="en" />);
  fireEvent.click(screen.getByRole("button", { name: "Open my projects" }));
  expect(push).toHaveBeenCalledWith("/en/weekly-review");
});
