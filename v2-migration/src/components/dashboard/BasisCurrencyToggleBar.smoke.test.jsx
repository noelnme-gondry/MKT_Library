// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import { useAppStore } from "@/store/useDataStore";

const slice = {
  raw: [{ Spend: 1400, Installs: 1 }],
  headers: ["Spend", "Installs"],
  mapping: { Spend: "cost", Installs: "installs" },
  fileName: "currency.csv",
  currency: "KRW",
};

describe("BasisCurrencyToggleBar currency contract", () => {
  beforeEach(() => {
    const state = useAppStore.getState();
    useAppStore.setState({
      currentRouteId: "5-2",
      activeDataGroup: "efficiency",
      csvGroups: { ...state.csvGroups, efficiency: slice },
      csvData: slice,
      displayCurrency: "USD",
      denomBasis: "installs",
      // 게이트는 다른 케이스의 확정 시그가 남으면 통화만 되돌려도 다시 맞아
      // 버린다(§7 beforeEach 오염) — 케이스마다 닫힌 상태에서 시작한다.
      analyzedByGroup: { ...state.analyzedByGroup, efficiency: null },
    });
  });

  it("효율 도구에서는 원본 단위만 선언하고 환산을 약속하지 않는다", () => {
    const { container } = render(<BasisCurrencyToggleBar />);

    expect(screen.getByText("금액 단위")).toBeTruthy();
    // 오해 방지 문장은 컨트롤 줄 가운데가 아니라 ⓘ 안에 있다 — 열면 보인다.
    expect(screen.queryByText(/숫자는 환산하지 않습니다/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "금액 단위 설명" }));
    expect(screen.getByText(/숫자는 환산하지 않습니다/)).toBeTruthy();
    expect(container.querySelector(".fixed-rate-note")).toBeNull();
    // 두 칸 모두 버튼이고 선택 상태를 aria-pressed로 말한다.
    expect(screen.getByRole("button", { name: "원 ₩" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "달러 $" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("group", { name: "금액 단위" }).querySelectorAll("button")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "달러 $" }));
    expect(useAppStore.getState().csvData.currency).toBe("USD");
    expect(useAppStore.getState().displayCurrency).toBe("USD");
  });

  it("단위 선언을 바꿔도 이미 끝난 분석이 사라지지 않는다", () => {
    // currency는 computeAnalyzeSig에 들어가므로 선언을 바꾸면 게이트 시그가
    // 달라진다. 환산이 없는 이 모드에서는 숫자가 한 자리도 안 바뀌는데도
    // 결과가 통째로 접히던 회귀 — 사용자에겐 "달러 눌렀더니 데이터가 확 바뀜".
    useAppStore.getState().setGroupAnalyzed("5-2");
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);

    render(<BasisCurrencyToggleBar />);
    fireEvent.click(screen.getByRole("button", { name: "달러 $" }));

    expect(useAppStore.getState().csvData.currency).toBe("USD");
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
  });

  it("분석 전이었다면 통화 선언만으로 분석이 끝난 척하지 않는다", () => {
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(false);

    render(<BasisCurrencyToggleBar />);
    fireEvent.click(screen.getByRole("button", { name: "달러 $" }));

    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(false);
  });

  it("실제 환산 모드에서만 고정 환율을 고지한다", () => {
    render(<BasisCurrencyToggleBar currencyMode="convert" locale="en" />);
    expect(screen.getByText("Display currency")).toBeTruthy();
    expect(screen.getByText(/fixed ₩1,400/)).toBeTruthy();
  });
});
