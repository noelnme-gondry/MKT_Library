// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DemoNoticeModal from "@/components/DemoNoticeModal";
import { useAppStore } from "@/store/useDataStore";

describe("DemoNoticeModal", () => {
  beforeEach(() => {
    useAppStore.setState({
      csvData: { raw: [{}], headers: ["date"], mapping: {}, fileName: "demo_efficiency.csv" },
      demoNoticeSeen: false,
    });
  });

  it("closes with Escape", () => {
    render(<DemoNoticeModal />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
