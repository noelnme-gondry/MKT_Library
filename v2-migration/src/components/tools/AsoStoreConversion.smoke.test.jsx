// @vitest-environment jsdom
//
// 5-27 ASO 스토어 전환 분석 렌더 스모크. 골든(asoStoreMath.test.js)은 순수함수만
// 보므로 표시층 배선(잘못된 import·없는 필드 접근)은 잡지 못한다 — 실제로 이
// 도구는 `fmtPercent`(존재하지 않는 export)를 import한 채 전 테스트를 통과했고
// `next build`에서야 걸렸다(§7 "render throw는 골든이 못 잡는다").
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";
import AsoStoreConversion from "@/components/tools/AsoStoreConversion";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice) {
  useAppStore.setState({
    currentRouteId: "5-27",
    csvGroups: { ...useAppStore.getState().csvGroups, aso_store: slice },
    csvData: slice,
  });
}

describe("AsoStoreConversion render smoke", () => {
  beforeEach(() => {
    useAppStore.setState({ analyzedByGroup: {} });
  });

  it("데이터 없는 상태에서 throw 없이 마운트된다", () => {
    seed(EMPTY);
    expect(() => render(<AsoStoreConversion />)).not.toThrow();
  });

  it("분석 게이트 통과 후 KO/EN 모두 결과를 렌더한다", () => {
    seed(buildDemoCsv("aso_store"));
    // 게이트 setter 이름은 `setGroupAnalyzed` — 옵셔널 체이닝으로 없는 이름을
    // 부르면 결과 분기에 영영 못 들어가고 테스트가 공허하게 통과한다.
    useAppStore.getState().setGroupAnalyzed("5-27");
    expect(useAppStore.getState().isGroupAnalyzed("5-27")).toBe(true);

    const ko = render(<AsoStoreConversion />);
    expect(ko.container.querySelector("#aso-result")).toBeTruthy();
    expect(ko.container.querySelector("#aso-funnel")).toBeTruthy();
    expect(ko.container.querySelector("#aso-sources")).toBeTruthy();
    // 추이 차트는 캔버스가 실제로 붙어야 한다(조건부 마운트라 렌더 분기에서만 드러남).
    expect(ko.container.querySelector("#aso-trend canvas")).toBeTruthy();
    ko.unmount();

    // EN은 EN 데모를 시드해야 실제 경로와 같다 — 액션 로그 라벨이 데이터라
    // KO 픽스처를 EN 화면에 그대로 넣으면 한글이 화면에 남는다.
    seed(buildDemoCsv("aso_store", "en"));
    useAppStore.getState().setGroupAnalyzed("5-27");
    const en = render(<AsoStoreConversion locale="en" />);
    expect(en.container.textContent).toContain("Store funnel");
    expect(en.container.textContent).not.toMatch(/[가-힣]/);
  });

  it("데모 데이터에서 믹스(트래픽 구성) 주도로 판정한다", () => {
    // 데모는 소스별 전환율을 유지한 채 저전환 Browse 비중만 올린다 → 페이지가
    // 아니라 유입 구성이 원인이어야 한다. 여기가 뒤집히면 분해가 깨진 것이다.
    seed(buildDemoCsv("aso_store"));
    useAppStore.getState().setGroupAnalyzed("5-27");
    const { container } = render(<AsoStoreConversion />);
    expect(container.textContent).toContain("트래픽 구성 변화가 주도");
  });
});
