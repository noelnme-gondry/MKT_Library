// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

  it("withholds a directional verdict for an exploratory profile interval", async () => {
    const { container } = render(<BrandCampaignIncrementality />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 보기" }));
    fireEvent.click(screen.getByRole("button", { name: /증분 추정하기/ }));
    await waitFor(() => expect(screen.getByText("95% AR(1) 프로파일 구간")).toBeTruthy());
    expect(container.textContent).toContain("증분 방향을 판정하지 않습니다");
    expect(container.textContent).not.toContain("관찰상 증가 신호가 남습니다");
  });
});
