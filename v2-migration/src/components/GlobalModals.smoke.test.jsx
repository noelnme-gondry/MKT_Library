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
    useAppStore.setState({ isCmdkOpen: false });
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

  it("keeps the English menu and localized tool route in parity", () => {
    renderToolMenu("en");
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    const dialog = screen.getByRole("dialog", { name: "Search tasks, tools, and guides" });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Budget Allocation Simulator/ }));
    expect(pushMock).toHaveBeenCalledWith("/en/tools/budget-allocation");
  });
});
