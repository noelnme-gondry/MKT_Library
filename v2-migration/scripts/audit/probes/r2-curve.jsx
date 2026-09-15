// R2 탐침 — 5-3 예산배분 · 5-22 포화도 × 퇴화 입력 6종.
// 두 도구는 ALLOC_MATH 곡선 엔진을 공유한다. 실행법은 probes/README.md 참조.
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { FIXTURES } from "../../../scripts/audit/degenerate-fixtures.mjs";
import BudgetAllocation from "@/components/tools/BudgetAllocation";
import MarketingEfficiency from "@/components/tools/MarketingEfficiency";

const TOOLS = { "5-3": BudgetAllocation, "5-22": MarketingEfficiency };
const MAPPING = { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions", revenue: "revenue_d7" };

function seed(fx, routeId) {
  const raw = fx.rows.map((r) => Object.fromEntries(fx.headers.map((h, i) => [h, r[i]])));
  const slice = { raw, headers: fx.headers, mapping: MAPPING, fileName: "probe.csv", currency: "KRW" };
  useAppStore.setState({ currentRouteId: routeId, csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
  useAppStore.getState().setGroupAnalyzed(routeId);
  expect(useAppStore.getState().isGroupAnalyzed(routeId)).toBe(true);
}

const BAD = [/Infinity/, /∞/, /NaN/, /undefined/];

describe("R2 · 곡선 엔진 도구 × 퇴화 입력", () => {
  for (const [id, Tool] of Object.entries(TOOLS)) {
    for (const [key, fx] of Object.entries(FIXTURES)) {
      it(`${id} × ${key}`, () => {
        cleanup(); seed(fx, id);
        let threw = null;
        try { render(<Tool />); } catch (e) { threw = e; }
        const t = (document.body.textContent || "").replace(/\s+/g, " ");
        const hits = BAD.filter((re) => re.test(t));
        console.log(`  ${id} × ${key.padEnd(10)} len=${String(t.length).padStart(5)} ${threw ? "THROW: " + threw.message.split("\n")[0] : ""}${hits.length ? " BAD: " + hits.join(" ") : ""}`);
        for (const re of hits) {
          const m = t.match(new RegExp(`.{0,60}${re.source}.{0,60}`));
          if (m) console.log(`      …${m[0]}…`);
        }
        if (!threw && t.length < 400) console.log(`      TEXT: ${t.slice(0, 300)}`);
      });
    }
  }
});
