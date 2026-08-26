import { describe, expect, it } from "vitest";
import { mmmControlFitRows } from "@/utils/mmmControlContract";
import { mmmValidate } from "@/utils/mmmMath";

describe("MMM continuous-control contract", () => {
  it("blocks missing control weeks and warns on non-informative control shapes", () => {
    const panel = {
      week: [1, 2, 3],
      targets: { Revenue: [100, 110, 120] },
      channels: [{ key: "paid", label: "Paid" }],
      ch: { paid: [10, 12, 14] },
      dummy: {},
      steps: {},
      external: { market: [100, NaN, 120], constant: [5, 5, 5], promo: [0, 1, 0] },
      externalDefs: [
        { key: "market", label: "Market demand" },
        { key: "constant", label: "Price index" },
        { key: "promo", label: "Promotion flag" },
      ],
    };
    const result = mmmValidate(panel, "en", "Revenue");
    expect(result.issues).toContain("Continuous control 'Market demand' has 1 missing week(s). Supply the observed value or unmap the control; the model does not impute controls.");
    expect(result.warnings).toContain("Continuous control 'Price index' has no variation and will be excluded from the fit.");
    expect(result.warnings).toContain("Continuous control 'Promotion flag' has only two values. Map a 0/1 event as an event dummy unless this is truly a continuous level.");
  });

  it("separates included controls from rank-dropped controls", () => {
    const panel = { externalDefs: [{ key: "market", label: "Market" }, { key: "price", label: "Price" }] };
    const run = {
      names: ["industry_market", "ln_paid"],
      droppedFeatures: ["industry_price"],
      externalTransforms: { market: { mode: "log-relative", reference: 100 } },
    };
    expect(mmmControlFitRows(panel, run)).toEqual([
      expect.objectContaining({ key: "market", status: "included", transformMode: "log-relative", reference: 100 }),
      expect.objectContaining({ key: "price", status: "dropped-collinear" }),
    ]);
  });
});
