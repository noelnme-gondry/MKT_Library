// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import StartGate from "@/components/StartGate";

describe("StartGate render smoke", () => {
  beforeEach(() => {
    useAppStore.setState({ demoDisabled: false });
  });

  it("mounts + sets demoDisabled(true) + lists tools", () => {
    expect(() => render(<StartGate />)).not.toThrow();
    // 진입 시 데모 자동로드 억제 플래그 on.
    expect(useAppStore.getState().demoDisabled).toBe(true);
    // 도구 카드(질문/제목) 최소 1개.
    expect(document.querySelectorAll(".phase-card").length).toBeGreaterThan(0);
    expect(screen.getByText(/데이터부터 살펴볼게요/)).toBeTruthy();
    expect(document.querySelector('a[href="/diagnose"]')).toBeTruthy();
  });

  it("startMyData clears demo-loaded groups only (real uploads kept)", () => {
    useAppStore.setState({
      csvGroups: {
        ...useAppStore.getState().csvGroups,
        efficiency: { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "demo_efficiency.csv" },
        aha: { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "my_real.csv" },
      },
    });
    useAppStore.getState().startMyData();
    const g = useAppStore.getState().csvGroups;
    expect(g.efficiency.raw.length).toBe(0); // 데모 → 비움
    expect(g.aha.raw.length).toBe(1); // 실제 업로드 → 보존
  });
});
