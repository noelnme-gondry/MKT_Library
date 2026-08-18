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
  // 게이트 setter는 `setGroupAnalyzed`다. 예전 이 줄은 없는 이름을 옵셔널
  // 체이닝으로 불러(`setAnalyzed?.()`) 결과 분기에 아예 들어가지 못했고,
  // 아래 조건부 단언까지 겹쳐 검사가 통째로 공허하게 통과하고 있었다(§7).
  useAppStore.getState().setGroupAnalyzed("5-25");
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
    const { container } = render(<MulticollinearityChecker />);
    // 게이트를 실제로 통과했는지 먼저 확인한다 — 통과 못 하면 결과 표가 없어
    // "∞가 없다"가 참이 되고 가드가 아무것도 안 지킨다.
    expect(useAppStore.getState().isGroupAnalyzed("5-25")).toBe(true);
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.textContent).not.toContain("∞");
  });
});
