import { describe, expect, it } from "vitest";
import { autoGuessColMap, buildPanelFromColMap, colMapMissing, isOperationalDeliveryCostHeader, mmmForecastInputWarnings, mmmPlatformTags, mmmSegmentValues, normalizePlatformValue } from "./MmmColumnMapper";
import { mmmValidate } from "@/utils/mmmMath";

describe("MMM column mapping", () => {
  it("normalizes row-platform casing and store aliases without folding Web into Android or iOS", () => {
    expect(["Android", "ANDROID", "AOS", "Google Play"].map(normalizePlatformValue))
      .toEqual(["android", "android", "android", "android"]);
    expect(["iOS", "IOS", "iPhone", "iPad"].map(normalizePlatformValue))
      .toEqual(["ios", "ios", "ios", "ios"]);
    expect(normalizePlatformValue("Web")).toBe("web");

    const headers = ["week", "platform", "regs", "spend"];
    const rows = [
      { week: "2025-W01", platform: "Android", regs: "10", spend: "20" },
      { week: "2025-W01", platform: "iOS", regs: "8", spend: "15" },
      { week: "2025-W01", platform: "Web", regs: "5", spend: "4" },
      { week: "2025-W02", platform: "AOS", regs: "11", spend: "22" },
      { week: "2025-W02", platform: "iPhone", regs: "9", spend: "16" },
      { week: "2025-W02", platform: "WEB", regs: "6", spend: "5" },
    ];
    const map = {
      week: { role: "week" },
      platform: { role: "platform" },
      regs: { role: "reg" },
      spend: { role: "channel", kind: "perf", plat: "common" },
    };
    expect(buildPanelFromColMap(headers, rows, map, "android", "en").panel.targets.Regs)
      .toEqual([10, 11]);
    expect(buildPanelFromColMap(headers, rows, map, "IOS", "en").panel.targets.Regs)
      .toEqual([8, 9]);
    expect(buildPanelFromColMap(headers, rows, map, "web", "en").panel.targets.Regs)
      .toEqual([5, 6]);
    const total = buildPanelFromColMap(headers, rows, map, "all", "en");
    expect(total.panel.targets.Regs).toEqual([23, 26]);
    expect(total.panel.timeDiagnostics.internalIncompletePlatformWeeks).toBe(0);
  });

  it("treats GEO and Reach/Frequency as optional Meridian inputs", () => {
    const headers = ["week", "regs", "meta_spend", "geo", "meta_reach", "meta_frequency"];
    const rows = [
      { week: "2025-W01", regs: "100", meta_spend: "20", geo: "KR", meta_reach: "1000", meta_frequency: "2" },
      { week: "2025-W02", regs: "110", meta_spend: "25", geo: "KR", meta_reach: "1200", meta_frequency: "2.5" },
    ];
    const mapped = autoGuessColMap(headers, rows, false);
    expect(mapped.geo.role).toBe("geo");
    expect(mapped.meta_reach.role).toBe("reach");
    expect(mapped.meta_frequency.role).toBe("frequency");
    const withOptional = buildPanelFromColMap(headers, rows, mapped).panel;
    expect(withOptional.geoMode).toBe("geo-available");
    expect(withOptional.rfMode).toBe("rf-available");
    expect(withOptional.meridianInput).toMatchObject({ level: "geo", reach: true, frequency: true, fitMode: "mixed-spend-rf" });
    expect(withOptional.mediaInputMap.c_meta_spend).toMatchObject({ type: "reach-frequency", reachHeader: "meta_reach", frequencyHeader: "meta_frequency" });
    expect(withOptional.geoPanel).toHaveLength(1);
    expect(withOptional.geoPanel[0].targets.Regs).toEqual([100, 110]);

    const withoutOptionalHeaders = ["week", "regs", "meta_spend"];
    const withoutOptionalRows = rows.map(({ week, regs, meta_spend }) => ({ week, regs, meta_spend }));
    const withoutOptionalMap = autoGuessColMap(withoutOptionalHeaders, withoutOptionalRows, false);
    const fallback = buildPanelFromColMap(withoutOptionalHeaders, withoutOptionalRows, withoutOptionalMap).panel;
    expect(colMapMissing(withoutOptionalHeaders, withoutOptionalMap)).toEqual([]);
    expect(fallback.geoMode).toBe("national-fallback");
    expect(fallback.rfMode).toBe("spend-only");
    expect(fallback.meridianInput).toMatchObject({ level: "national", reach: false, frequency: false });
  });

  it("prioritizes explicit spend/cost names over embedded target words", () => {
    const headers = ["date", "signup_spend", "revenue_campaign_cost", "traffic_spend", "revenue"];
    const rows = [{ date: "2025-01-06", signup_spend: "100", revenue_campaign_cost: "200", traffic_spend: "300", revenue: "500" }];
    const partial = autoGuessColMap(headers, rows);
    expect(partial.signup_spend.role).toBe("channel");
    expect(partial.revenue_campaign_cost.role).toBe("channel");
    expect(partial.traffic_spend.role).toBe("channel");
    expect(partial.revenue.role).toBe("revenue");
  });

  it("maps OS Paid RR separately from Total RR and preserves the identity inputs", () => {
    const headers = ["week", "ANDROID_RR", "IOS_RR", "ANDROID PAID RR", "IOS PAID RR", "Google_ANDROID_Cost", "Apple Search Ads_IOS_Cost"];
    const rows = [
      { week: "2025-W01", ANDROID_RR: "100", IOS_RR: "80", "ANDROID PAID RR": "30", "IOS PAID RR": "20", Google_ANDROID_Cost: "50", "Apple Search Ads_IOS_Cost": "40" },
      { week: "2025-W02", ANDROID_RR: "110", IOS_RR: "90", "ANDROID PAID RR": "35", "IOS PAID RR": "25", Google_ANDROID_Cost: "60", "Apple Search Ads_IOS_Cost": "45" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.ANDROID_RR).toMatchObject({ role: "reg", plat: "android" });
    expect(map.IOS_RR).toMatchObject({ role: "reg", plat: "ios" });
    expect(map["ANDROID PAID RR"]).toMatchObject({ role: "paid", plat: "android" });
    expect(map["IOS PAID RR"]).toMatchObject({ role: "paid", plat: "ios" });
    const android = buildPanelFromColMap(headers, rows, map, "android").panel;
    const total = buildPanelFromColMap(headers, rows, map, "all").panel;
    expect(android.targets.Regs).toEqual([100, 110]);
    expect(android.targets.PaidRegs).toEqual([30, 35]);
    expect(total.targets.Regs).toEqual([180, 200]);
    expect(total.targets.PaidRegs).toEqual([50, 60]);
    expect(android.targets.Regs.map((value, index) => value - android.targets.PaidRegs[index])).toEqual([70, 75]);
  });

  it("keeps Prism-style RR and performance delivery columns in partial auto mapping", () => {
    const headers = ["Week of", "RR", "brand_tiktok_impressions", "performance_meta_impressions", "performance_tiktok_impressions", "Christmas", "cold april record"];
    const rows = [
      { "Week of": "2022-01-03", RR: "65,621", brand_tiktok_impressions: "12,000", performance_meta_impressions: "4,500", performance_tiktok_impressions: "7,000", Christmas: "0", "cold april record": "1" },
      { "Week of": "2022-01-10", RR: "58,710", brand_tiktok_impressions: "10,000", performance_meta_impressions: "5,000", performance_tiktok_impressions: "6,500", Christmas: "1", "cold april record": "0" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map["Week of"].role).toBe("week");
    expect(map.RR.role).toBe("reg");
    expect(map.brand_tiktok_impressions).toMatchObject({ role: "channel", kind: "brand" });
    expect(map.performance_meta_impressions).toMatchObject({ role: "channel", kind: "perf" });
    expect(map.performance_tiktok_impressions).toMatchObject({ role: "channel", kind: "perf" });
    expect(map.Christmas).toMatchObject({ role: "dummy" });
    expect(map["cold april record"]).toMatchObject({ role: "dummy" });
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.targets.Regs).toEqual([65_621, 58_710]);
    expect(panel.channels.map((channel) => channel.label)).toEqual([
      "brand_tiktok_impressions",
      "performance_meta_impressions",
      "performance_tiktok_impressions",
    ]);
    expect(panel.channelValueSemantics).toBe("cost");
    expect(panel.channelCostHeaders).toEqual([
      "brand_tiktok_impressions",
      "performance_meta_impressions",
      "performance_tiktok_impressions",
    ]);
    expect(isOperationalDeliveryCostHeader("performance_meta_impressions")).toBe(true);
    expect(isOperationalDeliveryCostHeader("performance_meta_clicks")).toBe(false);
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
    const operationalSteps = autoGuessColMap(
      ["week", "IOS Delist", "IOS Reopen", "Liveness Check"],
      [
        { week: "2025-W01", "IOS Delist": "0", "IOS Reopen": "0", "Liveness Check": "0" },
        { week: "2025-W02", "IOS Delist": "1", "IOS Reopen": "0", "Liveness Check": "1" },
      ],
    );
    expect(operationalSteps["IOS Delist"]).toMatchObject({ role: "step", plat: "ios", stepMode: "state" });
    expect(operationalSteps["IOS Reopen"]).toMatchObject({ role: "step", plat: "ios", stepMode: "boundary" });
    expect(operationalSteps["Liveness Check"]).toMatchObject({ role: "step", plat: "common", stepMode: "boundary" });
    const stepRows = [
      { week: "2025-W04", IOS_RR: "75", IOS_Cost: "25", "IOS Delist": "0", "IOS Reopen": "1", "Liveness Check": "0" },
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", "IOS Delist": "0", "IOS Reopen": "0", "Liveness Check": "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", "IOS Delist": "0", "IOS Reopen": "0", "Liveness Check": "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", "IOS Delist": "1", "IOS Reopen": "0", "Liveness Check": "1" },
    ];
    const stepHeaders = Object.keys(stepRows[0]);
    const stepMap = autoGuessColMap(stepHeaders, stepRows);
    const stepPanel = buildPanelFromColMap(stepHeaders, stepRows, stepMap, "ios").panel;
    const stepValues = (label) => stepPanel.steps[stepPanel.stepDefs.find((step) => step.label === label).key];
    expect(stepValues("IOS Delist")).toEqual([0, 1, 1, 0]);
    expect(stepValues("IOS Reopen")).toEqual([0, 0, 0, 1]);
    expect(stepValues("Liveness Check")).toEqual([0, 1, 1, 1]);
    expect(stepPanel.operationalStepIntervals).toMatchObject([{
      platform: "ios",
      shutdownLabel: "IOS Delist",
      reopenLabel: "IOS Reopen",
      startIndex: 1,
      reopenIndex: 3,
    }]);
    expect(stepPanel.stepDefs.find((step) => step.label === "IOS Delist")).toMatchObject({ autoDerivedInterval: true });
    const warningRows = Array.from({ length: 20 }, (_, index) => ({
      week: `2025-W${String(index + 1).padStart(2, "0")}`,
      IOS_RR: "80",
      IOS_Cost: index >= 12 ? "30" : "0",
      "IOS Delist": index === 10 ? "1" : "0",
      "IOS Reopen": index === 14 ? "1" : "0",
    }));
    const warningHeaders = Object.keys(warningRows[0]);
    const warningMap = autoGuessColMap(warningHeaders, warningRows);
    const warnings = mmmForecastInputWarnings(warningHeaders, warningRows, warningMap, "ko");
    expect(warnings.some((warning) => warning.includes("운영 중단 상태를 2025-W11부터 2025-W15 직전까지 1로 자동 생성"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("상태열이 1개 기간에만 1"))).toBe(false);
    expect(warnings.some((warning) => warning.includes("Cost 커버리지가 뒤늦게 시작"))).toBe(true);
    const wideTargets = autoGuessColMap(
      ["week", "ANDROID_RR", "IOS_RR", "Google_ANDROID_Cost", "Apple Search Ads_IOS_Cost"],
      [{ week: "2025-W01", ANDROID_RR: "100", IOS_RR: "80", Google_ANDROID_Cost: "20", "Apple Search Ads_IOS_Cost": "30" }],
    );
    expect(wideTargets.ANDROID_RR).toMatchObject({ role: "reg", plat: "android" });
    expect(wideTargets.IOS_RR).toMatchObject({ role: "reg", plat: "ios" });
  });

  it("preserves an explicitly supplied shutdown state series", () => {
    const headers = ["week", "IOS_RR", "IOS_Cost", "IOS Delist", "IOS Reopen"];
    const rows = [
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", "IOS Delist": "0", "IOS Reopen": "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", "IOS Delist": "1", "IOS Reopen": "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", "IOS Delist": "1", "IOS Reopen": "0" },
      { week: "2025-W04", IOS_RR: "19", IOS_Cost: "5", "IOS Delist": "1", "IOS Reopen": "0" },
      { week: "2025-W05", IOS_RR: "75", IOS_Cost: "25", "IOS Delist": "0", "IOS Reopen": "1" },
    ];
    const autoMap = autoGuessColMap(headers, rows);
    const autoPanel = buildPanelFromColMap(headers, rows, autoMap, "ios").panel;
    const autoDelistKey = autoPanel.stepDefs.find((step) => step.label === "IOS Delist").key;
    expect(autoPanel.steps[autoDelistKey]).toEqual([0, 1, 1, 1, 0]);
    expect(autoPanel.operationalStepIntervals).toEqual([]);

    const manualMap = {
      week: { role: "week" },
      IOS_RR: { role: "reg", plat: "ios" },
      IOS_Cost: { role: "channel", plat: "ios" },
      "IOS Delist": { role: "step", plat: "ios", stepMode: "state" },
      "IOS Reopen": { role: "step", plat: "ios", stepMode: "boundary" },
    };
    const panel = buildPanelFromColMap(headers, rows, manualMap, "ios").panel;
    const delistKey = panel.stepDefs.find((step) => step.label === "IOS Delist").key;
    expect(panel.steps[delistKey]).toEqual([0, 1, 1, 1, 0]);
    expect(panel.operationalStepIntervals).toEqual([]);
    expect(panel.stepDefs.find((step) => step.label === "IOS Delist")).toMatchObject({ autoDerivedInterval: false });
  });

  it("does not guess across platforms or ambiguous operational boundary pairs", () => {
    const ambiguousRows = [
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", "IOS Delist A": "0", "IOS Delist B": "0", "IOS Reopen": "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", "IOS Delist A": "1", "IOS Delist B": "0", "IOS Reopen": "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", "IOS Delist A": "0", "IOS Delist B": "1", "IOS Reopen": "0" },
      { week: "2025-W04", IOS_RR: "75", IOS_Cost: "25", "IOS Delist A": "0", "IOS Delist B": "0", "IOS Reopen": "1" },
    ];
    const ambiguousHeaders = Object.keys(ambiguousRows[0]);
    const ambiguousMap = autoGuessColMap(ambiguousHeaders, ambiguousRows);
    const ambiguousPanel = buildPanelFromColMap(ambiguousHeaders, ambiguousRows, ambiguousMap, "ios").panel;
    const stepValues = (label) => ambiguousPanel.steps[ambiguousPanel.stepDefs.find((step) => step.label === label).key];
    expect(stepValues("IOS Delist A")).toEqual([0, 1, 0, 0]);
    expect(stepValues("IOS Delist B")).toEqual([0, 0, 1, 0]);
    expect(ambiguousPanel.operationalStepIntervals).toEqual([]);
    expect(mmmForecastInputWarnings(ambiguousHeaders, ambiguousRows, ambiguousMap, "ko"))
      .toEqual(expect.arrayContaining([expect.stringContaining("운영 중단·재개 경계가 여러 개라 자동 연결하지 않았습니다")]));
    expect(mmmForecastInputWarnings(ambiguousHeaders, ambiguousRows, ambiguousMap, "en"))
      .toEqual(expect.arrayContaining([expect.stringContaining("operational boundaries are ambiguous")]));

    const crossRows = [
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", "IOS Delist": "0", "Android Reopen": "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", "IOS Delist": "1", "Android Reopen": "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", "IOS Delist": "0", "Android Reopen": "1" },
    ];
    const crossHeaders = Object.keys(crossRows[0]);
    const crossMap = autoGuessColMap(crossHeaders, crossRows);
    const crossPanel = buildPanelFromColMap(crossHeaders, crossRows, crossMap, "ios").panel;
    const crossDelistKey = crossPanel.stepDefs.find((step) => step.label === "IOS Delist").key;
    expect(crossPanel.steps[crossDelistKey]).toEqual([0, 1, 0]);
    expect(crossPanel.operationalStepIntervals).toEqual([]);
    expect(mmmForecastInputWarnings(crossHeaders, crossRows, crossMap, "ko"))
      .toEqual(expect.arrayContaining([expect.stringContaining("같은 플랫폼의 명확한 후속 재개 pulse가 없습니다")]));
  });

  it.each([
    ["IOS Campaign Shutdown", "Campaign IOS Reopen"],
    ["iOS 캠페인 중단", "캠페인 iOS 재개"],
  ])("pairs related shutdown/reopen entities for %s", (shutdownHeader, reopenHeader) => {
    const rows = [
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", [shutdownHeader]: "0", [reopenHeader]: "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", [shutdownHeader]: "1", [reopenHeader]: "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", [shutdownHeader]: "0", [reopenHeader]: "0" },
      { week: "2025-W04", IOS_RR: "75", IOS_Cost: "25", [shutdownHeader]: "0", [reopenHeader]: "1" },
    ];
    const headers = Object.keys(rows[0]);
    const map = autoGuessColMap(headers, rows);
    const panel = buildPanelFromColMap(headers, rows, map, "ios").panel;
    const shutdownKey = panel.stepDefs.find((step) => step.label === shutdownHeader).key;
    expect(panel.steps[shutdownKey]).toEqual([0, 1, 1, 0]);
    expect(panel.operationalStepIntervals).toEqual([expect.objectContaining({
      platform: "ios",
      shutdownLabel: shutdownHeader,
      reopenLabel: reopenHeader,
      startIndex: 1,
      reopenIndex: 3,
    })]);
  });

  it.each([
    ["IOS Campaign Shutdown", "IOS Service Reopen"],
    ["iOS 캠페인 종료", "iOS 서비스 재개"],
  ])("keeps unrelated shutdown/reopen entities separate for %s", (shutdownHeader, reopenHeader) => {
    const rows = [
      { week: "2025-W01", IOS_RR: "80", IOS_Cost: "30", [shutdownHeader]: "0", [reopenHeader]: "0" },
      { week: "2025-W02", IOS_RR: "20", IOS_Cost: "5", [shutdownHeader]: "1", [reopenHeader]: "0" },
      { week: "2025-W03", IOS_RR: "18", IOS_Cost: "5", [shutdownHeader]: "0", [reopenHeader]: "0" },
      { week: "2025-W04", IOS_RR: "75", IOS_Cost: "25", [shutdownHeader]: "0", [reopenHeader]: "1" },
    ];
    const headers = Object.keys(rows[0]);
    const map = autoGuessColMap(headers, rows);
    const panel = buildPanelFromColMap(headers, rows, map, "ios").panel;
    const shutdownKey = panel.stepDefs.find((step) => step.label === shutdownHeader).key;
    const reopenKey = panel.stepDefs.find((step) => step.label === reopenHeader).key;
    expect(panel.steps[shutdownKey]).toEqual([0, 1, 0, 0]);
    expect(panel.steps[reopenKey]).toEqual([0, 0, 0, 1]);
    expect(panel.operationalStepIntervals).toEqual([]);
    expect(mmmForecastInputWarnings(headers, rows, map, "ko"))
      .toEqual(expect.arrayContaining([expect.stringContaining("중단·재개 헤더의 대상 이름이 달라 별도 경계로 유지")]));
    expect(mmmForecastInputWarnings(headers, rows, map, "en"))
      .toEqual(expect.arrayContaining([expect.stringContaining("refer to different entities, so they remain separate boundaries")]));
  });

  it("uses OS-specific industry demand for OS models and a summed control for Total", () => {
    const headers = ["week", "android_regs", "ios_regs", "android_cost", "ios_cost", "dating_market_downloads_android", "dating_market_downloads_ios"];
    const rows = [
      { week: "2025-W01", android_regs: "100", ios_regs: "80", android_cost: "20", ios_cost: "30", dating_market_downloads_android: "1000", dating_market_downloads_ios: "700" },
      { week: "2025-W02", android_regs: "110", ios_regs: "70", android_cost: "25", ios_cost: "35", dating_market_downloads_android: "1100", dating_market_downloads_ios: "650" },
    ];
    const map = autoGuessColMap(headers, rows, false);
    expect(map.dating_market_downloads_android).toMatchObject({ role: "external", plat: "android" });
    expect(map.dating_market_downloads_ios).toMatchObject({ role: "external", plat: "ios" });
    const android = buildPanelFromColMap(headers, rows, map, "android").panel;
    const ios = buildPanelFromColMap(headers, rows, map, "ios").panel;
    const total = buildPanelFromColMap(headers, rows, map, "all").panel;
    expect(android.external.c_dating_market_downloads_android).toEqual([1000, 1100]);
    expect(ios.external.c_dating_market_downloads_ios).toEqual([700, 650]);
    expect(android.externalDefs[0].label).toBe("dating_market_downloads_android");
    expect(total.external.c_dating_market_downloads_total).toEqual([1700, 1750]);
    expect(total.externalDefs).toEqual([expect.objectContaining({
      key: "c_dating_market_downloads_total",
      label: "dating market downloads (Android + iOS)",
      isPlatformAggregate: true,
      sourceHeaders: ["dating_market_downloads_android", "dating_market_downloads_ios"],
    })]);
  });

  it("maps the published MMM template's control roles without treating them as media", () => {
    const headers = ["date", "revenue", "google_spend", "market_index", "event_dummy", "regime_step"];
    const rows = [
      { date: "2025-01-06", revenue: "100", google_spend: "20", market_index: "98", event_dummy: "0", regime_step: "0" },
      { date: "2025-01-13", revenue: "110", google_spend: "25", market_index: "101", event_dummy: "1", regime_step: "1" },
    ];
    const map = autoGuessColMap(headers, rows, false);
    expect(map.market_index.role).toBe("external");
    expect(map.event_dummy.role).toBe("dummy");
    expect(map.regime_step.role).toBe("step");
    expect(map.google_spend.role).toBe("channel");
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

  it("groups daily MMM input by the selected Sunday or Monday week start", () => {
    const headers = ["date", "regs", "spend"];
    const map = { date: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const rows = Array.from({ length: 14 }, (_, day) => ({
      date: new Date(Date.UTC(2025, 0, 5 + day)).toISOString().slice(0, 10),
      regs: "10", spend: "20",
    }));
    const sunday = buildPanelFromColMap(headers, rows, map, "all", "ko", null, { weekStart: "sunday" }).panel;
    const monday = buildPanelFromColMap(headers, rows, map, "all", "ko", null, { weekStart: "monday" }).panel;
    expect(sunday.weekLabel).toEqual(["2025-01-05", "2025-01-12"]);
    expect(sunday.targets.Regs).toEqual([70, 70]);
    expect(monday.weekLabel).toEqual(["2025-01-06"]);
    expect(monday.targets.Regs).toEqual([70]);
    expect(monday.timeDiagnostics.boundaryPartialWeeks).toBe(2);
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

  it("sums channel-attributed targets when long data includes an Organic row", () => {
    const headers = ["week", "platform", "channel", "cost", "regs"];
    const rows = [
      { week: "2025-W01", platform: "android", channel: "Organic", cost: "0", regs: "70" },
      { week: "2025-W01", platform: "android", channel: "Meta", cost: "100", regs: "20" },
      { week: "2025-W01", platform: "android", channel: "Google", cost: "80", regs: "10" },
      { week: "2025-W02", platform: "android", channel: "Organic", cost: "0", regs: "80" },
      { week: "2025-W02", platform: "android", channel: "Meta", cost: "120", regs: "15" },
      { week: "2025-W02", platform: "android", channel: "Google", cost: "0", regs: "5" },
    ];
    const map = autoGuessColMap(headers, rows);
    const panel = buildPanelFromColMap(headers, rows, map, "android").panel;
    expect(panel.targets.Regs).toEqual([100, 100]);
    expect(panel.ch.c_mmm_spend_organic).toBeUndefined();
    expect(panel.ch.c_mmm_spend_meta).toEqual([100, 120]);
    expect(panel.ch.c_mmm_spend_google).toEqual([80, 0]);
    expect(panel.timeDiagnostics.issues.some((issue) => issue.code === "conflicting-long-repeated-value")).toBe(false);
    expect(panel.timeDiagnostics.warnings.find((warning) => warning.code === "attributed-long-target")?.headers).toEqual(["regs"]);
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

  it("preserves monthly calendar input as consecutive months instead of inventing missing weeks", () => {
    const headers = ["dt", "regs", "spend"];
    const rows = Array.from({ length: 6 }, (_, index) => ({
      dt: `2026-${String(index + 1).padStart(2, "0")}-15`,
      regs: String(100 + index * 10),
      spend: String(1000 + index * 100),
    }));
    const map = { dt: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map, "all", "ko", null, { periodUnit: "monthly" }).panel;
    expect(panel.weekLabel).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"]);
    expect(panel.calendarGaps).toMatchObject({ count: 0, unit: "monthly" });
    expect(panel.granularity).toEqual({ months: 1, unit: "monthly" });
    expect(mmmValidate(panel, "ko", "Regs").issues).toEqual([]);
  });

  // 주간은 잘린 경계 주를 찾아 드롭하지만(boundaryPartialWeeks), 월 단위 입력은
  // 하루치 커버리지가 관측되지 않아 같은 판정을 할 수 없다. 판별 못 하는 것을
  // 조용히 넘기지 않고 사유로 남기는지 고정한다(§8).
  it("flags that monthly-grain input cannot verify boundary-month completeness", () => {
    const headers = ["dt", "regs", "spend"];
    const rows = Array.from({ length: 6 }, (_, index) => ({
      dt: `2026-${String(index + 1).padStart(2, "0")}-15`,
      regs: String(100 + index * 10),
      spend: String(1000 + index * 100),
    }));
    const map = { dt: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map, "all", "ko", null, { periodUnit: "monthly" }).panel;

    expect(panel.timeDiagnostics.monthlyBoundaryUnverified).toBe(true);
    const warning = panel.timeDiagnostics.warnings.find((item) => item.code === "unverified-monthly-boundary");
    expect(warning?.messageKo).toContain("완결된 달인지 확인할 수 없습니다");
    expect(warning?.messageEn).toContain("cannot confirm");
  });

  it("does not raise the monthly boundary caveat on weekly input", () => {
    const headers = ["dt", "regs", "spend"];
    const rows = Array.from({ length: 28 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 5 + index));
      return { dt: day.toISOString().slice(0, 10), regs: String(100 + index), spend: String(1000 + index) };
    });
    const map = { dt: { role: "date" }, regs: { role: "reg" }, spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map, "all", "ko", null, { weekStart: "monday" }).panel;

    expect(panel.timeDiagnostics.monthlyBoundaryUnverified).toBe(false);
    expect(panel.timeDiagnostics.warnings.some((item) => item.code === "unverified-monthly-boundary")).toBe(false);
  });
});
