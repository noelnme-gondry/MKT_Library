import { readFileSync } from "node:fs";
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiagnosisWorkbench from "./DiagnosisWorkbench";
import { trackDiagnosis } from "@/lib/trackDiagnosis";

vi.mock("@/lib/trackDiagnosis", () => ({trackDiagnosis:vi.fn()}));
const sample = readFileSync("public/examples/campaign-diagnosis.csv","utf8");
function sampleFetch() {
  vi.spyOn(globalThis,"fetch").mockImplementation(async () => new Response(sample));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("CSV diagnosis workbench", () => {
  it("connects each selected channel/campaign, observation, explanation and action to the same sample", async () => {
    sampleFetch();
    render(<DiagnosisWorkbench locale="en" />);
    await screen.findByRole("complementary", {name:"Example diagnosis"});
    expect(trackDiagnosis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:"Try an example"}));
    await screen.findByText(/Overall CPA rose/);
    expect(screen.getByText("Largest contribution to the CPA increase").parentElement.textContent).toMatch(/Meta.*633/);
    fireEvent.click(screen.getByRole("tab",{name:"CPA drivers"}));
    const mix = screen.getByRole("tabpanel");
    expect(mix.textContent).toMatch(/Meta.*633/);
    expect(mix.textContent).toMatch(/Google.*206/);
    fireEvent.click(screen.getByRole("tab",{name:"Budget allocation"}));
    expect(screen.getByRole("figure",{name:/Spend vs. cost per acquisition/}).textContent).toContain("Meta");
    fireEvent.click(screen.getByRole("button",{name:"Google",exact:true}));
    expect(screen.getByRole("figure",{name:/Spend vs. cost per acquisition/}).textContent).toContain("Google");
    fireEvent.click(screen.getByRole("button",{name:"Search",exact:true}));
    const figure = screen.getByRole("figure",{name:/Spend vs. cost per acquisition/});
    expect(figure.textContent).toContain("Search");
    const options = within(figure).getByRole("combobox");
    fireEvent.change(options,{target:{value:"2026-11-22"}});
    expect(options.value).toBe("2026-11-22");
    fireEvent.click(screen.getByRole("tab",{name:"Organic"}));
    expect(screen.getByRole("tabpanel").textContent).toContain("+5");
    fireEvent.click(screen.getByRole("button",{name:"Review next steps"}));
    fireEvent.click(screen.getByRole("button",{name:"Inspect Meta observations"}));
    expect(screen.getByRole("figure",{name:/Spend vs. cost per acquisition/}).textContent).toContain("Meta");
    expect(trackDiagnosis).toHaveBeenCalledWith("action_open","demo","en");
    expect(trackDiagnosis).toHaveBeenCalledWith("result_view","demo","en");
  });
  it("distinguishes a partial user file from a completed two-period comparison",async () => {
    sampleFetch();
    render(<DiagnosisWorkbench/>);
    const file = new File(["date,channel,cost,installs\n2026-11-09,Only,100,10"],"one-day.csv",{type:"text/csv"});
    fireEvent.change(screen.getByLabelText("진단할 CSV 파일"),{target:{files:[file]}});
    fireEvent.click(await screen.findByRole("button",{name:"이 열로 진단하기"}));
    expect(await screen.findByText("비교에 필요한 정보를 확인해 주세요")).toBeTruthy();
    expect(screen.getByRole("figure",{name:/집행액에 따른 CPA/}).textContent).toContain("Only");
    expect(trackDiagnosis).toHaveBeenCalledWith("result_blocked","upload","ko");
    expect(trackDiagnosis).not.toHaveBeenCalledWith("result_view","upload","ko");
    expect(screen.queryByText("incomplete_period")).toBeNull();
  });
});

it("resumes a confirmed dataset in the planner and clears it on a workspace data reset", async () => {
  const { useAppStore } = await import("@/store/useDataStore");
  useAppStore.setState({ plannerSession: null, plannerGeneration: 0 });
  sampleFetch();
  try {
    const home = render(<DiagnosisWorkbench locale="en" shared />);
    fireEvent.click(screen.getByRole("button", { name: "Try an example" }));
    await screen.findByText(/Overall CPA rose/);
    home.unmount();
    render(<DiagnosisWorkbench locale="en" shared />);
    expect(screen.getByText(/Overall CPA rose/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change CSV" })).toBeTruthy();
    const groups = useAppStore.getState().csvGroups;
    act(() => useAppStore.setState({ csvGroups: { ...groups, efficiency: { ...groups.efficiency, raw: [] } } }));
    expect(useAppStore.getState().plannerSession).toBeNull();
    expect(screen.queryByText(/Overall CPA rose/)).toBeNull();
  } finally {
    useAppStore.setState({ plannerSession: null });
  }
});

it("shows every direction on first results and links a row to its own weekly scatter", async () => {
  sampleFetch();
  render(<DiagnosisWorkbench locale="en" />);
  fireEvent.click(screen.getByRole("button",{name:"Try an example"}));
  const pair = await screen.findByRole("button",{name:"Meta → Google"});
  expect(screen.getByRole("button",{name:"Google → Meta"})).toBeTruthy();
  fireEvent.click(pair);
  const chart = screen.getByRole("figure",{name:/Google · Weekly spend and CPA/});
  const dots = [...chart.querySelectorAll("g[data-week]")];
  expect(dots).toHaveLength(7);
  const costs = dots.map(dot => Number(dot.dataset.cost));
  const low = Math.min(...costs), high = Math.max(...costs);
  for (const dot of dots) {
    const weight = (Number(dot.dataset.cost)-low)/(high-low);
    expect(dot.lastElementChild.tagName).toBe("circle");
    expect(dot.lastElementChild.getAttribute("r")).toBe("3.7");
    expect(dot.lastElementChild.getAttribute("fill")).toBe(`color-mix(in srgb, var(--spend-high) ${100*weight}%, var(--spend-low))`);
    expect(dot.hasAttribute("data-direction")).toBe(false);
  }
  expect(chart.querySelector("[role=tooltip]")).toBeNull();
  expect(chart.textContent).not.toContain("2026-11-22");
  const point = dots.find(dot => dot.dataset.week==="2026-11-22");
  fireEvent.pointerEnter(point);
  expect(screen.getByRole("tooltip").textContent).toMatch(/2026-11-16 – 2026-11-22.*50,000/);
  fireEvent.pointerLeave(point);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focus(point);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.keyDown(point,{key:"Escape"});
  expect(screen.queryByRole("tooltip")).toBeNull();

  fireEvent.click(screen.getByRole("button",{name:"Google → Meta"}));
  expect(screen.getByRole("figure",{name:/Meta · Weekly spend and CPA/})).toBeTruthy();
});
