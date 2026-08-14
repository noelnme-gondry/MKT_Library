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
    const { container } = render(<BrandCampaignIncrementality />);
    expect(screen.getByText("어떤 데이터를 준비했나요?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /통제군 증분 분석 열기/ }).getAttribute("href")).toBe("/tools/incrementality");
    expect(container.querySelector("#brand-its-setup")).toBeTruthy();
    expect(useAppStore.getState().csvData.raw).toEqual([]);
  });

  // 위 beforeEach는 csvGroups 슬라이스를 직접 주입해 실제 진입 경로를 우회한다.
  // 사용자는 setCurrentRouteId만 거치므로, 그 경로로도 미러가 살아 있어야 한다
  // (슬라이스 누락 시 csvData=undefined → csvData.headers 렌더 throw).
  it("mounts after a real route navigation without a pre-seeded slice", () => {
    useAppStore.setState({ currentRouteId: "home", activeDataGroup: "efficiency", csvData: EMPTY });
    useAppStore.getState().setCurrentRouteId("5-24");
    expect(useAppStore.getState().csvData).toBeTruthy();
    expect(() => render(<BrandCampaignIncrementality />)).not.toThrow();
  });

  it("shows the deterministic demo result immediately", async () => {
    const { container } = render(<BrandCampaignIncrementality />);
    // 업로드 안내가 도구 자체 마크업에서 공용 CsvGuide로 바뀌면서 예시 버튼 라벨도
    // 다른 도구와 같아졌다. 문구 전체를 박아두면 공용 카피가 바뀔 때마다 깨지므로
    // 진입 지점만 특정한다.
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터/ }));
    await waitFor(() => expect(screen.getByText("95% AR(1) 프로파일 구간")).toBeTruthy());
    expect(container.querySelector("#brand-its-result")).toBeTruthy();
    expect(container.textContent).toContain("증분 방향을 판정하지 않습니다");
    expect(container.textContent).not.toContain("관찰상 증가 신호가 남습니다");
  });
});
