// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DashboardRecommendedViews from "./DashboardRecommendedViews";

const recommendations = [
  { tab: "funnel", rank: 1, title: "퍼널 진단", reason: "전환량이 변했습니다.", confidence: "high", confidenceLabel: "신뢰도 높음" },
  { tab: "anomaly", rank: 2, title: "이상탐지", reason: "일자별 급변을 확인하세요.", confidence: "medium", confidenceLabel: "신뢰도 보통" },
  { tab: "pacing", rank: 3, title: "페이싱", reason: "소진 속도를 확인하세요.", confidence: "medium", confidenceLabel: "신뢰도 보통" },
];

describe("DashboardRecommendedViews", () => {
  it("shows the ranked rationale and opens the selected view", () => {
    const onSelect = vi.fn();
    render(<DashboardRecommendedViews recommendations={recommendations} additional={[{ tab: "viz", title: "시각화" }]} label="행동 가능성 순서" onSelect={onSelect} />);

    expect(screen.getByRole("heading", { name: "이어서 확인할 분석" })).toBeTruthy();
    expect(screen.getByText("전환량이 변했습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /퍼널 진단/ }));
    expect(onSelect).toHaveBeenCalledWith(recommendations[0]);
    expect(screen.getByText("나머지 탭도 직접 보기")).toBeTruthy();
  });
});
