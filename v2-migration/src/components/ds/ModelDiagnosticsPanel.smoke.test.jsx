// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { REG_STATS } from "@/utils/regMath";
import ModelDiagnosticsPanel from "@/components/ds/ModelDiagnosticsPanel";

function fixture() {
  const X = Array.from({ length: 24 }, (_, i) => [1, i, (i * 7) % 5]);
  const y = X.map((row, i) => 4 + 1.5 * row[1] - 0.8 * row[2] + ((i % 4) - 2) * 0.25);
  return { X, fit: REG_STATS.ols(X, y) };
}

describe("ModelDiagnosticsPanel smoke", () => {
  it("mounts all four diagnostic charts for a declared OLS capability", () => {
    const { X, fit } = fixture();
    expect(() => render(<ModelDiagnosticsPanel scope="9-1:ols" fit={fit} X={X} labels={["Intercept", "x", "z"]} />)).not.toThrow();
    expect(screen.getByText("모델 신뢰도 점검")).toBeTruthy();
    expect(document.querySelectorAll(".analyst-model-diagnostics canvas")).toHaveLength(4);
  });

  it("does not render diagnostics for an undeclared estimator capability", () => {
    const { X, fit } = fixture();
    const { container } = render(<ModelDiagnosticsPanel scope="5-21:pvm" fit={fit} X={X} />);
    expect(container.textContent).toBe("");
  });
});
