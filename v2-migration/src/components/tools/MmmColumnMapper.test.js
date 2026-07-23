import { describe, expect, it } from "vitest";
import { autoGuessColMap, buildPanelFromColMap, colMapMissing, mmmPlatformTags, mmmSegmentValues } from "./MmmColumnMapper";
import { mmmValidate } from "@/utils/mmmMath";

describe("MMM column mapping", () => {
  it("prioritizes explicit spend/cost names over embedded target words", () => {
    const headers = ["date", "signup_spend", "revenue_campaign_cost", "traffic_spend", "revenue"];
    const rows = [{ date: "2025-01-06", signup_spend: "100", revenue_campaign_cost: "200", traffic_spend: "300", revenue: "500" }];
    const partial = autoGuessColMap(headers, rows);
    expect(partial.signup_spend.role).toBe("channel");
    expect(partial.revenue_campaign_cost.role).toBe("channel");
    expect(partial.traffic_spend.role).toBe("channel");
    expect(partial.revenue.role).toBe("revenue");
  });

  it("recognizes iOS-prefixed media symmetrically and preserves scientific notation", () => {
    const headers = ["week", "regs", "ios_meta_spend"];
    const rows = [
      { week: "2025-W01", regs: "1e6", ios_meta_spend: "1.2E+06" },
      { week: "2025-W02", regs: "2e6", ios_meta_spend: "2.4E+06" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.ios_meta_spend).toMatchObject({ role: "channel", plat: "ios" });
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.targets.Regs).toEqual([1_000_000, 2_000_000]);
    expect(panel.ch.c_ios_meta_spend).toEqual([1_200_000, 2_400_000]);
  });

  it("scopes OS-specific spend and steps while excluding ambiguous other cost", () => {
    const headers = ["week", "android_regs", "ios_regs", "android_cost", "ios_cost", "other_cost", "android_launch_step", "ios_delist_step", "global_event"];
    const rows = [
      { week: "2025-W01", android_regs: "100", ios_regs: "80", android_cost: "20", ios_cost: "30", other_cost: "9", android_launch_step: "1", ios_delist_step: "0", global_event: "0" },
      { week: "2025-W02", android_regs: "110", ios_regs: "70", android_cost: "25", ios_cost: "35", other_cost: "11", android_launch_step: "1", ios_delist_step: "1", global_event: "1" },
    ];
    const map = {
      week: { role: "week" },
      android_regs: { role: "reg", plat: "android" }, ios_regs: { role: "reg", plat: "ios" },
      android_cost: { role: "channel", plat: "android" }, ios_cost: { role: "channel", plat: "ios" }, other_cost: { role: "channel", plat: "common" },
      // legacy 저장 매핑처럼 step의 plat이 없어도 헤더의 OS 태그를 복구해야 한다.
      android_launch_step: { role: "step" }, ios_delist_step: { role: "step" }, global_event: { role: "dummy", plat: "common" },
    };
    const android = buildPanelFromColMap(headers, rows, map, "android").panel;
    expect(Object.keys(android.ch)).toEqual(["c_android_cost"]);
    expect(Object.keys(android.steps)).toEqual(["c_android_launch_step"]);
    expect(Object.keys(android.dummy)).toEqual(["c_global_event"]);
    expect(android.targets.Regs).toEqual([100, 110]);
    const ios = buildPanelFromColMap(headers, rows, map, "ios").panel;
    expect(Object.keys(ios.ch)).toEqual(["c_ios_cost"]);
    expect(Object.keys(ios.steps)).toEqual(["c_ios_delist_step"]);
    expect(ios.targets.Regs).toEqual([80, 70]);
    expect(autoGuessColMap(["week", "ios_reopen_step"], [{ week: "2025-W01", ios_reopen_step: "1" }], false).ios_reopen_step).toMatchObject({ role: "step", plat: "ios" });
  });

  it("auto-detects row OS and Revenue, then filters the panel", () => {
    const headers = ["week", "os", "revenue", "google_spend"];
    const rows = [
      { week: "2025-01-06", os: "android", revenue: "100", google_spend: "20" },
      { week: "2025-01-06", os: "iOS", revenue: "80", google_spend: "10" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.os.role).toBe("platform");
    expect(map.revenue.role).toBe("revenue");
    expect(mmmSegmentValues(headers, rows, map).values.map((v) => v.value)).toEqual(["android", "iOS"]);
    const panel = buildPanelFromColMap(headers, rows, map, "android").panel;
    expect(panel.targets.Revenue).toEqual([100]);
    expect(panel.ch.c_google_spend).toEqual([20]);
  });

  it("sorts date-like week inputs chronologically instead of parseFloat year ties", () => {
    const headers = ["week", "regs", "google_spend"];
    const rows = [
      { week: "2025-02-03", regs: "20", google_spend: "200" },
      { week: "2025-01-06", regs: "10", google_spend: "100" },
    ];
    const map = { week: { role: "week" }, regs: { role: "reg" }, google_spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-01-06", "2025-02-03"]);
    expect(panel.targets.Regs).toEqual([10, 20]);
    expect(panel.week).toEqual([1, 2]);
  });

  it("records missing calendar weeks instead of compressing adstock time silently", () => {
    const headers = ["date", "regs", "meta_spend"];
    const rows = [
      { date: "2025-01-06", regs: "100", meta_spend: "20" },
      { date: "2025-01-20", regs: "110", meta_spend: "25" },
    ];
    const map = { date: { role: "date" }, regs: { role: "reg" }, meta_spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.calendarGaps.count).toBe(1);
    expect(panel.calendarGaps.gaps[0]).toMatchObject({ after: "2025-01-06", before: "2025-01-20", missingWeeks: 1 });
    const guessed = autoGuessColMap(headers, rows);
    expect(guessed.date.role).toBe("date");
    expect(guessed.regs.role).toBe("reg");
    expect(guessed.meta_spend.role).toBe("channel");
    expect(colMapMissing(headers, guessed)).toEqual([]);
  });

  it("keeps short-prefix spend headers mapped as media", () => {
    const headers = ["date", "Regs", "g_spend"];
    const rows = Array.from({ length: 16 }, (_, week) => ({
      date: new Date(Date.UTC(2025, 0, 6 + (week >= 8 ? week + 1 : week) * 7)).toISOString().slice(0, 10),
      Regs: 100 + week * 3,
      g_spend: 50000 + (week % 4) * 8000,
    }));
    const guessed = autoGuessColMap(headers, rows);
    expect(guessed.g_spend.role).toBe("channel");
    expect(colMapMissing(headers, guessed)).toEqual([]);
  });

  it("canonicalizes ISO weeks and detects W01 to W03 plus numeric 1,2,4 gaps", () => {
    const map = { week: { role: "week" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const iso = buildPanelFromColMap(["week", "regs", "spend"], [
      { week: "2025-W01", regs: "10", spend: "100" },
      { week: "2025W3", regs: "12", spend: "120" },
    ], map).panel;
    expect(iso.calendarGaps.count).toBe(1);
    expect(iso.calendarGaps.gaps[0]).toMatchObject({ after: "2025-W01", before: "2025W3", missingWeeks: 1 });
    expect(iso.dates.map((date) => date.toISOString().slice(0, 10))).toEqual(["2024-12-30", "2025-01-13"]);

    const numeric = buildPanelFromColMap(["week", "regs", "spend"], [1, 2, 4].map((week) => ({ week, regs: week * 10, spend: week * 100 })), map).panel;
    expect(numeric.calendarGaps.count).toBe(1);
    expect(numeric.calendarGaps.gaps[0]).toMatchObject({ after: 2, before: 4, missingWeeks: 1 });
  });

  it("drops blank, impossible, and unparseable dates instead of creating raw fake weeks", () => {
    const headers = ["date", "regs", "spend"];
    const map = { date: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, [
      { date: "2025-01-06", regs: "10", spend: "100" },
      { date: "", regs: "999", spend: "999" },
      { date: "2025-02-31", regs: "999", spend: "999" },
      { date: "not-a-date", regs: "999", spend: "999" },
    ], map).panel;
    expect(panel.week).toEqual([1]);
    expect(panel.targets.Regs).toEqual([10]);
    expect(panel.ch.c_spend).toEqual([100]);
    expect(panel.timeDiagnostics).toMatchObject({ droppedInvalidRows: 3, blankTimeRows: 1, unparseableTimeRows: 2 });
    expect(panel.timeDiagnostics.issues[0].code).toBe("invalid-time-row");
  });

  it("diagnoses duplicate weekly rows instead of silently treating them as consecutive t", () => {
    const headers = ["week", "regs", "spend"];
    const map = { week: { role: "week" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, [
      { week: "2025-W01", regs: "10", spend: "100" },
      { week: "2025W1", regs: "11", spend: "110" },
      { week: "2025-W02", regs: "12", spend: "120" },
    ], map).panel;
    expect(panel.timeDiagnostics.duplicatePeriods).toBe(1);
    expect(panel.timeDiagnostics.issues.some((issue) => issue.code === "duplicate-time-period")).toBe(true);
  });

  it("diagnoses duplicate daily rows at the same platform grain before summing", () => {
    const headers = ["date", "platform", "regs", "spend"];
    const map = { date: { role: "date" }, platform: { role: "platform" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, [
      { date: "2025-01-06", platform: "android", regs: "10", spend: "100" },
      { date: "2025-01-06", platform: "android", regs: "11", spend: "110" },
      { date: "2025-01-06", platform: "ios", regs: "8", spend: "80" },
    ], map, "all").panel;
    expect(panel.timeDiagnostics.duplicatePeriods).toBe(1);
    expect(panel.timeDiagnostics.issues.some((issue) => issue.code === "duplicate-time-period")).toBe(true);
  });

  it("blocks internal partial daily weeks and safely excludes partial boundaries at modal 7-day cadence", () => {
    const headers = ["date", "regs", "spend"];
    const map = { date: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const full = Array.from({ length: 5 }, (_, week) => Array.from({ length: 7 }, (_, day) => ({
      date: new Date(Date.UTC(2025, 0, 6 + week * 7 + day)).toISOString().slice(0, 10),
      regs: "10",
      spend: "20",
    }))).flat();
    const internal = buildPanelFromColMap(headers, full.filter((_, index) => index !== 2 * 7 + 3), map).panel;
    expect(internal.timeDiagnostics).toMatchObject({ expectedDaysPerWeek: 7, internalPartialWeeks: 1 });
    expect(internal.timeDiagnostics.issues.some((issue) => issue.code === "partial-internal-week")).toBe(true);

    const boundary = buildPanelFromColMap(headers, full.slice(2, -3), map).panel;
    expect(boundary.timeDiagnostics).toMatchObject({ expectedDaysPerWeek: 7, boundaryPartialWeeks: 2 });
    expect(boundary.timeDiagnostics.warnings[0].code).toBe("partial-boundary-week");
    expect(boundary.week).toHaveLength(3);
  });

  it("checks daily completeness per row-platform before building Total", () => {
    const headers = ["date", "platform", "regs", "spend"];
    const map = { date: { role: "date" }, platform: { role: "platform" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const rows = Array.from({ length: 3 }, (_, week) => [
      ...Array.from({ length: 7 }, (_, day) => ({
        date: new Date(Date.UTC(2025, 0, 6 + week * 7 + day)).toISOString().slice(0, 10),
        platform: "android",
        regs: "10",
        spend: "20",
      })),
      ...Array.from({ length: 5 }, (_, day) => ({
        date: new Date(Date.UTC(2025, 0, 6 + week * 7 + day)).toISOString().slice(0, 10),
        platform: "ios",
        regs: "8",
        spend: "15",
      })),
    ]).flat();
    const total = buildPanelFromColMap(headers, rows, map, "all").panel;
    expect(total.timeDiagnostics.platformCoverage).toMatchObject({
      expectedSegments: ["android", "ios"],
      expectedDaysPerWeek: 7,
      inferredDaysBySegment: { android: 7, ios: 5 },
      internalIncompleteWeeks: 1,
      boundaryIncompleteWeeks: 2,
    });
    expect(total.timeDiagnostics.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["mixed-platform-cadence", "incomplete-internal-platform-week"]));
    expect(total.timeDiagnostics.issues.find((issue) => issue.code === "incomplete-internal-platform-week")?.messageEn).toContain("missing required platform rows or dates");
    expect(total.week).toHaveLength(1);

    const android = buildPanelFromColMap(headers, rows, map, "android").panel;
    expect(android.timeDiagnostics.internalIncompletePlatformWeeks).toBe(0);
    expect(android.timeDiagnostics.boundaryIncompletePlatformWeeks).toBe(0);
    expect(android.week).toHaveLength(3);
  });

  it("diagnoses a platform missing from an internal weekly Total period", () => {
    const headers = ["week", "platform", "regs", "spend"];
    const map = { week: { role: "week" }, platform: { role: "platform" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const rows = [
      { week: "2025-W01", platform: "android", regs: "10", spend: "20" },
      { week: "2025-W02", platform: "android", regs: "10", spend: "20" },
      { week: "2025-W02", platform: "ios", regs: "8", spend: "15" },
      { week: "2025-W03", platform: "android", regs: "11", spend: "22" },
      { week: "2025-W04", platform: "android", regs: "10", spend: "20" },
      { week: "2025-W04", platform: "ios", regs: "8", spend: "15" },
    ];
    const panel = buildPanelFromColMap(headers, rows, map, "all").panel;
    expect(panel.timeDiagnostics.platformCoverage).toMatchObject({
      expectedSegments: ["android", "ios"],
      internalIncompleteWeeks: 1,
      boundaryIncompleteWeeks: 1,
    });
    expect(panel.timeDiagnostics.issues.some((issue) => issue.code === "incomplete-internal-platform-week")).toBe(true);
    expect(panel.timeDiagnostics.warnings.some((warning) => warning.code === "incomplete-boundary-platform-week")).toBe(true);
    expect(panel.weekLabel).toEqual(["2025-01-06", "2025-01-13", "2025-01-20"]);
    expect(panel.targets.Regs).toEqual([18, 11, 18]);
  });

  it("pivots long weekly channel spend without summing repeated weekly targets", () => {
    const headers = ["date", "channel", "spend", "regs"];
    const rows = [
      { date: "2025-01-13", channel: "Google", spend: "200", regs: "12" },
      { date: "2025-01-06", channel: "Meta", spend: "50", regs: "10" },
      { date: "2025-01-06", channel: "Google", spend: "100", regs: "10" },
      { date: "2025-01-13", channel: "Meta", spend: "40", regs: "12" },
    ];
    const map = autoGuessColMap(headers, rows);
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-01-06", "2025-01-13"]);
    expect(panel.targets.Regs).toEqual([10, 12]);
    expect(panel.channels.map((channel) => channel.label)).toEqual(["MMM spend · Google", "MMM spend · Meta"]);
    expect(panel.ch.c_mmm_spend_google).toEqual([100, 200]);
    expect(panel.ch.c_mmm_spend_meta).toEqual([50, 40]);
  });

  it("auto-detects explicit week labels before pivoting long-format MMM", () => {
    const headers = ["week", "media", "cost", "revenue"];
    const rows = [
      { week: "2025-W02", media: "Google", cost: "200", revenue: "500" },
      { week: "2025-W01", media: "Google", cost: "100", revenue: "400" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.week.role).toBe("week");
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-W01", "2025-W02"]);
    expect(panel.targets.Revenue).toEqual([400, 500]);
  });

  it("canonicalizes equivalent long-format week and channel labels before pivoting", () => {
    const headers = ["week", "channel", "spend", "regs"];
    const rows = [
      { week: "2025-W1", channel: "Meta", spend: "100", regs: "10" },
      { week: "2025-W01", channel: "meta", spend: "20", regs: "10" },
      { week: "2025-W01", channel: "Google", spend: "80", regs: "10" },
    ];
    const panel = buildPanelFromColMap(headers, rows, autoGuessColMap(headers, rows)).panel;
    expect(panel.weekLabel).toEqual(["2025-W1"]);
    expect(panel.targets.Regs).toEqual([10]);
    expect(panel.ch.c_mmm_spend_meta).toEqual([120]);
    expect(panel.ch.c_mmm_spend_google).toEqual([80]);
    expect(panel.timeDiagnostics.duplicatePeriods).toBe(0);
  });

  it("preserves invalid long-format budget as missing spend instead of zero", () => {
    const headers = ["week", "media", "예산", "regs"];
    const rows = [
      { week: "2025-W01", media: "Google", 예산: "100", regs: "10" },
      { week: "2025-W02", media: "Google", 예산: "", regs: "11" },
    ];
    const map = {
      week: { role: "week" }, media: { role: "ignore" }, 예산: { role: "channel", kind: "perf", plat: "common" }, regs: { role: "reg" },
    };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.ch.c_mmm_spend_google[0]).toBe(100);
    expect(Number.isNaN(panel.ch.c_mmm_spend_google[1])).toBe(true);
    expect(mmmValidate(panel, "en", "Regs").issues.some((message) => message.includes("missing week"))).toBe(true);
  });

  it("aggregates daily values to weeks, keeps event flags binary, and exposes all mapped targets", () => {
    const headers = ["date", "traffic", "regs", "react", "purchasers", "revenue", "meta_spend", "promo"];
    const rows = [
      { date: "2025-01-06", traffic: "30", regs: "10", react: "4", purchasers: "3", revenue: "100", meta_spend: "20", promo: "0" },
      { date: "2025-01-07", traffic: "35", regs: "11", react: "5", purchasers: "4", revenue: "120", meta_spend: "25", promo: "1" },
      { date: "2025-01-08", traffic: "32", regs: "12", react: "3", purchasers: "2", revenue: "90", meta_spend: "18", promo: "1" },
    ];
    const map = { date: { role: "date" }, traffic: { role: "traffic" }, regs: { role: "reg" }, react: { role: "react" }, purchasers: { role: "purchasers" }, revenue: { role: "revenue" }, meta_spend: { role: "channel", kind: "perf", plat: "common" }, promo: { role: "dummy" } };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.week).toEqual([1]);
    expect(panel.targets).toMatchObject({ Traffic: [97], Regs: [33], React: [12], Purchasers: [9], Revenue: [310] });
    expect(panel.ch.c_meta_spend).toEqual([63]);
    expect(panel.dummy.c_promo).toEqual([1]);
  });

  it.each([
    ["blank", ""],
    ["arbitrary text", "foo"],
    ["out-of-range number", "2"],
    ["NaN", NaN],
  ])("keeps invalid %s dummy and regime values as blocking NaN", (_, invalid) => {
    const headers = ["week", "regs", "spend", "promo", "launch_step"];
    const map = {
      week: { role: "week" }, regs: { role: "reg" },
      spend: { role: "channel", kind: "perf", plat: "common" },
      promo: { role: "dummy" }, launch_step: { role: "step" },
    };
    const panel = buildPanelFromColMap(headers, [
      { week: "2025-W01", regs: "10", spend: "100", promo: invalid, launch_step: invalid },
      { week: "2025-W02", regs: "11", spend: "110", promo: "0", launch_step: "1" },
    ], map).panel;
    expect(Number.isNaN(panel.dummy.c_promo[0])).toBe(true);
    expect(Number.isNaN(panel.steps.c_launch_step[0])).toBe(true);
    const validation = mmmValidate(panel, "en", "Regs");
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("Event 'c_promo' has 1 non-binary week"),
      expect.stringContaining("Regime 'c_launch_step' has 1 non-binary week"),
    ]));
  });

  it("preserves exact 0/1 and documented binary labels", () => {
    const headers = ["week", "regs", "spend", "promo", "launch_step"];
    const map = {
      week: { role: "week" }, regs: { role: "reg" },
      spend: { role: "channel", kind: "perf", plat: "common" },
      promo: { role: "dummy" }, launch_step: { role: "step" },
    };
    const panel = buildPanelFromColMap(headers, [
      { week: "2025-W01", regs: "10", spend: "100", promo: 0, launch_step: "pre" },
      { week: "2025-W02", regs: "11", spend: "110", promo: "1", launch_step: "post" },
      { week: "2025-W03", regs: "12", spend: "120", promo: "no", launch_step: "before" },
      { week: "2025-W04", regs: "13", spend: "130", promo: "yes", launch_step: "after" },
    ], map).panel;
    expect(panel.dummy.c_promo).toEqual([0, 1, 0, 1]);
    expect(panel.steps.c_launch_step).toEqual([0, 1, 0, 1]);
    expect(mmmValidate(panel, "en", "Regs").issues.some((issue) => /non-binary week/.test(issue))).toBe(false);
  });

  it("uses weekly occurrence for events but blocks invalid or mixed daily regime state", () => {
    const headers = ["date", "regs", "spend", "promo", "launch_step"];
    const map = {
      date: { role: "date" }, regs: { role: "reg" },
      spend: { role: "channel", kind: "perf", plat: "common" },
      promo: { role: "dummy" }, launch_step: { role: "step" },
    };
    const valid = buildPanelFromColMap(headers, [
      { date: "2025-01-06", regs: "10", spend: "100", promo: "0", launch_step: "pre" },
      { date: "2025-01-07", regs: "11", spend: "110", promo: "1", launch_step: "pre" },
      { date: "2025-01-08", regs: "12", spend: "120", promo: "0", launch_step: "pre" },
    ], map).panel;
    expect(valid.dummy.c_promo).toEqual([1]);
    expect(valid.steps.c_launch_step).toEqual([0]);

    const invalid = buildPanelFromColMap(headers, [
      { date: "2025-01-06", regs: "10", spend: "100", promo: "0", launch_step: "pre" },
      { date: "2025-01-07", regs: "11", spend: "110", promo: "foo", launch_step: "post" },
    ], map).panel;
    expect(Number.isNaN(invalid.dummy.c_promo[0])).toBe(true);
    expect(Number.isNaN(invalid.steps.c_launch_step[0])).toBe(true);
    expect(mmmValidate(invalid, "en", "Regs").issues.filter((issue) => /non-binary week/.test(issue))).toHaveLength(2);
  });

  it("preserves comma-formatted first-day values during daily to weekly aggregation", () => {
    const headers = ["date", "regs", "meta_spend"];
    const rows = [
      { date: "2025-01-06", regs: "2,488", meta_spend: "1,200" },
      { date: "2025-01-07", regs: "12", meta_spend: "300" },
    ];
    const map = { date: { role: "date" }, regs: { role: "reg" }, meta_spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.targets.Regs).toEqual([2500]);
    expect(panel.ch.c_meta_spend).toEqual([1500]);

    const missing = buildPanelFromColMap(headers, [rows[0], { ...rows[1], regs: "" }], map).panel;
    expect(Number.isNaN(missing.targets.Regs[0])).toBe(true);
  });

  it("rolls row-platform weekly data into one Total row and recognizes every target tag", () => {
    const headers = ["week", "platform", "traffic_android", "traffic_ios", "buyers_android", "buyers_ios", "meta_spend"];
    const rows = [
      { week: "2025-W01", platform: "android", traffic_android: "100", traffic_ios: "0", buyers_android: "10", buyers_ios: "0", meta_spend: "40" },
      { week: "2025-W01", platform: "ios", traffic_android: "0", traffic_ios: "80", buyers_android: "0", buyers_ios: "8", meta_spend: "30" },
    ];
    const map = {
      week: { role: "week" }, platform: { role: "platform" },
      traffic_android: { role: "traffic", plat: "android" }, traffic_ios: { role: "traffic", plat: "ios" },
      buyers_android: { role: "purchasers", plat: "android" }, buyers_ios: { role: "purchasers", plat: "ios" },
      meta_spend: { role: "channel", kind: "perf", plat: "common" },
    };
    const panel = buildPanelFromColMap(headers, rows, map, "all").panel;
    expect(panel.week).toEqual([1]);
    expect(panel.targets.Traffic).toEqual([180]);
    expect(panel.targets.Purchasers).toEqual([18]);
    expect(panel.ch.c_meta_spend).toEqual([70]);

    const tagMap = { ...map, platform: { role: "ignore" } };
    expect(mmmPlatformTags(headers, tagMap).sort()).toEqual(["android", "ios"]);
  });

  it("requires explicit confirmation before using row order as an unlabelled weekly clock", () => {
    const headers = ["regs", "spend"];
    const base = { regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    expect(colMapMissing(headers, base, "en")).toContain("date/week or 'already weekly and ordered' confirmation");
    expect(colMapMissing(headers, { ...base, __mmmRowOrderConfirmed: true }, "en")).toEqual([]);
    const platformRows = { ...base, platform: { role: "platform" }, __mmmRowOrderConfirmed: true };
    expect(colMapMissing([...headers, "platform"], platformRows, "en")).toContain("date/week for combining platform rows by period");
  });

  it("blocks blank long-format time/channel rows instead of silently biasing the pivot", () => {
    const headers = ["week", "channel", "spend", "regs"];
    const rows = [
      { week: "2025-W01", channel: "Meta", spend: "100", regs: "10" },
      { week: "", channel: "Meta", spend: "999", regs: "999" },
      { week: "2025-W02", channel: "", spend: "999", regs: "999" },
    ];
    const panel = buildPanelFromColMap(headers, rows, autoGuessColMap(headers, rows)).panel;
    expect(panel.timeDiagnostics).toMatchObject({ blankTimeRows: 1, blankChannelRows: 1 });
    expect(panel.timeDiagnostics.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["invalid-time-row", "blank-long-channel"]));
  });

  it("blocks conflicting repeated long-format Y values independent of row order", () => {
    const headers = ["week", "channel", "spend", "regs", "promo"];
    const map = {
      week: { role: "week" }, channel: { role: "ignore" }, spend: { role: "channel", kind: "perf", plat: "common" },
      regs: { role: "reg" }, promo: { role: "dummy" },
    };
    const rows = [
      { week: "2025-W01", channel: "Meta", spend: "100", regs: "10", promo: "0" },
      { week: "2025-W01", channel: "Google", spend: "80", regs: "11", promo: "1" },
    ];
    const forward = buildPanelFromColMap(headers, rows, map).panel;
    const reversed = buildPanelFromColMap(headers, rows.slice().reverse(), map).panel;
    [forward, reversed].forEach((panel) => {
      expect(Number.isNaN(panel.targets.Regs[0])).toBe(true);
      expect(Number.isNaN(panel.dummy.c_promo[0])).toBe(true);
      expect(panel.timeDiagnostics.issues.find((issue) => issue.code === "conflicting-long-repeated-value")?.headers).toEqual(["promo", "regs"]);
    });
  });

  it("keeps Unicode channel keys stable when reference headers arrive in a different order", () => {
    const rows = [{ week: "2025-W01", regs: "10", "메타 비용": "100", "구글 비용": "80" }];
    const map = {
      week: { role: "week" }, regs: { role: "reg" },
      "메타 비용": { role: "channel", kind: "perf", plat: "common" },
      "구글 비용": { role: "channel", kind: "perf", plat: "common" },
    };
    const first = buildPanelFromColMap(["week", "regs", "메타 비용", "구글 비용"], rows, map).panel;
    const second = buildPanelFromColMap(["구글 비용", "메타 비용", "regs", "week"], rows, map).panel;
    expect(first.ch.c_메타_비용).toEqual([100]);
    expect(first.ch.c_구글_비용).toEqual([80]);
    expect(second.ch).toEqual(first.ch);
  });
});
