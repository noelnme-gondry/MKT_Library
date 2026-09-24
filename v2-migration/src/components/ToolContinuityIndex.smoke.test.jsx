// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ToolContinuityIndex, { CONTINUITY_LIMIT } from "@/components/ToolContinuityIndex";
import { useAppStore } from "@/store/useDataStore";
import { toolIndexEntry } from "@/lib/toolIndex";

const HEADERS = ["date", "channel", "campaign", "cost", "impressions", "clicks", "installs", "actions", "revenue"];
const MAPPING = {
  date: "date", channel: "channel", campaign: "campaign_name", cost: "cost",
  impressions: "impressions", clicks: "clicks", installs: "installs", actions: "actions", revenue: "revenue",
};
const rows = (count) => Array.from({ length: count }, (_, index) => ({
  date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
  channel: index % 2 ? "Meta" : "Google",
  campaign: index % 2 ? "MT_Prospecting" : "GG_UAC",
  cost: String(100000 + index * 137),
  impressions: String(40000 + index * 91),
  clicks: String(900 + index * 3),
  installs: String(200 + index),
  actions: String(60 + index),
  revenue: String(900000 + index * 811),
}));

const loadCsv = () => {
  const slice = { raw: rows(60), headers: HEADERS, mapping: MAPPING, fileName: "efficiency.csv" };
  useAppStore.setState({ csvData: slice, csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice } });
};

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()));
afterEach(cleanup);

describe("ToolContinuityIndex", () => {
  it("올린 파일이 없으면 목록을 지어내지 않는다", () => {
    // 자격을 모르는 전체 카탈로그를 펴면 "이 데이터로 된다"가 거짓이 된다(§8).
    const { container } = render(<ToolContinuityIndex toolId="5-2" />);
    expect(container.querySelector(".tool-continuity")).toBeNull();
  });

  it("같은 CSV로 이어서 볼 수 있는 분석을 자격 순으로 보여준다", () => {
    loadCsv();
    const { container } = render(<ToolContinuityIndex toolId="5-2" />);
    expect(container.querySelector(".tool-continuity")).toBeTruthy();
    const ready = container.querySelector(".tool-index__stage--ready");
    expect(ready, "효율 CSV면 되는 분석이 하나는 있어야 한다").toBeTruthy();
    expect(ready.querySelectorAll(".tool-index__chip").length).toBeGreaterThan(0);
  });

  it("지금 보고 있는 도구는 어느 묶음에도 넣지 않는다", () => {
    // 자격에서만 빼면 "안 되는 분석"으로 내려가 거짓말이 된다.
    loadCsv();
    const { container } = render(<ToolContinuityIndex toolId="5-2" />);
    const questions = [...container.querySelectorAll(".tool-index__q")].map((node) => node.textContent);
    expect(questions).not.toContain(toolIndexEntry("5-2", "ko").question);
    expect(questions.length).toBeGreaterThan(0);
  });

  it("바로 되는 분석은 3개까지만 펴고 나머지는 전체 목록으로 보낸다", () => {
    // 20개를 전부 펴면 폰에서 결과 아래가 2,000px를 넘었다.
    loadCsv();
    const { container } = render(<ToolContinuityIndex toolId="5-2" />);
    const chips = container.querySelectorAll(".tool-index__stage--ready .tool-index__chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(CONTINUITY_LIMIT);
    expect(container.querySelector(".tool-index__stage--blocked")).toBeNull();
    expect(container.querySelector('.tool-continuity__all[href="/start"]')).toBeTruthy();
  });

  it("EN은 한글 없이 그린다", () => {
    loadCsv();
    const { container } = render(<ToolContinuityIndex toolId="5-2" locale="en" />);
    expect(container.querySelector(".tool-continuity__none")).toBeNull();
    expect(container.querySelector("h2").textContent).not.toMatch(/[가-힣]/);
    expect(container.querySelector(".muted").textContent).not.toMatch(/[가-힣]/);
  });
});
