// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));

import WorkspaceStoragePage from "@/components/WorkspaceStoragePage";
import { trackProductEvent } from "@/lib/analytics";
import { useAppStore } from "@/store/useDataStore";

const initialCsvGroups = useAppStore.getInitialState().csvGroups;

describe("WorkspaceStoragePage resume journey", () => {
  beforeEach(() => {
    push.mockReset();
    trackProductEvent.mockReset();
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
      csvGroups: initialCsvGroups,
      refreshWorkspaceDatasets: vi.fn(async () => []),
      restoreWorkspaceDatasets: vi.fn(async () => {
        useAppStore.setState((state) => ({
          csvGroups: {
            ...state.csvGroups,
            efficiency: { ...state.csvGroups.efficiency, raw: [{ date: "2026-08-27" }] },
          },
        }));
        return [{ group: "efficiency" }];
      }),
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
    expect(trackProductEvent).toHaveBeenCalledWith("workspace_restore_completed", expect.objectContaining({ state: "success" }));
  });

  it("uses the localized route when the resumed tool supports English", async () => {
    render(<WorkspaceStoragePage locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue analysis" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/start"));
  });

  it("keeps the user on storage when the saved dataset cannot be restored", async () => {
    useAppStore.setState({ restoreWorkspaceDatasets: vi.fn(async () => []) });
    render(<WorkspaceStoragePage />);
    fireEvent.click(screen.getByRole("button", { name: "이어 분석하기" }));

    await waitFor(() => expect(trackProductEvent).toHaveBeenCalledWith("workspace_restore_completed", expect.objectContaining({ state: "failed" })));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "이어 분석하기" }).disabled).toBe(false);
  });
});
