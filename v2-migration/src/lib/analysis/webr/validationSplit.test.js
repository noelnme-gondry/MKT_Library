import { expect, it } from "vitest";
import { buildValidationSplit, chronologicalDate } from "./validationSplit";

const y = Array.from({ length: 120 }, (_, index) => index % 7);
it("keeps every repeated unit on one side of each group fold", () => {
  const groups = y.map((_, index) => `item-${index % 12}`);
  const split = buildValidationSplit({ n: y.length, y, groups });
  expect(split.ok).toBe(true);
  for (let fold = 1; fold <= split.folds; fold += 1) {
    const train = new Set(groups.filter((_, index) => split.foldIds[index] !== fold));
    const test = groups.filter((_, index) => split.foldIds[index] === fold);
    expect(test.some((group) => train.has(group))).toBe(false);
  }
  expect(buildValidationSplit({ n: y.length, y: [...y].reverse(), groups }).foldIds).toEqual(split.foldIds);
});
it("holds out future dates and purges their units from past training", () => {
  const times = y.map((_, index) => new Date(Date.UTC(2026, 0, Math.floor(index / 6) + 1)).toISOString().slice(0, 10));
  const groups = y.map((_, index) => index < 6 || index >= 96 ? "shared" : `past-${index}`);
  const split = buildValidationSplit({ n: y.length, y, groups, times });
  expect(split).toMatchObject({ ok: true, mode: "time_group_holdout", validationN: 24, purgedN: 6 });
  const trainDates = times.filter((_, index) => split.foldIds[index] === 0);
  const testDates = times.filter((_, index) => split.foldIds[index] === 1);
  expect(trainDates.sort().at(-1) < testDates.sort()[0]).toBe(true);
  expect(groups.filter((_, index) => split.foldIds[index] === 0)).not.toContain("shared");
});
it("holds when purging leaves no independent training units", () => {
  const times = y.map((_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10));
  expect(buildValidationSplit({ n: y.length, y, groups: y.map((_, index) => index % 6), times })).toMatchObject({ ok: false, reason: "validation_support" });
  expect(buildValidationSplit({ n: y.length, y, groups: ["a"] })).toMatchObject({ ok: false, reason: "validation_alignment" });
});
it("does not normalize invalid calendar dates into a valid split", () => {
  expect(chronologicalDate("2026-02-30")).toBeNull();
  expect(chronologicalDate("2024-02-29")).not.toBeNull();
});
