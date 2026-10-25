// @vitest-environment jsdom
//
// 5-26 ASA 키워드 도구 렌더 스모크. 최신 도구인데 전용 스모크가 없었고, 공유 스위트
// 두 곳에서만 마운트되는데 둘 다 useAppStore.setState로 슬라이스를 직접 주입해
// **실제 진입 경로를 우회**했다(감사 P1-10). ARCHITECTURE.md:130이 경고한 5-24 사고와
// 같은 패턴이다 — setCurrentRouteId → 미러 스왑을 밟지 않으면 미러가 undefined인
// 상태의 렌더 throw를 못 잡는다.
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { useAppStore } from "@/store/useDataStore";
import AsaKeywordFinder from "@/components/tools/AsaKeywordFinder";
import { openResultDetails } from "@/test/resultDetails";

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

  it("keeps threshold inputs disabled until their event handlers are attached", () => {
    const server = document.createElement("div");
    server.innerHTML = renderToString(<AsaKeywordFinder />);
    const inputs = server.querySelectorAll(".asa-tool__inputs input");
    expect(inputs).toHaveLength(3);
    for (const input of inputs) expect(input.disabled).toBe(true);
    render(<AsaKeywordFinder />);
    expect(screen.getByRole("textbox", { name: "목표 CPA", exact: true }).disabled).toBe(false);
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

  it("결과는 임원 보고 형식이다: 보류형 결론 → 성숙도 선언 뒤 숫자 결론·수치 3개·조치 표, 자세히 보기는 닫힘", () => {
    const actionable = [];
    for (let d = 1; d <= 7; d += 1) {
      const date = `2026-03-${String(d).padStart(2, "0")}`;
      actionable.push({ date, search_term: "budget app", match_type: "broad", cost: "1000", clicks: "10", installs: "3", daily_budget: "10000", target_cpa: "500" });
      actionable.push({ date, search_term: "bank app", match_type: "exact", cost: "1000", clicks: "10", installs: "1", daily_budget: "10000", target_cpa: "500" });
    }
    act(() => {
      useAppStore.getState().setCurrentRouteId("5-26");
      useAppStore.getState().setCsvData({ raw: actionable, headers: Object.keys(actionable[0]), mapping: Object.fromEntries(Object.keys(actionable[0]).map((key) => [key, key])), fileName: "asa.csv" });
      useAppStore.getState().setGroupAnalyzed("5-26");
    });
    const { container } = render(<AsaKeywordFinder />);
    const headline = () => container.querySelector(".result-action-card__headline").textContent;
    expect(headline()).toMatch(/^판단 보류 — 전환 성숙도 미확인/);
    fireEvent.change(screen.getByLabelText("최근 며칠은 전환이 아직 더 들어올 수 있나요?"), { target: { value: "mature" } });
    expect(headline()).toMatch(/검색어 1개 CPT 조정/);
    expect(headline()).toMatch(/Exact 승격 1개/);
    expect(container.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    const table = container.querySelector("#asa-actions table");
    expect(table.textContent).toContain("budget app");
    // 조치 없는 행(bank app)은 결론 표에 섞이지 않는다 — 자세히 보기의 전체 표에만 있다.
    expect(table.textContent).not.toContain("bank app");
    const toggle = container.querySelector("[data-result-details-toggle]");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#asa-all-title")).toBeNull();
    openResultDetails();
    expect(container.querySelector(".asa-tool__all").textContent).toContain("bank app");
  });
});
