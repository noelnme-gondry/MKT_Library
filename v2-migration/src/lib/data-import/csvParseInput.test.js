import { describe, expect, it } from "vitest";
import { CsvImportPolicyError } from "./csvImportPolicy";
import { prepareCsvParseInput } from "./csvParseInput";

describe("prepareCsvParseInput", () => {
  it("limits the file before decoding and returns UTF-8 text for parsing", async () => {
    const bytes = new TextEncoder().encode("날짜,설치\n2026-01-01,12");
    const file = { size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
    await expect(prepareCsvParseInput(file)).resolves.toBe("날짜,설치\n2026-01-01,12");
  });

  it("retains File parsing as a fallback only when byte access is unavailable", async () => {
    const file = { size: 12, name: "legacy.csv", arrayBuffer: async () => { throw new Error("unsupported"); } };
    await expect(prepareCsvParseInput(file)).resolves.toBe(file);
  });

  it("does not read an oversized or empty file", async () => {
    const oversized = { size: 100 * 1024 * 1024 + 1, arrayBuffer: async () => { throw new Error("must not run"); } };
    await expect(prepareCsvParseInput(oversized)).rejects.toMatchObject({ name: CsvImportPolicyError.name, code: "csv_file_too_large" });
    await expect(prepareCsvParseInput({ size: 0 })).rejects.toMatchObject({ code: "csv_empty_file" });
  });
});
