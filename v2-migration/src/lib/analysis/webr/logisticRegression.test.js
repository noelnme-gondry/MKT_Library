import { describe, expect, it } from "vitest";
import {
  adjustBenjaminiHochberg,
  normalizeLogisticResult,
  prepareLogisticInput,
} from "./logisticRegression";

function supportedInput() {
  const X = Array.from({ length: 80 }, (_, index) => [1, index % 2, index % 5]);
  const y = Array.from({ length: 80 }, (_, index) => index % 4 < 2 ? 0 : 1);
  return { X, y, terms: ["(Intercept)", "hook", "length"] };
}

describe("WebR advanced logistic regression adapter", () => {
  it("requires enough minority outcomes for every fitted parameter", () => {
    const input = supportedInput();
    expect(prepareLogisticInput(input)).toMatchObject({ ok: true, classCounts: { zero: 40, one: 40 } });
    expect(prepareLogisticInput({ ...input, y: input.y.map((_, index) => index < 10 ? 1 : 0) })).toMatchObject({
      ok: false,
      reason: "insufficient_class_support",
      requiredMinority: 30,
    });
  });

  it("rejects non-binary outcomes before starting WebR", () => {
    const input = supportedInput();
    expect(prepareLogisticInput({ ...input, y: input.y.map((value, index) => index === 0 ? 0.5 : value) })).toEqual({
      ok: false,
      reason: "invalid_binary_input",
    });
  });

  it("computes monotone Benjamini-Hochberg adjusted p-values", () => {
    expect(adjustBenjaminiHochberg([0.01, 0.04, 0.03])).toEqual([0.03, 0.04, 0.04]);
  });

  it("maps safe R aliases back to user-facing terms and abstains on separation", () => {
    const input = prepareLogisticInput(supportedInput());
    const row = (term, estimate, pValue, separation = false) => ({
      term,
      estimate,
      std_error: 0.2,
      statistic: estimate / 0.2,
      p_value: pValue,
      ci_low: estimate - 0.4,
      ci_high: estimate + 0.4,
      odds_ratio: Math.exp(estimate),
      odds_ratio_low: Math.exp(estimate - 0.4),
      odds_ratio_high: Math.exp(estimate + 0.4),
      n: 80,
      aic: 91,
      pseudo_r2: 0.21,
      converged: true,
      separation,
    });
    const complete = normalizeLogisticResult([
      row("(Intercept)", -0.3, 0.2),
      row("x0", 0.8, 0.01),
      row("x1", -0.2, 0.4),
    ], input.terms, input);
    expect(complete.status).toBe("complete");
    expect(complete.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "hook", isSignificant: true }),
    ]));

    const unstable = normalizeLogisticResult([
      row("(Intercept)", -0.3, 0.2, true),
      row("x0", 0.8, 0.01, true),
      row("x1", -0.2, 0.4, true),
    ], input.terms, input);
    expect(unstable.status).toBe("unstable");
    expect(unstable.rows.every((item) => item.isSignificant === false)).toBe(true);
  });
});
