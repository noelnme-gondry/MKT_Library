// @vitest-environment jsdom
// EN-ready analysis tools must not silently fall back to Korean UI copy.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Dashboard from "@/components/Dashboard";
import BudgetAllocation from "@/components/tools/BudgetAllocation";
import AbTestHoldout from "@/components/tools/AbTestHoldout";
import CampaignPvm from "@/components/tools/CampaignPvm";
import MarketingEfficiency from "@/components/tools/MarketingEfficiency";
import Incrementality from "@/components/tools/Incrementality";
import AhaMomentFinder from "@/components/tools/AhaMomentFinder";
import CreativeAnalyzer from "@/components/tools/CreativeAnalyzer";
import ContentElementAnalyzer from "@/components/tools/ContentElementAnalyzer";
import ContentFreshness from "@/components/tools/ContentFreshness";
import MarketingResponse from "@/components/tools/MarketingResponse";
import CohortTab from "@/components/dashboard/CohortTab";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function resetStore() {
  const current = useAppStore.getState();
  useAppStore.setState({
    csvData: EMPTY_CSV,
    csvGroups: Object.fromEntries(Object.keys(current.csvGroups || {}).map((key) => [key, EMPTY_CSV])),
    currentRouteId: "5-2",
    dashboardTab: "viz",
  });
}

const EN_READY_SURFACES = [
  ["Dashboard", <Dashboard key="dashboard" locale="en" />],
  ["Budget allocation", <BudgetAllocation key="budget" locale="en" />],
  ["A/B holdout", <AbTestHoldout key="holdout" locale="en" />],
  ["Campaign PVM", <CampaignPvm key="pvm" locale="en" />],
  ["Marketing efficiency", <MarketingEfficiency key="efficiency" locale="en" />],
  ["Incrementality", <Incrementality key="incrementality" locale="en" />],
  ["Aha moment", <AhaMomentFinder key="aha" locale="en" />],
  ["Creative analyzer", <CreativeAnalyzer key="creative" locale="en" />],
  ["Content element analyzer", <ContentElementAnalyzer key="content-element" locale="en" />],
  ["Content freshness", <ContentFreshness key="content-freshness" locale="en" />],
  ["Marketing response", <MarketingResponse key="marketing-response" locale="en" />],
  ["Cohort analysis", <CohortTab key="cohort" locale="en" />],
];

describe("English analysis surfaces", () => {
  beforeEach(resetStore);
  afterEach(cleanup);

  it.each(EN_READY_SURFACES)("$0 has no Korean UI copy in its empty state", (_name, element) => {
    render(element);
    const text = document.body.textContent;
    const koreanCopy = Array.from(new Set(text.match(/[가-힣]+/g) || []));
    const contexts = koreanCopy.map((value) => text.slice(Math.max(0, text.indexOf(value) - 36), text.indexOf(value) + value.length + 48));
    expect(koreanCopy, `${_name}: ${contexts.join(" | ")}`).toEqual([]);
  });
});
