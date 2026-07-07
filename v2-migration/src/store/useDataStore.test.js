import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, persistPartialize } from "./useDataStore.js";

describe("useDataStore · viewConfig 액션", () => {
  beforeEach(() => useAppStore.setState({ viewConfig: {} }));

  it("setViewConfig가 scope별로 patch 병합(기본 hidden/order 채움)", () => {
    useAppStore.getState().setViewConfig("5-2:scorecard", { hidden: ["ctr"] });
    const cfg = useAppStore.getState().viewConfig["5-2:scorecard"];
    expect(cfg).toEqual({ hidden: ["ctr"], order: [] });
  });

  it("연속 patch는 기존 값 유지하며 병합", () => {
    const { setViewConfig } = useAppStore.getState();
    setViewConfig("s1", { hidden: ["a"] });
    setViewConfig("s1", { order: ["b", "a"] });
    expect(useAppStore.getState().viewConfig.s1).toEqual({ hidden: ["a"], order: ["b", "a"] });
  });

  it("scope는 서로 독립", () => {
    const { setViewConfig } = useAppStore.getState();
    setViewConfig("s1", { hidden: ["a"] });
    setViewConfig("s2", { hidden: ["z"] });
    expect(useAppStore.getState().viewConfig.s1.hidden).toEqual(["a"]);
    expect(useAppStore.getState().viewConfig.s2.hidden).toEqual(["z"]);
  });

  it("resetViewConfig가 해당 scope만 제거", () => {
    const { setViewConfig, resetViewConfig } = useAppStore.getState();
    setViewConfig("s1", { hidden: ["a"] });
    setViewConfig("s2", { hidden: ["z"] });
    resetViewConfig("s1");
    expect(useAppStore.getState().viewConfig.s1).toBeUndefined();
    expect(useAppStore.getState().viewConfig.s2).toBeDefined();
  });
});

describe("useDataStore · persist 불변식(설정만 저장, 원본 CSV 제외 §2.2)", () => {
  it("partialize는 설정(viewConfig·customMetrics)만 남기고 원본 데이터·필터 제외", () => {
    const fakeState = {
      viewConfig: { "5-2:scorecard": { hidden: ["ctr"], order: [] } },
      customMetrics: { "5-2:viz-kpi": [{ id: "cm_1", name: "이익", op: "sub", a: "revenue", b: "cost" }] },
      csvGroups: { efficiency: { raw: [{ secret: 1 }] } },
      csvData: { raw: [{ secret: 2 }], mapping: { x: "cost" } },
      dashboardFilter: { platforms: new Set(["iOS"]) },
      eventMarkers: [{ id: "m1" }],
      isDarkMode: true,
    };
    const persisted = persistPartialize(fakeState);
    expect(Object.keys(persisted).sort()).toEqual(["customMetrics", "viewConfig"]);
    expect(persisted.viewConfig).toBe(fakeState.viewConfig);
    expect(persisted.customMetrics).toBe(fakeState.customMetrics);
    // 원본 데이터 키가 저장 payload에 절대 없어야 함
    expect(persisted.csvGroups).toBeUndefined();
    expect(persisted.csvData).toBeUndefined();
    expect(persisted.dashboardFilter).toBeUndefined();
    // JSON 직렬화해도 민감 원본 문자열이 새어나가지 않음
    const json = JSON.stringify(persisted);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("iOS");
  });

  it("addCustomMetric/removeCustomMetric — scope별 정의 추가·삭제", () => {
    useAppStore.setState({ customMetrics: {} });
    useAppStore.getState().addCustomMetric("5-2:viz-kpi", { name: "이익", op: "sub", a: "revenue", b: "cost" });
    const list = useAppStore.getState().customMetrics["5-2:viz-kpi"];
    expect(list).toHaveLength(1);
    expect(list[0].id).toMatch(/^cm_/);
    expect(list[0].name).toBe("이익");
    useAppStore.getState().removeCustomMetric("5-2:viz-kpi", list[0].id);
    expect(useAppStore.getState().customMetrics["5-2:viz-kpi"]).toHaveLength(0);
  });
});
