// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import BrandCampaignIncrementality from "@/components/tools/BrandCampaignIncrementality";
import { useAppStore } from "@/store/useDataStore";

import { fmtCurrency } from "@/utils/format";

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

  it.each(["ko", "en"])("keeps uncertainty visible and moves technical evidence behind a dialog (%s)", async (locale) => {
    const { container } = render(<BrandCampaignIncrementality locale={locale} />);
    const en = locale === "en";
    fireEvent.click(screen.getByRole("button", { name: en ? /Run the example/i : /예시 데이터/ }));
    await waitFor(() => expect(container.querySelector("#brand-its-result")).toBeTruthy());
    const result = container.querySelector("#brand-its-result");
    expect(within(result).getAllByText(en ? "95% AR(1) profile interval" : "95% AR(1) 프로파일 구간")).toHaveLength(1);
    expect(result.textContent).toContain(en ? "we do not determine incrementality direction" : "증분 방향을 판정하지 않습니다");
    expect(result.textContent).toContain(en ? "not a confirmed causal effect" : "인과효과 확정은 아닙니다");
    expect(result.textContent).not.toContain(en ? "Reference-only HAC SE" : "비교용 HAC 표준오차");
    expect(screen.queryByRole("dialog")).toBeNull();
    const chart = result.querySelector("canvas");
    expect(chart.compareDocumentPosition(result.querySelector(".result-action-card__utilities")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const trigger = screen.getByRole("button", { name: en ? "View analysis evidence" : "분석 근거 보기" });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: en ? "Brand incrementality evidence" : "브랜드 증분 분석 근거" });
    expect(dialog.textContent).toContain(en ? "Reference-only HAC SE" : "비교용 HAC 표준오차");
    expect(dialog.querySelector(".result-effect")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it.each(["ko", "en"])("links cost without changing the ITS fit (%s)", async locale => {
    const fit = vi.spyOn(brandMath, "runBrandInterruptedTimeSeries");
    const en = locale === "en";
    const { container } = render(<BrandCampaignIncrementality locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: en ? /Run the example/i : /예시 데이터/ }));
    await waitFor(() => expect(container.querySelector(".brand-cost-inline")).toBeTruthy());
    const result = fit.mock.results.find(entry => entry.value?.ok).value;
    const stats = container.querySelector(".result-action-card__stats");
    const costStat = stats.children[3];
    const estimate = stats.children[0].textContent;
    expect(costStat.textContent).toContain(fmtCurrency(1196000 / result.profileIncrementalTotal));
    expect(costStat.textContent).toContain(fmtCurrency(1196000));
    expect(costStat.textContent).toContain(en ? "reference" : "참고");
    const calls = fit.mock.calls.length;
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(screen.getByLabelText(en ? "Source cost currency" : "비용 원본 통화"), { target: { value: "USD" } });
    expect(costStat.textContent).toContain(fmtCurrency(1196000 / result.profileIncrementalTotal, { currency: "USD" }));
    const column = screen.getByLabelText(en ? "Brand campaign cost column" : "브랜드 캠페인 비용 열");
    fireEvent.change(column, { target: { value: "" } });
    expect(costStat.textContent).toContain(en ? "Not estimable" : "추정 불가");
    fireEvent.change(column, { target: { value: "cost" } });
    expect(costStat.textContent).toContain("$1,196,000.00");
    expect(stats.children[0].textContent).toBe(estimate);
    expect(fit.mock.calls.length).toBe(calls);
  });

  it("shows the deterministic demo result immediately", async () => {
    const { container } = render(<BrandCampaignIncrementality />);
    // 업로드 안내가 도구 자체 마크업에서 공용 CsvGuide로 바뀌면서 예시 버튼 라벨도
    // 다른 도구와 같아졌다. 문구 전체를 박아두면 공용 카피가 바뀔 때마다 깨지므로
    // 진입 지점만 특정한다.
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터/ }));
    await waitFor(() => expect(screen.getByText("95% AR(1) 프로파일 구간")).toBeTruthy());
    expect(container.querySelector("#brand-its-result")).toBeTruthy();
    expect(container.textContent).toContain("증분 방향을 판정하지 않습니다");
    expect(container.textContent).not.toContain("관찰상 증가 신호가 남습니다");
    // 핵심 그림: 누적 차이의 점추정·구간. 방향 판정을 보류한 예시라 색을 칠하지 않는다(결론 문장과 같은 판정).
    fireEvent.click(screen.getByRole("button", { name: "분석 근거 보기" }));
    const figure = screen.getByRole("dialog").querySelector(".tool-core-figure .result-effect");
    expect(figure).toBeTruthy();
    expect(figure.querySelector("li").getAttribute("data-tone")).toBe("flat");
    expect(figure.textContent).toContain("방향을 판정하지 않습니다");
  });
});

it.each([
  { interval: [-20, 80], tone: "neutral", figureTone: "flat", headline: "증가를 변화 없음과 구분하기 어렵습니다" },
  { interval: [-80, -20], tone: "bad", figureTone: "worse", headline: "관찰상 감소 신호가 남지만 인과 증명은 아닙니다" },
])("aligns the card and interval after design confirmation: $tone", async ({ interval, tone, figureTone, headline }) => {
  const run = brandMath.runBrandInterruptedTimeSeries;
  vi.spyOn(brandMath, "runBrandInterruptedTimeSeries").mockImplementation(input => {
    const result = run(input);
    if (!result?.ok) return result;
    return { ...result, profileInterval: interval, profileIncrementalTotal: (interval[0] + interval[1]) / 2, diagnostics: { ...result.diagnostics, ar1EvidenceTier: "confirmatory", ar1Profile: { ...result.diagnostics.ar1Profile, hitsBoundary: false } } };
  });
  useAppStore.setState({ currentRouteId: "5-24", csvData: EMPTY, csvGroups: { ...useAppStore.getState().csvGroups, brand_incrementality: EMPTY }, demoDisabled: true });
  const { container } = render(<BrandCampaignIncrementality />);
  fireEvent.click(screen.getByRole("button", { name: /예시 데이터/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "분석 근거 보기" })).toBeTruthy());
  for (const [label, value] of [
    ["비교한 대상은 무엇인가요?", "time"], ["두 그룹은 어떻게 나눴나요?", "observational"],
    ["결과를 보기 전에 기간을 정했나요?", "planned"], ["같은 기간에 프로모션·시즌·추적 방식이 바뀐 적이 있나요?", "none"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  expect(container.querySelector(".result-action-card").classList.contains(tone)).toBe(true);
  expect(container.querySelector(".result-action-card__stats").children[3].textContent).toContain("추정 불가");
  fireEvent.click(screen.getByRole("button", { name: "분석 근거 보기" }));
  expect(screen.getByRole("dialog").querySelector(".result-effect li").dataset.tone).toBe(figureTone);
  expect(screen.getByText(headline)).toBeTruthy();
  expect(container.textContent).not.toContain("AR(1) 계수 불확실성까지 반영하면 증가를 변화 없음과 구분하기 어렵습니다.");
  vi.restoreAllMocks();
});
