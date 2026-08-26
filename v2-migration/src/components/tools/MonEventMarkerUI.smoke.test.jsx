// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MonEventMarkerUI from "@/components/tools/MonEventMarkerUI";
import { useAppStore } from "@/store/useDataStore";

describe("MonEventMarkerUI", () => {
  beforeEach(() => useAppStore.setState({ eventMarkers: [] }));

  it("stores a typed annotation and honestly explains persistence", () => {
    render(<MonEventMarkerUI />);
    expect(screen.getByText(/이 기기에 저장/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("이벤트 종류"), { target: { value: "price" } });
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-08-20" } });
    fireEvent.change(screen.getByPlaceholderText(/신규 프로모션 시작/), { target: { value: "가격 실험" } });
    fireEvent.click(screen.getByRole("button", { name: "+ 마커 추가" }));
    expect(useAppStore.getState().eventMarkers[0]).toMatchObject({ date: "2026-08-20", label: "가격 실험", type: "price" });
    expect(screen.getAllByText("가격·프로모션")).toHaveLength(2);
  });
});
