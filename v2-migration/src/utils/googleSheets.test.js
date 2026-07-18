import { describe, it, expect } from "vitest";
import { parseGoogleSheetUrl, sheetValuesToTable, resolveSheetRange } from "./googleSheets.js";

describe("parseGoogleSheetUrl", () => {
  it("extracts spreadsheetId and gid from a standard edit URL", () => {
    const r = parseGoogleSheetUrl("https://docs.google.com/spreadsheets/d/1AbC-xyz_123/edit#gid=456789");
    expect(r).toEqual({ spreadsheetId: "1AbC-xyz_123", gid: "456789" });
  });

  it("extracts spreadsheetId with no gid (defaults to null)", () => {
    const r = parseGoogleSheetUrl("https://docs.google.com/spreadsheets/d/1AbC-xyz_123/edit");
    expect(r).toEqual({ spreadsheetId: "1AbC-xyz_123", gid: null });
  });

  it("returns null for non-sheet URLs", () => {
    expect(parseGoogleSheetUrl("https://example.com/foo")).toBeNull();
    expect(parseGoogleSheetUrl("")).toBeNull();
    expect(parseGoogleSheetUrl(null)).toBeNull();
  });
});

describe("sheetValuesToTable", () => {
  it("converts a 2D values array into PapaParse-shaped {headers, raw}", () => {
    const values = [
      ["date", "cost", "installs"],
      ["2026-07-01", "10000", "5"],
      ["2026-07-02", "12000", "6"],
    ];
    const { headers, raw } = sheetValuesToTable(values);
    expect(headers).toEqual(["date", "cost", "installs"]);
    expect(raw).toEqual([
      { date: "2026-07-01", cost: "10000", installs: "5" },
      { date: "2026-07-02", cost: "12000", installs: "6" },
    ]);
  });

  it("pads short rows with empty strings for missing trailing cells", () => {
    const values = [
      ["date", "cost", "installs"],
      ["2026-07-01", "10000"],
    ];
    const { raw } = sheetValuesToTable(values);
    expect(raw).toEqual([{ date: "2026-07-01", cost: "10000", installs: "" }]);
  });

  it("skips fully blank rows", () => {
    const values = [
      ["date", "cost"],
      ["2026-07-01", "10000"],
      ["", ""],
      ["2026-07-02", "12000"],
    ];
    const { raw } = sheetValuesToTable(values);
    expect(raw.length).toBe(2);
  });

  it("returns empty shape for empty/invalid input", () => {
    expect(sheetValuesToTable([])).toEqual({ headers: [], raw: [] });
    expect(sheetValuesToTable(null)).toEqual({ headers: [], raw: [] });
  });
});

describe("resolveSheetRange", () => {
  const sheetMeta = {
    sheets: [
      { properties: { sheetId: 0, title: "Sheet1" } },
      { properties: { sheetId: 456789, title: "효율 데이터" } },
    ],
  };

  it("resolves the first sheet when gid is not given", () => {
    expect(resolveSheetRange(sheetMeta, null)).toBe("Sheet1");
  });

  it("resolves the matching sheet by gid and quotes non-alnum names", () => {
    expect(resolveSheetRange(sheetMeta, "456789")).toBe("'효율 데이터'");
  });

  it("falls back to the first sheet when gid doesn't match any tab", () => {
    expect(resolveSheetRange(sheetMeta, "999")).toBe("Sheet1");
  });

  it("returns null when there are no sheets", () => {
    expect(resolveSheetRange({ sheets: [] }, null)).toBeNull();
    expect(resolveSheetRange(null, null)).toBeNull();
  });
});
