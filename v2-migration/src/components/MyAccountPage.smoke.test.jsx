// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyAccountPage from "./MyAccountPage";
import { useAppStore } from "@/store/useDataStore";
import { refreshAccount, accountRequest } from "@/lib/account/accountClient";
import { activePro } from "@/test/proEntitlement";
let accountRules = [];
let accountEnabled = true;
import { MAPPING_MEMORY_ENABLED_KEY } from "@/lib/data-import/memory/mappingMemory";

vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: vi.fn(), accountRequest: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState(useAppStore.getInitialState(), true);
  window.localStorage.clear();
  vi.clearAllMocks();
  accountRules = []; accountEnabled = true;
  accountRequest.mockImplementation(async (path, options) => {
    if (path !== "mappings") return { memos: [] };
    const input = options?.body ? JSON.parse(options.body) : {};
    if (options?.method === "DELETE") accountRules = input.all ? [] : accountRules.filter(rule => rule.normalizedColumnName !== input.name);
    else if (input.rules) accountRules = [...accountRules.filter(rule => !input.rules.some(next => next.normalizedColumnName === rule.normalizedColumnName)), ...input.rules];
    if (input.enabled !== undefined) accountEnabled = input.enabled;
    return { accountId: "a", rules: [...accountRules], enabled: accountEnabled, canApply: true };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const signedIn = (extra = {}) => refreshAccount.mockResolvedValue({
  enabled: true, mailEnabled: false,
  account: { id: "a", email: "noelnme@gmail.com", trialStartedAt: "2026-09-01T00:00:00Z" },
  entitlement: activePro({ trial: true }),
  ...extra,
});

it("계정·구독·프로젝트를 한 화면에서 보여준다", async () => {
  signedIn();
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByText("noelnme@gmail.com")).toBeTruthy());
  expect(screen.getByRole("heading", { name: "마이페이지" })).toBeTruthy();
  expect(screen.getByText("Pro 체험 중")).toBeTruthy();
  expect(screen.getByText("체험 시작")).toBeTruthy();
  expect(screen.getByText("이용 종료")).toBeTruthy();
  // 프로젝트는 이 기기(IndexedDB)에 있으므로 빈 상태에서 0개다.
  await waitFor(() => expect(screen.getByText("0개")).toBeTruthy());
  expect(screen.getByRole("link", { name: "프로젝트 열기" }).getAttribute("href")).toBe("/weekly-review#project-management");
});

it("구매 이용권의 시작일을 지어내지 않는다", async () => {
  // 서버가 구매 시작일을 내려주지 않는다 — 없는 값을 채우면 그게 거짓 숫자다(§8).
  signedIn({ entitlement: activePro({ trial: false }) });
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByText("Pro 이용권 사용 중")).toBeTruthy());
  expect(screen.queryByText("이용 시작")).toBeNull();
  expect(screen.getByText("이용 종료")).toBeTruthy();
});

it("체험을 다 쓴 계정은 종료로 읽히고 구독을 권한다", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, mailEnabled: false, account: { id: "a", email: "t@example.com", trialStartedAt: "2026-01-01T00:00:00Z" }, entitlement: null });
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByText("체험 종료")).toBeTruthy());
  expect(screen.getByRole("link", { name: "Pro 이용권 보기" })).toBeTruthy();
});

it("로그아웃 상태에서도 화면이 죽지 않고 사유를 말한다", async () => {
  refreshAccount.mockResolvedValue({ enabled: true, mailEnabled: false, account: null, entitlement: null });
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByText(/로그인하면 계정과 이용권 정보를/)).toBeTruthy());
  // 로그인 전에는 이용권 카드가 뜨지 않는다 — 빈 값을 표로 채우지 않는다.
  expect(screen.queryByRole("heading", { name: "이용권" })).toBeNull();
});

it("EN도 같은 구조로 렌더된다", async () => {
  signedIn();
  render(<MyAccountPage locale="en" />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "My account" })).toBeTruthy());
  expect(screen.getByText("Pro trial active")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open projects" }).getAttribute("href")).toBe("/en/weekly-review#project-management");
});

it.each(["ko", "en"])("does not claim zero projects when device storage cannot be read (%s)", async locale => {
  signedIn();
  vi.stubGlobal("indexedDB", { open: () => { throw new Error("blocked"); } });
  render(<MyAccountPage locale={locale} />);
  const warning = await screen.findByText(locale === "en" ? /Could not read the project count/ : /프로젝트 개수를 확인하지 못했습니다/);
  expect(warning.getAttribute("role")).toBe("alert");
  expect(screen.queryByText(locale === "en" ? "0" : "0개")).toBeNull();
});

it("직접 입력한 매핑의 이름과 연결 규칙만 계정에 저장한다", async () => {
  signedIn();
  window.localStorage.setItem(MAPPING_MEMORY_ENABLED_KEY, "true");
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "내 컬럼 매핑 Pro" })).toBeTruthy());
  expect(await screen.findByText("아직 저장한 매핑이 없습니다.")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("직접 입력"), { target: { value: "mkt_country" } });
  fireEvent.change(screen.getByLabelText("이 도구가 쓰는 항목"), { target: { value: "country" } });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));

  await waitFor(async () => expect(accountRules).toHaveLength(1));
  const [record] = accountRules;
  // 왼쪽은 내 파일의 컬럼, 오른쪽은 이 도구가 쓰는 항목.
  expect(record.normalizedColumnName).toBe("mkt_country");
  expect(record.canonicalKey).toBe("country");
  await waitFor(() => expect(screen.getByRole("rowheader", { name: "mkt_country" })).toBeTruthy());
});

it("저장한 매핑을 한 줄만 지울 수 있다", async () => {
  signedIn();
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "내 컬럼 매핑 Pro" })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("직접 입력"), { target: { value: "spend_krw" } });
  fireEvent.change(screen.getByLabelText("이 도구가 쓰는 항목"), { target: { value: "media_spend" } });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
  await waitFor(() => expect(screen.getByRole("rowheader", { name: "spend_krw" })).toBeTruthy());
  // 레지스트리에 없는 키는 저장되지 않는다 — 화면이 고를 수 있는 값만 규칙이 된다.
  expect((accountRules)[0].canonicalKey).toBe("media_spend");

  // 전체 삭제만 있으면 한 줄을 고치려고 나머지를 전부 버려야 한다.
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  await waitFor(async () => expect(accountRules).toHaveLength(0));
});

it("매핑 사용 토글은 규칙을 지우지 않고 적용만 멈춘다", async () => {
  signedIn();
  window.localStorage.setItem(MAPPING_MEMORY_ENABLED_KEY, "true");
  render(<MyAccountPage locale="ko" />);
  await waitFor(() => expect(screen.getByLabelText("저장한 매핑 사용").disabled).toBe(false));
  const toggle = screen.getByLabelText("저장한 매핑 사용");
  expect(toggle.checked).toBe(true);
  fireEvent.click(toggle);
  await waitFor(() => expect(accountEnabled).toBe(false));
});
