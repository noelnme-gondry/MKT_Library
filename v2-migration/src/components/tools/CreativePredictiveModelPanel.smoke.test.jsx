// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import CreativePredictiveModelPanel from "@/components/tools/CreativePredictiveModelPanel";

function creativeFixture() {
  return Array.from({ length: 73 }, (_, index) => ({
    creative_id: `creative_${index + 1}`,
    channel: index % 4 < 2 ? "Meta" : "Google",
    hook_type: ["question", "proof", "offer"][index % 3],
    format: index % 2 ? "video" : "static",
    impressions: 10000 + index * 31,
    clicks: 280 + (index % 11) * 17,
    ctr: 0.025 + (index % 13) * 0.001,
  }));
}

describe("CreativePredictiveModelPanel smoke", () => {
  it("withholds RF and SVM honestly when the creative-level sample and production features are insufficient", () => {
    render(<CreativePredictiveModelPanel
      metrics={creativeFixture()}
      attributes={["hook_type", "format"]}
      metric="ctr"
      mappedKeys={new Set(["creative_id", "channel", "hook_type", "format", "impressions", "clicks"])}
      signature="demo-73"
    />);

    expect(screen.getByRole("heading", { name: /예측 모델 비교와 설명력 분해/ })).toBeTruthy();
    expect(screen.getByText("73")).toBeTruthy();
    expect(screen.getAllByText("데이터 기준 미달")).toHaveLength(2);
    expect(screen.getByText(/SVM은 독립 소재/)).toBeTruthy();
    expect(screen.getByText(/개별 소재 SHAP 값이나 인과 기여도가 아닙니다/)).toBeTruthy();
    expect(screen.queryByText(/동일 검증 성능/)).toBeNull();
  });

  it("keeps the same eligibility disclosure in English", () => {
    render(<CreativePredictiveModelPanel
      metrics={creativeFixture()}
      attributes={["hook_type", "format"]}
      metric="ctr"
      mappedKeys={new Set(["creative_id", "channel", "hook_type", "format", "impressions", "clicks"])}
      signature="demo-73-en"
      locale="en"
    />);

    expect(screen.getByRole("heading", { name: /Predictive model comparison/ })).toBeTruthy();
    expect(screen.getAllByText("Below data threshold")).toHaveLength(2);
    expect(screen.getByText(/not per-creative SHAP or causal contribution/)).toBeTruthy();
  });
});
