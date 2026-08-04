import { describe, expect, it } from "vitest";
import { openGraphBase, withOpenGraphBase } from "./openGraph";

describe("Open Graph metadata base", () => {
  it("keeps the shared site name and locale on child metadata", () => {
    expect(openGraphBase("ko")).toEqual({ siteName: "Growth Opt Playbook", locale: "ko_KR" });
    expect(withOpenGraphBase({ title: "English page" }, "en")).toEqual({
      siteName: "Growth Opt Playbook",
      locale: "en_US",
      title: "English page",
    });
  });

  it("allows an explicit route locale override", () => {
    expect(withOpenGraphBase({ locale: "en_GB" }, "en").locale).toBe("en_GB");
  });
});
