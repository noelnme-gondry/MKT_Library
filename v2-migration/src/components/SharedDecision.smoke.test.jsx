import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SharedDecision from "@/components/SharedDecision";
import { encodeSharePayload } from "@/lib/decisionShare";

const searchParams = { value: new URLSearchParams() };

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual("next/navigation");
  return { ...actual, useSearchParams: () => searchParams.value };
});

const setToken = (token) => {
  searchParams.value = new URLSearchParams(token ? { d: token } : {});
};

describe("SharedDecision", () => {
  it("renders the shared conclusion, figures, and evidence", async () => {
    setToken(encodeSharePayload({
      toolId: "5-3",
      toolTitle: "예산 배분",
      headline: "검색 일반 키워드 예산을 10% 줄이세요.",
      points: [{ text: "한계 CPA가 평균의 1.8배" }],
      stats: [{ label: "이동 예산", value: "₩3,200,000" }],
      locale: "ko",
    }));
    render(<SharedDecision locale="ko" />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain("검색 일반 키워드 예산을 10% 줄이세요.");
    expect(screen.getByText("₩3,200,000")).toBeTruthy();
    expect(screen.getByText("한계 CPA가 평균의 1.8배")).toBeTruthy();
    expect(screen.getByRole("link", { name: /같은 분석 내 데이터로/ }).getAttribute("href")).toBe("/tools/budget-allocation");
  });

  it("keeps an honest empty state for a broken token instead of a blank page", async () => {
    setToken("tampered!!");
    render(<SharedDecision locale="ko" />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain("공유 링크가 유효하지 않습니다");
    expect(screen.getByRole("link", { name: /내 CSV로 시작/ }).getAttribute("href")).toBe("/start");
  });

  it("localizes the English receiver view", async () => {
    setToken(encodeSharePayload({
      toolId: "5-2",
      headline: "Cut wasted search spend first.",
      locale: "en",
    }));
    render(<SharedDecision locale="en" />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain("Cut wasted search spend first.");
    expect(screen.getByRole("link", { name: /Run this analysis/ }).getAttribute("href")).toBe("/en/dashboard");
  });
});
