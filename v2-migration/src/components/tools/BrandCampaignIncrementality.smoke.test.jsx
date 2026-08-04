// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import BrandCampaignIncrementality from "@/components/tools/BrandCampaignIncrementality";
import { useAppStore } from "@/store/useDataStore";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

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
    expect(() => render(<BrandCampaignIncrementality />)).not.toThrow();
    expect(screen.getByText("어떤 데이터를 준비했나요?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /통제군 증분 분석 열기/ }).getAttribute("href")).toBe("/tools/incrementality");
    expect(useAppStore.getState().csvData.raw).toEqual([]);
  });
});
