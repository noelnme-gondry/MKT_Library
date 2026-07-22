import { describe, expect, it } from "vitest";
import {
  MMM_METH_CONFIG,
  mmmCannibalization,
  mmmTrendExistence,
  mmmValidate,
} from "./mmmMath.js";

const korean = /[가-힣]/;

describe("MMM locale output", () => {
  const panel = {
    week: Array.from({ length: 40 }, (_, i) => i + 1),
    ch: { google: Array.from({ length: 40 }, (_, i) => 1000 + (i % 7) * 250) },
    targets: { Regs: Array.from({ length: 40 }, (_, i) => 5000 + i * 20) },
    channels: [{ key: "google", label: "Google", kind: "perf" }],
  };

  it("returns English validation warnings when locale is en", () => {
    const invalid = { ...panel, week: panel.week.map((value, i) => (i === 10 ? value + 2 : value)) };
    const warnings = mmmValidate(invalid, "en").warnings.join(" ");
    expect(warnings).not.toMatch(korean);
  });

  it("localizes trend and cannibalization verdicts", () => {
    const trend = mmmTrendExistence(panel, MMM_METH_CONFIG, "Regs", "en");
    const cannib = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Regs",
      { coef: -0.2, ci_lo: -0.4, ci_hi: -0.1, p: 0.01 },
      "google",
      "en",
    );
    expect(trend.verdict).not.toMatch(korean);
    expect(cannib.verdict).not.toMatch(korean);
  });
});
