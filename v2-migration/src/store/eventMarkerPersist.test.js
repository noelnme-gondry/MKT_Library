import { describe, expect, it } from "vitest";
import { persistPartialize, sanitizeEventMarkers } from "@/store/useDataStore";

// 이벤트 마커는 상태·액션·차트 플러그인·전용 UI가 모두 구현돼 있었는데
// persist 화이트리스트에만 빠져서, 찍어도 새로고침이면 사라졌다.
describe("sanitizeEventMarkers", () => {
  it("날짜·라벨·종류만 남기고 알 수 없는 필드는 버린다", () => {
    const out = sanitizeEventMarkers([
      { id: "m1", date: "2026-01-05", label: "브랜드 시작", type: "campaign", secret: "csv-row-value" },
    ]);
    expect(out).toEqual([{ id: "m1", date: "2026-01-05", label: "브랜드 시작", type: "campaign" }]);
    expect(JSON.stringify(out)).not.toContain("csv-row-value");
  });

  it("라벨 길이와 개수를 제한한다 (저장소 무한 증식 방지)", () => {
    const long = sanitizeEventMarkers([{ id: "m", date: "2026-01-05", label: "가".repeat(500) }]);
    expect(long[0].label.length).toBe(120);
    const many = sanitizeEventMarkers(
      Array.from({ length: 400 }, (_, i) => ({ id: `m${i}`, date: "2026-01-05", label: "x" })),
    );
    expect(many).toHaveLength(200);
  });

  it("비정상 입력에도 빈 배열로 안전하게 처리한다", () => {
    for (const bad of [null, undefined, "x", 3, {}]) expect(sanitizeEventMarkers(bad)).toEqual([]);
    // 날짜·라벨이 모두 비면 저장할 의미가 없으므로 제외한다.
    expect(sanitizeEventMarkers([{ id: "m" }])).toEqual([]);
  });

  it("persist payload에 마커가 포함되고 원본 CSV는 여전히 제외된다", () => {
    const persisted = persistPartialize({
      viewConfig: {}, customMetrics: {}, customCharts: {},
      csvGroups: { efficiency: { raw: [{ secret: 1 }] } },
      csvData: { raw: [{ secret: 2 }] },
      eventMarkers: [{ id: "m1", date: "2026-02-01", label: "가격 인상" }],
    });
    expect(persisted.eventMarkers).toEqual([{ id: "m1", date: "2026-02-01", label: "가격 인상", type: "other" }]);
    expect(persisted.csvGroups).toBeUndefined();
    expect(persisted.csvData).toBeUndefined();
    expect(JSON.stringify(persisted)).not.toContain("secret");
  });
});
