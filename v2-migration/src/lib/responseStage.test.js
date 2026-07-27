import { describe, expect, it } from "vitest";
import { resolveResponseStage } from "@/lib/responseStage";

describe("resolveResponseStage", () => {
  it("accepts only shareable 5-18 stages", () => {
    expect(resolveResponseStage("diagnose")).toBe("diagnose");
    expect(resolveResponseStage("mmm")).toBe("mmm");
    expect(resolveResponseStage("lab")).toBe("lab");
  });

  it("falls back to the required time-series first step", () => {
    expect(resolveResponseStage("unknown")).toBe("trend");
    expect(resolveResponseStage(null)).toBe("trend");
  });
});
