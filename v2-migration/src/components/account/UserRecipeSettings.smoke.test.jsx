// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/account/accountClient", () => ({
  accountRequest: vi.fn(async () => ({
    accountId: "a1",
    canApply: false,
    recipes: [{ toolId: "5-21", name: "주간 보고용", steps: [{ id: "level.pvm.channelCampaign", params: {} }, { id: "view.top.5", params: {} }] }],
  })),
}));
import UserRecipeSettings from "./UserRecipeSettings";

describe("마이페이지 · 내 분석 설정", () => {
  it("도구 이름·설정 이름·설정 단어를 사람이 읽는 말로 보인다(만료 후에도 열람)", async () => {
    render(<UserRecipeSettings accountId="a1" locale="ko" />);
    const row = (await screen.findByRole("cell", { name: "주간 보고용" })).closest("tr");
    expect(row.textContent).toContain("성과 변동 원인");
    expect(row.textContent).not.toContain("[object Object]");
    expect(row.textContent).toContain("채널+캠페인별 · 상위 5개만 보기");
    expect(within(row).getByRole("button", { name: /삭제/ })).toBeTruthy();
  });

  it("로그인 전에는 목록 대신 안내", () => {
    render(<UserRecipeSettings accountId={null} locale="ko" />);
    expect(screen.getByText(/로그인하면 저장한 설정을/)).toBeTruthy();
  });
});
