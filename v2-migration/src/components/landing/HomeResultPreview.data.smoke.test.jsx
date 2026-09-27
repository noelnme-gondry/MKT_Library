import { expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import HomeResultPreview from "./HomeResultPreview";

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
    expect(view.container.querySelectorAll("td")[index].textContent).toContain(Math.round(lead[period].cpa).toLocaleString(locale === "en" ? "en-US" : "ko-KR"));
  }
  expect([...view.container.querySelectorAll("time")].map(time => time.dateTime)).toEqual([result.dates[0], result.dates[6], result.dates[7], result.dates.at(-1)]);
  expect(view.getByRole("img").getAttribute("alt")).toBeTruthy();
  expect(view.container.textContent).toContain(locale === "en" ? "Fictional data" : "가상 데이터");
  fireEvent.click(view.getByRole("button"));
  expect(launch).toHaveBeenCalledOnce();
  view.unmount();
});
