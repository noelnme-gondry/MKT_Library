import { describe, expect, it } from "vitest";
import { resolveResponseStage, responseStageHref } from "@/lib/responseStage";

describe("resolveResponseStage", () => {
  it("accepts only shareable 5-18 stages", () => {
    expect(resolveResponseStage("diagnose")).toBe("diagnose");
    expect(resolveResponseStage("mmm")).toBe("mmm");
    expect(resolveResponseStage("lab")).toBe("lab");
    expect(resolveResponseStage("hub")).toBe("hub");
  });

  it("falls back to the shared mapping hub", () => {
    expect(resolveResponseStage("unknown")).toBe("hub");
    expect(resolveResponseStage(null)).toBe("hub");
  });

  it("uses stable individual URLs for every independent analysis", () => {
    expect(responseStageHref("trend")).toBe("/tools/marketing-trend");
    expect(responseStageHref("diagnose", "en")).toBe("/en/tools/cannibalization-diagnosis");
    expect(responseStageHref("mmm")).toBe("/tools/mmm-contribution");
    expect(responseStageHref("lab")).toBe("/tools/marketing-forecast");
  });
});
