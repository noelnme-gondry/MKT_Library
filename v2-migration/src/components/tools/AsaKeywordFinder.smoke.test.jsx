// @vitest-environment jsdom
//
// 5-26 ASA 키워드 도구 렌더 스모크. 최신 도구인데 전용 스모크가 없었고, 공유 스위트
// 두 곳에서만 마운트되는데 둘 다 useAppStore.setState로 슬라이스를 직접 주입해
// **실제 진입 경로를 우회**했다(감사 P1-10). ARCHITECTURE.md:130이 경고한 5-24 사고와
// 같은 패턴이다 — setCurrentRouteId → 미러 스왑을 밟지 않으면 미러가 undefined인
// 상태의 렌더 throw를 못 잡는다.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { useAppStore } from "@/store/useDataStore";
import AsaKeywordFinder from "@/components/tools/AsaKeywordFinder";

const HEADERS = ["date", "search_term", "cost", "clicks", "installs"];
const MAPPING = { date: "date", search_term: "search_term", cost: "cost", clicks: "clicks", installs: "installs" };

function rows() {
  const out = [];
  const terms = ["brand keyword", "generic running", "competitor app"];
  for (let d = 1; d <= 14; d += 1) {
    const date = `2026-02-${String(d).padStart(2, "0")}`;
    terms.forEach((term, i) => {
      out.push({
        date,
        search_term: term,
        // 천단위 콤마가 들어간 실제 내보내기 형태 — mapRowsToStandard가 벗겨야 한다.
        cost: (12000 + i * 4000 + d * 300).toLocaleString("en-US"),
        clicks: String(120 + i * 30 + d),
        installs: String(18 + i * 5 + Math.floor(d / 2)),
      });
    });
  }
  return out;
}

describe("AsaKeywordFinder render smoke", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it("실제 진입 경로(setCurrentRouteId → 미러 스왑)로 데이터 없이 마운트된다", () => {
    act(() => {
      useAppStore.getState().setCurrentRouteId("5-26");
    });
    // 미러가 스왑된 뒤에도 슬라이스가 살아 있어야 한다(undefined면 렌더 throw).
    expect(useAppStore.getState().csvData).toBeTruthy();
    expect(() => render(<AsaKeywordFinder />)).not.toThrow();
  });

  it("진입 경로로 CSV를 쓴 뒤 분석까지 throw 없이 렌더된다", () => {
    act(() => {
      useAppStore.getState().setCurrentRouteId("5-26");
      useAppStore.getState().setCsvData({ raw: rows(), headers: HEADERS, mapping: MAPPING, fileName: "asa.csv" });
    });
    // 업로드가 asa_keyword 그룹에 실제로 들어갔는지(읽기·쓰기 그룹 일치, §4.3)
    expect(useAppStore.getState().csvGroups.asa_keyword.raw.length).toBe(42);
    expect(useAppStore.getState().csvData.raw.length).toBe(42);
    expect(() => render(<AsaKeywordFinder />)).not.toThrow();
  });

  it("EN 로케일에서도 throw 없이 렌더된다", () => {
    act(() => {
      useAppStore.getState().setCurrentRouteId("5-26");
      useAppStore.getState().setCsvData({ raw: rows(), headers: HEADERS, mapping: MAPPING, fileName: "asa.csv" });
    });
    expect(() => render(<AsaKeywordFinder locale="en" />)).not.toThrow();
    expect(screen.queryByText("�")).toBeNull();
  });
});
