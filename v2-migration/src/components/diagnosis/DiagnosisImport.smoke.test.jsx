import { act, render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiagnosisImport from "./DiagnosisImport";
import { useAppStore } from "@/store/useDataStore";
import { trackDiagnosis } from "@/lib/trackDiagnosis";

vi.mock("@/lib/trackDiagnosis", () => ({trackDiagnosis:vi.fn()}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
describe("browser-only diagnosis intake", () => {
  it("loads only the chosen file, lets the user select a KPI and passes every row downstream", async () => {
    const onData = vi.fn();
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network request"));
    render(<DiagnosisImport onData={onData} />);
    const file = new File(["date,channel,cost,installs,purchases\n2026-11-09,Meta,100,12,0\n2026-11-16,Meta,200,14,"], "sensitive-customer.csv", {type:"text/csv"});
    fireEvent.change(screen.getByLabelText("진단할 CSV 파일"), {target:{files:[file]}});
    const outcome = await screen.findByLabelText("성과 건수");
    expect(outcome.value).toBe("");
    fireEvent.change(outcome,{target:{value:"purchases"}});
    fireEvent.click(screen.getByText("이 열로 진단하기"));
    await waitFor(() => expect(onData).toHaveBeenCalledTimes(1));
    expect(onData.mock.calls[0][0]).toMatchObject([{result:0}, {result:null}]);
    expect(onData.mock.calls[0][1]).toMatchObject({source:"file",resultLabel:"purchases"});
    expect(network).not.toHaveBeenCalled();
    expect(trackDiagnosis.mock.calls).toEqual([["file_selected","upload","ko"],["mapping_success","upload","ko"]]);
    fireEvent.click(screen.getByRole("button",{name:"열 연결 수정"}));
    expect(screen.getByLabelText("성과 건수").value).toBe("purchases");
  });
  it("lets the reader choose a platform before comparing duplicated market totals", async () => {
    const onData=vi.fn();
    render(<DiagnosisImport locale="en" onData={onData}/>);
    const file=new File(["week,channel,cost,installs,market,platform,organic\n2026-W46,Meta,10,2,KR,iOS,7\n2026-W46,Meta,20,3,KR,Android,7"], "platforms.csv");
    fireEvent.change(screen.getByLabelText("CSV file to diagnose"), {target:{files:[file]}});
    fireEvent.change(await screen.findByLabelText("Platform scope"), {target:{value:"iOS"}});
    fireEvent.click(screen.getByRole("button", {name:"Diagnose this CSV"}));
    await waitFor(() => expect(onData).toHaveBeenCalledTimes(1));
    expect(onData.mock.calls[0][0]).toMatchObject([{platform:"iOS",organic:7}]);
    expect(screen.getByText(/1 of 2 rows selected/)).toBeTruthy();
  });
  it("keeps shared intake disabled while the saved project is being restored", () => {
    const before = useAppStore.getState();
    useAppStore.setState({ decisionPersistenceEnabled: true, projectsReady: false, projectSwitching: true, projectError: null });
    try {
      render(<DiagnosisImport locale="en" shared onData={vi.fn()} />);
      const upload = screen.getByRole("button", { name: "Diagnose my CSV" });
      const demo = screen.getByRole("button", { name: "Try an example" });
      expect(upload.disabled).toBe(true);
      expect(demo.disabled).toBe(true);
      act(() => useAppStore.setState({ projectsReady: true, projectSwitching: false }));
      expect(upload.disabled).toBe(false);
      expect(demo.disabled).toBe(false);
    } finally {
      cleanup();
      useAppStore.setState(before);
    }
  });
  it("separates the example from uploaded data in event parameters", async () => {
    const onData=vi.fn();
    const fetch=vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("date,channel,cost,installs\n2026-11-09,Meta,100,10"));
    render(<DiagnosisImport locale="en" initialExample onData={onData}/>);
    await waitFor(() => expect(onData).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/examples/campaign-diagnosis.csv");
    expect(trackDiagnosis.mock.calls).toEqual([["example_open","demo","en"],["mapping_success","demo","en"]]);
  });
});
