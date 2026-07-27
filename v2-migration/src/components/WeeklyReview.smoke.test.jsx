// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WeeklyReview from "@/components/WeeklyReview";

describe("WeeklyReview", () => {
  it("explains the client-only review loop before a CSV is imported", () => {
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "지난 판단을 다음 판단의 근거로" })).toBeTruthy();
    expect(screen.getByText(/브라우저 메모리에서만/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "결정 기록 CSV 불러오기" })).toBeTruthy();
  });

  it("renders all copy in English", () => {
    render(<WeeklyReview locale="en" />);
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    expect(screen.getByRole("button", { name: "Import decision CSV" })).toBeTruthy();
  });
});
