// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import BrandCampaignIncrementality from "@/components/tools/BrandCampaignIncrementality";
import { useAppStore } from "@/store/useDataStore";

import { fmtCurrency, fmtCurrencyCompact } from "@/utils/format";
import { openResultDetails } from "@/test/resultDetails";

import * as brandMath from "@/utils/brandIncrementalityMath";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

afterEach(() => vi.restoreAllMocks());

describe("BrandCampaignIncrementality render smoke", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentRouteId: "5-24",
      csvGroups: { ...useAppStore.getState().csvGroups, brand_incrementality: EMPTY },
      csvData: EMPTY,
      demoDisabled: true,
    });
  });

  it("mounts a data-readiness router without loading unrelated demo data", () => {
    const { container } = render(<BrandCampaignIncrementality />);
    expect(screen.getByText("어떤 데이터를 준비했나요?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /통제군 증분 분석 열기/ }).getAttribute("href")).toBe("/tools/incrementality");
    expect(container.querySelector("#brand-its-setup")).toBeTruthy();
    expect(useAppStore.getState().csvData.raw).toEqual([]);
  });

  // 위 beforeEach는 csvGroups 슬라이스를 직접 주입해 실제 진입 경로를 우회한다.
  // 사용자는 setCurrentRouteId만 거치므로, 그 경로로도 미러가 살아 있어야 한다
  // (슬라이스 누락 시 csvData=undefined → csvData.headers 렌더 throw).
  it("mounts after a real route navigation without a pre-seeded slice", () => {
    useAppStore.setState({ currentRouteId: "home", activeDataGroup: "efficiency", csvData: EMPTY });
    useAppStore.getState().setCurrentRouteId("5-24");
    expect(useAppStore.getState().csvData).toBeTruthy();
    expect(() => render(<BrandCampaignIncrementality />)).not.toThrow();
  });

  // 설계 선언·비용 열은 결과 위 조건 줄의 "조건 바꾸기" 창 안에 있다 — 사람이 하듯 열고 닫는다.
  const openConditions = (en) => fireEvent.click(screen.getByText(en ? "Change settings" : "조건 바꾸기", { selector: "button" }));
  const closeConditions = (en) => fireEvent.click(within(document.querySelector(".condition-dialog")).getByText(en ? "Close" : "닫기", { selector: "button" }));

  it.each(["ko", "en"])("reads out as an executive report with the interval in the conclusion and evidence in details (%s)", async (locale) => {
    const { container } = render(<BrandCampaignIncrementality locale={locale} />);
    const en = locale === "en";
    fireEvent.click(screen.getByRole("button", { name: en ? /Run the example/i : /예시 데이터/ }));
    await waitFor(() => expect(container.querySelector("#brand-its-result")).toBeTruthy());
    const result = container.querySelector("#brand-its-result");
    // 결정 #3: 비교 조건이 선언되지 않아도 추정치와 95% 구간을 보이고, 예시는 사전 기간이 짧아 판단 보류(탐색용)다.
    const headline = result.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(en ? /Campaign-period brand_search [+−][\d,]+ observed \(95% [+−][\d,]+ ~ [+−][\d,]+\)/ : /캠페인 기간 brand_search [+−][\d,]+ 관찰 \(95% [+−][\d,]+ ~ [+−][\d,]+\)/);
    expect(headline).toMatch(en ? /Hold — .* · exploratory/ : /판단 보류 — .* · 탐색용/);
    expect(headline).not.toMatch(en ? /recommend|adopt/i : /권고|채택/);
    expect(result.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    // 구간 그림은 창이 아니라 결론 바로 아래 핵심 그림이다. 방향 판정을 보류한 예시라 색이 없다.
    const figure = result.querySelector(".result-action-card .tool-core-figure .result-effect");
    expect(figure.querySelector("li").getAttribute("data-tone")).toBe("flat");
    expect(result.textContent).toContain(en ? "we do not determine incrementality direction" : "증분 방향을 판정하지 않습니다");
    expect(result.textContent).toContain(en ? "not a confirmed causal effect" : "인과효과 확정은 아닙니다");
    // 자세히 보기는 기본 닫힘: 선 차트·모형 근거는 열어야 마운트된다.
    expect(result.querySelector("canvas")).toBeNull();
    expect(result.textContent).not.toContain(en ? "Reference-only HAC SE" : "비교용 HAC 표준오차");
    openResultDetails(result);
    expect(result.textContent).toContain(en ? "Reference-only HAC SE" : "비교용 HAC 표준오차");
    const chart = result.querySelector("canvas");
    expect(chart.compareDocumentPosition(result.querySelector(".result-action-card__utilities")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["ko", "en"])("links cost without changing the ITS fit (%s)", async locale => {
    const fit = vi.spyOn(brandMath, "runBrandInterruptedTimeSeries");
    const en = locale === "en";
    const { container } = render(<BrandCampaignIncrementality locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: en ? /Run the example/i : /예시 데이터/ }));
    await waitFor(() => expect(container.querySelector("#brand-its-result")).toBeTruthy());
    const result = fit.mock.results.find(entry => entry.value?.ok).value;
    const stats = container.querySelector(".result-action-card__stats");
    const costStat = stats.children[1];
    const estimate = stats.children[0].textContent;
    expect(costStat.textContent).toContain(fmtCurrency(1196000 / result.profileIncrementalTotal, { precise: true }));
    expect(costStat.textContent).toContain(fmtCurrencyCompact(1196000, { locale }));
    expect(costStat.textContent).toContain(en ? "reference" : "참고");
    const calls = fit.mock.calls.length;
    openConditions(en);
    fireEvent.change(screen.getByLabelText(en ? "Source cost currency" : "비용 원본 통화"), { target: { value: "USD" } });
    expect(costStat.textContent).toContain(fmtCurrency(1196000 / result.profileIncrementalTotal, { currency: "USD", precise: true }));
    const column = screen.getByLabelText(en ? "Brand campaign cost column" : "브랜드 캠페인 비용 열");
    fireEvent.change(column, { target: { value: "" } });
    expect(costStat.textContent).toContain(en ? "Not estimable" : "추정 불가");
    fireEvent.change(column, { target: { value: "cost" } });
    expect(costStat.textContent).toContain(fmtCurrencyCompact(1196000, { currency: "USD", locale }));
    closeConditions(en);
    expect(stats.children[0].textContent).toBe(estimate);
    expect(fit.mock.calls.length).toBe(calls);
  });
});

it.each([
  { interval: [-20, 80], tone: "neutral", figureTone: "flat", effect: "증가를 변화 없음과 구분하기 어렵습니다", hold: true },
  { interval: [-80, -20], tone: "bad", figureTone: "worse", effect: "관찰상 감소 신호 — 인과 증명은 아님", hold: false },
  { interval: [20, 80], tone: "good", figureTone: "better", effect: "인과 확정 아님 — 다음 캠페인은 비집행 지역을 남기기", hold: false },
])("aligns the card and interval after design confirmation: $tone", async ({ interval, tone, figureTone, effect, hold }) => {
  const run = brandMath.runBrandInterruptedTimeSeries;
  vi.spyOn(brandMath, "runBrandInterruptedTimeSeries").mockImplementation(input => {
    const result = run(input);
    if (!result?.ok) return result;
    return { ...result, profileInterval: interval, profileIncrementalTotal: (interval[0] + interval[1]) / 2, diagnostics: { ...result.diagnostics, ar1EvidenceTier: "confirmatory", ar1Profile: { ...result.diagnostics.ar1Profile, hitsBoundary: false } } };
  });
  useAppStore.setState({ currentRouteId: "5-24", csvData: EMPTY, csvGroups: { ...useAppStore.getState().csvGroups, brand_incrementality: EMPTY }, demoDisabled: true });
  const { container } = render(<BrandCampaignIncrementality />);
  fireEvent.click(screen.getByRole("button", { name: /예시 데이터/ }));
  await waitFor(() => expect(container.querySelector("#brand-its-result")).toBeTruthy());
  // 선언 전: 숫자는 보이되 탐색용, 그림은 색 없음.
  expect(container.querySelector(".result-action-card__headline").textContent).toContain("탐색용 — 비교 조건이 확인되면 판정합니다");
  fireEvent.click(screen.getByText("조건 바꾸기", { selector: "button" }));
  for (const [label, value] of [
    ["비교한 대상은 무엇인가요?", "time"], ["두 그룹은 어떻게 나눴나요?", "observational"],
    ["결과를 보기 전에 기간을 정했나요?", "planned"], ["같은 기간에 프로모션·시즌·추적 방식이 바뀐 적이 있나요?", "none"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(within(document.querySelector(".condition-dialog")).getByText("닫기", { selector: "button" }));
  expect(container.querySelector(".result-action-card").classList.contains(tone)).toBe(true);
  const headline = container.querySelector(".result-action-card__headline").textContent;
  expect(headline).toContain(effect);
  expect(headline.startsWith("판단 보류 — 구간이 0 포함")).toBe(hold);
  expect(headline).toMatch(/\(95% [+−][\d,]+ ~ [+−][\d,]+\)/);
  expect(container.querySelector(".result-action-card__stats").children[1].textContent).toContain(tone === "good" ? "₩" : "추정 불가");
  expect(container.querySelector(".tool-core-figure .result-effect li").dataset.tone).toBe(figureTone);
  vi.restoreAllMocks();
});
