import { render, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import Header from "@/components/Header";
import { useAppStore } from "@/store/useDataStore";

// 테마 동기화 때문에 차트가 없는 콘텐츠 페이지에서도 chart.js를 내려받던 회귀 방지.
const chartImport = vi.hoisted(() => vi.fn());
vi.mock("chart.js/auto", () => {
  chartImport();
  return { default: { instances: {} } };
});

describe("Header theme sync", () => {
  beforeEach(() => {
    chartImport.mockClear();
    document.body.innerHTML = "";
  });

  it("does not pull the chart bundle when the page has no canvas", async () => {
    render(<Header />);
    await act(async () => {
      useAppStore.getState().toggleTheme();
    });
    expect(chartImport).not.toHaveBeenCalled();
  });

  it("still refreshes chart themes when a canvas is mounted", async () => {
    document.body.appendChild(document.createElement("canvas"));
    render(<Header />);
    await act(async () => {
      useAppStore.getState().toggleTheme();
      await Promise.resolve();
    });
    expect(chartImport).toHaveBeenCalled();
  });
});
