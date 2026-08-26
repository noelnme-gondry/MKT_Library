// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import WorkspaceStoragePage from "@/components/WorkspaceStoragePage";
import { useAppStore } from "@/store/useDataStore";

describe("WorkspaceStoragePage resume journey", () => {
  beforeEach(() => {
    push.mockReset();
    useAppStore.setState({
      decisionPersistenceEnabled: true,
      workspaceDatasetSummaries: [{
        group: "efficiency",
        fileName: "campaign.csv",
        rowCount: 24,
        byteSize: 2048,
        lastUsedAt: "2026-08-27T00:00:00.000Z",
        remainingDays: 90,
      }],
      workspaceExpiredCount: 0,
      workspaceStorageError: null,
      refreshWorkspaceDatasets: vi.fn(async () => []),
      restoreWorkspaceDatasets: vi.fn(async () => []),
      removeWorkspaceDataset: vi.fn(async () => true),
      clearWorkspaceDatasets: vi.fn(async () => true),
      setDecisionPersistenceEnabled: vi.fn(),
    });
  });

  it("restores a saved dataset before returning to the Dochi start route", async () => {
    render(<WorkspaceStoragePage />);
    fireEvent.click(screen.getByRole("button", { name: "이어 분석하기" }));

    await waitFor(() => expect(useAppStore.getState().restoreWorkspaceDatasets).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/start");
    expect(screen.getByText("campaign.csv")).toBeTruthy();
  });

  it("uses the localized route when the resumed tool supports English", async () => {
    render(<WorkspaceStoragePage locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue analysis" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/start"));
  });
});
