// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AnalysisEligibilityList from "@/components/data-import/AnalysisEligibilityList";

describe("AnalysisEligibilityList", () => {
  it("shows one honest empty state when every analysis is blocked", () => {
    const results = ["5-2", "5-25"].map((toolId) => ({
      toolId,
      status: "blocked",
      rowCount: 1,
      periodCount: 1,
      blockers: [{ code: "min_rows", required: 10, current: 1 }],
    }));
    render(<AnalysisEligibilityList results={results} getTitle={(id) => `Tool ${id}`} onOpen={vi.fn()} />);

    expect(screen.getByText("지금 바로 실행할 분석은 없습니다")).toBeTruthy();
    expect(screen.queryByText("먼저 보기")).toBeNull();
    expect(screen.getAllByText("Tool 5-2")).toHaveLength(1);
    expect(screen.getAllByText("Tool 5-25")).toHaveLength(1);
  });
});
