// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyChartGlobals, crosshairPlugin, externalTooltipHandler } from "@/utils/chartGlobals";
import { CHART_FONT_STACK } from "@/utils/chartUtils";

/* 전역 셋업은 Chart 싱글턴에 부작용을 남기므로, 테스트는 실제 Chart 대신
   최소 형태의 가짜 생성자에 적용해 검증한다(스모크 setup이 chart.js/auto를
   defaults 없는 스텁으로 목킹하고 있어 실물 검증이 불가능하기도 하다). */
function makeFakeChartCtor() {
  return {
    registered: [],
    register(plugin) {
      this.registered.push(plugin);
    },
    defaults: {
      font: {},
      animation: {},
      elements: { point: {}, line: {}, bar: {} },
      plugins: { tooltip: {} },
    },
  };
}

function tooltipEl() {
  return document.getElementById("gop-chart-tooltip");
}

function fakeChart() {
  return {
    canvas: { getBoundingClientRect: () => ({ left: 40, top: 60, width: 400, height: 220 }) },
  };
}

describe("applyChartGlobals", () => {
  it("공용 폰트·애니메이션·hover 반경을 defaults에 심고 기준선 플러그인을 등록한다", () => {
    const ctor = makeFakeChartCtor();
    applyChartGlobals(ctor);

    expect(ctor.defaults.font.family).toBe(CHART_FONT_STACK);
    expect(ctor.defaults.animation.easing).toBe("easeOutQuart");
    expect(ctor.defaults.elements.point.hitRadius).toBeGreaterThan(0);
    expect(ctor.registered).toContain(crosshairPlugin);
  });

  it("캔버스 기본 툴팁을 끄고 외부 HTML 툴팁 핸들러로 넘긴다", () => {
    const ctor = makeFakeChartCtor();
    applyChartGlobals(ctor);

    expect(ctor.defaults.plugins.tooltip.enabled).toBe(false);
    expect(ctor.defaults.plugins.tooltip.external).toBe(externalTooltipHandler);
  });

  it("pointRadius는 전역으로 건드리지 않는다 (이상치 마커·산점도가 사라지는 회귀 방지)", () => {
    const ctor = makeFakeChartCtor();
    applyChartGlobals(ctor);

    expect(ctor.defaults.elements.point.radius).toBeUndefined();
  });
});

describe("externalTooltipHandler", () => {
  beforeEach(() => {
    tooltipEl()?.remove();
  });

  it("body 직속에 단 하나의 툴팁 노드만 만들고 재사용한다", () => {
    const context = {
      chart: fakeChart(),
      tooltip: { opacity: 1, caretX: 10, caretY: 10, title: ["2026-01-05"], body: [{ lines: ["비용: 1,200"] }], labelColors: [{ backgroundColor: "#8fb1ff" }] },
    };
    externalTooltipHandler(context);
    externalTooltipHandler(context);

    expect(document.querySelectorAll("#gop-chart-tooltip")).toHaveLength(1);
    expect(tooltipEl().parentElement).toBe(document.body);
  });

  it("사용자 CSV에서 온 라벨을 마크업이 아니라 텍스트로 넣는다", () => {
    externalTooltipHandler({
      chart: fakeChart(),
      tooltip: {
        opacity: 1,
        caretX: 10,
        caretY: 10,
        title: ["<b>2026-01-05</b>"],
        body: [{ lines: ['<img src=x onerror="window.__pwned=1">브랜드 캠페인: 3'] }],
        labelColors: [{ borderColor: "#77dcaa" }],
      },
    });

    const el = tooltipEl();
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("b")).toBeNull();
    expect(el.textContent).toContain("<img src=x");
    expect(window.__pwned).toBeUndefined();
  });

  it("opacity 0이면 숨기고 화면 밖으로 나가지 않게 위치를 잡는다", () => {
    const chart = fakeChart();
    externalTooltipHandler({ chart, tooltip: { opacity: 1, caretX: 10, caretY: 10, title: ["x"], body: [{ lines: ["y"] }], labelColors: [{}] } });
    expect(tooltipEl().style.opacity).toBe("1");
    expect(parseInt(tooltipEl().style.left, 10)).toBeGreaterThanOrEqual(8);

    externalTooltipHandler({ chart, tooltip: { opacity: 0 } });
    expect(tooltipEl().style.opacity).toBe("0");
  });
});

describe("crosshairPlugin", () => {
  function ctxSpy() {
    return {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), setLineDash: vi.fn(),
    };
  }
  const area = { left: 0, right: 300, top: 0, bottom: 150 };

  it("활성 지점이 있으면 세로 기준선을 그린다", () => {
    const ctx = ctxSpy();
    crosshairPlugin.afterDatasetsDraw({
      config: { type: "line" },
      options: {},
      chartArea: area,
      ctx,
      tooltip: { getActiveElements: () => [{ element: { x: 120, y: 40 } }] },
    });
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(120, area.top);
  });

  it("indexAxis가 y면(가로 막대·포레스트) 가로 기준선으로 바꾼다", () => {
    const ctx = ctxSpy();
    crosshairPlugin.afterDatasetsDraw({
      config: { type: "bar" },
      options: { indexAxis: "y" },
      chartArea: area,
      ctx,
      tooltip: { getActiveElements: () => [{ element: { x: 120, y: 40 } }] },
    });
    expect(ctx.moveTo).toHaveBeenCalledWith(area.left, 40);
  });

  it("파이·도넛·레이더와 활성 지점 없음에는 아무것도 그리지 않는다", () => {
    const pie = ctxSpy();
    crosshairPlugin.afterDatasetsDraw({
      config: { type: "doughnut" }, options: {}, chartArea: area, ctx: pie,
      tooltip: { getActiveElements: () => [{ element: { x: 10, y: 10 } }] },
    });
    expect(pie.stroke).not.toHaveBeenCalled();

    const idle = ctxSpy();
    crosshairPlugin.afterDatasetsDraw({
      config: { type: "line" }, options: {}, chartArea: area, ctx: idle,
      tooltip: { getActiveElements: () => [] },
    });
    expect(idle.stroke).not.toHaveBeenCalled();
  });

  it("chartArea·tooltip이 아직 없는 초기 렌더에서도 throw 하지 않는다", () => {
    expect(() => crosshairPlugin.afterDatasetsDraw({ config: { type: "line" }, options: {}, ctx: ctxSpy() })).not.toThrow();
  });
});
