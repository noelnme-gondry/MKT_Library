// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { useAllocationRecipe } from "./useAllocationRecipe";
import { allocationOptionStep } from "./allocationRecipe";
const csv = { mapping: { country: "country", channel: "channel", campaign: "campaign_name", installs: "installs", revenue: "revenue_d7" } };
afterEach(cleanup);
beforeEach(() => useAppStore.setState(useAppStore.getInitialState()));
it("restores legacy on mount, re-applies while mounted, then persists only steps", async () => {
  useAppStore.setState({ savedSetupAppliedTool: "5-3", savedSetupAppliedProject: useAppStore.getState().activeProjectId, savedSetupAppliedInputs: { budget: "50000", recentDays: 14 } });
  const { result } = renderHook(() => useAllocationRecipe(csv));
  expect(result.current.field("budget")[0]).toBe("50000");
  act(() => useAppStore.setState({ savedSetupApplied: 1, savedSetupAppliedInputs: { budget: "70000", recentDays: 28 } }));
  expect(result.current.field("recentDays")[0]).toBe(28);
  act(() => result.current.field("lowerChartCountries")[1](new Set(["KR"])));
  await waitFor(() => expect(useAppStore.getState().viewConfig["analysis-inputs:5-3"].recipeSteps).toContainEqual(allocationOptionStep("lowerChartCountries", ["KR"])));
  expect(result.current.field("budget")[0]).toBe("70000");
});
it("view/export changes preserve calculation references; account presets preserve local data values", () => {
  const { result } = renderHook(() => useAllocationRecipe(csv));
  act(() => result.current.field("budget")[1]("50000"));
  act(() => result.current.field("selectedCountries")[1](new Set(["KR"])));
  const before = result.current.field("selectedCountries")[0];
  const models = result.current.field("groupModels")[0];
  act(() => result.current.field("lowerChartCountries")[1](new Set(["KR"])));
  expect(result.current.field("selectedCountries")[0]).toBe(before);
  act(() => result.current.applyPreset([{ id: "export.png.title", params: {} }]));
  expect(result.current.field("budget")[0]).toBe("50000");
  expect(result.current.field("groupModels")[0]).toBe(models);
  act(() => result.current.field("budget")[1]("75000"));
  expect(result.current.field("selectedCountries")[0]).toBe(before);
  expect(result.current.field("groupModels")[0]).toBe(models);
  expect(result.current.fold.state.export.pngHeader).toBe("title");
});
it("keeps missing metrics rejected and reapplies them when the column returns", () => {
  const { result, rerender } = renderHook(({ data }) => useAllocationRecipe(data), { initialProps: { data: csv } });
  act(() => result.current.field("objective")[1]("roas"));
  rerender({ data: { mapping: { installs: "installs" } } });
  expect(result.current.field("objective")[0]).toBeNull();
  expect(result.current.fold.rejected[0].code).toBe("METRIC_NOT_SUPPORTED");
  rerender({ data: csv });
  expect(result.current.field("objective")[0]).toBe("roas");
});
