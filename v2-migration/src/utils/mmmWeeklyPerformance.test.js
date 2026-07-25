import { describe, expect, it } from "vitest";
import {
  allocateMmmAggregateRun,
  buildMmmAggregateMediaPanel,
  buildMmmCollinearityGroupedPerformance,
  buildMmmWeeklyPerformance,
  sliceMmmChannelContributions,
} from "./mmmWeeklyPerformance";

describe("PR #416 aggregate media allocation", () => {
  it("fits two summed media inputs and allocates every weekly group RR by adstocked spend share", () => {
    const panel = {
      week: [1, 2, 3],
      ch: {
        search: [100, 0, 0],
        social: [0, 100, 0],
        video: [50, 50, 0],
      },
      channels: [
        { key: "search", label: "Search", kind: "perf" },
        { key: "social", label: "Social", kind: "perf" },
        { key: "video", label: "Video", kind: "brand" },
      ],
    };
    const aggregatePanel = buildMmmAggregateMediaPanel(panel);
    expect(aggregatePanel.ch).toEqual({
      performance_total: [100, 100, 0],
      branding_total: [50, 50, 0],
    });
    const aggregateRun = {
      weeks: [
        { contrib: { Performance: 10, Brand: 5 } },
        { contrib: { Performance: 20, Brand: 6 } },
        { contrib: { Performance: 8, Brand: 2 } },
      ],
      channelContributions: {
        performance_total: {
          key: "performance_total",
          weeklyMean: [10, 20, 8],
          weeklyLow: [5, 10, 4],
          weeklyHigh: [15, 30, 12],
          posteriorPositive: 0.9,
        },
        branding_total: {
          key: "branding_total",
          weeklyMean: [5, 6, 2],
          weeklyLow: [2, 3, 1],
          weeklyHigh: [8, 9, 3],
          posteriorPositive: 0.8,
        },
      },
      saturationByChannel: {
        performance_total: { params: { alpha: 0.5 } },
        branding_total: { params: { alpha: 0.5 } },
      },
    };
    const adstock = (values, alpha) => values.reduce((result, value, index) => {
      result.push(value + alpha * (result[index - 1] || 0));
      return result;
    }, []);
    const allocated = allocateMmmAggregateRun(panel, aggregatePanel, aggregateRun, adstock);

    allocated.weeks.forEach((week, index) => {
      expect(
        week.channelContrib.search + week.channelContrib.social,
      ).toBeCloseTo(week.contrib.Performance, 10);
      expect(week.channelContrib.video).toBeCloseTo(week.contrib.Brand, 10);
      expect(
        allocated.channelContributions.search.weeklyMean[index]
        + allocated.channelContributions.social.weeklyMean[index],
      ).toBeCloseTo(week.contrib.Performance, 10);
    });
    expect(allocated.channelContributions.social).toMatchObject({
      source: "aggregate-group-adstock-allocation",
      allocationReliability: "group-total-by-construction",
      identificationVerdict: "ALLOCATED/BY-CONSTRUCTION",
      groupKey: "performance_total",
    });
  });
});

describe("sliceMmmChannelContributions", () => {
  it("기간 필터 뒤 total을 화면 구간의 weekly 값으로 다시 계산한다", () => {
    const sliced = sliceMmmChannelContributions({
      search: {
        key: "search",
        weeklyMean: [10, 20, 30, 40],
        weeklyLow: [5, 10, 15, 20],
        weeklyHigh: [15, 30, 45, 60],
        totalMean: 100,
        totalLow: 50,
        totalHigh: 150,
      },
    }, 1, 3);

    expect(sliced.search).toMatchObject({
      weeklyMean: [20, 30],
      weeklyLow: [10, 15],
      weeklyHigh: [30, 45],
      totalMean: 50,
      totalLow: 25,
      totalHigh: 75,
    });
  });
});

describe("buildMmmWeeklyPerformance", () => {
  it("기간 전체의 주 평균 지출·예측 성과·CPR을 채널별로 집계한다", () => {
    const rows = buildMmmWeeklyPerformance(
      { week: [1, 2, 3, 4], ch: { meta: [100, 0, 200, 100], unused: [0, 0, 0, 0] } },
      {
        meta: {
          key: "meta", label: "Meta", posteriorPositive: 0.9,
          weeklyMean: [10, 5, 20, 10], totalMean: 45, totalLow: 30, totalHigh: 60,
        },
        unused: { key: "unused", label: "Unused", weeklyMean: [0, 0, 0, 0], totalMean: 0 },
      },
    );

    expect(rows[0]).toMatchObject({
      key: "meta", label: "Meta", activeWeeks: 3, totalSpend: 400,
      totalPredicted: 45, totalPredictedLow: 30, totalPredictedHigh: 60,
      avgWeeklySpend: 100,
      avgWeeklyPredicted: 11.25, avgWeeklyPredictedLow: 7.5,
      avgWeeklyPredictedHigh: 15, posteriorPositive: 0.9,
    });
    expect(rows[0].predictedCpr).toBeCloseTo(400 / 45);
  });

  it("예측 성과가 0이면 CPR을 억지로 표시하지 않는다", () => {
    const rows = buildMmmWeeklyPerformance(
      { week: [1, 2], ch: { google: [100, 100] } },
      { google: { key: "google", weeklyMean: [0, 0], totalMean: 0 } },
    );
    expect(rows[0].predictedCpr).toBeNull();
  });

  it("선택 기간 Spend가 0이어도 carryover RR이 있으면 채널을 숨기지 않는다", () => {
    const rows = buildMmmWeeklyPerformance(
      { week: [1, 2], ch: { ooh: [0, 0] } },
      { ooh: { key: "ooh", weeklyMean: [8, 2], totalMean: 10 } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "ooh",
      totalSpend: 0,
      totalPredicted: 10,
      avgWeeklyPredicted: 5,
      predictedCpr: null,
    });
  });

  it("높은 상관으로 연결된 채널은 표시용 묶음으로 합산하고 나머지는 개별로 남긴다", () => {
    const panel = { week: [1, 2, 3, 4], ch: { snap: [100, 0, 100, 0], tiktok: [50, 50, 0, 0], search: [0, 100, 0, 100] } };
    const rows = [
      { key: "snap", label: "Snap", activeWeeks: 2, avgWeeklySpend: 50, avgWeeklyPredicted: 5, predictedCpr: 10 },
      { key: "tiktok", label: "TikTok", activeWeeks: 2, avgWeeklySpend: 25, avgWeeklyPredicted: 2.5, predictedCpr: 10 },
      { key: "search", label: "Search", activeWeeks: 2, avgWeeklySpend: 50, avgWeeklyPredicted: 10, predictedCpr: 5 },
    ];

    const grouped = buildMmmCollinearityGroupedPerformance(panel, rows, [
      { a: "media_snap", b: "media_tiktok", corr: 0.92 },
      { a: "media_snap", b: "media_search", corr: 0.84 },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.find((row) => row.key === "search")).toEqual(rows[2]);
    expect(grouped.find((row) => row.isCollinearityGroup)).toMatchObject({
      label: "Snap + TikTok", activeWeeks: 3, avgWeeklySpend: 75,
      totalSpend: 300, totalPredicted: 30,
      avgWeeklyPredicted: 7.5, predictedCpr: 10, maxCorrelation: 0.92,
      isGroupRefit: false,
    });
  });

  it("재적합된 상관 그룹은 개별행 단순합 대신 그룹 posterior를 사용한다", () => {
    const panel = { week: [1, 2], ch: { snap: [100, 0], tiktok: [50, 50] } };
    const rows = [
      { key: "snap", label: "Snap", avgWeeklySpend: 50, avgWeeklyPredicted: 5 },
      { key: "tiktok", label: "TikTok", avgWeeklySpend: 50, avgWeeklyPredicted: 5 },
    ];
    const grouped = buildMmmCollinearityGroupedPerformance(panel, rows, [], 0.9, {
      enabled: true,
      groups: [{
        key: "__corr_group_1",
        label: "Snap + TikTok",
        members: ["snap", "tiktok"],
        maxCorrelation: 0.98,
        contribution: { totalMean: 30, totalLow: 20, totalHigh: 40, posteriorPositive: 0.94 },
      }],
    });
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      isGroupRefit: true,
      totalSpend: 200,
      totalPredicted: 30,
      avgWeeklySpend: 100,
      avgWeeklyPredicted: 15,
      avgWeeklyPredictedLow: 10,
      avgWeeklyPredictedHigh: 20,
    });
  });
});
