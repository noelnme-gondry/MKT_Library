// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RESULT_CHART_VARIANTS, ResultBudgetShift, ResultHazardColumns, ResultMixRate, ResultStatusShare, ResultSurvival, ResultUnitCostGap, ResultVifThreshold } from "./ResultCharts";

const fallback = <p className="probe-fallback">fallback</p>;

describe("분석별 핵심 그림", () => {
  it("성과 변동은 직전→비중→효율→최근 다리와 채널별 두 성분을 그린다", () => {
    const { container } = render(<ResultMixRate locale="ko" currency="KRW" visualization={{
      question: "q",
      data: [{ entity: "A", mix: -45, rate: 590, contribution: 545 }, { entity: "B", mix: 10, rate: -30, contribution: -20 }],
      options: { start: 6663, end: 7188, metric: "CPA" },
    }} />);
    const bridge = [...container.querySelectorAll(".result-bridge li")].map((li) => li.textContent);
    expect(bridge).toEqual(["직전 CPA₩6,663", "비중 변화−₩35", "효율 변화+₩560", "최근 CPA₩7,188"]);
    // 다리의 두 성분 합 = 최근 − 직전 (분해 항등식이 화면에서도 성립해야 한다)
    expect(6663 - 35 + 560).toBe(7188);
    const rows = [...container.querySelectorAll(".result-split > li")];
    expect(rows.map((row) => row.querySelector("strong").textContent)).toEqual(["A", "B"]);
    expect(rows[0].querySelectorAll(".result-split__bar")).toHaveLength(2);
    // 오른쪽(올림)은 가운데 50%에서 시작하고, 왼쪽(낮춤)은 50%에서 끝난다.
    const [mixBar, rateBar] = rows[0].querySelectorAll(".result-diverging i");
    expect(rateBar.style.getPropertyValue("--bar-start")).toBe("50%");
    expect(Number.parseFloat(mixBar.style.getPropertyValue("--bar-start"))).toBeLessThan(50);
  });

  it("한 성분이 없는 채널도 그림을 깨뜨리지 않는다(빈 성분은 막대를 그리지 않는다)", () => {
    // divergingStyle이 범위 밖 이름(fallback)을 돌려주던 때는 여기서 ReferenceError로 화면 전체가 죽었다.
    const { container } = render(<ResultMixRate locale="ko" currency="KRW" visualization={{
      question: "q",
      data: [{ entity: "A", mix: null, rate: 120, contribution: 120 }, { entity: "B", mix: -40, rate: null, contribution: -40 }],
      options: { start: 1000, end: 1080, metric: "CPA" },
    }} />);
    const bars = [...container.querySelectorAll(".result-diverging i")];
    expect(bars).toHaveLength(4);
    expect(bars.filter((bar) => bar.style.getPropertyValue("--bar-start") === "")).toHaveLength(2);
  });

  it("포화도는 평균과 한계 단가를 한 줄에 두 점으로 놓고 판정을 글자로 말한다", () => {
    const { container } = render(<ResultUnitCostGap locale="ko" currency="KRW" visualization={{
      question: "q",
      data: [{ entity: "TikTok", averageUnitCost: 2581, marginalUnitCost: 5598, verdict: "saturated" }, { entity: "ASA", averageUnitCost: 3000, marginalUnitCost: 2400, verdict: "scale" }],
      options: { metric: "CPA" },
    }} />);
    const heads = [...container.querySelectorAll(".result-gap__head span")].map((span) => span.textContent);
    expect(heads).toEqual(["포화 · ×2.17", "여유 · ×0.80"]);
    expect(container.querySelectorAll(".result-gap__track .result-gap__dot")).toHaveLength(4);
    expect(container.textContent).toContain("평균 ₩2,581 → 한계 ₩5,598");
  });

  it("예산 재배분은 지금과 바꾼 안을 나란히 두고 0은 ₩0으로 쓴다", () => {
    const { container } = render(<ResultBudgetShift locale="ko" currency="KRW" visualization={{
      question: "q",
      data: [{ entity: "A", current: 1000, budget: 0 }, { entity: "B", current: 500, budget: 2000 }],
      options: {},
    }} />);
    const items = [...container.querySelectorAll(".result-shift li")].map((li) => li.textContent);
    // 많이 옮긴 채널이 위로 온다.
    expect(items[0]).toContain("B+₩1,500");
    expect(items[1]).toContain("바꾼 안 ₩0");
    expect(container.textContent).not.toContain("₩0.00");
  });

  it("VIF는 엔진 기준선(주의·심각)을 그리고, 계산 못 한 채널은 그렇다고 쓴다", () => {
    const { container } = render(<ResultVifThreshold locale="ko" visualization={{
      question: "q",
      data: [{ entity: "Meta", vif: 3882 }, { entity: "Kakao", vif: null }],
      options: { thresholds: [5, 10] },
    }} />);
    expect(container.querySelectorAll(".result-vif__line")).toHaveLength(4);
    expect(container.textContent).toContain("계산 불가");
    expect(container.querySelector('.result-vif__bar[data-tone="worse"]')).toBeTruthy();
  });

  it("소재 상태는 띠 하나로 나누고 전체 개수를 말한다", () => {
    const { container } = render(<ResultStatusShare locale="ko" visualization={{
      question: "q",
      data: [{ status: "현재 알림", count: 3, tone: "danger" }, { status: "비피로", count: 7, tone: "success" }],
      options: { x: "status", y: "count" },
    }} />);
    expect(container.querySelectorAll(".result-share__bar i")).toHaveLength(2);
    expect(container.textContent).toContain("전체 소재 10개");
  });

  it("생존은 계단 곡선과 구간 띠, 위험도는 시간축 세로 막대로 그린다", () => {
    const survival = render(<ResultSurvival locale="ko" visualization={{
      question: "q",
      data: [{ period: 1, survival: 0.9, ciLow: 0.85, ciHigh: 0.95 }, { period: 3, survival: 0.6, ciLow: 0.5, ciHigh: 0.7 }],
      options: { x: "period", y: "survival" },
    }} />);
    const d = survival.container.querySelector(".result-survival__line").getAttribute("d");
    // 계단: 시점 1에서 수평 이동 후 수직 하강 → 같은 x가 연달아 두 번 나온다.
    const xs = d.match(/[ML]([\d.]+),/g).map((token) => token.slice(1, -1));
    expect(xs.filter((value, index) => value === xs[index + 1]).length).toBeGreaterThanOrEqual(2);
    expect(survival.container.querySelector(".result-survival__band")).toBeTruthy();
    survival.unmount();
    const hazard = render(<ResultHazardColumns locale="ko" visualization={{
      question: "q", data: [{ period: 1, hazard: 0.05 }, { period: 2, hazard: 0.2 }, { period: 3, hazard: 0.1 }], options: {},
    }} />);
    expect(hazard.container.querySelectorAll(".result-columns__plot i")).toHaveLength(3);
    expect(hazard.container.querySelector('[data-tone="worse"]').title).toBe("2: 20.0%");
  });

  it("그릴 값이 없으면 넘겨받은 기본 그림으로 물러난다", () => {
    for (const Chart of Object.values(RESULT_CHART_VARIANTS)) {
      const { container, unmount } = render(<Chart locale="ko" currency="KRW" visualization={{ question: "q", data: [], options: {} }} fallback={fallback} />);
      expect(container.querySelector(".probe-fallback"), Chart.name).toBeTruthy();
      unmount();
    }
  });
});
