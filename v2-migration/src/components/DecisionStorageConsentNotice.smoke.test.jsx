// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const download = vi.hoisted(() => ({ csv: vi.fn() }));
vi.mock("@/utils/download", () => ({ downloadCsv: download.csv }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));

import DecisionStorageConsentNotice from "@/components/DecisionStorageConsentNotice";
import { useAppStore } from "@/store/useDataStore";

describe("DecisionStorageConsentNotice", () => {
  beforeEach(() => {
    download.csv.mockReset();
    useAppStore.setState({
      decisionPersistenceEnabled: false,
      decisionPersistencePreferenceSet: false,
      decisionRecords: [{ id: "d1", toolId: "5-2", action: "예산 유지" }],
      setDecisionPersistenceEnabled: useAppStore.getInitialState().setDecisionPersistenceEnabled,
    });
  });

  it("keeps migrated records visible until the expanded storage choice is explicit", () => {
    render(<DecisionStorageConsentNotice />);
    expect(screen.getByText("기기 저장 범위를 다시 확인해 주세요")).toBeTruthy();
    expect(screen.getByText(/결정 기록 1개는 삭제하지 않고 보존/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "먼저 CSV 내보내기" }));
    expect(download.csv).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "이번 세션만 유지" }));
    expect(useAppStore.getState().decisionPersistencePreferenceSet).toBe(true);
    expect(useAppStore.getState().decisionRecords).toHaveLength(1);
    expect(screen.queryByText("기기 저장 범위를 다시 확인해 주세요")).toBeNull();
  });

  it("accepts the new scope in English", () => {
    render(<DecisionStorageConsentNotice locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Keep files and records" }));
    expect(useAppStore.getState().decisionPersistenceEnabled).toBe(true);
    expect(useAppStore.getState().decisionPersistencePreferenceSet).toBe(true);
  });
});
