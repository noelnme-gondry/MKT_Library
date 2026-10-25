import { describe, expect, it } from "vitest";
import { decomposeStoreConversion, classifyStoreShift } from "@/utils/asoStoreMath";
import { asoStoreReport, fmtPp, storeContributions } from "./asoStoreReport";

const rows = (date, entries) => entries.map(([source, views, installs]) => ({ date, source, views: String(views), installs: String(installs) }));

describe("asoStoreReport", () => {
  it("restates the views-per-install decomposition as conversion pp that sum exactly to the total change", () => {
    const before = [...rows("2026-01-01", [["A", 100, 40], ["B", 100, 10]]), ...rows("2026-01-02", [["A", 100, 40], ["B", 100, 10]])];
    const after = [...rows("2026-01-03", [["A", 100, 38], ["B", 300, 15]]), ...rows("2026-01-04", [["A", 100, 38], ["B", 300, 15]])];
    const decomposed = decomposeStoreConversion(before, after);
    const contributions = storeContributions(decomposed);
    const total = decomposed.funnelAfter.viewToInstall - decomposed.funnelBefore.viewToInstall;
    expect(contributions.mix + contributions.rate).toBeCloseTo(total, 12);
    // 저전환 B의 설치 비중이 늘었다 → 구성 기여는 음수(전환율을 끌어내림).
    expect(contributions.rows.find((row) => row.source === "B").mix).toBeLessThan(0);
  });

  it("says the share of the fall only when both parts point the same way", () => {
    const before = rows("2026-01-01", [["A", 100, 40], ["B", 100, 10]]).concat(rows("2026-01-02", [["A", 100, 40], ["B", 100, 10]]));
    const sameWay = rows("2026-01-03", [["A", 100, 39], ["B", 300, 29]]).concat(rows("2026-01-04", [["A", 100, 39], ["B", 300, 29]]));
    const decomposed = decomposeStoreConversion(before, sameWay);
    const report = asoStoreReport({ split: {}, decomposed, verdict: classifyStoreShift(decomposed) });
    expect(report.text).toMatch(/^설치 전환율 25\.00% → 1\d\.\d{2}% \(−\d+\.\d{2}%p\)/);
    expect(report.text).toMatch(/하락분의 \d+%는 유입 구성 변화/);
    expect(report.stats).toHaveLength(3);
  });

  it("withholds without inventing a number when the halves cannot be decomposed", () => {
    const report = asoStoreReport({ split: null, decomposed: null, overall: { viewToInstall: 0.2 } }, { locale: "en" });
    expect(report.text).toBe("Withheld — fewer than four distinct dates");
    expect(fmtPp(-0.00001)).toBe("0.00%p");
  });
});
