import { describe, expect, it } from "vitest";
import { categoricalAssociation, dunnHolm, gamesHowell, kruskalWallis, pairedTTest, welchAnova, welchTTest, wilcoxonRankSum, wilcoxonSignedRank } from "./groupComparisonMath";

describe("group comparison math", () => {
  it("uses Welch with its own degrees of freedom and an effect size", () => {
    const result = welchTTest([10, 12, 8, 11], [20, 22, 19, 23]);
    expect(result).toMatchObject({ ok: true, method: "welch_t_test" });
    expect(result.difference).toBeLessThan(0);
    expect(result.p).toBeLessThan(0.05);
    expect(result.effect.hedgesG).toBeLessThan(0);
  });

  it("keeps paired rows paired and refuses a constant paired difference", () => {
    expect(pairedTTest([10, 12, 14], [8, 8, 8])).toMatchObject({ ok: true, n: 3, difference: 4 });
    expect(pairedTTest([10, 12, 14], [9, 11, 13])).toEqual({ ok: false, reason: "constant_pair_difference", n: 3 });
  });

  it("uses an exact Mann-Whitney distribution only on the no-tie small-sample boundary", () => {
    const exact = wilcoxonRankSum([1, 2, 3], [4, 5, 6]);
    expect(exact).toMatchObject({ ok: true, pMethod: "exact", u: 0 });
    expect(exact.p).toBeCloseTo(0.1, 12);

    const ties = wilcoxonRankSum([1, 2, 2], [2, 3, 4]);
    expect(ties.pMethod).toBe("tie_corrected_normal_approximation");
  });

  it("uses exact signed ranks without ties and does not silently include zero differences", () => {
    const exact = wilcoxonSignedRank([2, 4, 6], [1, 2, 3]);
    expect(exact).toMatchObject({ ok: true, pMethod: "exact", n: 3, wPlus: 6 });
    expect(exact.p).toBeCloseTo(0.25, 12);
    expect(wilcoxonSignedRank([2, 4], [2, 4])).toEqual({ ok: false, reason: "all_pair_differences_zero" });
  });

  it("keeps Welch ANOVA and rank-based Kruskal/Dunn paths distinct", () => {
    const groups = [
      { name: "A", values: [1, 2, 3, 2, 1] },
      { name: "B", values: [10, 11, 9, 12, 10] },
      { name: "C", values: [20, 22, 21, 19, 20] },
    ];
    const anova = welchAnova(groups);
    const kruskal = kruskalWallis(groups);
    const dunn = dunnHolm(groups);
    expect(anova).toMatchObject({ ok: true, method: "welch_anova" });
    expect(anova.p).toBeLessThan(0.05);
    expect(kruskal).toMatchObject({ ok: true, method: "kruskal_wallis" });
    expect(kruskal.p).toBeLessThan(0.05);
    expect(dunn).toMatchObject({ ok: true, method: "dunn_holm", adjustment: "holm" });
    expect(dunn.pairs).toHaveLength(3);
    expect(dunn.pairs.some((pair) => pair.holmP < 0.05)).toBe(true);

    const gamesHowellResult = gamesHowell(groups);
    expect(gamesHowellResult).toMatchObject({ ok: true, method: "games_howell", familySize: 3 });
    expect(gamesHowellResult.pairs).toHaveLength(3);
    expect(gamesHowellResult.pairs.every((pair) => Number.isFinite(pair.p) && pair.p >= 0 && pair.p <= 1)).toBe(true);
    expect(gamesHowellResult.pairs.some((pair) => pair.p < 0.05)).toBe(true);
  });

  it("uses Fisher for a sparse 2×2 table and preserves Cramér's V with the table", () => {
    const sparse = categoricalAssociation([[1, 19], [8, 12]]);
    expect(sparse).toMatchObject({ ok: true, method: "fisher_exact_2x2", n: 40 });
    expect(sparse.fisher.pValue).toBeGreaterThan(0);
    expect(sparse.effect.cramersV).toBeGreaterThan(0);

    const general = categoricalAssociation([[30, 20, 10], [10, 20, 30]]);
    expect(general).toMatchObject({ ok: true, method: "chi_square", df: 2 });
    expect(general.expected).toEqual([[20, 20, 20], [20, 20, 20]]);
  });
});
