// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";

import DmNudge from "@/components/DmNudge";
import { useAppStore } from "@/store/useDataStore";

describe("DmNudge", () => {
  it("does not describe a real upload as sample data", () => {
    useAppStore.setState({
      csvData: { raw: [{ Date: "2026-01-01" }], fileName: "campaign.csv" },
      currentRouteId: "5-2",
      dmNudgeDismissed: false,
    });

    const { container } = render(<DmNudge />);
    expect(container.querySelector("[data-dm-nudge]")).toBeNull();
  });

  it("shows a compact action-only nudge for demo data", async () => {
    useAppStore.setState({
      csvData: { raw: [{ Date: "2026-01-01" }], fileName: "demo_efficiency.csv" },
      currentRouteId: "5-2",
      dmNudgeDismissed: false,
    });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 401 });

    const { container } = render(<DmNudge />);
    await waitFor(() => expect(container.querySelector("[data-dm-nudge]")).toBeTruthy());
    expect(container.textContent).toContain("내 데이터로 시작하기");
    expect(container.textContent).toContain("데이터 준비를 1:1로 문의");
    expect(container.textContent).not.toContain("지금 화면은 예시 데이터");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });
});
