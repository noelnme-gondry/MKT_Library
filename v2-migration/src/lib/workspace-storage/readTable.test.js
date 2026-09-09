import { describe, expect, it } from "vitest";
import { readStoredTable } from "./readTable";

describe("stored source restoration", () => {
  it("uses the upload decoder when restoring CP949 campaign values", async () => {
    const prefix = new TextEncoder().encode("Campaign,Cost\r\n");
    const suffix = new TextEncoder().encode(",100\r\n");
    const sourceBlob = new Blob([prefix, new Uint8Array([0xb0, 0xa1, 0xb3, 0xaa]), suffix]);
    const table = await readStoredTable({ sourceBlob, sourceKind: "csv", headers: ["Campaign", "Cost"] });
    expect(table.raw).toEqual([{ Campaign: "가나", Cost: "100" }]);
  });
  it("rejects malformed quoted sources before replacement", async () => {
    await expect(readStoredTable({ sourceBlob: new Blob(['Campaign,Cost\n"broken']), sourceKind: "csv", headers: ["Campaign", "Cost"] })).rejects.toThrow();
  });
});
