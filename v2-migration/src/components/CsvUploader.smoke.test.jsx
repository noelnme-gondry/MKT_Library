// @vitest-environment jsdom
//
// Render-smoke for CsvUploader. Regression net for a render throw. CsvUploader
// takes a `toolId` prop (Dashboard mounts it with "5-2") and reads csvData +
// TOOL_REQUIRED/OPTIONAL_FIELDS to render the dropzone (no data) or the mapping
// grid + required-columns table (data present). Both branches must mount.
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import CsvUploader from "@/components/CsvUploader";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// Valid efficiency CSV for 5-2: needs date + one of installs/actions/cost.
// mapping = { originalHeader: standardKey }.
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [];
  for (let d = 1; d <= 10; d++) for (const ch of ["Google", "Meta"]) {
    const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
    raw.push({ Date: `2026-01-${String(d).padStart(2, "0")}`, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: Math.round(cost / (ch === "Google" ? 5000 : 4200)) });
  }
  const slice = { raw, headers, mapping, fileName: "x.csv" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
}

describe("CsvUploader render smoke", () => {
  beforeEach(() => seedNoData());
  it("no-data mounts and auto-loads demo (mapping grid, not dropzone)", () => {
    // 첫 진입(데이터 없음) 시 샘플 데이터 자동 로드 — 빈 드롭존 대신 즉시 매핑그리드/결과.
    expect(() => render(<CsvUploader toolId="5-2" />)).not.toThrow();
    expect(document.querySelector(".mapping-grid")).toBeTruthy();
    expect(document.querySelector(".csv-dropzone")).toBeFalsy();
  });
  it("with-data mounts (mapping grid)", () => {
    seedWithData();
    expect(() => render(<CsvUploader toolId="5-2" />)).not.toThrow();
    expect(document.querySelector(".mapping-grid")).toBeTruthy();
  });
});
