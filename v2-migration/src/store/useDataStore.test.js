import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, persistPartialize, persistMigrate } from "./useDataStore.js";

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
    const persisted = persistPartialize({ ...fakeState, customCharts: { s: [{ id: "ch_1" }] } });
    expect(Object.keys(persisted).sort()).toEqual(["customCharts", "customMetrics", "viewConfig"]);
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

  it("persistMigrate — version 1(현재)은 저장 형태를 그대로 통과(무동작)", () => {
    const persisted = { viewConfig: { s1: { hidden: ["a"], order: [] } }, customMetrics: {}, customCharts: {} };
    expect(persistMigrate(persisted, 1)).toBe(persisted);
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

  it("requestAd는 전면 광고 없이 분석 콜백을 즉시 실행", () => {
    let executed = false;
    useAppStore.getState().requestAd(() => { executed = true; });
    expect(executed).toBe(true);
  });
});

describe("useDataStore · CSV grain별 필터 승계", () => {
  beforeEach(() => {
    const empty = {
      dateStart: null,
      dateEnd: null,
      platforms: new Set(),
      countries: new Set(),
      channels: new Set(),
      sources: new Set(),
    };
    useAppStore.setState({
      currentRouteId: "5-2",
      dashboardFilter: empty,
      dashboardFilterGroups: { efficiency: empty },
    });
  });

  it("같은 efficiency grain에서는 채널·기간 필터를 승계", () => {
    useAppStore.getState().setDashboardFilter({
      dateStart: "2026-07-01",
      channels: new Set(["Google"]),
    });
    useAppStore.getState().setCurrentRouteId("5-21");
    const filter = useAppStore.getState().dashboardFilter;
    expect(filter.dateStart).toBe("2026-07-01");
    expect([...filter.channels]).toEqual(["Google"]);
  });

  it("다른 grain으로 이동하면 efficiency 필터를 전달하지 않음", () => {
    useAppStore.getState().setDashboardFilter({ channels: new Set(["Google"]) });
    useAppStore.getState().setCurrentRouteId("5-18");
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual([]);
    useAppStore.getState().setCurrentRouteId("5-2");
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual(["Google"]);
  });
});

describe("useDataStore · 구조화 세션 상태", () => {
  it("finding은 같은 도구의 최신 결과로 교체되고 persist되지 않는다", () => {
    useAppStore.setState({ findingsByGroup: {} });
    const finding = {
      schemaVersion: 1,
      id: "5-2:sig:primary",
      toolId: "5-2",
      dataGroup: "efficiency",
      kind: "anomaly",
      severity: "watch",
      score: 70,
      headline: "변동 확인",
      detail: "근거 확인",
      evidence: [],
      scope: {},
      suggestedTargets: [],
      inputSignature: "sig",
      locale: "ko",
    };
    useAppStore.getState().publishFinding(finding);
    useAppStore.getState().publishFinding({ ...finding, id: "5-2:sig2:primary", inputSignature: "sig2" });
    expect(useAppStore.getState().findingsByGroup.efficiency).toHaveLength(1);
    const persisted = persistPartialize(useAppStore.getState());
    expect(persisted.findingsByGroup).toBeUndefined();
    expect(persisted.reportDraft).toBeUndefined();
    expect(persisted.analysisHandoff).toBeUndefined();
  });

  it("보고서 블록 순서를 바꾸고 같은 id를 갱신한다", () => {
    useAppStore.setState({ reportDraft: { schemaVersion: 1, title: "", period: null, blocks: [], notes: [] } });
    const a = { schemaVersion: 1, id: "a", headline: "A" };
    const b = { schemaVersion: 1, id: "b", headline: "B" };
    useAppStore.getState().addReportBlock(a);
    useAppStore.getState().addReportBlock(b);
    useAppStore.getState().moveReportBlock("b", -1);
    expect(useAppStore.getState().reportDraft.blocks.map((item) => item.id)).toEqual(["b", "a"]);
    useAppStore.getState().addReportBlock({ ...a, headline: "A2" });
    expect(useAppStore.getState().reportDraft.blocks.find((item) => item.id === "a").headline).toBe("A2");
  });

  it("프로젝트 복원은 호환 group만 적용하고 분석 gate를 열지 않는다", () => {
    const emptyFilter = {
      dateStart: null, dateEnd: null,
      platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set(),
    };
    useAppStore.setState({
      currentRouteId: "5-2",
      csvGroups: {
        ...useAppStore.getState().csvGroups,
        efficiency: { raw: [{ 날짜: "2026-07-01", 비용: "100" }], headers: ["날짜", "비용"], mapping: {}, fileName: "x.csv" },
      },
      dashboardFilterGroups: { ...useAppStore.getState().dashboardFilterGroups, efficiency: emptyFilter },
      analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: "old" },
    });
    useAppStore.getState().applyProjectConfig({
      groups: {
        efficiency: {
          mapping: { 날짜: "date", 비용: "cost", 악성: "not_a_field" },
          filters: { channels: ["Google"] },
        },
      },
      viewConfig: { scope: { hidden: ["ctr"], order: [] } },
      customMetrics: {},
      customCharts: {},
    }, ["efficiency"]);
    const state = useAppStore.getState();
    expect(state.csvGroups.efficiency.mapping).toEqual({ 날짜: "date", 비용: "cost" });
    expect([...state.dashboardFilterGroups.efficiency.channels]).toEqual(["Google"]);
    expect(state.analyzedByGroup.efficiency).toBeNull();
  });
});
