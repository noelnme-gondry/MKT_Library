// R1 임시 탐침 3 — 분모 기준(설치/가입) 토글이 실제로 전 탭에 전파되는가 (§12.18)
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ScorecardTab from "@/components/dashboard/ScorecardTab";
import LtvTab from "@/components/dashboard/LtvTab";
import FunnelTab from "@/components/dashboard/FunnelTab";
import SegmentTab from "@/components/dashboard/SegmentTab";

const TABS = { scorecard: ScorecardTab, ltv: LtvTab, funnel: FunnelTab, segment: SegmentTab };

function seed(basis) {
  const headers = ["date", "channel", "cost", "installs", "actions", "revenue"];
  const raw = [];
  for (let d = 1; d <= 20; d++) {
    const date = `2026-07-${String(d).padStart(2, "0")}`;
    for (const ch of ["google", "meta"]) {
      const cost = ch === "google" ? 100000 + d * 3000 : 80000 + d * 2500;
      // installs와 actions를 10배 차이로 둔다 → 분모가 바뀌면 CPI/CPA가 눈에 띄게 갈린다
      raw.push({ date, channel: ch, cost: String(cost), installs: String(Math.round(cost / 500)),
        actions: String(Math.round(cost / 5000)), revenue: String(cost * 4) });
    }
  }
  const slice = { raw, headers, mapping: { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions", revenue: "revenue_d7" }, fileName: "d.csv", currency: "KRW" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice, denomBasis: basis });
  useAppStore.getState().setGroupAnalyzed("5-2");
  expect(useAppStore.getState().denomBasis).toBe(basis);
}

describe("R1 · 분모 토글 전파", () => {
  for (const [name, Tab] of Object.entries(TABS)) {
    it(name, () => {
      cleanup(); seed("installs");
      render(<Tab />);
      const a = (document.body.textContent || "").replace(/\s+/g, " ");
      cleanup(); seed("actions");
      render(<Tab />);
      const b = (document.body.textContent || "").replace(/\s+/g, " ");
      console.log(`  ${name}: 분모 전환 시 화면 ${a === b ? "동일(전파 안 됨?)" : "변함"} · len ${a.length}/${b.length}`);
      if (a !== b) {
        // 첫 차이 지점 주변을 보여 준다
        let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
        console.log(`     installs: …${a.slice(Math.max(0, i - 30), i + 50)}…`);
        console.log(`     actions : …${b.slice(Math.max(0, i - 30), i + 50)}…`);
      }
    });
  }
});
