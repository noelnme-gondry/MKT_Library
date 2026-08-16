import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import AuthorCard from "@/components/seo/AuthorCard";
import { AUTHOR, authorNode } from "@/lib/authorProfile";

describe("AuthorCard", () => {
  // 화면과 JSON-LD가 다른 소개를 말하면 그게 곧 신뢰도 훼손이다. 둘 다 SSOT에서
  // 나오는지 렌더 결과로 확인한다 — 카드에 문구를 따로 적으면 조용히 갈라진다.
  it.each(["ko", "en"])("SSOT의 이름·역할·소개를 그대로 보여준다 (%s)", (locale) => {
    render(<AuthorCard locale={locale} />);
    expect(screen.getByText(AUTHOR.name)).toBeTruthy();
    expect(screen.getByText(AUTHOR[locale].role)).toBeTruthy();
    expect(screen.getByText(AUTHOR[locale].bio)).toBeTruthy();
    // 같은 값이 구조화 데이터에도 들어간다.
    expect(authorNode(locale).description).toBe(AUTHOR[locale].bio);
    expect(authorNode(locale).jobTitle).toBe(AUTHOR[locale].role);
  });

  it("외부 프로필을 rel=me로 걸고 주소가 아니라 표시명을 앵커로 쓴다", () => {
    const { container } = render(<AuthorCard locale="ko" />);
    for (const url of AUTHOR.sameAs) {
      const anchor = container.querySelector(`a[href="${url}"]`);
      expect(anchor, `${url} 링크 없음`).toBeTruthy();
      expect(anchor.getAttribute("rel")).toContain("me");
      expect(anchor.textContent).not.toContain("https://");
      expect(anchor.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("EN 카드가 프로필을 /en으로 보낸다", () => {
    const { container } = render(<AuthorCard locale="en" />);
    expect(container.querySelector(`a[href="/en${AUTHOR.profilePath}"]`)).toBeTruthy();
  });
});
