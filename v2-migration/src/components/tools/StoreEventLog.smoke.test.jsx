// @vitest-environment jsdom
//
// 액션 로그의 세 입력 경로가 실제로 목록에 도달하는지 고정한다. 엔진 골든은
// 순수함수만 보므로 스토어 배선(추가·삭제·CSV 소유 구분)은 여기서만 드러난다(§7).
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";
import { eventsFromRows } from "@/utils/storeEvents";
import AsoStoreConversion from "@/components/tools/AsoStoreConversion";

function seedAnalyzed() {
  const slice = buildDemoCsv("aso_store");
  useAppStore.setState({
    currentRouteId: "5-27",
    csvGroups: { ...useAppStore.getState().csvGroups, aso_store: slice },
    csvData: slice,
    storeEventsManual: [],
  });
  useAppStore.getState().setGroupAnalyzed("5-27");
  return slice;
}

describe("StoreEventLog 입력 경로", () => {
  beforeEach(() => {
    useAppStore.setState({ analyzedByGroup: {}, storeEventsManual: [] });
  });

  it("① 본 CSV의 event 컬럼에서 뽑은 이벤트가 목록에 뜬다", () => {
    const slice = seedAnalyzed();
    const fromCsv = eventsFromRows(slice.raw);
    expect(fromCsv.length).toBeGreaterThan(0);

    const { container } = render(<AsoStoreConversion />);
    const panel = container.querySelector("#aso-events");
    expect(panel).toBeTruthy();
    for (const event of fromCsv) expect(panel.textContent).toContain(event.label);
    // CSV가 소유한 이벤트는 여기서 지울 수 없어야 한다(원본이 진실).
    expect(panel.textContent).toContain("CSV 컬럼");
  });

  it("③ 직접 추가한 이벤트가 목록에 더해진다", () => {
    seedAnalyzed();
    const { container } = render(<AsoStoreConversion />);
    const form = container.querySelector(".event-log__form");
    fireEvent.change(form.querySelector('input[type="date"]'), { target: { value: "2025-03-15" } });
    fireEvent.change(form.querySelector('input[type="text"]'), { target: { value: "리뷰 이벤트 시작" } });
    fireEvent.submit(form);

    expect(useAppStore.getState().storeEventsManual.map((event) => event.label)).toContain("리뷰 이벤트 시작");
    expect(container.querySelector("#aso-events").textContent).toContain("리뷰 이벤트 시작");
  });

  it("③ 붙여넣기로 여러 건을 한 번에 넣는다", () => {
    seedAnalyzed();
    const { container } = render(<AsoStoreConversion />);
    const textarea = container.querySelector(".event-log__form textarea");
    fireEvent.change(textarea, { target: { value: "2025-03-05, 가격 인하 A, price\n2025-03-06, 피처링 노출, external" } });
    fireEvent.click([...container.querySelectorAll("#aso-events button")].find((button) => button.textContent === "읽어들이기"));

    const labels = useAppStore.getState().storeEventsManual.map((event) => event.label);
    expect(labels).toEqual(expect.arrayContaining(["가격 인하 A", "피처링 노출"]));
  });

  it("직접 추가분만 지워지고 CSV 이벤트는 남는다", () => {
    const slice = seedAnalyzed();
    useAppStore.getState().addStoreEvents([{ date: "2025-03-15", label: "지울 것" }]);
    const { container } = render(<AsoStoreConversion />);

    const removeButtons = container.querySelectorAll(".event-log__remove");
    // CSV 이벤트에는 삭제 버튼이 없으므로 직접 추가분 수와 같아야 한다.
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]);
    expect(useAppStore.getState().storeEventsManual).toHaveLength(0);
    expect(container.querySelector("#aso-events").textContent).toContain(eventsFromRows(slice.raw)[0].label);
  });

  it("데이터 기간 밖 이벤트는 버리지 않고 안내한다", () => {
    seedAnalyzed();
    useAppStore.getState().addStoreEvents([{ date: "2020-01-01", label: "옛날 일" }]);
    const { container } = render(<AsoStoreConversion />);
    expect(container.querySelector("#aso-events").textContent).toContain("2020-01-01");
    expect(container.querySelector("#aso-events").textContent).toMatch(/기간 밖/);
  });
});
