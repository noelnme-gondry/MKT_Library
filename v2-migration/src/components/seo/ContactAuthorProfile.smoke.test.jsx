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
    unmount();
  });
});
