import { expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import HomeResultPreview from "./HomeResultPreview";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { runEfficiencyAnalysis } from "@/lib/assistant/efficiencyAnalysisAdapters";

it.each(["ko", "en"])("shows actual sample evidence and launches the sample (%s)", locale => {
  const result = compareSamplePerformance(buildDemoCsv("efficiency").raw);
  // 미리보기는 결과 화면과 같은 범위(유료 채널 전체 합계)를 사용한다.
  const lead = result;
  const launch = vi.fn();
  const view = render(<HomeResultPreview locale={locale} onTrySample={launch} />);
  expect(view.container.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(view.container.querySelectorAll("figure, canvas")).toHaveLength(0);
  expect(view.container.textContent).toContain(locale === "en" ? `${result.channels.length} paid channels` : `유료 채널 ${result.channels.length}개 합계`);
  expect(view.container.querySelector("dd").textContent).toBe(`+${(lead.cpaChange * 100).toFixed(1)}%`);
  for (const [index, period] of ["prior", "recent"].entries()) {
    expect(view.container.querySelectorAll("td:not(.home-sample-bar)")[index].textContent).toContain(Math.round(lead[period].cpa).toLocaleString(locale === "en" ? "en-US" : "ko-KR"));
  }
  // 막대는 0에서 시작하는 같은 축 — 큰 값이 100%, 작은 값은 실제 비율 그대로다(장식 막대 금지, §12.28).
  const bars = [...view.container.querySelectorAll(".home-sample-bar i")].map(bar => parseFloat(bar.style.width));
  const max = Math.max(lead.prior.cpa, lead.recent.cpa);
  expect(bars).toHaveLength(2);
  expect(bars[0]).toBeCloseTo(lead.prior.cpa / max * 100, 6);
  expect(bars[1]).toBeCloseTo(lead.recent.cpa / max * 100, 6);
  expect(view.container.querySelector(".home-sample-bar").getAttribute("aria-hidden")).toBe("true");
  expect([...view.container.querySelectorAll("time")].map(time => time.dateTime)).toEqual([result.dates[0], result.dates[6], result.dates[7], result.dates.at(-1)]);
  // 도치는 장식이다 — 숫자는 표가 말하므로 스크린리더에 같은 내용을 한 번 더 읽히지 않는다.
  expect(view.container.querySelector("img").getAttribute("alt")).toBe("");
  expect(view.container.textContent).toContain(locale === "en" ? "Fictional data" : "가상 데이터");
  fireEvent.click(view.getByRole("button"));
  expect(launch).toHaveBeenCalledOnce();
  view.unmount();
});

// 홈 카드의 "변화 기여가 가장 큰 채널"은 샘플을 누르면 결과 화면의 성과 변동 원인(5-21)으로 다시 나온다.
// 두 곳이 같은 채널·같은 금액을 말해야 한다 — 어댑터를 그대로 돌려 대조한다(같은 함수라도 입력 규칙이
// 갈리면 다른 답이 나오므로 결과로 확인한다).
it.each(["ko", "en"])("names the same driver channel and amount as the 5-21 result (%s)", locale => {
  const adapterResult = runEfficiencyAnalysis({ toolId: "5-21", csvData: buildSampleJourney(locale), inputSignature: "home", mappingSignature: "home", locale, options: { denomBasis: "actions" } });
  expect(adapterResult.status).toBe("success");
  const stat = adapterResult.verdict.stats.find(item => item.id === adapterResult.verdict.primaryStatId);
  expect(stat.id).toBe("driver-contribution");
  const view = render(<HomeResultPreview locale={locale} />);
  const line = view.container.querySelector(".home-sample-trace");
  expect(line).not.toBeNull();
  const entity = line.querySelector("strong").textContent;
  expect(adapterResult.verdict.headline).toContain(entity);
  const shown = Number(line.querySelector("b").textContent.replace(/[^0-9]/g, ""));
  expect(shown).toBe(Math.round(Math.abs(stat.value)));
  expect(line.querySelector("b").textContent.startsWith(stat.value >= 0 ? "+" : "−")).toBe(true);
  view.unmount();
});
