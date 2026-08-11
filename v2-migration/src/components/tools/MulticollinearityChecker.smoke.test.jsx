// @vitest-environment jsdom
//
// 5-25 VIF 점검 도구 렌더 스모크. 이 도구는 다른 전 도구와 달리 스모크가 없었고,
// 그 때문에 "계산 불가"를 ∞(완전 공선 = 최악 등급)로 렌더하는 표시층 버그가
// 골든(순수함수) 그물을 통과해 배포됐다. 그 회귀를 여기서 고정한다.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MulticollinearityChecker from "@/components/tools/MulticollinearityChecker";

const HEADERS = ["date", "channel", "cost"];
const MAPPING = { date: "date", channel: "channel", cost: "cost" };

function seed(raw) {
  const slice = { raw, headers: HEADERS, mapping: MAPPING, fileName: "vif.csv" };
  useAppStore.setState({
    currentRouteId: "5-25",
    csvGroups: { ...useAppStore.getState().csvGroups, collinearity: slice },
    csvData: slice,
  });
  useAppStore.getState().setAnalyzed?.("5-25", true);
}

// 채널 2개지만 하나는 지출이 전혀 변하지 않음(상수) → VIF 계산 불가(not_applicable).
// 예전 코드는 이 상태에서 표에 "∞"를 찍었다.
function constantChannelRows() {
  const rows = [];
  for (let d = 1; d <= 20; d += 1) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    rows.push({ date, channel: "brand", cost: 100000 });
    rows.push({ date, channel: "perf", cost: 50000 + d * 3000 });
  }
  return rows;
}

describe("MulticollinearityChecker render smoke", () => {
  beforeEach(() => {
    useAppStore.setState({ analyzedByGroup: {} });
  });

  it("데이터 없는 상태에서 throw 없이 마운트된다", () => {
    useAppStore.setState({
      currentRouteId: "5-25",
      csvGroups: { ...useAppStore.getState().csvGroups, collinearity: { raw: [], headers: [], mapping: {}, fileName: "" } },
      csvData: { raw: [], headers: [], mapping: {}, fileName: "" },
    });
    expect(() => render(<MulticollinearityChecker />)).not.toThrow();
  });

  it("VIF 계산 불가 상태를 ∞(완전 공선)로 표시하지 않는다 (날조 금지 회귀 가드)", () => {
    seed(constantChannelRows());
    expect(() => render(<MulticollinearityChecker />)).not.toThrow();
    const tableText = document.body.textContent || "";
    // 계산 불가인데 최악 등급 기호를 찍으면 안 된다.
    if (/계산할 수 없습니다|Not computable|계산 불가/.test(tableText)) {
      expect(tableText.includes("∞"), "계산 불가 상태에서 ∞가 렌더됨").toBe(false);
    }
  });
});
