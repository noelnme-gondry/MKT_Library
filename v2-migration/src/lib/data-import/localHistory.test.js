import { describe, expect, it } from "vitest";
import { sheetSourceOverflowIds } from "@/lib/data-import/localHistory";

describe("sheetSourceOverflowIds", () => {
  it("keeps the five newest saved Sheet sources and removes older records", () => {
    const sources = Array.from({ length: 7 }, (_, index) => ({
      id: `source-${index + 1}`,
      updatedAt: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    expect(sheetSourceOverflowIds(sources)).toEqual(["source-2", "source-1"]);
  });
});
