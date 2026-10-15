// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ContactAuthorProfile from "@/components/seo/ContactAuthorProfile";
import { AUTHOR, profilePageNode } from "@/lib/authorProfile";

describe("contact author profile", () => {
  it.each(["ko", "en"])("keeps the visible profile and ProfilePage node aligned (%s)", (locale) => {
    const { unmount } = render(<ContactAuthorProfile locale={locale} />);
    expect(screen.getByText(AUTHOR[locale].role)).toBeTruthy();
    expect(screen.getByText(AUTHOR[locale].bio)).toBeTruthy();

    const payload = profilePageNode(locale);
    expect(payload["@type"]).toBe("ProfilePage");
    expect(payload.mainEntity["@type"]).toBe("Person");
    expect(payload.mainEntity.description).toBe(AUTHOR[locale].bio);
    expect(payload.mainEntity.jobTitle).toBe(AUTHOR[locale].role);
    // Google ProfilePage는 dateModified를 DateTime으로 요구한다. 날짜만 쓰면
    // Search Console이 "datetime 값이 잘못됨"으로 표시한다(2026-10 경고).
    expect(payload.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/);
    expect(Number.isNaN(Date.parse(payload.dateModified))).toBe(false);
    unmount();
  });
});
