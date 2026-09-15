// R1 임시 탐침 — 5-2 탭 9개 × 퇴화 입력 6종. 화면에 거짓 숫자가 뜨는가.
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { FIXTURES } from "../../../scripts/audit/degenerate-fixtures.mjs";
import VizTab from "@/components/dashboard/VizTab";
import ScorecardTab from "@/components/dashboard/ScorecardTab";
import PacingTab from "@/components/dashboard/PacingTab";
import AnomalyTab from "@/components/dashboard/AnomalyTab";
import SeasonalityTab from "@/components/dashboard/SeasonalityTab";
import LtvTab from "@/components/dashboard/LtvTab";
import CohortTab from "@/components/dashboard/CohortTab";
import FunnelTab from "@/components/dashboard/FunnelTab";
import SegmentTab from "@/components/dashboard/SegmentTab";

const TABS = { viz: VizTab, scorecard: ScorecardTab, pacing: PacingTab, anomaly: AnomalyTab,
  seasonality: SeasonalityTab, ltv: LtvTab, cohort: CohortTab, funnel: FunnelTab, segment: SegmentTab };

const MAPPING = { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions", revenue: "revenue_d7" };

function seed(fx) {
  const raw = fx.rows.map((r) => Object.fromEntries(fx.headers.map((h, i) => [h, r[i]])));
  const slice = { raw, headers: fx.headers, mapping: MAPPING, fileName: "probe.csv" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
  useAppStore.getState().setGroupAnalyzed("5-2");
}

// 화면에 뜨면 안 되는 문자열. "Infinity"는 toLocaleString이 "∞"로 내기도 한다.
const BAD = [/Infinity/, /∞/, /NaN/, /undefined/, /\bnull\b/, /-0\.00/];

describe("R1 · 5-2 탭 × 퇴화 입력", () => {
  beforeEach(() => cleanup());
  for (const [fxKey, fx] of Object.entries(FIXTURES)) {
    for (const [tabName, Tab] of Object.entries(TABS)) {
      it(`${tabName} × ${fxKey}(${fx.name})`, () => {
        seed(fx);
        let threw = null;
        try { render(<Tab />); } catch (e) { threw = e; }
        const text = document.body.textContent || "";
        const hits = BAD.filter((re) => re.test(text)).map((re) => String(re));
        if (threw || hits.length) {
          console.log(`\n### ${tabName} × ${fxKey}`);
          if (threw) console.log(`  THROW: ${threw.message.split("\n")[0]}`);
          if (hits.length) {
            console.log(`  BAD: ${hits.join(" ")}`);
            for (const re of BAD) {
              const m = text.match(new RegExp(`.{0,45}${re.source}.{0,45}`));
              if (m) console.log(`    …${m[0]}…`);
            }
          }
        }
        if (fxKey === "sparse" && (tabName === "scorecard" || tabName === "segment")) {
          console.log(`FULL ${tabName}: ${text.replace(/\s+/g, " ")}`);
        }
        expect(true).toBe(true);
      });
    }
  }
});
