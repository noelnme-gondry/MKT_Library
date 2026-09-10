import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useAppStore } from "@/store/useDataStore";
import { useSavedToolInput } from "./useSavedToolInput";
function Inputs() {
  const [budget, setBudget] = useSavedToolInput("5-3", "budget", "");
  return <input aria-label="Budget" value={budget} onChange={event => setBudget(event.target.value)} />;
}
beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
it("captures entered values and applies a saved setup to an already mounted input", async () => {
  render(<Inputs />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "125000" } });
  await waitFor(() => expect(useAppStore.getState().viewConfig["analysis-inputs:5-3"].budget).toBe("125000"));
  act(() => useAppStore.setState({ viewConfig: { "analysis-inputs:5-3": { budget: "250000" } }, savedSetupApplied: 1, savedSetupAppliedTool: "5-3", savedSetupAppliedInputs: { budget: "250000" } }));
  expect(screen.getByRole("textbox").value).toBe("250000");
});
it("ignores incompatible imported shapes", () => {
  useAppStore.setState({ viewConfig: { "analysis-inputs:5-3": { budget: { unsafe: 1 } } } });
  render(<Inputs />); expect(screen.getByRole("textbox").value).toBe("");
});
