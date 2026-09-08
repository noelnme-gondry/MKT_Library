// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MarketingEfficiency from "./MarketingEfficiency";

const card = vi.hoisted(() => ({ props: null }));
vi.mock("@/components/ds/ResultActionCard", () => ({ default: (props) => { card.props = props; return null; } }));

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
