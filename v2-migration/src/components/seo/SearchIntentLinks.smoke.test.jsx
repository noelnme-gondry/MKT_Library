/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SearchIntentLinks from "@/components/seo/SearchIntentLinks";

const links = [
  { role: "definition", href: "/glossary/uplift", label: "업리프트 뜻과 계산법" },
  { role: "analysis", href: "/tools/incrementality", label: "홀드아웃·전후 증분 분석" },
];

describe("SearchIntentLinks", () => {
  it("역할이 포함된 설명형 앵커를 렌더한다", () => {
    render(<SearchIntentLinks links={links} />);

    expect(screen.getByRole("navigation", { name: "이 주제의 다음 단계" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "핵심 정의 · 업리프트 뜻과 계산법" }).getAttribute("href")).toBe("/glossary/uplift");
    expect(screen.getByRole("link", { name: "직접 분석 · 홀드아웃·전후 증분 분석" }).getAttribute("href")).toBe("/tools/incrementality");
  });

  it("EN 역할과 링크를 같은 구조로 렌더한다", () => {
    render(<SearchIntentLinks locale="en" links={[{ role: "method", href: "/en/blog/uplift-holdout-guide", label: "Measure uplift with a holdout" }]} />);

    expect(screen.getByRole("link", { name: "Measurement method · Measure uplift with a holdout" }).getAttribute("href")).toBe("/en/blog/uplift-holdout-guide");
  });

  it("연결된 검색의도가 없으면 빈 영역을 만들지 않는다", () => {
    const { container } = render(<SearchIntentLinks />);
    expect(container.innerHTML).toBe("");
  });
});
