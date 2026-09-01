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
    });
  });

  it("효율 도구에서는 원본 단위만 선언하고 환산을 약속하지 않는다", () => {
    const { container } = render(<BasisCurrencyToggleBar />);

    expect(screen.getByText("데이터 통화")).toBeTruthy();
    expect(screen.getByText(/숫자는 환산하지 않습니다/)).toBeTruthy();
    expect(container.querySelector(".fixed-rate-note")).toBeNull();
    expect(screen.getByRole("button", { name: "원 ₩" }).classList.contains("active")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "달러 $" }));
    expect(useAppStore.getState().csvData.currency).toBe("USD");
    expect(useAppStore.getState().displayCurrency).toBe("USD");
  });

  it("실제 환산 모드에서만 고정 환율을 고지한다", () => {
    render(<BasisCurrencyToggleBar currencyMode="convert" locale="en" />);
    expect(screen.getByText("Display currency")).toBeTruthy();
    expect(screen.getByText(/fixed ₩1,400/)).toBeTruthy();
  });
});
