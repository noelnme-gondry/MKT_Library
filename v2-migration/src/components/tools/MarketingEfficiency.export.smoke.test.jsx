// @vitest-environment jsdom
import { expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MarketingEfficiency from "./MarketingEfficiency";

const card = vi.hoisted(() => ({ props: null, figures: [] }));
vi.mock("@/components/ds/ResultActionCard", () => ({ default: (props) => { card.props = props; return null; } }));

vi.mock("@/components/ds/FigurePngButton", async () => {
  const { useAnalysisExport } = await import("@/lib/analysis-export/AnalysisExportContext");
  return { default: function FigureProbe(props) { card.figures.push({ ...props, context: useAnalysisExport() }); return null; } };
});
beforeEach(() => { useAppStore.setState(useAppStore.getInitialState()); card.figures = []; });

it("exports unbounded saturation without replacing it with a zero-returning formula", () => {
  const raw = Array.from({ length: 12 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, channel: "A", cost: String(1000 + index * 100), installs: "10" }));
  const slice = { raw, headers: Object.keys(raw[0]), mapping: Object.fromEntries(Object.keys(raw[0]).map((key) => [key, key])), fileName: "plateau.csv" };
  useAppStore.getState().setCurrentRouteId("5-22");
  useAppStore.getState().setCsvData(slice);
  useAppStore.getState().setGroupAnalyzed("5-22");
  expect(useAppStore.getState().isGroupAnalyzed("5-22")).toBe(true);
  render(<MarketingEfficiency />);
  const table = card.props.workbookExport().calculationTables[0];
  expect(table.rows[1][7]).toBe("unbounded");
  expect(table.rows[1][8]).toBe("saturated");
  expect(table.rows[1].slice(9)).toEqual([1000, 2100]);
});


it.each(["ko", "en"])("passes download settings and actual scope to card and sibling figures (%s)", (locale) => {
  const raw = Array.from({ length: 12 }, (_, i) => ({ Date: `2026-08-${String(i + 1).padStart(2, "0")}`, Channel: "Meta", Spend: String(1000 + i * 100), Installs: "10" }));
  raw.push({ Date: "2026-08-31", Channel: "Sparse", Spend: "100", Installs: "1" });
  const state = useAppStore.getState();
  state.setCurrentRouteId("5-22");
  state.setCsvData({ raw, headers: ["Date", "Channel", "Spend", "Installs"], mapping: { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" }, fileName: "sat.csv" });
  state.setGroupAnalyzed("5-22");
  useAppStore.setState({
    savedSetupAppliedTool: "5-22", savedSetupAppliedProject: useAppStore.getState().activeProjectId,
    savedSetupAppliedInputs: { recipeSteps: [
      { id: "export.png.none", params: {} },
      { id: "export.filename.toolPeriod", params: {} },
      { id: "export.report.hide", params: { section: "tables" } },
      { id: "export.caveats.exclude", params: {} },
    ] },
  });
  render(<MarketingEfficiency locale={locale} />);
  expect(card.props.exportOptions).toMatchObject({ pngHeader: "none", reportHidden: ["tables"], fileNamePattern: "toolPeriod" });
  const exported = card.props.workbookExport();
  expect(exported.calculationTables[0].rows).toHaveLength(2);
  expect(exported.method.limitations[0]).toMatch(locale === "en" ? /excluded 1 analysis limitation/ : /분석 한계 1건을 제외/);
  expect(exported.method.assumptions.some((line) => line.includes("Sparse") && line.includes("4"))).toBe(true);
  expect(card.props.scopeEvidence.periods[0]).toMatchObject({ start: "2026-08-01", end: "2026-08-12", observations: 12 });
  const figures = card.figures.slice(-3);
  expect(figures).toHaveLength(3);
  for (const figure of figures) {
    expect(figure.context.exportOptions.pngHeader).toBe("none");
    const end = figure.fileName.startsWith("scale_decision") ? "2026-08-31" : "2026-08-12";
    expect(figure.context.figureContext.scope).toMatchObject({ dateStart: "2026-08-01", dateEnd: end });
    expect(figure.context.fileNameFor("png")).toContain(`20260801-${end.replaceAll("-", "")}`);
  }
  // 칩을 지우면 카드 밖 그림의 다운로드도 기본값으로 돌아온다.
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Remove PNG without header" : "PNG에 머리글 넣지 않기 빼기" }));
  expect(card.figures.at(-1).context.exportOptions.pngHeader).toBe("full");
});
