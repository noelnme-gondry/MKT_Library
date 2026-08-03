import { describe, expect, it } from "vitest";
import { RESPONSE_SUBTOOL_IDS, getResponseSubtoolContent } from "./responseSubtoolContent";

describe("response subtool search content", () => {
  it.each(["ko", "en"])("keeps every %s landing unique and complete", (locale) => {
    const pages = RESPONSE_SUBTOOL_IDS.map((id) => getResponseSubtoolContent(id, locale));

    expect(new Set(pages.map((page) => page.h1)).size).toBe(RESPONSE_SUBTOOL_IDS.length);
    expect(new Set(pages.map((page) => page.title)).size).toBe(RESPONSE_SUBTOOL_IDS.length);
    for (const page of pages) {
      expect(page.intro).toBeTruthy();
      expect(page.sections).toHaveLength(3);
      expect(page.faq).toHaveLength(2);
    }
  });
});
