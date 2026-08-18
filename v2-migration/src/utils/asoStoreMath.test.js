import { describe, expect, it } from "vitest";
import {
  aggregateBySource,
  classifyStoreShift,
  dailyConversionSeries,
  decomposeStoreConversion,
  storeFunnel,
} from "./asoStoreMath";

/**
 * 골든 — 합성 데이터로 손계산과 대조한다(§8).
 * 이 모듈은 새 수학이 아니라 PVM 분해의 어댑터이므로, 검증 대상은
 * ① 퍼널 산술 ② 소스별 집계 ③ 믹스/효율 판정의 방향과 임계다.
 */

describe("storeFunnel", () => {
  it("단계별 통과율을 손계산과 같게 낸다", () => {
    const funnel = storeFunnel([
      { impressions: 10000, views: 4000, installs: 1200 },
      { impressions: 10000, views: 6000, installs: 1800 },
    ]);
    expect(funnel.impressions).toBe(20000);
    expect(funnel.views).toBe(10000);
    expect(funnel.installs).toBe(3000);
    expect(funnel.tapThrough).toBeCloseTo(0.5, 12);        // 10000 / 20000
    expect(funnel.viewToInstall).toBeCloseTo(0.3, 12);     // 3000 / 10000
    expect(funnel.impressionToInstall).toBeCloseTo(0.15, 12);
  });

  it("분모가 0이면 비율을 지어내지 않고 null로 둔다", () => {
    const funnel = storeFunnel([{ impressions: 0, views: 0, installs: 0 }]);
    expect(funnel.tapThrough).toBeNull();
    expect(funnel.viewToInstall).toBeNull();
  });

  it("천단위 콤마가 든 문자열을 숫자로 읽는다", () => {
    // CSV는 dynamicTyping 없이 파싱돼 모든 값이 문자열로 들어온다(§7).
    const funnel = storeFunnel([{ impressions: "12,000", views: "3,000", installs: "900" }]);
    expect(funnel.views).toBe(3000);
    expect(funnel.viewToInstall).toBeCloseTo(0.3, 12);
  });
});

describe("aggregateBySource", () => {
  it("소스별로 조회·설치를 합산한다", () => {
    const agg = aggregateBySource([
      { source: "Search", views: 100, installs: 40 },
      { source: "Search", views: 100, installs: 20 },
      { source: "Browse", views: 200, installs: 20 },
    ]);
    expect(agg.get("Search")).toEqual({ cost: 200, result: 60 });
    expect(agg.get("Browse")).toEqual({ cost: 200, result: 20 });
  });

  it("소스가 비면 미지정으로 모은다", () => {
    const agg = aggregateBySource([{ source: "", views: 10, installs: 1 }]);
    expect(agg.get("(미지정)")).toEqual({ cost: 10, result: 1 });
  });
});

describe("decomposeStoreConversion", () => {
  // 소스별 전환율은 그대로인데 전환이 나쁜 Browse 비중만 늘린 케이스.
  // 전체 전환율은 떨어지지만 원인은 페이지가 아니라 트래픽 구성이다.
  const mixOnlyBefore = [
    { source: "Search", views: 700, installs: 350 },  // 50%
    { source: "Browse", views: 300, installs: 30 },   // 10%
  ];
  const mixOnlyAfter = [
    { source: "Search", views: 300, installs: 150 },  // 50% 그대로
    { source: "Browse", views: 700, installs: 70 },   // 10% 그대로
  ];

  it("소스별 전환율이 불변이면 믹스 효과로 판정한다", () => {
    const decomposed = decomposeStoreConversion(mixOnlyBefore, mixOnlyAfter);
    expect(decomposed.funnelBefore.viewToInstall).toBeCloseTo(0.38, 12);
    expect(decomposed.funnelAfter.viewToInstall).toBeCloseTo(0.22, 12);
    expect(decomposed.conversionDelta).toBeCloseTo(-0.16, 12);
    const verdict = classifyStoreShift(decomposed);
    expect(verdict.verdict).toBe("mix");
    expect(verdict.totals.rate).toBeCloseTo(0, 10);
  });

  it("트래픽 구성이 불변이면 효율 효과로 판정한다", () => {
    const before = [
      { source: "Search", views: 500, installs: 250 },
      { source: "Browse", views: 500, installs: 50 },
    ];
    const after = [
      { source: "Search", views: 500, installs: 200 },  // 50% → 40%
      { source: "Browse", views: 500, installs: 40 },   // 10% → 8%
    ];
    const verdict = classifyStoreShift(decomposeStoreConversion(before, after));
    expect(verdict.verdict).toBe("efficiency");
    expect(verdict.totals.mix).toBeCloseTo(0, 10);
  });

  it("설치가 0인 기간은 분해하지 않고 null을 돌려준다", () => {
    const zero = [{ source: "Search", views: 100, installs: 0 }];
    expect(decomposeStoreConversion(zero, zero)).toBeNull();
    expect(classifyStoreShift(null).verdict).toBe("unknown");
  });

  it("변화가 전혀 없으면 믹스 탓으로 몰지 않는다", () => {
    const same = [
      { source: "Search", views: 500, installs: 250 },
      { source: "Browse", views: 500, installs: 50 },
    ];
    const verdict = classifyStoreShift(decomposeStoreConversion(same, same));
    expect(verdict.verdict).toBe("flat");
    expect(verdict.mixShare).toBeNull();
  });

  it("같은 입력은 항상 같은 결과를 낸다(결정론)", () => {
    const first = decomposeStoreConversion(mixOnlyBefore, mixOnlyAfter);
    const second = decomposeStoreConversion(mixOnlyBefore, mixOnlyAfter);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("dailyConversionSeries", () => {
  const rows = [
    { date: "2026-03-02", source: "Search", views: 100, installs: 45 },
    { date: "2026-03-01", source: "Search", views: 200, installs: 100 },
    { date: "2026-03-01", source: "Browse", views: 100, installs: 10 },
    { date: "2026-03-02", source: "Browse", views: 300, installs: 15 },
  ];

  it("날짜를 오름차순으로 정렬한다", () => {
    expect(dailyConversionSeries(rows).dates).toEqual(["2026-03-01", "2026-03-02"]);
  });

  it("전체 전환율은 소스 합산 분모로 계산한다", () => {
    // 3/1: (100+10)/(200+100)=0.36667, 3/2: (45+15)/(100+300)=0.15
    const series = dailyConversionSeries(rows);
    expect(series.total[0]).toBeCloseTo(110 / 300, 12);
    expect(series.total[1]).toBeCloseTo(60 / 400, 12);
  });

  it("소스는 총 설치 내림차순으로 결정론적으로 정렬된다", () => {
    const series = dailyConversionSeries(rows);
    expect(series.sources.map((s) => s.source)).toEqual(["Search", "Browse"]);
    expect(series.sources[0].values).toEqual([0.5, 0.45]);
  });

  it("분모가 0인 날은 값을 만들지 않고 null로 둔다", () => {
    const series = dailyConversionSeries([
      { date: "2026-03-01", source: "Search", views: 0, installs: 0 },
      { date: "2026-03-02", source: "Search", views: 50, installs: 10 },
    ]);
    expect(series.total).toEqual([null, 0.2]);
    expect(series.sources[0].values).toEqual([null, 0.2]);
  });

  it("빈 입력에서 throw 하지 않는다", () => {
    expect(dailyConversionSeries([])).toEqual({ dates: [], total: [], sources: [] });
    expect(dailyConversionSeries(null).dates).toEqual([]);
  });
});
