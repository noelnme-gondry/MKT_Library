import { describe, expect, it } from "vitest";
import { buildRootMetadata } from "./siteMetadata";

describe("localized root metadata", () => {
  it.each([
    ["ko", "ko_KR", "마케팅"],
    ["en", "en_US", "Marketing"],
  ])("builds a complete %s metadata base", (locale, ogLocale, titleWord) => {
    const metadata = buildRootMetadata(locale);
    expect(metadata.title.default).toContain(titleWord);
    expect(metadata.openGraph).toMatchObject({ siteName: "Growth Opt Playbook", locale: ogLocale });
    expect(metadata.metadataBase.toString()).toBe("https://growthoptplaybook.com/");
  });
});
