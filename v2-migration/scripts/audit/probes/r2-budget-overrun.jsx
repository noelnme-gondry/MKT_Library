import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { FIXTURES } from "../../../scripts/audit/degenerate-fixtures.mjs";
import BudgetAllocation from "@/components/tools/BudgetAllocation";

const MAPPING = { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions", revenue: "revenue_d7" };
function seed(fx, hold) {
  const raw = fx.rows.map((r) => Object.fromEntries(fx.headers.map((h, i) => [h, r[i]])));
  const slice = { raw, headers: fx.headers, mapping: MAPPING, fileName: "probe.csv", currency: "KRW" };
  useAppStore.setState({
    currentRouteId: "5-3", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice,
    savedSetupAppliedTool: "5-3", savedSetupAppliedProject: useAppStore.getState().activeProjectId,
    savedSetupAppliedInputs: { holdLowConfidence: hold }, savedSetupApplied: (useAppStore.getState().savedSetupApplied || 0) + 1,
  });
  useAppStore.getState().setGroupAnalyzed("5-3");
}
const stat = (label) => {
  const el = [...document.querySelectorAll("*")].find((n) => (n.textContent || "").trim().startsWith(label) && ![...n.children].some((c) => (c.textContent || "").includes(label)));
  return el?.parentElement ? (el.parentElement.textContent || "").replace(/\s+/g, " ").slice(0, 46) : "?";
};

describe("R2 · 계획 지출 > 총 예산 — 저신뢰 고정이 원인인가", () => {
  for (const key of ["collinear", "sparse"]) {
    for (const hold of [true, false]) {
      it(`${key} hold=${hold}`, () => {
        cleanup(); seed(FIXTURES[key], hold);
        render(<BudgetAllocation />);
        const budget = [...document.querySelectorAll("input")].map((e) => e.value).find((v) => /^\d{4,}$/.test(v));
        const t = (document.body.textContent || "").replace(/\s+/g, " ");
        const warn = ["초과", "넘습니다", "예산을 넘", "over budget", "예산보다"].filter((w) => t.includes(w));
        console.log(`  ${key} hold=${String(hold).padEnd(5)} 예산=${budget} | ${stat("계획 지출")} | 경고문구: ${warn.length ? warn.join(",") : "없음"}`);
        if (hold) {
          const hi = t.indexOf("현재 지출로 고정");
          if (hi >= 0) console.log(`      고정 안내: …${t.slice(hi, hi + 190)}…`);
        }
        expect(true).toBe(true);
      });
    }
  }
});
