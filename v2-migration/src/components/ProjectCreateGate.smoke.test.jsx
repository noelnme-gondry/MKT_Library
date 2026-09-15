// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectCreateGate from "./ProjectCreateGate";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";
import { activePro } from "@/test/proEntitlement";

vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  vi.clearAllMocks();
  refreshAccount.mockResolvedValue({ enabled: true, account: null, entitlement: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const signedOut = () => refreshAccount.mockResolvedValue({ enabled: true, account: null, entitlement: null });

it.each([
  ["ko", "프로젝트는 Pro 기능입니다", "Google로 로그인하고 시작", "취소"],
  ["en", "Projects are a Pro feature", "Sign in with Google and start", "Cancel"],
])("한 문장으로 Pro와 무료 체험을 함께 말한다 (%s)", async (locale, title, login, cancel) => {
  signedOut();
  render(<ProjectCreateGate locale={locale} open onClose={() => {}} onReady={() => {}} />);
  await waitFor(() => expect(screen.getByText(title)).toBeTruthy());
  // 유료 장벽과 무료 제안이 따로 놀면 "Pro가 필요합니다"가 먼저 읽히고 무료가 변명이 된다.
  expect(screen.getByRole("button", { name: login })).toBeTruthy();
  expect(screen.getByRole("button", { name: cancel })).toBeTruthy();
});

it("로그인 완료 신호를 받으면 체험을 시작하고 호출부를 통과시킨다", async () => {
  signedOut();
  accountRequest.mockResolvedValue({ trialStarted: true, entitlement: activePro({ trial: true }) });
  const onReady = vi.fn();
  render(<ProjectCreateGate locale="ko" open onClose={() => {}} onReady={onReady} />);
  await waitFor(() => expect(screen.getByText("프로젝트는 Pro 기능입니다")).toBeTruthy());

  window.dispatchEvent(new MessageEvent("message", { data: { type: "gop-account-ready" }, origin: window.location.origin }));

  await waitFor(() => expect(onReady).toHaveBeenCalled());
  expect(accountRequest).toHaveBeenCalledWith("trial", { method: "POST" });
  // 체험 권한이 스토어에 들어가야 프로젝트 저장 게이트(`hasPaidAccess`)가 열린다.
  expect(useAppStore.getState().entitlement.trial).toBe(true);
});

it("다른 출처의 메시지는 무시한다", async () => {
  signedOut();
  const onReady = vi.fn();
  render(<ProjectCreateGate locale="ko" open onClose={() => {}} onReady={onReady} />);
  await waitFor(() => expect(screen.getByText("프로젝트는 Pro 기능입니다")).toBeTruthy());
  window.dispatchEvent(new MessageEvent("message", { data: { type: "gop-account-ready" }, origin: "https://attacker.example" }));
  expect(accountRequest).not.toHaveBeenCalled();
  expect(onReady).not.toHaveBeenCalled();
});

it("이미 로그인돼 있으면 로그인 버튼을 다시 누르게 하지 않는다", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: null });
  accountRequest.mockResolvedValue({ trialStarted: true, entitlement: activePro({ trial: true }) });
  const onReady = vi.fn();
  render(<ProjectCreateGate locale="ko" open onClose={() => {}} onReady={onReady} />);
  await waitFor(() => expect(onReady).toHaveBeenCalled());
});

it("체험을 이미 쓴 계정에는 구독을 권하고 통과시키지 않는다", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, account: { id: "a", email: "t@example.com" }, entitlement: null });
  // 서버가 거절하지 않고 권한 없음을 그대로 돌려준다 — 화면이 사유를 말해야 한다.
  accountRequest.mockResolvedValue({ trialStarted: false, entitlement: null });
  const onReady = vi.fn();
  render(<ProjectCreateGate locale="ko" open onClose={() => {}} onReady={onReady} />);
  await waitFor(() => expect(screen.getByText(/체험은 이미 사용했습니다/)).toBeTruthy());
  expect(onReady).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Pro 이용권 보기" })).toBeTruthy();
});

it("취소하면 아무것도 시작하지 않는다", async () => {
  signedOut();
  const onClose = vi.fn();
  render(<ProjectCreateGate locale="ko" open onClose={onClose} onReady={() => {}} />);
  await waitFor(() => expect(screen.getByText("프로젝트는 Pro 기능입니다")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(onClose).toHaveBeenCalled();
  expect(accountRequest).not.toHaveBeenCalled();
});

it("팝업이 막히면 사유를 말한다", async () => {
  signedOut();
  vi.stubGlobal("open", () => null);
  render(<ProjectCreateGate locale="ko" open onClose={() => {}} onReady={() => {}} />);
  await waitFor(() => expect(screen.getByText("프로젝트는 Pro 기능입니다")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Google로 로그인하고 시작" }));
  await waitFor(() => expect(screen.getByText(/팝업을 허용/)).toBeTruthy());
});
