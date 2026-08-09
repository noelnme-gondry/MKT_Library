// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import GlobalModals from "@/components/GlobalModals";
import Header from "@/components/Header";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
    refresh() {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect() {},
  notFound() {},
}));

function renderToolMenu(locale = "ko") {
  return render(
    <>
      <Header locale={locale} />
      <GlobalModals locale={locale} />
    </>,
  );
}

describe("GlobalModals complete tool menu", () => {
  beforeEach(() => {
    pushMock.mockClear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    useAppStore.setState({ isCmdkOpen: false, analystMode: false });
  });

  it("opens an accessible dialog, traps focus, closes on Escape, and restores focus", async () => {
    renderToolMenu();
    const trigger = screen.getByRole("button", { name: "전체 도구" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "작업·도구·가이드 검색" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const search = screen.getByRole("combobox", { name: "작업·도구·가이드 검색" });
    await waitFor(() => expect(document.activeElement).toBe(search));

    const options = screen.getAllByRole("option");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(options.at(-1));
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(search);

    const close = screen.getByRole("button", { name: "닫기" });
    expect(close.style.minWidth).toBe("44px");
    expect(close.style.minHeight).toBe("44px");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(document.querySelector("#cmdk")?.hidden).toBe(true);
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("opens a representative Korean tool route from the real menu", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    fireEvent.click(screen.getByRole("option", { name: /운영 대시보드/ }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(useAppStore.getState().isCmdkOpen).toBe(false);
  });

  it("includes data analysis, metric calculators, and performance diagnosis as workspace tasks", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    expect(screen.getByRole("option", { name: /내 데이터 분석/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /마케팅 지표 계산기/ })).toBeTruthy();
    const diagnosis = screen.getByRole("option", { name: /성과 문제 진단/ });
    fireEvent.click(diagnosis);
    expect(pushMock).toHaveBeenCalledWith("/diagnose");
  });

  it("puts start tasks first and finds tools by the decision question", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    const initialOptions = screen.getAllByRole("option");
    expect(initialOptions.slice(0, 3).map((option) => option.textContent)).toEqual([
      expect.stringContaining("내 데이터 분석"),
      expect.stringContaining("성과 문제 진단"),
      expect.stringContaining("마케팅 지표 계산기"),
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "작업·도구·가이드 검색" }), {
      target: { value: "줄인 예산을 어디로 옮기는 게 좋을까" },
    });
    expect(screen.getAllByRole("option")[0].textContent).toContain("예산 배분 시뮬레이터");
    expect(screen.getByRole("option", { name: /예산 배분 시뮬레이터/ })).toBeTruthy();
  });

  it("finds a tool from natural symptom wording and a workspace task from file intent", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    const search = screen.getByRole("combobox", { name: "작업·도구·가이드 검색" });

    fireEvent.change(search, { target: { value: "ROAS가 떨어졌어요" } });
    expect(screen.getByRole("option", { name: /캠페인 포화도/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CSV 업로드" } });
    expect(screen.getByRole("option", { name: /내 데이터 분석.*CSV·XLSX를 올리고/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CPT 올릴까" } });
    expect(screen.getByRole("option", { name: /ASA 키워드 발굴/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CPA가 올랐어요" } });
    expect(screen.getByRole("option", { name: /캠페인 성과 변동/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "광고비가 너무 적게 소진돼요" } });
    expect(screen.getByRole("option", { name: /ASA 키워드 발굴/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "VIF 필요해요" } });
    expect(screen.getByRole("option", { name: /VIF 다중공선성/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "다중공선성 있는지 좀 봐줘" } });
    expect(screen.getByRole("option", { name: /VIF 다중공선성/ })).toBeTruthy();
  });

  it("offers recovery actions when no command matches", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    fireEvent.change(screen.getByRole("combobox", { name: "작업·도구·가이드 검색" }), {
      target: { value: "찾을수없는검색어999" },
    });

    expect(screen.getByText("바로 맞는 도구를 찾지 못했습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "내 데이터 분석" }));
    expect(pushMock).toHaveBeenCalledWith("/start");
  });

  it("keeps the English menu and localized tool route in parity", () => {
    renderToolMenu("en");
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    const dialog = screen.getByRole("dialog", { name: "Search tasks, tools, and guides" });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Budget Allocation Simulator/ }));
    expect(pushMock).toHaveBeenCalledWith("/en/tools/budget-allocation");
  });

  it("finds an English tool from a conversational symptom", () => {
    renderToolMenu("en");
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "my ROAS has been falling since I raised budget" },
    });
    expect(screen.getByRole("option", { name: /Campaign Saturation/ })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "need VIF" },
    });
    expect(screen.getByRole("option", { name: /VIF Multicollinearity/ })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "could you help me find a VIF check" },
    });
    expect(screen.getByRole("option", { name: /VIF Multicollinearity/ })).toBeTruthy();
  });

  it("switches analyst mode as a command without navigating", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    fireEvent.click(screen.getByRole("option", { name: /분석가 모드 켜기/ }));
    expect(useAppStore.getState().analystMode).toBe(true);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("reveals the noindex growth funnel report only in analyst mode", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    expect(screen.queryByRole("option", { name: /제품 성장 퍼널 리포트/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /분석가 모드 켜기/ }));
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    fireEvent.click(screen.getByRole("option", { name: /제품 성장 퍼널 리포트/ }));
    expect(pushMock).toHaveBeenCalledWith("/growth-funnel");
  });
});
