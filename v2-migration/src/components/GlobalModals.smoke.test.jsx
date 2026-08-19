// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import GlobalModals from "@/components/GlobalModals";
import Header from "@/components/Header";
import { toolIndexEntry } from "@/lib/toolIndex";
import { workspaceNavItem } from "@/lib/workspaceNav";

// 도구 이름은 레지스트리에서 뽑는다 — 여기에 적어 두면 리네임마다 테스트가 깨진다.
const nameOf = (id, locale = "ko") => toolIndexEntry(id, locale).name;

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
    fireEvent.click(screen.getByRole("option", { name: new RegExp(nameOf("5-2")) }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(useAppStore.getState().isCmdkOpen).toBe(false);
  });

  it("includes data analysis, metric calculators, and performance diagnosis as workspace tasks", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    expect(screen.getByRole("option", { name: new RegExp(workspaceNavItem("start").name) })).toBeTruthy();
    expect(screen.getByRole("option", { name: /마케팅 지표 계산기/ })).toBeTruthy();
    const diagnosis = screen.getByRole("option", { name: new RegExp(workspaceNavItem("diagnose").name) });
    fireEvent.click(diagnosis);
    expect(pushMock).toHaveBeenCalledWith("/diagnose");
  });

  it("puts start tasks first and finds tools by the decision question", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    const initialOptions = screen.getAllByRole("option");
    // 워크스페이스 목적지 넷이 도구보다 먼저 온다 — 그중 결정 검토함은 예전에
    // 팔레트에서 통째로 빠져 있었다(같은 목록을 네 곳에 손으로 적던 흔적).
    expect(initialOptions.slice(0, 4).map((option) => option.textContent)).toEqual([
      expect.stringContaining(workspaceNavItem("start").name),
      expect.stringContaining(workspaceNavItem("diagnose").name),
      expect.stringContaining(workspaceNavItem("review").name),
      expect.stringContaining("마케팅 지표 계산기"),
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "작업·도구·가이드 검색" }), {
      target: { value: "줄인 예산을 어디로 옮기는 게 좋을까" },
    });
    expect(screen.getAllByRole("option")[0].textContent).toContain(nameOf("5-3"));
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-3")) })).toBeTruthy();
  });

  it("finds a tool from natural symptom wording and a workspace task from file intent", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    const search = screen.getByRole("combobox", { name: "작업·도구·가이드 검색" });

    fireEvent.change(search, { target: { value: "ROAS가 떨어졌어요" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-22")) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CSV 업로드" } });
    expect(screen.getByRole("option", { name: new RegExp(`${workspaceNavItem("start").name}.*CSV·XLSX를 올리고`) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CPT 올릴까" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-26")) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "CPA가 올랐어요" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-21")) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "광고비가 너무 적게 소진돼요" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-26")) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "VIF 필요해요" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-25")) })).toBeTruthy();

    fireEvent.change(search, { target: { value: "다중공선성 있는지 좀 봐줘" } });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-25")) })).toBeTruthy();
  });

  it("offers recovery actions when no command matches", () => {
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    fireEvent.change(screen.getByRole("combobox", { name: "작업·도구·가이드 검색" }), {
      target: { value: "찾을수없는검색어999" },
    });

    expect(screen.getByText("바로 맞는 도구를 찾지 못했습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: workspaceNavItem("start").name }));
    expect(pushMock).toHaveBeenCalledWith("/start");
  });

  it("keeps the English menu and localized tool route in parity", () => {
    renderToolMenu("en");
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    const dialog = screen.getByRole("dialog", { name: "Search tasks, tools, and guides" });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: new RegExp(nameOf("5-3", "en")) }));
    expect(pushMock).toHaveBeenCalledWith("/en/tools/budget-allocation");
  });

  it("finds an English tool from a conversational symptom", () => {
    renderToolMenu("en");
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "my ROAS has been falling since I raised budget" },
    });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-22", "en")) })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "need VIF" },
    });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-25", "en")) })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Search tasks, tools, and guides" }), {
      target: { value: "could you help me find a VIF check" },
    });
    expect(screen.getByRole("option", { name: new RegExp(nameOf("5-25", "en")) })).toBeTruthy();
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

  it("이름에서 뺀 전문용어로도 도구를 찾는다", () => {
    // 표시 이름을 6~8자로 줄이면서 VIF·다중공선성·PVM 같은 말이 이름에서 빠졌다.
    // 사용자는 그 말로 찾으므로 검색은 계속 걸려야 한다 — 실제로 한 번 깨졌던 자리다.
    renderToolMenu();
    fireEvent.click(screen.getByRole("button", { name: "전체 도구" }));
    const search = screen.getByRole("combobox", { name: "작업·도구·가이드 검색" });
    for (const [query, toolId] of [["다중공선성", "5-25"], ["VIF", "5-25"], ["MMM", "5-18-mmm"]]) {
      fireEvent.change(search, { target: { value: query } });
      // 하나만 나오는지가 아니라 "찾히는지"가 계약이다(같은 말로 여러 분석이 잡힌다).
      // 이름을 정규식으로 그대로 쓰면 "채널 기여도 (MMM)"의 괄호가 캡처 그룹이 되어
      // 실제로는 "채널 기여도 MMM"을 찾는다 — 이름에 메타문자가 들어온 순간 조용히
      // 어긋나므로 이스케이프한다.
      const namePattern = new RegExp(nameOf(toolId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      expect(
        screen.queryAllByRole("option", { name: namePattern }).length,
        `"${query}"로 ${toolId}(${nameOf(toolId)})를 못 찾음`,
      ).toBeGreaterThan(0);
    }
  });
});
