import { describe, expect, it } from "vitest";
import { parseGrowthFunnelRows } from "./growthFunnel";

// event_count 컬럼이 없으면 "행 1개 = 이벤트 1건"이 올바른 해석이다.
// 그러나 컬럼이 있는데 셀이 비었거나 숫자가 아니면 실제 건수를 모르므로,
// 조용히 1을 채우면 없는 수치를 만들어내는 것이다(§8·§11 날조 금지).
describe("parseGrowthFunnelRows — 건수 불명 행 처리", () => {
  it("event_count 컬럼이 없으면 행당 1건으로 센다", () => {
    const out = parseGrowthFunnelRows([
      { "이벤트 이름": "page_view" },
      { "이벤트 이름": "page_view" },
    ]);
    expect(out.mode).toBe("row_event_volume");
    expect(out.events).toHaveLength(2);
    expect(out.events.every((e) => e.count === 1)).toBe(true);
    expect(out.unparsedCountRows).toBe(0);
  });

  it("event_count가 있으면 그 값을 쓴다 (콤마 포함 허용)", () => {
    const out = parseGrowthFunnelRows([
      { "이벤트 이름": "page_view", "이벤트 수": "1,234" },
    ]);
    expect(out.mode).toBe("aggregated_event_volume");
    expect(out.events[0].count).toBe(1234);
    expect(out.unparsedCountRows).toBe(0);
  });

  it("event_count 컬럼이 있는데 값이 비었거나 숫자가 아니면 1로 채우지 않고 제외한다", () => {
    const out = parseGrowthFunnelRows([
      { "이벤트 이름": "page_view", "이벤트 수": "100" },
      { "이벤트 이름": "page_view", "이벤트 수": "" },
      { "이벤트 이름": "page_view", "이벤트 수": "N/A" },
    ]);
    expect(out.events).toHaveLength(1);
    expect(out.events[0].count).toBe(100);
    // 버려진 행 수를 노출해 화면이 "일부 행 제외"를 고지할 수 있게 한다.
    expect(out.unparsedCountRows).toBe(2);
  });
});
